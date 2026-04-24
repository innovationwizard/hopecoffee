// ============================================================================
// ⚠️  JAN-SCOPED FROZEN REFERENCE — 2026-04-23
// ============================================================================
// Per RECONCILIATION_PLAN_2026_JAN_MAY.md §1.2, the Jan 2026 prod DB is frozen.
// The original script swept every shipment + every contract in the DB
// (whole-DB scope forbidden by directive 6 of 2026-04-23). It has been
// renamed to scripts/recalc-january.ts and scoped to Jan 2026 shipments.
//
// The top-level `throw` below prevents accidental execution. Do not run.
// For any non-Jan month, call calculateContract + recalculateShipment inline
// from the per-month ETL script.
// ============================================================================

throw new Error(
  "scripts/recalc-january.ts — decommissioned 2026-04-23. Jan prod DB is frozen; see RECONCILIATION_PLAN_2026_JAN_MAY.md §1.2."
);

// ============================================================================
// Recalculate Jan 2026 contracts + Jan 2026 shipment aggregates.
// Delegates to the canonical calculateContract + recalculateShipment services
// so this script stays a thin wrapper around the shared calc engine.
// ============================================================================

import Decimal from "decimal.js";
import { PrismaClient } from "@prisma/client";
import { calculateContract } from "../src/lib/services/calculations";
import { recalculateShipment } from "../src/lib/services/shipment-aggregation";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
const prisma = new PrismaClient();

async function recalc() {
  const allShipments = await prisma.shipment.findMany({
    where: { year: 2026, month: 1 },
    include: { contracts: true },
  });

  console.log("Recalculating", allShipments.length, "Jan 2026 shipments...");

  for (const ship of allShipments) {
    const shipmentGastosPerSaco = Number(ship.gastosPerSaco) || 23;

    for (const c of ship.contracts) {
      const calc = calculateContract({
        sacos69kg: Number(c.sacos69kg),
        puntaje: c.puntaje,
        precioBolsa: Number(c.precioBolsa) || 0,
        diferencial: Number(c.diferencial) || 0,
        gastosExportPerSaco: Number(c.gastosPerSaco) || shipmentGastosPerSaco,
        tipoCambio: Number(c.tipoCambio) || 7.65,
        costoFinanciero:
          c.costoFinanciero != null && Number(c.costoFinanciero) !== 0
            ? Number(c.costoFinanciero)
            : undefined,
        montoCredito:
          c.montoCredito != null && Number(c.montoCredito) > 0
            ? Number(c.montoCredito)
            : undefined,
        facturacionKgsOverride:
          c.facturacionKgsOverride != null
            ? Number(c.facturacionKgsOverride)
            : undefined,
      });

      await prisma.contract.update({
        where: { id: c.id },
        data: {
          sacos46kg: calc.sacos46kg.toNumber(),
          precioBolsaDif: calc.precioBolsaDif.toNumber(),
          facturacionLbs: calc.facturacionLbs.toNumber(),
          facturacionKgs: calc.facturacionKgs.toNumber(),
          gastosExport: calc.gastosExportacion.toNumber(),
          utilidadSinGE: calc.utilidadSinGastosExport.toNumber(),
          costoFinanciero: calc.costoFinanciero.toNumber(),
          utilidadSinCF: calc.utilidadSinCostoFinanciero.toNumber(),
          totalPagoQTZ: calc.totalPagoQTZ.toNumber(),
          comisionCompra: calc.comisionCompra.toNumber(),
          comisionVenta: calc.comisionVenta.toNumber(),
          computedAt: new Date(),
        },
      });
    }

    await recalculateShipment(ship.id);

    const refreshed = await prisma.shipment.findUniqueOrThrow({
      where: { id: ship.id },
      select: { totalPagoQTZ: true, margenBruto: true },
    });
    console.log(
      `${ship.name}: Q${Number(refreshed.totalPagoQTZ ?? 0).toFixed(2)} revenue, ${(Number(refreshed.margenBruto ?? 0) * 100).toFixed(2)}% margin`
    );
  }
}

recalc()
  .then(() => {
    console.log("\nDone!");
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
