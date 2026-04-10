"use server";

import { revalidatePath } from "next/cache";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/services/auth";
import { createAuditLog } from "@/lib/services/audit";
import { CuppingRecordCreateSchema } from "@/lib/validations/schemas";
import type { CuppingRecordCreateInput } from "@/lib/validations/schemas";

// ---------------------------------------------------------------------------
// CUPPING RECORDS
// ---------------------------------------------------------------------------

interface CuppingFilters {
  lotId?: string;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
  scoreMin?: number;
  scoreMax?: number;
}

export async function getCuppingRecords(filters?: CuppingFilters) {
  await requireAuth();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (filters?.lotId) {
    where.lotId = filters.lotId;
  }
  if (filters?.supplierId) {
    where.lot = { supplierId: filters.supplierId };
  }
  if (filters?.dateFrom || filters?.dateTo) {
    where.date = {};
    if (filters.dateFrom) where.date.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.date.lte = new Date(filters.dateTo);
  }
  if (filters?.scoreMin !== undefined || filters?.scoreMax !== undefined) {
    where.totalScore = {};
    if (filters.scoreMin !== undefined) where.totalScore.gte = filters.scoreMin;
    if (filters.scoreMax !== undefined) where.totalScore.lte = filters.scoreMax;
  }

  return prisma.cuppingRecord.findMany({
    where,
    include: {
      lot: {
        include: {
          supplier: { select: { id: true, name: true } },
          facility: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { date: "desc" },
  });
}

export async function getCuppingRecord(id: string) {
  await requireAuth();

  return prisma.cuppingRecord.findUniqueOrThrow({
    where: { id },
    include: {
      lot: {
        include: {
          supplier: { select: { id: true, name: true } },
          facility: { select: { id: true, name: true } },
        },
      },
      yieldAdjustments: {
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

const SCA_FIELDS = [
  "fragrance",
  "flavor",
  "aftertaste",
  "acidity",
  "body",
  "balance",
  "uniformity",
  "cleanCup",
  "sweetness",
  "overall",
] as const;

const ADJUSTMENT_RATE_PER_POINT = 50; // Q per point of yield difference

export async function createCuppingRecord(data: CuppingRecordCreateInput) {
  const session = await requirePermission("cupping:write");
  const validated = CuppingRecordCreateSchema.parse(data);

  // 1. Compute total score
  const totalScore = SCA_FIELDS.reduce(
    (sum, field) => sum.plus(new Decimal(validated[field])),
    new Decimal(0)
  );

  // 2. Create cupping record
  const record = await prisma.cuppingRecord.create({
    data: {
      lotId: validated.lotId,
      catadorUserId: validated.catadorUserId ?? null,
      date: validated.date,
      fragrance: validated.fragrance,
      flavor: validated.flavor,
      aftertaste: validated.aftertaste,
      acidity: validated.acidity,
      body: validated.body,
      balance: validated.balance,
      uniformity: validated.uniformity,
      cleanCup: validated.cleanCup,
      sweetness: validated.sweetness,
      overall: validated.overall,
      totalScore: totalScore.toNumber(),
      moisturePercent: validated.moisturePercent ?? null,
      defectCount: validated.defectCount ?? null,
      screenSize: validated.screenSize ?? null,
      waterActivity: validated.waterActivity ?? null,
      yieldMeasured: validated.yieldMeasured ?? null,
      purchaseOrderId: validated.purchaseOrderId ?? null,
      notes: validated.notes ?? null,
    },
  });

  // 3. Update lot's cupping score and actual yield
  await prisma.lot.update({
    where: { id: validated.lotId },
    data: {
      cuppingScore: totalScore.toNumber(),
      ...(validated.yieldMeasured != null
        ? { actualYield: validated.yieldMeasured }
        : {}),
    },
  });

  // 4. Check yield tolerance and auto-create adjustment if needed
  if (validated.yieldMeasured != null) {
    const lot = await prisma.lot.findUniqueOrThrow({
      where: { id: validated.lotId },
    });

    if (lot.contractedYield != null) {
      const contractedYield = new Decimal(lot.contractedYield.toString());
      const actualYield = new Decimal(validated.yieldMeasured);
      const diff = actualYield.minus(contractedYield).abs();

      // Get tolerance config
      const toleranceConfig = await prisma.yieldToleranceConfig.findFirst({
        orderBy: { updatedAt: "desc" },
      });
      const tolerance = toleranceConfig
        ? new Decimal(toleranceConfig.toleranceValue.toString())
        : new Decimal("0.01");

      if (diff.greaterThan(tolerance)) {
        const yieldDiff = actualYield.minus(contractedYield);
        const priceAdjPerQQ = yieldDiff.times(ADJUSTMENT_RATE_PER_POINT);
        const totalAdj = priceAdjPerQQ.times(
          new Decimal(lot.quantityQQ.toString())
        );

        await prisma.yieldAdjustment.create({
          data: {
            cuppingRecordId: record.id,
            contractedYield: contractedYield.toNumber(),
            actualYield: actualYield.toNumber(),
            toleranceApplied: tolerance.toNumber(),
            priceAdjustmentPerQQ: priceAdjPerQQ.toNumber(),
            totalAdjustment: totalAdj.toNumber(),
            status: "PENDIENTE",
          },
        });
      }
    }
  }

  // 5. Audit
  await createAuditLog(
    session.userId,
    "CREATE",
    "CuppingRecord",
    record.id,
    null,
    validated
  );

  revalidatePath("/quality-lab");
  return record;
}

export async function deleteCuppingRecord(id: string) {
  const session = await requirePermission("cupping:write");

  const existing = await prisma.cuppingRecord.findUniqueOrThrow({
    where: { id },
    include: { yieldAdjustments: true },
  });

  // Delete pending yield adjustments
  await prisma.yieldAdjustment.deleteMany({
    where: {
      cuppingRecordId: id,
      status: "PENDIENTE",
    },
  });

  await prisma.cuppingRecord.delete({ where: { id } });

  await createAuditLog(
    session.userId,
    "DELETE",
    "CuppingRecord",
    id,
    existing,
    null
  );

  revalidatePath("/quality-lab");
}

// ---------------------------------------------------------------------------
// YIELD ADJUSTMENTS
// ---------------------------------------------------------------------------

export async function getYieldAdjustments(status?: string) {
  await requireAuth();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (status) where.status = status;

  return prisma.yieldAdjustment.findMany({
    where,
    include: {
      cuppingRecord: {
        include: {
          lot: {
            include: {
              supplier: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function applyYieldAdjustment(id: string) {
  const session = await requirePermission("yield_adjustment:write");

  const existing = await prisma.yieldAdjustment.findUniqueOrThrow({
    where: { id },
  });

  const updated = await prisma.yieldAdjustment.update({
    where: { id },
    data: {
      status: "APLICADO",
      appliedAt: new Date(),
      appliedByUserId: session.userId,
    },
  });

  await createAuditLog(
    session.userId,
    "UPDATE",
    "YieldAdjustment",
    id,
    { status: existing.status },
    { status: "APLICADO" }
  );

  revalidatePath("/quality-lab");
  revalidatePath("/quality-lab/adjustments");
  return updated;
}

export async function rejectYieldAdjustment(id: string) {
  const session = await requirePermission("yield_adjustment:write");

  const existing = await prisma.yieldAdjustment.findUniqueOrThrow({
    where: { id },
  });

  const updated = await prisma.yieldAdjustment.update({
    where: { id },
    data: { status: "RECHAZADO" },
  });

  await createAuditLog(
    session.userId,
    "UPDATE",
    "YieldAdjustment",
    id,
    { status: existing.status },
    { status: "RECHAZADO" }
  );

  revalidatePath("/quality-lab");
  revalidatePath("/quality-lab/adjustments");
  return updated;
}

// ---------------------------------------------------------------------------
// YIELD TOLERANCE CONFIG
// ---------------------------------------------------------------------------

export async function getYieldTolerance() {
  await requireAuth();

  return prisma.yieldToleranceConfig.findFirst({
    orderBy: { updatedAt: "desc" },
  });
}

export async function updateYieldTolerance(value: number) {
  const session = await requirePermission("yield_adjustment:write");

  const existing = await prisma.yieldToleranceConfig.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  let result;
  if (existing) {
    result = await prisma.yieldToleranceConfig.update({
      where: { id: existing.id },
      data: {
        toleranceValue: value,
        updatedByUserId: session.userId,
      },
    });
  } else {
    result = await prisma.yieldToleranceConfig.create({
      data: {
        toleranceValue: value,
        updatedByUserId: session.userId,
      },
    });
  }

  await createAuditLog(
    session.userId,
    "UPDATE",
    "YieldToleranceConfig",
    result.id,
    existing ? { toleranceValue: existing.toleranceValue } : null,
    { toleranceValue: value }
  );

  revalidatePath("/quality-lab");
  return result;
}

// ---------------------------------------------------------------------------
// HELPERS (for server components)
// ---------------------------------------------------------------------------

export async function getLotsForCupping() {
  await requireAuth();

  return prisma.lot.findMany({
    where: {
      stage: { in: ["PERGAMINO_BODEGA", "EN_PROCESO"] },
    },
    include: {
      supplier: { select: { id: true, name: true } },
    },
    orderBy: { lotNumber: "asc" },
  });
}

export async function getCuppingStats() {
  await requireAuth();

  const [totalRecords, avgScore, lotsWithoutCupping] = await Promise.all([
    prisma.cuppingRecord.count(),
    prisma.cuppingRecord.aggregate({
      _avg: { totalScore: true },
    }),
    prisma.lot.count({
      where: {
        stage: { in: ["PERGAMINO_BODEGA", "EN_PROCESO"] },
        cuppingRecords: { none: {} },
      },
    }),
  ]);

  return {
    totalRecords,
    avgScore: avgScore._avg.totalScore
      ? Number(avgScore._avg.totalScore)
      : null,
    lotsWithoutCupping,
  };
}
