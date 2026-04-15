"use server";

import { revalidatePath } from "next/cache";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/services/auth";
import { createAuditLog } from "@/lib/services/audit";
import { recalculateShipment } from "@/lib/services/shipment-aggregation";
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

/**
 * Apply a pending YieldAdjustment, closing the quality-lab → financial loop.
 *
 * This is the "plum" moment Hector asked for in hector.txt line 15–17:
 * applying an adjustment must propagate through the supplier ledger and the
 * margin calculation, not just flip a status. See docs/quality-lab-wiring-audit.md
 * for the full audit and rationale.
 *
 * Behavior:
 *
 *   1. Flips `YieldAdjustment.status` to `APLICADO` and records who / when.
 *
 *   2. Creates a new `SupplierAccountEntry` recording the price delta against
 *      the same supplier + lot. The new entry uses `orderCode = "ADJ-<id>"`
 *      (distinguishable from regular bodega receipts) and carries the full
 *      `totalAdjustment` in `total`. pergamino = 0 because no physical coffee
 *      moved — this is a pure price delta. The new entry's id is written back
 *      to `YieldAdjustment.supplierAccountEntryId` so the link is
 *      bidirectionally traceable for auditing.
 *
 *   3. Best-effort materia prima cost update: if the lot has an active
 *      `ContractLotAllocation`, resolves the chain
 *      Lot → ContractLotAllocation → Contract → MateriaPrimaAllocation →
 *      MateriaPrima and adjusts the MP row's `totalMP` by `totalAdjustment`.
 *      After the MP mutation, `recalculateShipment` is called on the affected
 *      shipment so the stored aggregates stay consistent. If the chain does
 *      not resolve (the lot is not yet allocated to a contract, or the
 *      contract has no MP allocation), the MP update is skipped and a WARN
 *      is written to the audit log — the adjustment still reaches the
 *      supplier ledger via step 2, so accounting can trace it manually.
 *
 *   4. All three mutations are wrapped in a single Prisma transaction.
 *      Either all happen or all roll back. Shipment re-aggregation happens
 *      after the transaction commits because `recalculateShipment` uses the
 *      global prisma client.
 */
export async function applyYieldAdjustment(id: string) {
  const session = await requirePermission("yield_adjustment:write");

  const existing = await prisma.yieldAdjustment.findUniqueOrThrow({
    where: { id },
    include: {
      cuppingRecord: {
        include: { lot: true },
      },
    },
  });

  if (existing.status !== "PENDIENTE") {
    throw new Error(
      `YieldAdjustment ${id} is not PENDIENTE (current: ${existing.status})`
    );
  }

  const lot = existing.cuppingRecord.lot;
  if (!lot.supplierId) {
    throw new Error(
      `Cannot apply yield adjustment: lot ${lot.lotNumber} has no supplierId`
    );
  }

  const totalAdjustment = new Decimal(existing.totalAdjustment.toString());

  // Resolve the Lot → Contract → MateriaPrima chain for the MP update.
  // This is best-effort: if any step is missing, we skip the MP update and
  // let the supplier ledger entry carry the delta alone.
  const lotAlloc = await prisma.contractLotAllocation.findFirst({
    where: { lotId: lot.id },
    include: {
      contract: {
        include: {
          materiaPrimaAllocations: {
            include: { materiaPrima: true },
          },
        },
      },
    },
  });

  const mpTarget = lotAlloc?.contract.materiaPrimaAllocations[0]?.materiaPrima;
  const affectedShipmentId = lotAlloc?.contract.shipmentId ?? null;
  const mpUpdateSkipped = mpTarget == null;

  const { newSupplierEntry } = await prisma.$transaction(async (tx) => {
    // Step 1 — flip status.
    await tx.yieldAdjustment.update({
      where: { id },
      data: {
        status: "APLICADO",
        appliedAt: new Date(),
        appliedByUserId: session.userId,
      },
    });

    // Step 2 — write the supplier ledger entry for the delta.
    const newEntry = await tx.supplierAccountEntry.create({
      data: {
        supplierId: lot.supplierId!,
        orderCode: `ADJ-${id.slice(0, 8)}`,
        ingresoNum: 0,
        date: new Date(),
        pergamino: new Decimal(0),
        precio: new Decimal(0),
        total: totalAdjustment,
        lotId: lot.id,
        facilityId: lot.facilityId,
        qualityGrade: "yield-adjustment",
      },
    });

    // Link YieldAdjustment ↔ SupplierAccountEntry bidirectionally.
    await tx.yieldAdjustment.update({
      where: { id },
      data: { supplierAccountEntryId: newEntry.id },
    });

    // Step 3 — best-effort MP cost update.
    if (mpTarget != null) {
      const currentTotalMP = new Decimal(mpTarget.totalMP.toString());
      const newTotalMP = currentTotalMP.plus(totalAdjustment);
      await tx.materiaPrima.update({
        where: { id: mpTarget.id },
        data: { totalMP: newTotalMP.toNumber() },
      });
    }

    return { newSupplierEntry: newEntry };
  });

  // Step 4 — recompute the affected shipment's aggregates (outside tx;
  // recalculateShipment uses the global prisma client).
  if (affectedShipmentId != null && !mpUpdateSkipped) {
    await recalculateShipment(affectedShipmentId);
  }

  // Audit trail — one entry per mutation, plus a WARN if MP was skipped.
  await createAuditLog(
    session.userId,
    "UPDATE",
    "YieldAdjustment",
    id,
    { status: existing.status },
    {
      status: "APLICADO",
      supplierAccountEntryId: newSupplierEntry.id,
      mpUpdated: !mpUpdateSkipped,
    }
  );
  await createAuditLog(
    session.userId,
    "CREATE",
    "SupplierAccountEntry",
    newSupplierEntry.id,
    null,
    {
      supplierId: newSupplierEntry.supplierId,
      orderCode: newSupplierEntry.orderCode,
      total: newSupplierEntry.total.toString(),
      sourceYieldAdjustmentId: id,
    }
  );
  if (mpUpdateSkipped) {
    await createAuditLog(
      session.userId,
      "UPDATE",
      "YieldAdjustment",
      id,
      null,
      {
        warning:
          "MP cost update skipped: no ContractLotAllocation → MateriaPrima chain resolved for this lot. Supplier ledger updated; contract margin will NOT reflect this adjustment until a MP-side correction is applied manually.",
      }
    );
  }

  revalidatePath("/quality-lab");
  revalidatePath("/quality-lab/adjustments");
  revalidatePath("/suppliers");

  return { newSupplierEntryId: newSupplierEntry.id, mpUpdateSkipped };
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
