"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/services/auth";
import { createAuditLog } from "@/lib/services/audit";
import { SupplierAccountEntrySchema } from "@/lib/validations/schemas";
import { generateLotNumber } from "@/lib/services/correlatives";
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
  const session = await requirePermission("supplier_account:write");
  const validated = SupplierAccountEntrySchema.parse(data);

  const total = validated.pergamino * validated.precio;

  // Find the default receiving facility (first active BODEGA)
  const defaultFacility = await prisma.facility.findFirst({
    where: { type: "BODEGA", isActive: true },
    orderBy: { name: "asc" },
  });

  const lotNumber = await generateLotNumber();

  const [entry, lot] = await prisma.$transaction(async (tx) => {
    const createdLot = await tx.lot.create({
      data: {
        lotNumber,
        supplierId: validated.supplierId,
        facilityId: defaultFacility?.id ?? null,
        stage: "PERGAMINO_BODEGA",
        quantityQQ: validated.pergamino,
        receptionDate: validated.date,
        costPerQQ: validated.precio,
      },
    });

    const createdEntry = await tx.supplierAccountEntry.create({
      data: {
        ...validated,
        total,
        lotId: createdLot.id,
        facilityId: defaultFacility?.id ?? null,
      },
    });

    return [createdEntry, createdLot] as const;
  });

  await createAuditLog(
    session.userId,
    "CREATE",
    "SupplierAccountEntry",
    entry.id,
    null,
    validated
  );

  await createAuditLog(
    session.userId,
    "CREATE",
    "Lot",
    lot.id,
    null,
    { lotNumber, supplierId: validated.supplierId, quantityQQ: validated.pergamino }
  );

  revalidatePath(`/suppliers/${validated.supplierId}`);
  revalidatePath("/inventory");
  return entry;
}

export async function deleteAccountEntry(id: string) {
  const session = await requirePermission("supplier_account:write");

  const entry = await prisma.supplierAccountEntry.findUniqueOrThrow({
    where: { id },
  });

  await prisma.supplierAccountEntry.delete({ where: { id } });

  await createAuditLog(session.userId, "DELETE", "SupplierAccountEntry", id);

  revalidatePath(`/suppliers/${entry.supplierId}`);
}
