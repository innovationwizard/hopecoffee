"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/services/auth";
import { createAuditLog } from "@/lib/services/audit";
import { generateMillingOrderNumber, generateLotNumber } from "@/lib/services/correlatives";
import {
  MillingOrderCreateSchema,
  MillingInputSchema,
  MillingOutputSchema,
} from "@/lib/validations/schemas";
import type {
  MillingOrderCreateInput,
  MillingInputInput,
  MillingOutputInput,
} from "@/lib/validations/schemas";
import Decimal from "decimal.js";

export async function getMillingOrders() {
  await requireAuth();
  return prisma.millingOrder.findMany({
    orderBy: { date: "desc" },
    include: {
      facility: true,
      _count: { select: { inputs: true, outputs: true } },
      inputs: { select: { quantityQQ: true } },
      outputs: { select: { quantityQQ: true, outputType: true } },
    },
  });
}

export async function getMillingOrder(id: string) {
  await requireAuth();
  return prisma.millingOrder.findUnique({
    where: { id },
    include: {
      facility: true,
      inputs: {
        include: {
          lot: {
            include: {
              supplier: { select: { id: true, name: true } },
            },
          },
        },
      },
      outputs: {
        include: {
          lot: { select: { id: true, lotNumber: true } },
        },
      },
    },
  });
}

export async function getAvailableLots() {
  await requireAuth();
  return prisma.lot.findMany({
    where: { stage: "PERGAMINO_BODEGA" },
    orderBy: { lotNumber: "asc" },
    include: {
      supplier: { select: { id: true, name: true } },
    },
  });
}

export async function getFacilities() {
  await requireAuth();
  return prisma.facility.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
}

function outputTypeToLotStage(outputType: string): "ORO_EXPORTABLE" | "SUBPRODUCTO" {
  if (outputType === "ORO_EXPORTABLE") return "ORO_EXPORTABLE";
  return "SUBPRODUCTO";
}

