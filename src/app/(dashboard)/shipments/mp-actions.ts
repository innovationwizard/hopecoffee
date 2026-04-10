"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/services/auth";
import { createAuditLog } from "@/lib/services/audit";
import { recalculateShipment } from "@/lib/services/shipment-aggregation";
import { calculateMateriaPrima } from "@/lib/services/calculations";
import { MateriaPrimaCreateSchema } from "@/lib/validations/schemas";
import type { MateriaPrimaCreateInput } from "@/lib/validations/schemas";

export async function createMateriaPrima(data: MateriaPrimaCreateInput) {
  const session = await requirePermission("materia_prima:write");
  const validated = MateriaPrimaCreateSchema.parse(data);

  const calc = calculateMateriaPrima({
    punteo: validated.punteo,
    oro: validated.oro,
    rendimiento: validated.rendimiento,
    precioPromQ: validated.precioPromQ,
  });

  const mp = await prisma.materiaPrima.create({
    data: {
      shipmentId: validated.shipmentId,
      supplierId: validated.supplierId,
      supplierNote: validated.supplierNote,
      isPurchased: validated.isPurchased,
      punteo: validated.punteo,
      oro: validated.oro,
      rendimiento: validated.rendimiento,
      pergamino: calc.pergamino.toNumber(),
      precioPromQ: validated.precioPromQ,
      totalMP: calc.totalMP.toNumber(),
    },
  });

  await recalculateShipment(validated.shipmentId);

  await createAuditLog(
    session.userId,
    "CREATE",
    "MateriaPrima",
    mp.id,
    null,
    validated
  );

  revalidatePath(`/shipments/${validated.shipmentId}`);
  return mp;
}

export async function updateMateriaPrima(
  data: MateriaPrimaCreateInput & { id: string }
) {
  const session = await requirePermission("materia_prima:write");
  const { id, ...rest } = data;
  const validated = MateriaPrimaCreateSchema.parse(rest);

  const calc = calculateMateriaPrima({
    punteo: validated.punteo,
    oro: validated.oro,
    rendimiento: validated.rendimiento,
    precioPromQ: validated.precioPromQ,
  });

  const old = await prisma.materiaPrima.findUniqueOrThrow({ where: { id } });

  await prisma.materiaPrima.update({
    where: { id },
    data: {
      supplierId: validated.supplierId,
      supplierNote: validated.supplierNote,
      isPurchased: validated.isPurchased,
      punteo: validated.punteo,
      oro: validated.oro,
      rendimiento: validated.rendimiento,
      pergamino: calc.pergamino.toNumber(),
      precioPromQ: validated.precioPromQ,
      totalMP: calc.totalMP.toNumber(),
    },
  });

  await recalculateShipment(validated.shipmentId);

  await createAuditLog(
    session.userId,
    "UPDATE",
    "MateriaPrima",
    id,
    old,
    validated
  );

  revalidatePath(`/shipments/${validated.shipmentId}`);
}

export async function deleteMateriaPrima(id: string) {
  const session = await requirePermission("materia_prima:write");

  const mp = await prisma.materiaPrima.findUniqueOrThrow({ where: { id } });

  await prisma.materiaPrima.delete({ where: { id } });

  await recalculateShipment(mp.shipmentId);

  await createAuditLog(session.userId, "DELETE", "MateriaPrima", id);

  revalidatePath(`/shipments/${mp.shipmentId}`);
}
