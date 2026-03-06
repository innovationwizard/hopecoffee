import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

function toJsonSafe(value: unknown): Prisma.InputJsonValue | undefined {
  if (value == null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function createAuditLog(
  userId: string,
  action: string,
  entity: string,
  entityId: string,
  oldValue?: unknown,
  newValue?: unknown
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entity,
      entityId,
      oldValue: toJsonSafe(oldValue),
      newValue: toJsonSafe(newValue),
    },
  });
}
