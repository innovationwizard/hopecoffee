import Decimal from "decimal.js";
import { PrismaClient } from "@prisma/client";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
const prisma = new PrismaClient();

async function recalc() {
  const SACO_CONV = new Decimal("1.5");
  const LBS_KGS = new Decimal("1.01411");
  const COM_PER_QQ = new Decimal("1.50");
  const LBS_PER_KG = new Decimal("2.2046");

  const allShipments = await prisma.shipment.findMany({
    include: { contracts: true, materiaPrima: true, subproductos: true },
  });

  console.log("Recalculating", allShipments.length, "shipments...");

  for (const ship of allShipments) {
    const gastosPerSaco = new Decimal(Number(ship.gastosPerSaco) || 23);

    for (const c of ship.contracts) {
      const sacos69 = new Decimal(Number(c.sacos69kg));
      const bolsa = new Decimal(Number(c.precioBolsa) || 0);
      const dif = new Decimal(Number(c.diferencial) || 0);
      const tc = new Decimal(Number(c.tipoCambio) || 7.65);
      const sacos46 = sacos69.mul(SACO_CONV);
      const precioBolsaDif = bolsa.plus(dif);

      let facturacionLbs: Decimal;
      if (c.tipoFacturacion === "LIBRAS_ESPANOLAS") {
        facturacionLbs = sacos69.mul(69).mul(LBS_PER_KG).mul(precioBolsaDif.div(100));
      } else {
        facturacionLbs = sacos46.mul(precioBolsaDif);
      }

      const facturacionKgs = facturacionLbs.mul(LBS_KGS);
      const gastosExport = gastosPerSaco.mul(sacos69);
      const utilidadSinGE = facturacionKgs.minus(gastosExport);
      const comisionCompra = sacos46.mul(COM_PER_QQ);
      const comisionVenta = sacos46.mul(COM_PER_QQ);

      let costoFinanciero = new Decimal(0);
      if (c.costoFinanciero != null && Number(c.costoFinanciero) !== 0) {
        costoFinanciero = new Decimal(Number(c.costoFinanciero));
      } else if (c.montoCredito != null && Number(c.montoCredito) > 0) {
        costoFinanciero = new Decimal(Number(c.montoCredito))
          .mul(new Decimal("0.08").div(12))
          .mul(2)
          .div(tc);
      }

      const utilidadSinCF = utilidadSinGE.minus(costoFinanciero);
      const totalPagoQTZ = utilidadSinCF.mul(tc);

      await prisma.contract.update({
        where: { id: c.id },
        data: {
          sacos46kg: sacos46.toNumber(),
          precioBolsaDif: precioBolsaDif.toNumber(),
          facturacionLbs: facturacionLbs.toNumber(),
          facturacionKgs: facturacionKgs.toNumber(),
          gastosExport: gastosExport.toNumber(),
          utilidadSinGE: utilidadSinGE.toNumber(),
          costoFinanciero: costoFinanciero.toNumber(),
          utilidadSinCF: utilidadSinCF.toNumber(),
          totalPagoQTZ: totalPagoQTZ.toNumber(),
          comisionCompra: comisionCompra.toNumber(),
          comisionVenta: comisionVenta.toNumber(),
          computedAt: new Date(),
        },
      });
    }

    // Aggregate shipment
    const updatedContracts = await prisma.contract.findMany({ where: { shipmentId: ship.id } });
    let totSacos46 = new Decimal(0), totFactLbs = new Decimal(0), totFactKgs = new Decimal(0);
    let totGastos = new Decimal(0), totUtilSinGE = new Decimal(0), totCostoFin = new Decimal(0);
    let totUtilSinCF = new Decimal(0), totPagoQTZ = new Decimal(0), totComision = new Decimal(0);

    for (const c of updatedContracts) {
      totSacos46 = totSacos46.plus(new Decimal(Number(c.sacos46kg)));
      totFactLbs = totFactLbs.plus(new Decimal(Number(c.facturacionLbs) || 0));
      totFactKgs = totFactKgs.plus(new Decimal(Number(c.facturacionKgs) || 0));
      totGastos = totGastos.plus(new Decimal(Number(c.gastosExport) || 0));
      totUtilSinGE = totUtilSinGE.plus(new Decimal(Number(c.utilidadSinGE) || 0));
      totCostoFin = totCostoFin.plus(new Decimal(Number(c.costoFinanciero) || 0));
      totUtilSinCF = totUtilSinCF.plus(new Decimal(Number(c.utilidadSinCF) || 0));
      totPagoQTZ = totPagoQTZ.plus(new Decimal(Number(c.totalPagoQTZ) || 0));
      totComision = totComision
        .plus(new Decimal(Number(c.comisionCompra) || 0))
        .plus(new Decimal(Number(c.comisionVenta) || 0));
    }

    const totMP = ship.materiaPrima.reduce(
      (sum, mp) => sum.plus(new Decimal(Number(mp.totalMP))),
      new Decimal(0)
    );
    const totSub = ship.subproductos.reduce(
      (sum, sp) => sum.plus(new Decimal(Number(sp.totalPerga))),
      new Decimal(0)
    );
    const utilidadBruta = totPagoQTZ.minus(totMP).plus(totSub).minus(totComision);
    const margenBruto = totPagoQTZ.isZero() ? new Decimal(0) : utilidadBruta.div(totPagoQTZ);

    await prisma.shipment.update({
      where: { id: ship.id },
      data: {
        totalSacos69: updatedContracts.reduce((s, c) => s + Number(c.sacos69kg), 0),
        totalSacos46: totSacos46.toNumber(),
        totalFacturacionLbs: totFactLbs.toNumber(),
        totalFacturacionKgs: totFactKgs.toNumber(),
        totalGastosExport: totGastos.toNumber(),
        totalUtilidadSinGE: totUtilSinGE.toNumber(),
        totalCostoFinanc: totCostoFin.toNumber(),
        totalUtilidadSinCF: totUtilSinCF.toNumber(),
        totalPagoQTZ: totPagoQTZ.toNumber(),
        totalMateriaPrima: totMP.toNumber(),
        totalComision: totComision.toNumber(),
        totalSubproducto: totSub.toNumber(),
        utilidadBruta: utilidadBruta.toNumber(),
        margenBruto: margenBruto.toNumber(),
        aggregatedAt: new Date(),
      },
    });

    console.log(`${ship.name}: Q${totPagoQTZ.toFixed(2)} revenue, ${margenBruto.mul(100).toFixed(2)}% margin`);
  }
}

recalc()
  .then(() => { console.log("\nDone!"); })
  .catch((e) => { console.error(e); })
  .finally(() => prisma.$disconnect());
