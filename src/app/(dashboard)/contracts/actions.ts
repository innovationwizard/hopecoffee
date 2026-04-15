"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAuth, requirePermission, requirePermissionSync } from "@/lib/services/auth";
import { createAuditLog } from "@/lib/services/audit";
import { calculateContract } from "@/lib/services/calculations";
import { generateContractCorrelative } from "@/lib/services/correlatives";
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
    where.OR = [
      { contractNumber: { contains: filters.search, mode: "insensitive" } },
      { officialCorrelative: { contains: filters.search, mode: "insensitive" } },
      { cooContractName: { contains: filters.search, mode: "insensitive" } },
    ];
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
      shipment: {
        select: {
          id: true, name: true, month: true, year: true,
          margenBruto: true,
          totalFacturacionKgs: true,
          totalSacos69: true,
          totalMateriaPrima: true,
          totalSubproducto: true,
          _count: { select: { containers: true } },
          // Pergamino totals from MP entries
          materiaPrima: { select: { pergamino: true } },
          // Subproducto oro totals
          subproductos: { select: { totalOro: true } },
        },
      },
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
  const session = await requirePermission("contract:create");
  const validated = ContractCreateSchema.parse(data);

  const computed = computeContractFields({
    sacos69kg: validated.sacos69kg,
    precioBolsa: validated.precioBolsa,
    diferencial: validated.diferencial,
    tipoCambio: validated.tipoCambio,
    montoCredito: validated.montoCredito,
    gastosExportPerSaco: validated.gastosPerSaco ?? undefined,
  });

  // Snapshot the default export cost config at creation time
  const [defaultConfig, officialCorrelative] = await Promise.all([
    prisma.exportCostConfig.findFirst({
      where: { isDefault: true },
      select: { id: true },
    }),
    generateContractCorrelative(),
  ]);

  const contract = await prisma.contract.create({
    data: {
      contractNumber: validated.contractNumber,
      officialCorrelative,
      cooContractName: validated.cooContractName ?? null,
      clientId: validated.clientId,
      shipmentId: validated.shipmentId ?? null,
      status: validated.status,
      regions: validated.regions,
      puntaje: validated.puntaje,
      sacos69kg: validated.sacos69kg,
      precioBolsa: validated.precioBolsa ?? null,
      diferencial: validated.diferencial ?? null,
      posicionBolsa: validated.posicionBolsa ?? null,
      montoCredito: validated.montoCredito ?? null,
      cfTasaAnual: validated.cfTasaAnual ?? null,
      cfMeses: validated.cfMeses ?? null,
      isrRate: validated.isrRate ?? null,
      isrAmount: validated.isrAmount ?? null,
      cosecha: validated.cosecha ?? null,
      posicionNY: validated.posicionNY ?? null,
      fechaEmbarque: validated.fechaEmbarque ?? null,
      lote: validated.lote ?? null,
      notes: validated.notes ?? null,
      // Inventory & subproducto
      precioPromedioInv: validated.precioPromedioInv ?? null,
      subproductos: validated.subproductosQty ?? null,
      precioSubproducto: validated.precioSubproducto ?? null,
      exportCostConfigId: defaultConfig?.id ?? null,
      // Export cost breakdown
      gastosPerSaco: validated.gastosPerSaco ?? null,
      exportTrillaPerQQ: validated.exportTrillaPerQQ ?? null,
      exportSacoYute: validated.exportSacoYute ?? null,
      exportEstampado: validated.exportEstampado ?? null,
      exportBolsaGrainPro: validated.exportBolsaGrainPro ?? null,
      exportFitoSanitario: validated.exportFitoSanitario ?? null,
      exportImpuestoAnacafe1: validated.exportImpuestoAnacafe1 ?? null,
      exportImpuestoAnacafe2: validated.exportImpuestoAnacafe2 ?? null,
      exportInspeccionOirsa: validated.exportInspeccionOirsa ?? null,
      exportFumigacion: validated.exportFumigacion ?? null,
      exportEmisionDocumento: validated.exportEmisionDocumento ?? null,
      exportFletePuerto: validated.exportFletePuerto ?? null,
      exportSeguro: validated.exportSeguro ?? null,
      exportCustodio: validated.exportCustodio ?? null,
      exportAgenteAduanal: validated.exportAgenteAduanal ?? null,
      exportComisionOrganico: validated.exportComisionOrganico ?? null,
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

const FINANCIAL_FIELDS = [
  "precioBolsa", "diferencial", "comisionCompra", "comisionVenta",
  "montoCredito", "cfTasaAnual", "cfMeses", "tipoCambio", "isrRate", "isrAmount",
  "gastosPerSaco", "exportTrillaPerQQ", "exportSacoYute", "exportEstampado",
  "exportBolsaGrainPro", "exportFitoSanitario", "exportImpuestoAnacafe1",
  "exportImpuestoAnacafe2", "exportInspeccionOirsa", "exportFumigacion",
  "exportEmisionDocumento", "exportFletePuerto", "exportSeguro",
  "exportCustodio", "exportAgenteAduanal", "exportComisionOrganico",
  "posicionBolsa",
] as const;

export async function updateContract(data: ContractUpdateInput) {
  const session = await requireAuth();
  const validated = ContractUpdateSchema.parse(data);

  const existing = await prisma.contract.findUniqueOrThrow({
    where: { id: validated.id },
  });

  // Permission check: financial fields require contract:update_financial
  const touchesFinancial = FINANCIAL_FIELDS.some(
    (f) => (validated as Record<string, unknown>)[f] !== undefined
  );

  if (touchesFinancial) {
    requirePermissionSync(session.role, "contract:update_financial");
  } else {
    requirePermissionSync(session.role, "contract:update");
  }

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

  const montoCredito = validated.montoCredito !== undefined
    ? validated.montoCredito
    : toNum(existing.montoCredito);

  const computed = computeContractFields({
    sacos69kg,
    precioBolsa,
    diferencial,
    tipoCambio,
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
      ...(validated.lote !== undefined && { lote: validated.lote }),
      ...((validated as Record<string, unknown>).cooContractName !== undefined && {
        cooContractName: (validated as Record<string, unknown>).cooContractName as string | null,
      }),
      ...(validated.notes !== undefined && { notes: validated.notes }),
      ...(validated.posicionNY !== undefined && {
        posicionNY: validated.posicionNY,
      }),
      ...(validated.fechaEmbarque !== undefined && {
        fechaEmbarque: validated.fechaEmbarque,
      }),
      ...(validated.posicionBolsa !== undefined && { posicionBolsa: validated.posicionBolsa }),
      ...(validated.montoCredito !== undefined && { montoCredito: validated.montoCredito }),
      ...(validated.cosecha !== undefined && { cosecha: validated.cosecha }),
      ...(validated.shipmentId !== undefined && { shipmentId: validated.shipmentId ?? null }),
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
  const session = await requirePermission("contract:delete");

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

export interface MonthlyContextContract {
  id: string;
  contractNumber: string;
  clientName: string;
  sacos69kg: number;
  totalPagoQTZ: number;
  // Per-contract P&L (prorated from own shipment) for custom context aggregation
  facturacionQTZ: number;
  utilidadBruta: number;
  margin: number;
  status: string;
}

export interface MonthlyContextStats {
  month: string; // "2026-03"
  contractCount: number;
  totalSacos69kg: number;
  totalRevenue: number;
  avgMargin: number;
  contracts: MonthlyContextContract[];
}

export async function getMonthlyContext(
  referenceDate?: Date | null
): Promise<MonthlyContextStats> {
  await requireAuth();

  const ref = referenceDate ?? new Date();
  const year = ref.getFullYear();
  const month = ref.getMonth() + 1; // 1-12 matching Shipment.month

  const shipmentWhere = { month, year };
  const contractWhere = {
    shipment: shipmentWhere,
    status: { not: "CANCELADO" as const },
  };

  // Fetch contracts WITH their shipment P&L data so we can compute per-contract margins
  const peers = await prisma.contract.findMany({
    where: contractWhere,
    select: {
      id: true, contractNumber: true, sacos69kg: true,
      totalPagoQTZ: true, facturacionKgs: true, tipoCambio: true,
      status: true, client: { select: { name: true } },
      shipment: {
        select: {
          totalSacos69: true,
          totalFacturacionQTZ: true,
          totalMateriaPrima: true,
          totalISR: true,
          totalComision: true,
          totalSubproducto: true,
          utilidadBruta: true,
          margenBruto: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Build per-contract P&L by prorating each contract's own shipment costs
  const contracts: MonthlyContextContract[] = peers.map((c) => {
    const sacos = toNum(c.sacos69kg);
    const pagoQTZ = toNum(c.totalPagoQTZ);
    const factKgs = toNum(c.facturacionKgs);
    const tc = toNum(c.tipoCambio) || 7.65;
    const contractFactQTZ = factKgs * tc;

    const s = c.shipment;
    const shipSacos = s ? toNum(s.totalSacos69) : 0;
    const share = shipSacos > 0 ? sacos / shipSacos : 0;

    // Prorate THIS contract's own shipment costs by its sacos share
    const mp = s ? toNum(s.totalMateriaPrima) * share : 0;
    const isr = s ? toNum(s.totalISR) * share : 0;
    const comision = s ? toNum(s.totalComision) * share : 0;
    const subproducto = s ? toNum(s.totalSubproducto) * share : 0;

    const utilidadBruta = pagoQTZ - mp - isr - comision + subproducto;
    const margin = contractFactQTZ > 0 ? utilidadBruta / contractFactQTZ : 0;

    return {
      id: c.id,
      contractNumber: c.contractNumber,
      clientName: c.client.name,
      sacos69kg: sacos,
      totalPagoQTZ: pagoQTZ,
      facturacionQTZ: contractFactQTZ,
      utilidadBruta,
      margin,
      status: c.status,
    };
  });

  const totalSacos69kg = contracts.reduce((s, c) => s + c.sacos69kg, 0);
  const totalRevenue = contracts.reduce((s, c) => s + c.totalPagoQTZ, 0);
  const totalFactQTZ = contracts.reduce((s, c) => s + c.facturacionQTZ, 0);
  const totalUtilBruta = contracts.reduce((s, c) => s + c.utilidadBruta, 0);
  const avgMargin = totalFactQTZ > 0 ? totalUtilBruta / totalFactQTZ : 0;

  const monthStr = `${year}-${String(month).padStart(2, "0")}`;

  return {
    month: monthStr,
    contractCount: contracts.length,
    totalSacos69kg,
    totalRevenue,
    avgMargin,
    contracts,
  };
}

export async function changeContractStatus(id: string, newStatus: string) {
  const session = await requirePermission("contract:change_status");

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
