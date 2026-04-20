"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/services/auth";
import { createAuditLog } from "@/lib/services/audit";
import {
  ExportCostConfigSchema,
  ExchangeRateSchema,
  UserCreateSchema,
} from "@/lib/validations/schemas";
import { hashPassword } from "@/lib/services/auth";
import type {
  ExportCostConfigInput,
  ExchangeRateInput,
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

  const user = await prisma.user.create({
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
