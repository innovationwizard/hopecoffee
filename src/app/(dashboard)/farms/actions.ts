"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/services/auth";
import { createAuditLog } from "@/lib/services/audit";
import { calculateFarmFinancing } from "@/lib/services/calculations";
import { FarmCreateSchema } from "@/lib/validations/schemas";
import type { FarmCreateInput } from "@/lib/validations/schemas";

export async function getFarms() {
  await requireAuth();
  return prisma.farm.findMany({ orderBy: { name: "asc" } });
}

export async function updateFarm(data: FarmCreateInput & { id: string }) {
  const session = await requireRole("OPERATOR");
  const { id, ...rest } = data;
  const validated = FarmCreateSchema.parse(rest);

  const calc = calculateFarmFinancing({
    totalQuetzales: validated.totalQuetzales,
    tipoCambio: validated.tipoCambio,
    aumentoPorcentaje: validated.aumentoPorcentaje,
    porcentajePrestamo: validated.porcentajePrest,
  });

  const old = await prisma.farm.findUniqueOrThrow({ where: { id } });

  await prisma.farm.update({
    where: { id },
    data: {
      name: validated.name,
      totalQuetzales: validated.totalQuetzales,
      tipoCambio: validated.tipoCambio,
      totalUSD: calc.totalUSD.toNumber(),
      porcentaje: 0,
      aumentoPorcentaje: validated.aumentoPorcentaje,
      nuevoTotal: calc.nuevoTotal.toNumber(),
      porcentajePrest: validated.porcentajePrest,
      totalPrestamo: calc.totalPrestamo.toNumber(),
    },
  });

  await createAuditLog(
    session.userId,
    "UPDATE",
    "Farm",
    id,
    old,
    validated
  );

  revalidatePath("/farms");
}
