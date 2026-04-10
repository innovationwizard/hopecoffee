import Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import { calculateShipmentMargin } from "./calculations";
import { toNum } from "@/lib/utils/format";

/**
 * Recalculate shipment aggregates from stored contract values.
 *
 * Uses the contract's persisted fields (facturacionKgs, totalPagoQTZ, etc.)
 * as the source of truth — NOT recomputed from inputs — because imported
 * Excel data is the SSOT and recomputing can produce rounding differences.
 *
 * ISR is resolved per contract:
 *   - isrAmount (fixed QTZ) takes precedence
 *   - else isrRate × contract's proportional share of total materia prima
 *   - else 0
 */
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

  const totalMateriaPrima = new Decimal(toNum(mpAgg._sum.totalMP));
  const totalSubproducto = new Decimal(toNum(subAgg._sum.totalPerga));

  // First pass: sum total sacos to compute proportional MP shares
  const totalSacosAll = shipment.contracts.reduce(
    (sum, c) => sum + toNum(c.sacos69kg), 0
  );

  // Aggregate from stored contract fields (Excel SSOT)
  let totalSacos69 = new Decimal(0);
  let totalSacos46 = new Decimal(0);
  let totalFacturacionLbs = new Decimal(0);
  let totalFacturacionKgs = new Decimal(0);
  let totalGastosExport = new Decimal(0);
  let totalUtilidadSinGE = new Decimal(0);
  let totalCostoFinanc = new Decimal(0);
  let totalUtilidadSinCF = new Decimal(0);
  let totalPagoQTZ = new Decimal(0);
  let totalFacturacionQTZ = new Decimal(0);
  let totalComisionQTZ = new Decimal(0);
  let totalISR = new Decimal(0);

  for (const c of shipment.contracts) {
    const tc = new Decimal(toNum(c.tipoCambio) || 7.65);
    const sacos69 = new Decimal(toNum(c.sacos69kg));
    const sacos46 = sacos69.mul("1.5");
    const factKgs = new Decimal(toNum(c.facturacionKgs));
    const factLbs = new Decimal(toNum(c.facturacionLbs));
    const gastos = new Decimal(toNum(c.gastosExport));
    const utilSinGE = new Decimal(toNum(c.utilidadSinGE));
    const costoFin = new Decimal(toNum(c.costoFinanciero));
    const utilSinCF = new Decimal(toNum(c.utilidadSinCF));
    const pagoQTZ = new Decimal(toNum(c.totalPagoQTZ));

    // Comision: $1.50/qq buy + sell
    const comisionUSD = sacos46.mul("1.50").mul(2);

    // ISR: fixed amount takes precedence, else rate × proportional MP share
    const isrAmount = toNum(c.isrAmount);
    const isrRate = toNum(c.isrRate);
    let contractISR = new Decimal(0);
    if (isrAmount > 0) {
      contractISR = new Decimal(isrAmount);
    } else if (isrRate > 0 && totalSacosAll > 0) {
      const mpShare = totalMateriaPrima.mul(sacos69.toNumber() / totalSacosAll);
      contractISR = mpShare.mul(isrRate);
    }

    totalSacos69 = totalSacos69.plus(sacos69);
    totalSacos46 = totalSacos46.plus(sacos46);
    totalFacturacionLbs = totalFacturacionLbs.plus(factLbs);
    totalFacturacionKgs = totalFacturacionKgs.plus(factKgs);
    totalGastosExport = totalGastosExport.plus(gastos);
    totalUtilidadSinGE = totalUtilidadSinGE.plus(utilSinGE);
    totalCostoFinanc = totalCostoFinanc.plus(costoFin);
    totalUtilidadSinCF = totalUtilidadSinCF.plus(utilSinCF);
    totalPagoQTZ = totalPagoQTZ.plus(pagoQTZ);
    totalFacturacionQTZ = totalFacturacionQTZ.plus(factKgs.mul(tc));
    totalComisionQTZ = totalComisionQTZ.plus(comisionUSD.mul(tc));
    totalISR = totalISR.plus(contractISR);
  }

  const margin = calculateShipmentMargin(
    totalFacturacionQTZ,
    totalPagoQTZ,
    totalMateriaPrima,
    totalISR,
    totalComisionQTZ,
    totalSubproducto
  );

  await prisma.shipment.update({
    where: { id: shipmentId },
    data: {
      totalSacos69: totalSacos69.toNumber(),
      totalSacos46: totalSacos46.toNumber(),
      totalFacturacionLbs: totalFacturacionLbs.toNumber(),
      totalFacturacionKgs: totalFacturacionKgs.toNumber(),
      totalGastosExport: totalGastosExport.toNumber(),
      totalUtilidadSinGE: totalUtilidadSinGE.toNumber(),
      totalCostoFinanc: totalCostoFinanc.toNumber(),
      totalUtilidadSinCF: totalUtilidadSinCF.toNumber(),
      totalPagoQTZ: totalPagoQTZ.toNumber(),
      totalFacturacionQTZ: totalFacturacionQTZ.toNumber(),
      totalMateriaPrima: totalMateriaPrima.toNumber(),
      totalISR: totalISR.toNumber(),
      totalComision: totalComisionQTZ.toNumber(),
      totalSubproducto: totalSubproducto.toNumber(),
      utilidadBruta: margin.utilidadBruta.toNumber(),
      margenBruto: margin.margenBruto.toNumber(),
      aggregatedAt: new Date(),
    },
  });
}
