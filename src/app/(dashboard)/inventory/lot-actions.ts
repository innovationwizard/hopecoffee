"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/services/auth";
import { createAuditLog } from "@/lib/services/audit";
import { LotCreateSchema } from "@/lib/validations/schemas";
import { generateLotNumber } from "@/lib/services/correlatives";
import type { z } from "zod";
import type { Prisma } from "@prisma/client";

type LotInput = z.infer<typeof LotCreateSchema>;

interface LotFilters {
  facilityId?: string;
  supplierId?: string;
  stage?: string;
  search?: string;
}

export async function getLots(filters?: LotFilters) {
  await requireAuth();

  const where: Prisma.LotWhereInput = {};

  if (filters?.facilityId) where.facilityId = filters.facilityId;
  if (filters?.supplierId) where.supplierId = filters.supplierId;
  if (filters?.stage) where.stage = filters.stage as Prisma.EnumLotStageFilter["equals"];
  if (filters?.search) {
    where.OR = [
      { lotNumber: { contains: filters.search, mode: "insensitive" } },
      { qualityGrade: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return prisma.lot.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      supplier: { select: { id: true, name: true } },
      facility: { select: { id: true, name: true } },
    },
  });
}

export async function getLot(id: string) {
  await requireAuth();
  return prisma.lot.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true } },
      facility: { select: { id: true, name: true } },
      cuppingRecords: { orderBy: { date: "desc" } },
      contractLotAllocations: {
        include: {
          contract: { select: { id: true, contractNumber: true } },
        },
      },
    },
  });
}

export async function getLotBalances() {
  await requireAuth();

  const groups = await prisma.lot.groupBy({
    by: ["stage"],
    _sum: { quantityQQ: true },
    _count: true,
  });

  const balances: Record<string, { totalQQ: number; count: number }> = {};
  for (const g of groups) {
    balances[g.stage] = {
      totalQQ: Number(g._sum.quantityQQ ?? 0),
      count: g._count,
    };
  }

  return balances;
}

export async function createLot(data: LotInput) {
  const session = await requirePermission("lot:write");
  const validated = LotCreateSchema.parse(data);
  const lotNumber = await generateLotNumber();

  const lot = await prisma.lot.create({
    data: {
      ...validated,
      lotNumber,
    },
  });

  await createAuditLog(
    session.userId,
    "CREATE",
    "Lot",
    lot.id,
    null,
    { ...validated, lotNumber }
  );

  revalidatePath("/inventory");
  return lot;
}

export async function updateLot(data: LotInput & { id: string }) {
  const session = await requirePermission("lot:write");
  const { id, ...fields } = data;
  const validated = LotCreateSchema.parse(fields);

  const old = await prisma.lot.findUniqueOrThrow({ where: { id } });

  const lot = await prisma.lot.update({
    where: { id },
    data: validated,
  });

  await createAuditLog(
    session.userId,
    "UPDATE",
    "Lot",
    id,
    old,
    validated
  );

  revalidatePath("/inventory");
  return lot;
}
