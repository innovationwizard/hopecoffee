// ============================================================================
// Recalculate every contract's stored calc fields + every shipment aggregate.
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
    include: { contracts: true },
  });

  console.log("Recalculating", allShipments.length, "shipments...");

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
