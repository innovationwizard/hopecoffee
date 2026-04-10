"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/services/auth";
import { createAuditLog } from "@/lib/services/audit";
import { ContainerLotSchema } from "@/lib/validations/schemas";
import type { ContainerLotInput } from "@/lib/validations/schemas";

export async function getContainerLots(containerId: string) {
  await requireAuth();
  return prisma.containerLot.findMany({
    where: { containerId },
    include: {
      lot: {
        select: {
          id: true,
          lotNumber: true,
          stage: true,
          quantityQQ: true,
          supplier: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { lot: { lotNumber: "asc" } },
  });
}

export async function assignLotToContainer(data: ContainerLotInput) {
  const session = await requirePermission("container:lot_assign");
  const validated = ContainerLotSchema.parse(data);

  const link = await prisma.containerLot.create({
    data: validated,
  });

  await createAuditLog(
    session.userId,
    "CREATE",
    "ContainerLot",
    link.id,
    null,
    validated
  );

  const container = await prisma.container.findUniqueOrThrow({
    where: { id: validated.containerId },
    select: { shipmentId: true },
  });

  revalidatePath(`/shipments/${container.shipmentId}`);
  return link;
}

export async function unassignLotFromContainer(id: string) {
  const session = await requirePermission("container:lot_assign");

  const link = await prisma.containerLot.findUniqueOrThrow({
    where: { id },
    include: { container: { select: { shipmentId: true } } },
  });
  await prisma.containerLot.delete({ where: { id } });

  await createAuditLog(
    session.userId,
    "DELETE",
    "ContainerLot",
    id,
    link,
    null
  );

  revalidatePath(`/shipments/${link.container.shipmentId}`);
}

export async function shipContainer(containerId: string) {
  const session = await requirePermission("container:lot_assign");

  const container = await prisma.container.findUniqueOrThrow({
    where: { id: containerId },
    include: {
      containerLots: {
        include: { lot: true },
      },
    },
  });

  if (container.containerLots.length === 0) {
    throw new Error("El contenedor no tiene lotes asignados para despachar.");
  }

  for (const cl of container.containerLots) {
    const oldStage = cl.lot.stage;
    await prisma.lot.update({
      where: { id: cl.lot.id },
      data: { stage: "EXPORTADO" },
    });
    await createAuditLog(
      session.userId,
      "UPDATE",
      "Lot",
      cl.lot.id,
      { stage: oldStage },
      { stage: "EXPORTADO", triggeredBy: `shipContainer(${containerId})` }
    );
  }

  revalidatePath(`/shipments/${container.shipmentId}`);
}
