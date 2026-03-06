"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/services/auth";
import { createAuditLog } from "@/lib/services/audit";
import { recalculateShipment } from "@/lib/services/shipment-aggregation";
import { calculateSubproducto } from "@/lib/services/calculations";
import { SubproductoCreateSchema } from "@/lib/validations/schemas";
import type { SubproductoCreateInput } from "@/lib/validations/schemas";

export async function createSubproducto(data: SubproductoCreateInput) {
  const session = await requireRole("OPERATOR");
  const validated = SubproductoCreateSchema.parse(data);

  const calc = calculateSubproducto({
    contenedores: validated.contenedores,
    oroPerContenedor: validated.oroPerCont,
    precioSinIVA: validated.precioSinIVA,
  });

  const sub = await prisma.subproducto.create({
    data: {
      shipmentId: validated.shipmentId,
      contenedores: validated.contenedores,
      oroPerCont: validated.oroPerCont,
      totalOro: calc.totalOro.toNumber(),
      precioSinIVA: validated.precioSinIVA,
      totalPerga: calc.totalPergamino.toNumber(),
    },
  });

  await recalculateShipment(validated.shipmentId);

  await createAuditLog(
    session.userId,
    "CREATE",
    "Subproducto",
    sub.id,
    null,
    validated
  );

  revalidatePath(`/shipments/${validated.shipmentId}`);
  return sub;
}

export async function deleteSubproducto(id: string) {
  const session = await requireRole("OPERATOR");

  const sub = await prisma.subproducto.findUniqueOrThrow({ where: { id } });

  await prisma.subproducto.delete({ where: { id } });

  await recalculateShipment(sub.shipmentId);

  await createAuditLog(session.userId, "DELETE", "Subproducto", id);

  revalidatePath(`/shipments/${sub.shipmentId}`);
}
