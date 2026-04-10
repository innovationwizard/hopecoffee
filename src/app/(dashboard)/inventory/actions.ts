"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/services/auth";
import { createAuditLog } from "@/lib/services/audit";
import { calculatePurchaseOrder } from "@/lib/services/calculations";
import { PurchaseOrderCreateSchema, PurchaseOrderUpdateSchema } from "@/lib/validations/schemas";
import type { PurchaseOrderCreateInput, PurchaseOrderUpdateInput } from "@/lib/validations/schemas";

export async function getPurchaseOrders() {
  await requireAuth();
  return prisma.purchaseOrder.findMany({
    orderBy: { date: "desc" },
    include: { supplier: true },
  });
}

export async function getPurchaseOrder(id: string) {
  await requireAuth();
  return prisma.purchaseOrder.findUnique({
    where: { id },
    include: { supplier: true },
  });
}

export async function getSuppliers() {
  await requireAuth();
  return prisma.supplier.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
}

function computePOFields(input: PurchaseOrderCreateInput) {
  const calc = calculatePurchaseOrder({
    quintalesPergamino: input.quintalesPerg,
    precioPorQQ: input.precioPerg,
    fletePorQQ: input.fletePorQQ,
    seguridad: input.seguridad,
    seguro: input.seguro,
    cadena: input.cadena,
    cargas: input.cargas,
    descargas: input.descargas,
  });
  return {
    totalCafe: calc.totalCafe.toNumber(),
    totalFlete: calc.totalFlete.toNumber(),
    costoTotalAccum: calc.costoTotalAcumulado.toNumber(),
    precioPromedio: calc.precioPromedio.toNumber(),
  };
}

export async function createPurchaseOrder(data: PurchaseOrderCreateInput) {
  const session = await requirePermission("purchase_order:write");
  const validated = PurchaseOrderCreateSchema.parse(data);
  const computed = computePOFields(validated);

  const po = await prisma.purchaseOrder.create({
    data: {
      ...validated,
      ...computed,
    },
  });

  await createAuditLog(
    session.userId,
    "CREATE",
    "PurchaseOrder",
    po.id,
    null,
    validated
  );

  revalidatePath("/purchase-orders");
  return po;
}

export async function updatePurchaseOrder(data: PurchaseOrderUpdateInput) {
  const session = await requirePermission("purchase_order:write");
  const validated = PurchaseOrderUpdateSchema.parse(data);
  const { id, ...fields } = validated;

  const old = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id } });

  // For recomputation, merge validated fields with existing values
  const merged: PurchaseOrderCreateInput = {
    orderNumber: fields.orderNumber ?? old.orderNumber,
    supplierId: fields.supplierId ?? old.supplierId,
    date: fields.date ?? old.date,
    status: fields.status ?? old.status,
    cosecha: fields.cosecha !== undefined ? fields.cosecha : old.cosecha,
    quintalesPerg: fields.quintalesPerg ?? Number(old.quintalesPerg),
    precioPerg: fields.precioPerg ?? Number(old.precioPerg),
    fletePorQQ: fields.fletePorQQ ?? Number(old.fletePorQQ),
    seguridad: fields.seguridad ?? Number(old.seguridad),
    seguro: fields.seguro ?? Number(old.seguro),
    cadena: fields.cadena ?? Number(old.cadena),
    cargas: fields.cargas ?? Number(old.cargas),
    descargas: fields.descargas ?? Number(old.descargas),
    notes: fields.notes !== undefined ? fields.notes : old.notes,
  };

  const computed = computePOFields(merged);

  const po = await prisma.purchaseOrder.update({
    where: { id },
    data: {
      ...merged,
      ...computed,
    },
  });

  await createAuditLog(
    session.userId,
    "UPDATE",
    "PurchaseOrder",
    id,
    old,
    merged
  );

  revalidatePath("/purchase-orders");
  revalidatePath(`/purchase-orders/${id}`);
  return po;
}

export async function getAccumulatedPOStats() {
  await requireAuth();
  const result = await prisma.purchaseOrder.aggregate({
    _sum: {
      quintalesPerg: true,
      costoTotalAccum: true,
    },
    _count: true,
  });

  const totalQQ = Number(result._sum.quintalesPerg ?? 0);
  const totalCost = Number(result._sum.costoTotalAccum ?? 0);
  const weightedAvgPrice = totalQQ > 0 ? totalCost / totalQQ : 0;

  return {
    totalQQ,
    totalCost,
    weightedAvgPrice,
    count: result._count,
  };
}

export async function deletePurchaseOrder(id: string) {
  const session = await requirePermission("purchase_order:delete");

  await prisma.purchaseOrder.delete({ where: { id } });

  await createAuditLog(session.userId, "DELETE", "PurchaseOrder", id);

  revalidatePath("/purchase-orders");
}
