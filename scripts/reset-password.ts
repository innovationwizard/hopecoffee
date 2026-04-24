// Usage: npx tsx scripts/reset-password.ts <email> <newPassword>
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

async function main() {
  const [, , email, pw] = process.argv;
  if (!email || !pw) {
    console.error("Usage: tsx scripts/reset-password.ts <email> <newPassword>");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const passwordHash = await hash(pw, 12);
  const user = await prisma.user.update({
    where: { email },
    data: { passwordHash },
    select: { email: true, name: true },
  });
  console.log(`Password reset for ${user.name} <${user.email}>`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
