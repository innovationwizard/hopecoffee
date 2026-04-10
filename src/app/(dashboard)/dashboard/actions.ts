"use server";

import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/services/auth";
import { toNum } from "@/lib/utils/format";

const BREAK_EVEN_TARGET = 2_500_000; // Q2.5M operational costs
const MARGIN_THRESHOLD = 0.12; // 12% target

export async function getDashboardStats() {
  await requireAuth();

  const currentYear = new Date().getFullYear();

  const [
    contractCount,
    activeContracts,
    shipmentAgg,
    ytdShipmentAgg,
    recentShipments,
    recentContracts,
    inventoryByStage,
    qualityStats,
    lotsWithoutCupping,
    yieldStats,
    pendingAdjustments,
    millingStats,
  ] = await Promise.all([
    prisma.contract.count(),
    prisma.contract.count({
      where: { status: { notIn: ["CANCELADO", "LIQUIDADO"] } },
    }),
    // DB-level aggregation for weighted margin
    prisma.shipment.aggregate({
      _sum: { totalPagoQTZ: true, utilidadBruta: true, numContainers: true },
      _count: true,
    }),
    // YTD aggregation for break-even
    prisma.shipment.aggregate({
      where: { year: currentYear },
      _sum: { utilidadBruta: true, numContainers: true },
      _count: true,
    }),
    prisma.shipment.findMany({
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 6,
      select: {
        id: true,
        name: true,
        month: true,
        year: true,
        numContainers: true,
        totalPagoQTZ: true,
        margenBruto: true,
        utilidadBruta: true,
      },
    }),
    prisma.contract.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { client: true },
    }),
    // Inventory by stage
    prisma.lot.groupBy({
      by: ["stage"],
      _sum: { quantityQQ: true },
      _count: true,
    }),
    // Quality stats
    prisma.cuppingRecord.aggregate({
      _avg: { totalScore: true },
      _count: true,
    }),
    // Pending cupping (lots without cupping records)
    prisma.lot.count({
      where: {
        stage: { in: ["PERGAMINO_BODEGA", "EN_PROCESO"] },
        cuppingRecords: { none: {} },
      },
    }),
    // Yield performance
    prisma.lot.aggregate({
      where: { actualYield: { not: null }, contractedYield: { not: null } },
      _avg: { actualYield: true, contractedYield: true },
      _count: true,
    }),
    // Pending yield adjustments
    prisma.yieldAdjustment.count({
      where: { status: "PENDIENTE" },
    }),
    // Milling stats
    prisma.millingOrder.aggregate({
      _count: true,
      where: { status: "COMPLETADO" },
    }),
  ]);

  const totalRevenue = toNum(shipmentAgg._sum.totalPagoQTZ);
  const totalUtilidadBruta = toNum(shipmentAgg._sum.utilidadBruta);
  const weightedMargin = totalRevenue > 0 ? totalUtilidadBruta / totalRevenue : 0;
  const marginAlert = weightedMargin < MARGIN_THRESHOLD && shipmentAgg._count > 0;

  // Break-even: cumulative utilidad bruta YTD vs Q2.5M
  const ytdUtilidadBruta = toNum(ytdShipmentAgg._sum.utilidadBruta);
  const ytdContainers = ytdShipmentAgg._sum.numContainers ?? 0;
  const breakEvenProgress = ytdUtilidadBruta / BREAK_EVEN_TARGET;

  const avgUtilidadPerContainer = ytdContainers > 0
    ? ytdUtilidadBruta / ytdContainers
    : 0;
  const remaining = BREAK_EVEN_TARGET - ytdUtilidadBruta;
  const containersRemaining = avgUtilidadPerContainer > 0
    ? Math.ceil(remaining / avgUtilidadPerContainer)
    : null;

  // Build inventory map by stage
  const inventoryMap: Record<string, { qq: number; count: number }> = {};
  for (const row of inventoryByStage) {
    inventoryMap[row.stage] = {
      qq: toNum(row._sum.quantityQQ),
      count: row._count,
    };
  }

  // Yield index: avg(contractedYield / actualYield) — higher means better
  const avgActual = toNum(yieldStats._avg.actualYield);
  const avgContracted = toNum(yieldStats._avg.contractedYield);
  const yieldIndex = avgActual > 0 ? avgContracted / avgActual : 0;

  return {
    contractCount,
    activeContracts,
    shipments: recentShipments,
    recentContracts,
    weightedMargin,
    marginAlert,
    totalRevenue,
    totalUtilidadBruta,
    breakEvenProgress,
    containersRemaining,
    breakEvenTarget: BREAK_EVEN_TARGET,
    // Operational KPIs
    inventoryMap,
    avgCuppingScore: toNum(qualityStats._avg.totalScore),
    cuppingRecordCount: qualityStats._count,
    lotsWithoutCupping,
    yieldIndex,
    yieldLotsCount: yieldStats._count,
    pendingAdjustments,
    completedMillingOrders: millingStats._count,
  };
}