export async function createMillingOrder(
  data: MillingOrderCreateInput,
  inputs: MillingInputInput[],
  outputs: MillingOutputInput[]
) {
  const session = await requirePermission("milling:write");

  const validatedOrder = MillingOrderCreateSchema.parse(data);
  const validatedInputs = inputs.map((i) => MillingInputSchema.parse(i));
  const validatedOutputs = outputs.map((o) => MillingOutputSchema.parse(o));

  if (validatedInputs.length === 0) {
    throw new Error("Debe agregar al menos un lote de entrada.");
  }
  if (validatedOutputs.length === 0) {
    throw new Error("Debe agregar al menos una salida.");
  }

  // Validate balance: sum(outputs) ~= sum(inputs) within 1% tolerance
  const totalInputQQ = validatedInputs.reduce(
    (sum, i) => sum.plus(i.quantityQQ),
    new Decimal(0)
  );
  const totalOutputQQ = validatedOutputs.reduce(
    (sum, o) => sum.plus(o.quantityQQ),
    new Decimal(0)
  );

  if (totalInputQQ.gt(0)) {
    const diff = totalOutputQQ.minus(totalInputQQ).abs();
    const tolerance = totalInputQQ.times(0.01);
    if (diff.gt(tolerance)) {
      throw new Error(
        `El balance no cuadra. Entrada: ${totalInputQQ.toFixed(2)} QQ, Salida: ${totalOutputQQ.toFixed(2)} QQ. Diferencia permitida: 1%.`
      );
    }
  }

  const orderNumber = await generateMillingOrderNumber();

  const order = await prisma.$transaction(async (tx) => {
    // Create the milling order
    const mo = await tx.millingOrder.create({
      data: {
        orderNumber,
        facilityId: validatedOrder.facilityId ?? null,
        date: validatedOrder.date,
        operatorUserId: validatedOrder.operatorUserId ?? null,
        status: validatedOrder.status ?? "PENDIENTE",
        notes: validatedOrder.notes ?? null,
      },
    });

    // Process inputs: verify lots and update stages
    for (const input of validatedInputs) {
      const lot = await tx.lot.findUniqueOrThrow({ where: { id: input.lotId } });
      if (lot.stage !== "PERGAMINO_BODEGA") {
        throw new Error(
          `Lote ${lot.lotNumber} no esta en etapa PERGAMINO_BODEGA (actual: ${lot.stage}).`
        );
      }

      await tx.millingInput.create({
        data: {
          millingOrderId: mo.id,
          lotId: input.lotId,
          quantityQQ: input.quantityQQ,
        },
      });

      await tx.lot.update({
        where: { id: input.lotId },
        data: { stage: "EN_PROCESO" },
      });
    }

    // Process outputs
    for (const output of validatedOutputs) {
      if (output.outputType === "MERMA") {
        // Merma: no lot created
        await tx.millingOutput.create({
          data: {
            millingOrderId: mo.id,
            lotId: null,
            quantityQQ: output.quantityQQ,
            outputType: output.outputType,
            qualityGrade: output.qualityGrade ?? null,
            costPerQQ: output.costPerQQ ?? null,
          },
        });
      } else {
        // Create a new lot for the output
        const lotNumber = await generateLotNumber();
        const stage = outputTypeToLotStage(output.outputType);

        const newLot = await tx.lot.create({
          data: {
            lotNumber,
            stage,
            quantityQQ: output.quantityQQ,
            costPerQQ: output.costPerQQ ?? null,
            qualityGrade: output.qualityGrade ?? null,
            facilityId: validatedOrder.facilityId ?? null,
          },
        });

        await tx.millingOutput.create({
          data: {
            millingOrderId: mo.id,
            lotId: newLot.id,
            quantityQQ: output.quantityQQ,
            outputType: output.outputType,
            qualityGrade: output.qualityGrade ?? null,
            costPerQQ: output.costPerQQ ?? null,
          },
        });
      }
    }

    return mo;
  });

  await createAuditLog(
    session.userId,
    "CREATE",
    "MillingOrder",
    order.id,
    null,
    { orderNumber, inputs: validatedInputs, outputs: validatedOutputs }
  );

  revalidatePath("/milling");
  return order;
}

export async function completeMillingOrder(id: string) {
  const session = await requirePermission("milling:write");

  const order = await prisma.millingOrder.findUniqueOrThrow({ where: { id } });

  if (order.status === "COMPLETADO") {
    throw new Error("La orden ya esta completada.");
  }

  const updated = await prisma.millingOrder.update({
    where: { id },
    data: { status: "COMPLETADO" },
  });

  await createAuditLog(
    session.userId,
    "UPDATE",
    "MillingOrder",
    id,
    { status: order.status },
    { status: "COMPLETADO" }
  );

  revalidatePath("/milling");
  revalidatePath(`/milling/${id}`);
  return updated;
}

export async function deleteMillingOrder(id: string) {
  const session = await requirePermission("milling:write");

  const order = await prisma.millingOrder.findUniqueOrThrow({
    where: { id },
    include: {
      inputs: { select: { lotId: true } },
      outputs: { select: { lotId: true } },
    },
  });

  if (order.status !== "PENDIENTE") {
    throw new Error("Solo se pueden eliminar ordenes en estado PENDIENTE.");
  }

  await prisma.$transaction(async (tx) => {
    // Revert input lot stages back to PERGAMINO_BODEGA
    for (const input of order.inputs) {
      await tx.lot.update({
        where: { id: input.lotId },
        data: { stage: "PERGAMINO_BODEGA" },
      });
    }

    // Delete output lots that were created
    for (const output of order.outputs) {
      if (output.lotId) {
        await tx.lot.delete({ where: { id: output.lotId } });
      }
    }

    // Cascade deletes inputs/outputs
    await tx.millingOrder.delete({ where: { id } });
  });

  await createAuditLog(session.userId, "DELETE", "MillingOrder", id);

  revalidatePath("/milling");
}
