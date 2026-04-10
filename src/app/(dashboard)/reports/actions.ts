"use server";

import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/services/auth";
import { toNum } from "@/lib/utils/format";

// ---------------------------------------------------------------------------
// SALES BY MONTH
// ---------------------------------------------------------------------------

export interface SalesByMonthRow {
  month: number;
  year: number;
  label: string;
  numContracts: number;
  numContainers: number;
  totalSacos69: number;
  totalSacos46: number;
  totalFacturacionKgs: number;
  totalPagoQTZ: number;
  totalGastosExport: number;
  utilidadBruta: number;
  margenBruto: number;
}

export async function getSalesByMonth(): Promise<SalesByMonthRow[]> {
  await requireAuth();

  const shipments = await prisma.shipment.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }],
    include: {
      contracts: {
        where: { status: { not: "CANCELADO" } },
        select: { id: true },
      },
    },
  });

  return shipments.map((s) => ({
    month: s.month,
    year: s.year,
    label: s.name,
    numContracts: s.contracts.length,
    numContainers: s.numContainers,
    totalSacos69: toNum(s.totalSacos69),
    totalSacos46: toNum(s.totalSacos46),
    totalFacturacionKgs: toNum(s.totalFacturacionKgs),
    totalPagoQTZ: toNum(s.totalPagoQTZ),
    totalGastosExport: toNum(s.totalGastosExport),
    utilidadBruta: toNum(s.utilidadBruta),
    margenBruto: toNum(s.margenBruto),
  }));
}

// ---------------------------------------------------------------------------
// MARGIN BY CLIENT
// ---------------------------------------------------------------------------

export interface MarginByClientRow {
  clientId: string;
  clientName: string;
  clientCode: string;
  numContracts: number;
  totalSacos46: number;
  totalFacturacionKgs: number;
  totalPagoQTZ: number;
  totalGastosExport: number;
  avgMargin: number;
  totalUtilidadSinCF: number;
}

