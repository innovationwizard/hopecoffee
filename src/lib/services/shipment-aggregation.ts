import Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import {
  calculateContract,
  calculateShipmentMargin,
  aggregateContracts,
} from "./calculations";
import { toNum } from "@/lib/utils/format";

export async function recalculateShipment(shipmentId: string) {
  const [shipment, mpAgg, subAgg] = await Promise.all([
    prisma.shipment.findUniqueOrThrow({
      where: { id: shipmentId },
      include: { contracts: true },
    }),
    prisma.materiaPrima.aggregate({
      where: { shipmentId },
      _sum: { totalMP: true },
    }),
    prisma.subproducto.aggregate({
      where: { shipmentId },
      _sum: { totalPerga: true },
    }),
  ]);

  const gastosPerSaco = toNum(shipment.gastosPerSaco) || 23;

  const contractCalcs = shipment.contracts.map((c) =>
    calculateContract({
      sacos69kg: toNum(c.sacos69kg),
      puntaje: c.puntaje,
      precioBolsa: toNum(c.precioBolsa) ?? 0,
      diferencial: toNum(c.diferencial) ?? 0,
      gastosExportPerSaco: gastosPerSaco,
      tipoCambio: toNum(c.tipoCambio) ?? 7.65,
      costoFinanciero: toNum(c.costoFinanciero) ?? undefined,
      tipoFacturacion: c.tipoFacturacion ?? undefined,
      montoCredito: toNum(c.montoCredito) ?? undefined,
    })
  );

  const agg = aggregateContracts(contractCalcs);

  const totalMateriaPrima = new Decimal(toNum(mpAgg._sum.totalMP));
  const totalSubproducto = new Decimal(toNum(subAgg._sum.totalPerga));
  const totalComision = agg.totalComision;

  const margin = calculateShipmentMargin(
    agg.totalPagoQTZ,
    totalMateriaPrima,
    totalComision,
    totalSubproducto
  );

  await prisma.shipment.update({
    where: { id: shipmentId },
    data: {
      totalSacos69: shipment.contracts
        .reduce((s, c) => s + toNum(c.sacos69kg), 0),
      totalSacos46: agg.totalSacos46.toNumber(),
      totalFacturacionLbs: agg.totalFactLbs.toNumber(),
      totalFacturacionKgs: agg.totalFactKgs.toNumber(),
      totalGastosExport: agg.totalGastos.toNumber(),
      totalUtilidadSinGE: agg.totalUtilSinGE.toNumber(),
      totalCostoFinanc: agg.totalCostoFin.toNumber(),
      totalUtilidadSinCF: agg.totalUtilSinCF.toNumber(),
      totalPagoQTZ: agg.totalPagoQTZ.toNumber(),
      totalMateriaPrima: totalMateriaPrima.toNumber(),
      totalComision: totalComision.toNumber(),
      totalSubproducto: totalSubproducto.toNumber(),
      utilidadBruta: margin.utilidadBruta.toNumber(),
      margenBruto: margin.margenBruto.toNumber(),
      aggregatedAt: new Date(),
    },
  });
}
