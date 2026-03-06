"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/services/auth";
import { createAuditLog } from "@/lib/services/audit";
import { recalculateShipment } from "@/lib/services/shipment-aggregation";
import { ShipmentCreateSchema } from "@/lib/validations/schemas";
import type { ShipmentCreateInput } from "@/lib/validations/schemas";

export async function getShipments() {
  await requireAuth();
  return prisma.shipment.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }],
    include: {
      _count: { select: { contracts: true, materiaPrima: true } },
    },
  });
}

export async function getShipment(id: string) {
  await requireAuth();
  return prisma.shipment.findUnique({
    where: { id },
    include: {
      contracts: { include: { client: true }, orderBy: { contractNumber: "asc" } },
      materiaPrima: { orderBy: { createdAt: "asc" } },
      subproductos: { orderBy: { createdAt: "asc" } },
      containers: { orderBy: { createdAt: "asc" } },
    },
  });
}

export async function createShipment(data: ShipmentCreateInput) {
  const session = await requireRole("OPERATOR");
  const validated = ShipmentCreateSchema.parse(data);

  const shipment = await prisma.shipment.create({
    data: validated,
  });

  await createAuditLog(
    session.userId,
    "CREATE",
    "Shipment",
    shipment.id,
    null,
    validated
  );

  revalidatePath("/shipments");
  return shipment;
}

export async function updateShipment(
  data: ShipmentCreateInput & { id: string }
) {
  const session = await requireRole("OPERATOR");
  const { id, ...rest } = data;
  const validated = ShipmentCreateSchema.parse(rest);

  const old = await prisma.shipment.findUniqueOrThrow({ where: { id } });

  const shipment = await prisma.shipment.update({
    where: { id },
    data: validated,
  });

  await createAuditLog(
    session.userId,
    "UPDATE",
    "Shipment",
    id,
    old,
    validated
  );

  revalidatePath("/shipments");
  revalidatePath(`/shipments/${id}`);
  return shipment;
}

export async function deleteShipment(id: string) {
  const session = await requireRole("ADMIN");

  await prisma.shipment.delete({ where: { id } });

  await createAuditLog(session.userId, "DELETE", "Shipment", id);

  revalidatePath("/shipments");
}

export async function assignContractToShipment(
  contractId: string,
  shipmentId: string
) {
  const session = await requireRole("OPERATOR");

  const contract = await prisma.contract.findUniqueOrThrow({
    where: { id: contractId },
  });

  const oldShipmentId = contract.shipmentId;

  await prisma.contract.update({
    where: { id: contractId },
    data: { shipmentId },
  });

  await recalculateShipment(shipmentId);

  if (oldShipmentId && oldShipmentId !== shipmentId) {
    await recalculateShipment(oldShipmentId);
  }

  await createAuditLog(
    session.userId,
    "ASSIGN",
    "Contract",
    contractId,
    oldShipmentId ? { shipmentId: oldShipmentId } : null,
    { shipmentId }
  );

  revalidatePath("/shipments");
  revalidatePath(`/shipments/${shipmentId}`);
  if (oldShipmentId) revalidatePath(`/shipments/${oldShipmentId}`);
  revalidatePath("/contracts");
}

export async function unassignContractFromShipment(contractId: string) {
  const session = await requireRole("OPERATOR");

  const contract = await prisma.contract.findUniqueOrThrow({
    where: { id: contractId },
  });

  if (!contract.shipmentId) return;

  const oldShipmentId = contract.shipmentId;

  await prisma.contract.update({
    where: { id: contractId },
    data: { shipmentId: null },
  });

  await recalculateShipment(oldShipmentId);

  await createAuditLog(
    session.userId,
    "UNASSIGN",
    "Contract",
    contractId,
    { shipmentId: oldShipmentId },
    null
  );

  revalidatePath("/shipments");
  revalidatePath(`/shipments/${oldShipmentId}`);
  revalidatePath("/contracts");
}

export async function getUnassignedContracts() {
  await requireAuth();
  return prisma.contract.findMany({
    where: { shipmentId: null },
    include: { client: true },
    orderBy: { contractNumber: "asc" },
  });
}
