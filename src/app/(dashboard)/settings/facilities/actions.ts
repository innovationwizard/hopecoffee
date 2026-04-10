"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/services/auth";
import { createAuditLog } from "@/lib/services/audit";
import { FacilityCreateSchema } from "@/lib/validations/schemas";
import type { z } from "zod";

type FacilityInput = z.input<typeof FacilityCreateSchema>;

export async function getFacilities() {
  await requireAuth();
  return prisma.facility.findMany({
    orderBy: { name: "asc" },
  });
}

export async function createFacility(data: FacilityInput) {
  const session = await requirePermission("facility:manage");
  const validated = FacilityCreateSchema.parse(data);

  const facility = await prisma.facility.create({
    data: validated,
  });

  await createAuditLog(
    session.userId,
    "CREATE",
    "Facility",
    facility.id,
    null,
    validated
  );

  revalidatePath("/settings/facilities");
  return facility;
}

export async function updateFacility(data: FacilityInput & { id: string }) {
  const session = await requirePermission("facility:manage");
  const { id, ...fields } = data;
  const validated = FacilityCreateSchema.parse(fields);

  const old = await prisma.facility.findUniqueOrThrow({ where: { id } });

  const facility = await prisma.facility.update({
    where: { id },
    data: validated,
  });

  await createAuditLog(
    session.userId,
    "UPDATE",
    "Facility",
    id,
    old,
    validated
  );

  revalidatePath("/settings/facilities");
  return facility;
}

export async function deleteFacility(id: string) {
  const session = await requirePermission("facility:manage");

  await prisma.facility.delete({ where: { id } });

  await createAuditLog(session.userId, "DELETE", "Facility", id);

  revalidatePath("/settings/facilities");
}
