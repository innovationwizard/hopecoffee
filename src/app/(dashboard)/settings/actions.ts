"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  ConflictError,
  hashPassword,
  requireAuth,
  requirePermission,
} from "@/lib/services/auth";
import { createAuditLog } from "@/lib/services/audit";
import { diffRoles } from "@/lib/services/user-roles-diff";
import {
  ExportCostConfigSchema,
  ExchangeRateSchema,
  UpdateUserRolesSchema,
  UserCreateSchema,
} from "@/lib/validations/schemas";
import type {
  ExportCostConfigInput,
  ExchangeRateInput,
  UpdateUserRolesInput,
  UserCreateInput,
} from "@/lib/validations/schemas";

// --- Exchange Rates ---

export async function getExchangeRates() {
  await requireAuth();
  return prisma.exchangeRate.findMany({
    orderBy: { validFrom: "desc" },
  });
}

export async function createExchangeRate(data: ExchangeRateInput) {
  const session = await requirePermission("exchange_rate:write");
  const validated = ExchangeRateSchema.parse(data);

  const rate = await prisma.exchangeRate.create({
    data: {
      ...validated,
      isActive: true,
    },
  });

  await createAuditLog(
    session.userId,
    "CREATE",
    "ExchangeRate",
    rate.id,
    null,
    validated
  );

  revalidatePath("/settings/exchange-rates");
  return rate;
}

// --- Export Cost Configs ---

export async function getExportCostConfigs() {
  await requireAuth();
  return prisma.exportCostConfig.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function createExportCostConfig(data: ExportCostConfigInput) {
  const session = await requirePermission("export_cost:write");
  const validated = ExportCostConfigSchema.parse(data);

  if (validated.isDefault) {
    await prisma.exportCostConfig.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }

  const config = await prisma.exportCostConfig.create({
    data: validated,
  });

  await createAuditLog(
    session.userId,
    "CREATE",
    "ExportCostConfig",
    config.id,
    null,
    validated
  );

  revalidatePath("/settings/export-costs");
  return config;
}

export async function updateExportCostConfig(
  data: ExportCostConfigInput & { id: string }
) {
  const session = await requirePermission("export_cost:write");
  const { id, ...rest } = data;
  const validated = ExportCostConfigSchema.parse(rest);

  if (validated.isDefault) {
    await prisma.exportCostConfig.updateMany({
      where: { isDefault: true, id: { not: id } },
      data: { isDefault: false },
    });
  }

  const old = await prisma.exportCostConfig.findUniqueOrThrow({
    where: { id },
  });

  await prisma.exportCostConfig.update({
    where: { id },
    data: validated,
  });

  await createAuditLog(
    session.userId,
    "UPDATE",
    "ExportCostConfig",
    id,
    old,
    validated
  );

  revalidatePath("/settings/export-costs");
}

// --- Users ---

export async function getUsers() {
  await requirePermission("user:manage");
  return prisma.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      roleAssignments: {
        select: { role: true },
      },
    },
  });
}

export async function createUser(data: UserCreateInput) {
  const session = await requirePermission("user:manage");
  const validated = UserCreateSchema.parse(data);

  const hashed = await hashPassword(validated.password);

  let user;
  try {
    user = await prisma.user.create({
      data: {
        email: validated.email,
        name: validated.name,
        passwordHash: hashed,
        roleAssignments: {
          create: validated.roles.map((role) => ({
            role,
            assignedBy: session.userId,
          })),
        },
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new ConflictError("Ya existe un usuario con ese correo");
    }
    throw err;
  }

  await createAuditLog(
    session.userId,
    "CREATE",
    "User",
    user.id,
    null,
    { email: validated.email, name: validated.name, roles: validated.roles }
  );

  revalidatePath("/settings/users");
  return user;
}

export async function getUser(id: string) {
  await requirePermission("user:manage");
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      roleAssignments: {
        select: { role: true },
      },
    },
  });
}

export async function updateUserRoles(input: UpdateUserRolesInput) {
  const session = await requirePermission("user:manage");
  const validated = UpdateUserRolesSchema.parse(input);
  const { userId, roles: requested } = validated;

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { roleAssignments: { select: { role: true } } },
  });
  const current = user.roleAssignments.map((ra) => ra.role);

  const { toRemove, toAdd } = diffRoles(current, requested);

  if (toRemove.length === 0 && toAdd.length === 0) {
    return;
  }

  // Atomic: role mutations and audit log commit together — partial state would
  // make the audit trail lie about who currently holds which role.
  await prisma.$transaction([
    ...(toRemove.length > 0
      ? [
          prisma.userRoleAssignment.deleteMany({
            where: { userId, role: { in: toRemove } },
          }),
        ]
      : []),
    ...(toAdd.length > 0
      ? [
          prisma.userRoleAssignment.createMany({
            data: toAdd.map((role) => ({
              userId,
              role,
              assignedBy: session.userId,
            })),
          }),
        ]
      : []),
    prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "UPDATE",
        entity: "User.roles",
        entityId: userId,
        oldValue: { roles: [...current].sort() },
        newValue: { roles: [...requested].sort() },
      },
    }),
  ]);

  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${userId}/edit`);
}

export async function toggleUserActive(userId: string) {
  const session = await requirePermission("user:manage");

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: !user.isActive },
  });

  await createAuditLog(
    session.userId,
    "UPDATE",
    "User",
    userId,
    { isActive: user.isActive },
    { isActive: !user.isActive }
  );

  revalidatePath("/settings/users");
}

// --- Audit Log ---

export async function getAuditLogs(page = 1, limit = 50) {
  await requirePermission("audit_log:view");

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.auditLog.count(),
  ]);

  return { entries, total, pages: Math.ceil(total / limit) };
}
