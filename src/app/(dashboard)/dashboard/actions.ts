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
  };
}
