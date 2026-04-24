"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import {
  AUTH_COOKIE,
  hashPassword,
  requireAuth,
  verifyPassword,
} from "@/lib/services/auth";
import { createAuditLog } from "@/lib/services/audit";
import {
  PasswordChangeSchema,
  type PasswordChangeInput,
} from "@/lib/validations/schemas";

export async function changeOwnPassword(data: PasswordChangeInput) {
  const session = await requireAuth();
  const validated = PasswordChangeSchema.parse(data);

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: { passwordHash: true },
  });

  const ok = await verifyPassword(validated.currentPassword, user.passwordHash);
  if (!ok) {
    throw new Error("La contraseña actual es incorrecta");
  }

  const newHash = await hashPassword(validated.newPassword);

  await prisma.user.update({
    where: { id: session.userId },
    data: { passwordHash: newHash },
  });

  await createAuditLog(
    session.userId,
    "UPDATE",
    "User.password",
    session.userId,
    null,
    { changedAt: new Date().toISOString() }
  );

  // Force re-auth on this browser. Cannot invalidate other active JWTs without
  // a tokenVersion column — tracked as a follow-up.
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE);
}
