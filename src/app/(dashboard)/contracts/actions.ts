"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/services/auth";
import { createAuditLog } from "@/lib/services/audit";
import { calculateContract } from "@/lib/services/calculations";
import {
  ContractCreateSchema,
  ContractUpdateSchema,
  type ContractCreateInput,
  type ContractUpdateInput,
} from "@/lib/validations/schemas";
import type { ContractStatus, Prisma } from "@prisma/client";
import { toNum } from "@/lib/utils/format";

export async function getClients() {
  await requireAuth();
  return prisma.client.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function getActiveExchangeRate() {
  const rate = await prisma.exchangeRate.findFirst({
    where: { isActive: true },
    orderBy: { validFrom: "desc" },
  });
  return rate;
}

export async function getContracts(filters?: {
  clientId?: string;
  status?: string;
  search?: string;
  cosecha?: string; // "YY/YY"
  month?: string; // "YYYY-MM"
  page?: number;
  pageSize?: number;
}) {
  await requireAuth();

  const where: Prisma.ContractWhereInput = {};
  if (filters?.clientId) where.clientId = filters.clientId;
  if (filters?.status) where.status = filters.status as ContractStatus;
  if (filters?.search) {
    where.contractNumber = { contains: filters.search, mode: "insensitive" };
  }
  if (filters?.cosecha) {
    where.cosecha = filters.cosecha;
  }
  if (filters?.month) {
    const [y, m] = filters.month.split("-").map(Number);
    if (y && m) {
      where.shipment = { year: y, month: m };
    }
  }

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 100;

  const [data, total] = await Promise.all([
    prisma.contract.findMany({
      where,
      include: { client: true, shipment: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.contract.count({ where }),
  ]);

  return { data, total, page, pageSize };
}

export async function getContract(id: string) {
  await requireAuth();
  return prisma.contract.findUnique({
    where: { id },
    include: {
      client: true,
      shipment: { select: { id: true, name: true } },
      materiaPrimaAllocations: {
        include: { materiaPrima: true },
      },
      priceSnapshots: {
        orderBy: { snapshotAt: "desc" },
        take: 20,
      },
    },
  });
}

function computeContractFields(input: {
  sacos69kg: number;
  precioBolsa?: number | null;
  diferencial?: number | null;
  tipoCambio?: number | null;
  costoFinanciero?: number | null;
  gastosExportPerSaco?: number;
  tipoFacturacion?: string | null;
  montoCredito?: number | null;
}) {
  const sacos69kg = input.sacos69kg;
  const precioBolsa = input.precioBolsa ?? 0;
  const diferencial = input.diferencial ?? 0;
  const tipoCambio = input.tipoCambio ?? 7.65;
  const gastosExportPerSaco = input.gastosExportPerSaco ?? 23;

  const calc = calculateContract({
    sacos69kg,
    puntaje: 82,
    precioBolsa,
    diferencial,
    gastosExportPerSaco,
    tipoCambio,
    costoFinanciero: input.costoFinanciero ?? undefined,
    tipoFacturacion: (input.tipoFacturacion as "LIBRAS_GUATEMALTECAS" | "LIBRAS_ESPANOLAS") ?? undefined,
    montoCredito: input.montoCredito ?? undefined,
  });

  return {
    sacos46kg: calc.sacos46kg.toNumber(),
    precioBolsaDif: calc.precioBolsaDif.toNumber(),
    facturacionLbs: calc.facturacionLbs.toNumber(),
    facturacionKgs: calc.facturacionKgs.toNumber(),
    gastosExport: calc.gastosExportacion.toNumber(),
    utilidadSinGE: calc.utilidadSinGastosExport.toNumber(),
    costoFinanciero: calc.costoFinanciero.toNumber(),
    utilidadSinCF: calc.utilidadSinCostoFinanciero.toNumber(),
    totalPagoQTZ: calc.totalPagoQTZ.toNumber(),
    tipoCambio,
    comisionCompra: calc.comisionCompra.toNumber(),
    comisionVenta: calc.comisionVenta.toNumber(),
    computedAt: new Date(),
  };
}

export async function createContract(data: ContractCreateInput) {
  const session = await requireRole("OPERATOR");
  const validated = ContractCreateSchema.parse(data);

  const computed = computeContractFields({
    sacos69kg: validated.sacos69kg,
    precioBolsa: validated.precioBolsa,
    diferencial: validated.diferencial,
    tipoCambio: validated.tipoCambio,
    tipoFacturacion: validated.tipoFacturacion,
    montoCredito: validated.montoCredito,
  });

  // Snapshot the default export cost config at creation time
  const defaultConfig = await prisma.exportCostConfig.findFirst({
    where: { isDefault: true },
    select: { id: true },
  });

  const contract = await prisma.contract.create({
    data: {
      contractNumber: validated.contractNumber,
      clientId: validated.clientId,
      shipmentId: validated.shipmentId ?? null,
      status: validated.status,
      regions: validated.regions,
      puntaje: validated.puntaje,
      sacos69kg: validated.sacos69kg,
      rendimiento: validated.rendimiento,
      precioBolsa: validated.precioBolsa ?? null,
      diferencial: validated.diferencial ?? null,
      tipoFacturacion: validated.tipoFacturacion,
      posicionBolsa: validated.posicionBolsa ?? null,
      montoCredito: validated.montoCredito ?? null,
      cosecha: validated.cosecha ?? null,
      posicionNY: validated.posicionNY ?? null,
      fechaEmbarque: validated.fechaEmbarque ?? null,
      lote: validated.lote ?? null,
      notes: validated.notes ?? null,
      exportCostConfigId: defaultConfig?.id ?? null,
      ...computed,
    },
  });

  await createAuditLog(
    session.userId,
    "CREATE",
    "Contract",
    contract.id,
    null,
    contract
  );

  revalidatePath("/contracts");
  return contract;
}

export async function updateContract(data: ContractUpdateInput) {
  const session = await requireRole("OPERATOR");
  const validated = ContractUpdateSchema.parse(data);

  const existing = await prisma.contract.findUniqueOrThrow({
    where: { id: validated.id },
  });

  // Business rule: price is frozen once FIJADO
  if (existing.status === "FIJADO") {
    const priceChanged =
      (validated.precioBolsa !== undefined && validated.precioBolsa !== toNum(existing.precioBolsa)) ||
      (validated.diferencial !== undefined && validated.diferencial !== toNum(existing.diferencial)) ||
      (validated.posicionBolsa !== undefined && validated.posicionBolsa !== existing.posicionBolsa);
    if (priceChanged) {
      throw new Error("El precio está congelado. El contrato ya fue fijado.");
    }
  }

  const sacos69kg = validated.sacos69kg ?? toNum(existing.sacos69kg);
  const precioBolsa =
    validated.precioBolsa !== undefined
      ? validated.precioBolsa
      : toNum(existing.precioBolsa);
  const diferencial =
    validated.diferencial !== undefined
      ? validated.diferencial
      : toNum(existing.diferencial);
  const tipoCambio =
    validated.tipoCambio !== undefined
      ? validated.tipoCambio
      : toNum(existing.tipoCambio);

  const tipoFacturacion = validated.tipoFacturacion ?? existing.tipoFacturacion;
  const montoCredito = validated.montoCredito !== undefined
    ? validated.montoCredito
    : toNum(existing.montoCredito);

  const computed = computeContractFields({
    sacos69kg,
    precioBolsa,
    diferencial,
    tipoCambio,
    tipoFacturacion,
    montoCredito,
  });

  // Snapshot current prices before updating
  await prisma.contractPriceSnapshot.create({
    data: {
      contractId: validated.id,
      precioBolsa: existing.precioBolsa,
      diferencial: existing.diferencial,
      tipoCambio: existing.tipoCambio,
      posicionBolsa: existing.posicionBolsa,
      status: existing.status,
      triggeredBy: session.userId,
      reason: "price_update",
    },
  });

  const contract = await prisma.contract.update({
    where: { id: validated.id },
    data: {
      ...(validated.contractNumber && {
        contractNumber: validated.contractNumber,
      }),
      ...(validated.clientId && { clientId: validated.clientId }),
      ...(validated.status && { status: validated.status }),
      ...(validated.regions && { regions: validated.regions }),
      ...(validated.puntaje && { puntaje: validated.puntaje }),
      ...(validated.rendimiento && { rendimiento: validated.rendimiento }),
      ...(validated.lote !== undefined && { lote: validated.lote }),
      ...(validated.notes !== undefined && { notes: validated.notes }),
      ...(validated.posicionNY !== undefined && {
        posicionNY: validated.posicionNY,
      }),
      ...(validated.fechaEmbarque !== undefined && {
        fechaEmbarque: validated.fechaEmbarque,
      }),
      ...(validated.tipoFacturacion && { tipoFacturacion: validated.tipoFacturacion }),
      ...(validated.posicionBolsa !== undefined && { posicionBolsa: validated.posicionBolsa }),
      ...(validated.montoCredito !== undefined && { montoCredito: validated.montoCredito }),
      ...(validated.cosecha !== undefined && { cosecha: validated.cosecha }),
      sacos69kg,
      precioBolsa,
      diferencial,
      ...computed,
    },
  });

  await createAuditLog(
    session.userId,
    "UPDATE",
    "Contract",
    contract.id,
    existing,
    contract
  );

  revalidatePath("/contracts");
  revalidatePath(`/contracts/${contract.id}`);
  return contract;
}

export async function deleteContract(id: string) {
  const session = await requireRole("ADMIN");

  const existing = await prisma.contract.findUniqueOrThrow({
    where: { id },
  });

  await prisma.contract.delete({ where: { id } });

  await createAuditLog(
    session.userId,
    "DELETE",
    "Contract",
    id,
    existing,
    null
  );

  revalidatePath("/contracts");
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  NEGOCIACION: ["CONFIRMADO", "CANCELADO"],
  CONFIRMADO: ["FIJADO", "NO_FIJADO", "CANCELADO"],
  NO_FIJADO: ["FIJADO", "CANCELADO"],
  FIJADO: ["EMBARCADO", "CANCELADO"],
  EMBARCADO: ["LIQUIDADO"],
  LIQUIDADO: [],
  CANCELADO: [],
};

export interface MonthlyContextStats {
  month: string; // "2026-03"
  contractCount: number;
  totalSacos69kg: number;
  totalRevenue: number;
  avgMargin: number;
  contracts: {
    id: string;
    contractNumber: string;
    clientName: string;
    sacos69kg: number;
    totalPagoQTZ: number;
    margin: number;
    status: string;
  }[];
}

export async function getMonthlyContext(
  referenceDate?: Date | null,
  excludeId?: string
): Promise<MonthlyContextStats> {
  await requireAuth();

  const ref = referenceDate ?? new Date();
  const year = ref.getFullYear();
  const month = ref.getMonth();
  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const monthWhere = {
    createdAt: { gte: startOfMonth, lte: endOfMonth },
    status: { not: "CANCELADO" as const },
    ...(excludeId ? { id: { not: excludeId } } : {}),
  };

  const [agg, peers] = await Promise.all([
    prisma.contract.aggregate({
      where: monthWhere,
      _sum: { sacos69kg: true, totalPagoQTZ: true, facturacionKgs: true, utilidadSinCF: true },
      _count: true,
    }),
    prisma.contract.findMany({
      where: monthWhere,
      select: {
        id: true, contractNumber: true, sacos69kg: true,
        totalPagoQTZ: true, facturacionKgs: true, utilidadSinCF: true,
        status: true, client: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const totalSacos69kg = toNum(agg._sum.sacos69kg);
  const totalRevenue = toNum(agg._sum.totalPagoQTZ);
  const totalFactKgs = toNum(agg._sum.facturacionKgs);
  const totalUtilidad = toNum(agg._sum.utilidadSinCF);
  const avgMargin = totalFactKgs > 0 ? totalUtilidad / totalFactKgs : 0;

  const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;

  return {
    month: monthStr,
    contractCount: agg._count,
    totalSacos69kg,
    totalRevenue,
    avgMargin,
    contracts: peers.map((c) => {
      const factKgs = toNum(c.facturacionKgs);
      const utilidad = toNum(c.utilidadSinCF);
      return {
        id: c.id,
        contractNumber: c.contractNumber,
        clientName: c.client.name,
        sacos69kg: toNum(c.sacos69kg),
        totalPagoQTZ: toNum(c.totalPagoQTZ),
        margin: factKgs > 0 ? utilidad / factKgs : 0,
        status: c.status,
      };
    }),
  };
}

export async function changeContractStatus(id: string, newStatus: string) {
  const session = await requireRole("OPERATOR");

  const existing = await prisma.contract.findUniqueOrThrow({
    where: { id },
    include: { materiaPrimaAllocations: true },
  });

  const allowed = VALID_TRANSITIONS[existing.status] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new Error(
      `No se puede cambiar de ${existing.status} a ${newStatus}.`
    );
  }

  // Business rule: "No se fija venta sin haber fijado compra"
  if (newStatus === "FIJADO" && existing.materiaPrimaAllocations.length === 0) {
    throw new Error(
      "No se puede fijar venta sin haber fijado compra. Asigna materia prima primero."
    );
  }

  // Snapshot prices on status change
  await prisma.contractPriceSnapshot.create({
    data: {
      contractId: id,
      precioBolsa: existing.precioBolsa,
      diferencial: existing.diferencial,
      tipoCambio: existing.tipoCambio,
      posicionBolsa: existing.posicionBolsa,
      status: existing.status,
      triggeredBy: session.userId,
      reason: "status_change",
    },
  });

  const contract = await prisma.contract.update({
    where: { id },
    data: { status: newStatus as ContractStatus },
  });

  await createAuditLog(
    session.userId,
    "STATUS_CHANGE",
    "Contract",
    id,
    { status: existing.status },
    { status: newStatus }
  );

  revalidatePath("/contracts");
  revalidatePath(`/contracts/${id}`);
  return contract;
}
