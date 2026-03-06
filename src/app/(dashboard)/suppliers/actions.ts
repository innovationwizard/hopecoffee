"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/services/auth";
import { createAuditLog } from "@/lib/services/audit";
import { SupplierAccountEntrySchema } from "@/lib/validations/schemas";
import type { z } from "zod";

export async function getSuppliers() {
  await requireAuth();
  return prisma.supplier.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { purchaseOrders: true, accountEntries: true } },
    },
  });
}

export async function getSupplier(id: string) {
  await requireAuth();
  return prisma.supplier.findUnique({
    where: { id },
    include: {
      purchaseOrders: { orderBy: { date: "desc" }, take: 20 },
      accountEntries: { orderBy: { date: "desc" } },
    },
  });
}

type AccountEntryInput = z.infer<typeof SupplierAccountEntrySchema>;

export async function createAccountEntry(data: AccountEntryInput) {
  const session = await requireRole("OPERATOR");
  const validated = SupplierAccountEntrySchema.parse(data);

  const total = validated.pergamino * validated.precio;

  const entry = await prisma.supplierAccountEntry.create({
    data: {
      ...validated,
      total,
    },
  });

  await createAuditLog(
    session.userId,
    "CREATE",
    "SupplierAccountEntry",
    entry.id,
    null,
    validated
  );

  revalidatePath(`/suppliers/${validated.supplierId}`);
  return entry;
}

export async function deleteAccountEntry(id: string) {
  const session = await requireRole("OPERATOR");

  const entry = await prisma.supplierAccountEntry.findUniqueOrThrow({
    where: { id },
  });

  await prisma.supplierAccountEntry.delete({ where: { id } });

  await createAuditLog(session.userId, "DELETE", "SupplierAccountEntry", id);

  revalidatePath(`/suppliers/${entry.supplierId}`);
}
