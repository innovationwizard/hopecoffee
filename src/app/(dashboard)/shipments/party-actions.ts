"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/services/auth";
import { createAuditLog } from "@/lib/services/audit";
import { ShipmentPartyCreateSchema } from "@/lib/validations/schemas";
import type { ShipmentPartyCreateInput } from "@/lib/validations/schemas";

export async function getShipmentParties(shipmentId: string) {
  await requireAuth();
  return prisma.shipmentParty.findMany({
    where: { shipmentId },
    include: { client: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function createShipmentParty(data: ShipmentPartyCreateInput) {
  const session = await requirePermission("shipment:party_write");
  const validated = ShipmentPartyCreateSchema.parse(data);

  const party = await prisma.shipmentParty.create({
    data: validated,
  });

  await createAuditLog(
    session.userId,
    "CREATE",
    "ShipmentParty",
    party.id,
    null,
    validated
  );

  revalidatePath(`/shipments/${validated.shipmentId}`);
  return party;
}

export async function deleteShipmentParty(id: string) {
  const session = await requirePermission("shipment:party_write");

  const party = await prisma.shipmentParty.findUniqueOrThrow({ where: { id } });
  await prisma.shipmentParty.delete({ where: { id } });

  await createAuditLog(session.userId, "DELETE", "ShipmentParty", id, party, null);

  revalidatePath(`/shipments/${party.shipmentId}`);
}
