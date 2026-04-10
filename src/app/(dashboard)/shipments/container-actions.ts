"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/services/auth";
import { createAuditLog } from "@/lib/services/audit";
import { ContainerCreateSchema } from "@/lib/validations/schemas";
import type { ContainerCreateInput } from "@/lib/validations/schemas";

export async function getContainers(shipmentId: string) {
  return prisma.container.findMany({
    where: { shipmentId },
    orderBy: { createdAt: "asc" },
  });
}

export async function createContainer(data: ContainerCreateInput) {
  const session = await requirePermission("container:write");
  const validated = ContainerCreateSchema.parse(data);

  const container = await prisma.container.create({
    data: validated,
  });

  await createAuditLog(
    session.userId,
    "CREATE",
    "Container",
    container.id,
    null,
    validated
  );

  revalidatePath(`/shipments/${validated.shipmentId}`);
  return container;
}

export async function deleteContainer(id: string) {
  const session = await requirePermission("container:write");

  const container = await prisma.container.findUniqueOrThrow({ where: { id } });
  await prisma.container.delete({ where: { id } });

  await createAuditLog(session.userId, "DELETE", "Container", id);

  revalidatePath(`/shipments/${container.shipmentId}`);
}
