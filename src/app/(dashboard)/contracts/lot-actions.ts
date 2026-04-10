"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/services/auth";
import { createAuditLog } from "@/lib/services/audit";
import { ContractLotAllocationSchema } from "@/lib/validations/schemas";
import type { ContractLotAllocationInput } from "@/lib/validations/schemas";

export async function getContractLotAllocations(contractId: string) {
  await requireAuth();
  return prisma.contractLotAllocation.findMany({
    where: { contractId },
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
    orderBy: { createdAt: "asc" },
  });
}

export async function getAvailableOroLots() {
  await requireAuth();
  return prisma.lot.findMany({
    where: {
      stage: "ORO_EXPORTABLE",
      quantityQQ: { gt: 0 },
    },
    select: {
      id: true,
      lotNumber: true,
      quantityQQ: true,
      qualityGrade: true,
      supplier: { select: { id: true, name: true } },
    },
    orderBy: { lotNumber: "asc" },
  });
}

export async function allocateLotToContract(data: ContractLotAllocationInput) {
  const session = await requirePermission("contract:lot_allocate");
  const validated = ContractLotAllocationSchema.parse(data);

  const allocation = await prisma.contractLotAllocation.create({
    data: validated,
  });

  await createAuditLog(
    session.userId,
    "CREATE",
    "ContractLotAllocation",
    allocation.id,
    null,
    validated
  );

  revalidatePath(`/contracts/${validated.contractId}`);
  return allocation;
}

export async function deallocateLotFromContract(id: string) {
  const session = await requirePermission("contract:lot_allocate");

  const allocation = await prisma.contractLotAllocation.findUniqueOrThrow({
    where: { id },
  });
  await prisma.contractLotAllocation.delete({ where: { id } });

  await createAuditLog(
    session.userId,
    "DELETE",
    "ContractLotAllocation",
    id,
    allocation,
    null
  );

  revalidatePath(`/contracts/${allocation.contractId}`);
}