export async function getMarginByClient(): Promise<MarginByClientRow[]> {
  await requireAuth();

  const clients = await prisma.client.findMany({
    where: { isActive: true },
    include: {
      contracts: {
        where: { status: { not: "CANCELADO" } },
        select: {
          sacos46kg: true,
          facturacionKgs: true,
          totalPagoQTZ: true,
          gastosExport: true,
          utilidadSinCF: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return clients
    .filter((c) => c.contracts.length > 0)
    .map((c) => {
      const totalFacturacionKgs = c.contracts.reduce(
        (sum, ct) => sum + toNum(ct.facturacionKgs),
        0
      );
      const totalPagoQTZ = c.contracts.reduce(
        (sum, ct) => sum + toNum(ct.totalPagoQTZ),
        0
      );
      const totalGastosExport = c.contracts.reduce(
        (sum, ct) => sum + toNum(ct.gastosExport),
        0
      );
      const totalUtilidadSinCF = c.contracts.reduce(
        (sum, ct) => sum + toNum(ct.utilidadSinCF),
        0
      );
      const totalSacos46 = c.contracts.reduce(
        (sum, ct) => sum + toNum(ct.sacos46kg),
        0
      );
      const avgMargin =
        totalPagoQTZ > 0 ? totalUtilidadSinCF / totalPagoQTZ : 0;

      return {
        clientId: c.id,
        clientName: c.name,
        clientCode: c.code,
        numContracts: c.contracts.length,
        totalSacos46,
        totalFacturacionKgs,
        totalPagoQTZ,
        totalGastosExport,
        avgMargin,
        totalUtilidadSinCF,
      };
    })
    .sort((a, b) => b.totalPagoQTZ - a.totalPagoQTZ);
}

// ---------------------------------------------------------------------------
// PURCHASES BY SUPPLIER
// ---------------------------------------------------------------------------

export interface PurchasesBySupplierRow {
  supplierId: string;
  supplierName: string;
  supplierCode: string;
  numPOs: number;
  totalQQPergamino: number;
  totalCostQTZ: number;
  avgPricePerQQ: number;
  totalFlete: number;
  costoTotalAccum: number;
  precioPromedio: number;
  numAccountEntries: number;
  accountTotalQQ: number;
  accountTotalQTZ: number;
}

export async function getPurchasesBySupplier(): Promise<
  PurchasesBySupplierRow[]
> {
  await requireAuth();

  const suppliers = await prisma.supplier.findMany({
    where: { isActive: true },
    include: {
      purchaseOrders: {
        select: {
          quintalesPerg: true,
          totalCafe: true,
          totalFlete: true,
          costoTotalAccum: true,
          precioPromedio: true,
        },
      },
      accountEntries: {
        select: {
          pergamino: true,
          total: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return suppliers
    .filter(
      (s) => s.purchaseOrders.length > 0 || s.accountEntries.length > 0
    )
    .map((s) => {
      const totalQQPergamino = s.purchaseOrders.reduce(
        (sum, po) => sum + toNum(po.quintalesPerg),
        0
      );
      const totalCostQTZ = s.purchaseOrders.reduce(
        (sum, po) => sum + toNum(po.totalCafe),
        0
      );
      const totalFlete = s.purchaseOrders.reduce(
        (sum, po) => sum + toNum(po.totalFlete),
        0
      );
      const costoTotalAccum = s.purchaseOrders.reduce(
        (sum, po) => sum + toNum(po.costoTotalAccum),
        0
      );
      const avgPricePerQQ =
        totalQQPergamino > 0 ? totalCostQTZ / totalQQPergamino : 0;

      // Weighted average of precioPromedio across POs
      const precioPromedio =
        totalQQPergamino > 0
          ? s.purchaseOrders.reduce(
              (sum, po) =>
                sum + toNum(po.precioPromedio) * toNum(po.quintalesPerg),
              0
            ) / totalQQPergamino
          : 0;

      const accountTotalQQ = s.accountEntries.reduce(
        (sum, ae) => sum + toNum(ae.pergamino),
        0
      );
      const accountTotalQTZ = s.accountEntries.reduce(
        (sum, ae) => sum + toNum(ae.total),
        0
      );

      return {
        supplierId: s.id,
        supplierName: s.name,
        supplierCode: s.code,
        numPOs: s.purchaseOrders.length,
        totalQQPergamino,
        totalCostQTZ,
        avgPricePerQQ,
        totalFlete,
        costoTotalAccum,
        precioPromedio,
        numAccountEntries: s.accountEntries.length,
        accountTotalQQ,
        accountTotalQTZ,
      };
    })
    .sort((a, b) => b.costoTotalAccum - a.costoTotalAccum);
}

// ---------------------------------------------------------------------------
// CONTRACT PIPELINE (status distribution)
// ---------------------------------------------------------------------------

export interface ContractPipelineRow {
  status: string;
  count: number;
  totalSacos46: number;
  totalPagoQTZ: number;
}

export async function getContractPipeline(): Promise<ContractPipelineRow[]> {
  await requireAuth();

  const contracts = await prisma.contract.findMany({
    select: {
      status: true,
      sacos46kg: true,
      totalPagoQTZ: true,
    },
  });

  const byStatus = new Map<
    string,
    { count: number; totalSacos46: number; totalPagoQTZ: number }
  >();

  for (const c of contracts) {
    const existing = byStatus.get(c.status) ?? {
      count: 0,
      totalSacos46: 0,
      totalPagoQTZ: 0,
    };
    existing.count += 1;
    existing.totalSacos46 += toNum(c.sacos46kg);
    existing.totalPagoQTZ += toNum(c.totalPagoQTZ);
    byStatus.set(c.status, existing);
  }

  const order = [
    "NEGOCIACION",
    "CONFIRMADO",
    "NO_FIJADO",
    "FIJADO",
    "EMBARCADO",
    "LIQUIDADO",
    "CANCELADO",
  ];

  return order
    .filter((s) => byStatus.has(s))
    .map((s) => ({
      status: s,
      ...byStatus.get(s)!,
    }));
}

// ---------------------------------------------------------------------------
// REVENUE BY REGION
// ---------------------------------------------------------------------------

export interface RevenueByRegionRow {
  region: string;
  numContracts: number;
  totalSacos46: number;
  totalPagoQTZ: number;
}

export async function getRevenueByRegion(): Promise<RevenueByRegionRow[]> {
  await requireAuth();

  const contracts = await prisma.contract.findMany({
    where: { status: { not: "CANCELADO" } },
    select: {
      regions: true,
      sacos46kg: true,
      totalPagoQTZ: true,
    },
  });

  const byRegion = new Map<
    string,
    { numContracts: number; totalSacos46: number; totalPagoQTZ: number }
  >();

  for (const c of contracts) {
    for (const region of c.regions) {
      const existing = byRegion.get(region) ?? {
        numContracts: 0,
        totalSacos46: 0,
        totalPagoQTZ: 0,
      };
      existing.numContracts += 1;
      existing.totalSacos46 += toNum(c.sacos46kg);
      existing.totalPagoQTZ += toNum(c.totalPagoQTZ);
      byRegion.set(region, existing);
    }
  }

  return Array.from(byRegion.entries())
    .map(([region, data]) => ({ region, ...data }))
    .sort((a, b) => b.totalPagoQTZ - a.totalPagoQTZ);
}

// ---------------------------------------------------------------------------
// P&L BY SHIPMENT
// ---------------------------------------------------------------------------

export interface PnlRow {
  key: string;
  label: string;
  month: number;
  year: number;
  totalPagoQTZ: number;
  totalSubproducto: number;
  ingresoTotal: number;
  totalMateriaPrima: number;
  totalISR: number;
  totalGastosExport: number;
  totalCostoFinanc: number;
  totalComision: number;
  costoTotal: number;
  utilidadBruta: number;
  margenBruto: number;
}

export async function getPnlData(): Promise<PnlRow[]> {
  await requireAuth();

  const shipments = await prisma.shipment.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }],
    select: {
      id: true,
      name: true,
      month: true,
      year: true,
      totalPagoQTZ: true,
      totalFacturacionQTZ: true,
      totalSubproducto: true,
      totalMateriaPrima: true,
      totalISR: true,
      totalGastosExport: true,
      totalCostoFinanc: true,
      totalComision: true,
      utilidadBruta: true,
    },
  });

  return shipments.map((s) => {
    const totalPagoQTZ = toNum(s.totalPagoQTZ);
    const totalFacturacionQTZ = toNum(s.totalFacturacionQTZ);
    const totalSubproducto = toNum(s.totalSubproducto);
    const ingresoTotal = totalPagoQTZ + totalSubproducto;
    const totalMateriaPrima = toNum(s.totalMateriaPrima);
    const totalISR = toNum(s.totalISR);
    const totalGastosExport = toNum(s.totalGastosExport);
    const totalCostoFinanc = toNum(s.totalCostoFinanc);
    const totalComision = toNum(s.totalComision);
    const costoTotal = totalMateriaPrima + totalISR + totalGastosExport + totalCostoFinanc + totalComision;
    const utilidadBruta = toNum(s.utilidadBruta);
    const margenBruto = totalFacturacionQTZ > 0 ? utilidadBruta / totalFacturacionQTZ : 0;

    return {
      key: s.id,
      label: s.name,
      month: s.month,
      year: s.year,
      totalPagoQTZ,
      totalSubproducto,
      ingresoTotal,
      totalMateriaPrima,
      totalISR,
      totalGastosExport,
      totalCostoFinanc,
      totalComision,
      costoTotal,
      utilidadBruta,
      margenBruto,
    };
  });
}

// ---------------------------------------------------------------------------
// INVENTORY REPORT
// ---------------------------------------------------------------------------

export interface InventoryStageRow {
  stage: string;
  qq: number;
  count: number;
}

export interface InventoryGroupRow {
  name: string;
  stages: InventoryStageRow[];
}

export interface InventoryReport {
  byFacility: InventoryGroupRow[];
  bySupplier: InventoryGroupRow[];
  byStage: InventoryStageRow[];
}

export async function getInventoryReport(): Promise<InventoryReport> {
  await requireAuth();

  const lots = await prisma.lot.findMany({
    select: {
      stage: true,
      quantityQQ: true,
      facility: { select: { name: true } },
      supplier: { select: { name: true } },
    },
  });

  // By stage
  const stageMap = new Map<string, { qq: number; count: number }>();
  for (const lot of lots) {
    const existing = stageMap.get(lot.stage) ?? { qq: 0, count: 0 };
    existing.qq += toNum(lot.quantityQQ);
    existing.count += 1;
    stageMap.set(lot.stage, existing);
  }
  const byStage = Array.from(stageMap.entries()).map(([stage, data]) => ({
    stage,
    ...data,
  }));

  // By facility
  const facilityMap = new Map<string, Map<string, { qq: number; count: number }>>();
  for (const lot of lots) {
    const fname = lot.facility?.name ?? "Sin beneficio";
    if (!facilityMap.has(fname)) facilityMap.set(fname, new Map());
    const stages = facilityMap.get(fname)!;
    const existing = stages.get(lot.stage) ?? { qq: 0, count: 0 };
    existing.qq += toNum(lot.quantityQQ);
    existing.count += 1;
    stages.set(lot.stage, existing);
  }
  const byFacility = Array.from(facilityMap.entries())
    .map(([name, stages]) => ({
      name,
      stages: Array.from(stages.entries()).map(([stage, data]) => ({ stage, ...data })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // By supplier
  const supplierMap = new Map<string, Map<string, { qq: number; count: number }>>();
  for (const lot of lots) {
    const sname = lot.supplier?.name ?? "Sin proveedor";
    if (!supplierMap.has(sname)) supplierMap.set(sname, new Map());
    const stages = supplierMap.get(sname)!;
    const existing = stages.get(lot.stage) ?? { qq: 0, count: 0 };
    existing.qq += toNum(lot.quantityQQ);
    existing.count += 1;
    stages.set(lot.stage, existing);
  }
  const bySupplier = Array.from(supplierMap.entries())
    .map(([name, stages]) => ({
      name,
      stages: Array.from(stages.entries()).map(([stage, data]) => ({ stage, ...data })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { byFacility, bySupplier, byStage };
}

// ---------------------------------------------------------------------------
// YIELD VARIANCE REPORT
// ---------------------------------------------------------------------------

export interface YieldVarianceRow {
  lotNumber: string;
  supplier: string;
  contracted: number;
  actual: number;
  variance: number;
  adjustmentStatus: string | null;
}

export async function getYieldVarianceReport(): Promise<YieldVarianceRow[]> {
  await requireAuth();

  const lots = await prisma.lot.findMany({
    where: {
      actualYield: { not: null },
      contractedYield: { not: null },
    },
    select: {
      lotNumber: true,
      contractedYield: true,
      actualYield: true,
      supplier: { select: { name: true } },
      cuppingRecords: {
        select: {
          yieldAdjustments: {
            select: { status: true },
            take: 1,
            orderBy: { createdAt: "desc" },
          },
        },
        take: 1,
        orderBy: { date: "desc" },
      },
    },
    orderBy: { lotNumber: "asc" },
  });

  return lots.map((lot) => {
    const contracted = toNum(lot.contractedYield);
    const actual = toNum(lot.actualYield);
    const variance = contracted > 0 ? (actual - contracted) / contracted : 0;
    const adjustment = lot.cuppingRecords[0]?.yieldAdjustments[0];
    return {
      lotNumber: lot.lotNumber,
      supplier: lot.supplier?.name ?? "Sin proveedor",
      contracted,
      actual,
      variance,
      adjustmentStatus: adjustment?.status ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// MILLING EFFICIENCY REPORT
// ---------------------------------------------------------------------------

export interface MillingEfficiencyRow {
  orderNumber: string;
  date: string;
  inputQQ: number;
  oroOutputQQ: number;
  segundaQQ: number;
  mermaQQ: number;
  yield: number;
}

export async function getMillingEfficiencyReport(): Promise<MillingEfficiencyRow[]> {
  await requireAuth();

  const orders = await prisma.millingOrder.findMany({
    where: { status: "COMPLETADO" },
    include: {
      inputs: { select: { quantityQQ: true } },
      outputs: { select: { outputType: true, quantityQQ: true } },
    },
    orderBy: { date: "desc" },
  });

  return orders.map((order) => {
    const inputQQ = order.inputs.reduce((sum, i) => sum + toNum(i.quantityQQ), 0);
    const oroOutputQQ = order.outputs
      .filter((o) => o.outputType === "ORO_EXPORTABLE")
      .reduce((sum, o) => sum + toNum(o.quantityQQ), 0);
    const segundaQQ = order.outputs
      .filter((o) => o.outputType === "SEGUNDA")
      .reduce((sum, o) => sum + toNum(o.quantityQQ), 0);
    const mermaQQ = order.outputs
      .filter((o) => o.outputType === "MERMA" || o.outputType === "CASCARILLA")
      .reduce((sum, o) => sum + toNum(o.quantityQQ), 0);
    const yieldPct = inputQQ > 0 ? oroOutputQQ / inputQQ : 0;

    return {
      orderNumber: order.orderNumber,
      date: order.date.toISOString().slice(0, 10),
      inputQQ,
      oroOutputQQ,
      segundaQQ,
      mermaQQ,
      yield: yieldPct,
    };
  });
}

// ---------------------------------------------------------------------------
// REPORTS SUMMARY (for hub page)
// ---------------------------------------------------------------------------

export interface ReportsSummary {
  totalContracts: number;
  activeContracts: number;
  totalShipments: number;
  totalContainers: number;
  totalRevenueQTZ: number;
  totalUtilidadBruta: number;
  weightedMargin: number;
  totalPurchaseCostQTZ: number;
  totalQQPurchased: number;
  numClients: number;
  numSuppliers: number;
}

export async function getReportsSummary(): Promise<ReportsSummary> {
  await requireAuth();

  const [
    totalContracts,
    activeContracts,
    shipmentAgg,
    purchaseAgg,
    numClients,
    numSuppliers,
  ] = await Promise.all([
    prisma.contract.count({ where: { status: { not: "CANCELADO" } } }),
    prisma.contract.count({
      where: { status: { notIn: ["CANCELADO", "LIQUIDADO"] } },
    }),
    prisma.shipment.aggregate({
      _sum: {
        totalPagoQTZ: true,
        utilidadBruta: true,
        numContainers: true,
      },
      _count: true,
    }),
    prisma.purchaseOrder.aggregate({
      _sum: { costoTotalAccum: true, quintalesPerg: true },
    }),
    prisma.client.count({ where: { isActive: true } }),
    prisma.supplier.count({ where: { isActive: true } }),
  ]);

  const totalRevenueQTZ = toNum(shipmentAgg._sum.totalPagoQTZ);
  const totalUtilidadBruta = toNum(shipmentAgg._sum.utilidadBruta);
  const weightedMargin =
    totalRevenueQTZ > 0 ? totalUtilidadBruta / totalRevenueQTZ : 0;

  return {
    totalContracts,
    activeContracts,
    totalShipments: shipmentAgg._count,
    totalContainers: shipmentAgg._sum.numContainers ?? 0,
    totalRevenueQTZ,
    totalUtilidadBruta,
    weightedMargin,
    totalPurchaseCostQTZ: toNum(purchaseAgg._sum.costoTotalAccum),
    totalQQPurchased: toNum(purchaseAgg._sum.quintalesPerg),
    numClients,
    numSuppliers,
  };
}
