// ============================================================================
// Backfill posicionBolsa from SSOT — 2026-05-04
// ============================================================================
// Source: docs/ssot/febrero-2026-cell-inventory.md, cells C7-C8 = 46082
//         = March 1 2026 → PosicionBolsa.MAR
//
// All other SSOT months (Mar/Apr/May) had posicionBolsa populated during
// their ETL runs. Only these two Febrero contracts came in before that field
// was wired.
//
// Scope: contractNumber IN ("P40023", "P40029") only.
// Idempotent: skips rows that already have a non-null posicionBolsa.
//
// Usage:
//   npx tsx scripts/backfill-posicion-bolsa.ts --dry-run
//   npx tsx scripts/backfill-posicion-bolsa.ts --execute
// ============================================================================

import { PosicionBolsa, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = !process.argv.includes("--execute");

const UPDATES: { contractNumber: string; posicionBolsa: PosicionBolsa }[] = [
  { contractNumber: "P40029", posicionBolsa: PosicionBolsa.MAR },
  { contractNumber: "P40023", posicionBolsa: PosicionBolsa.MAR },
];

async function main() {
  console.log(`Mode: ${DRY_RUN ? "DRY-RUN" : "EXECUTE"}\n`);

  for (const { contractNumber, posicionBolsa } of UPDATES) {
    const existing = await prisma.contract.findUnique({
      where: { contractNumber },
      select: { id: true, contractNumber: true, posicionBolsa: true },
    });

    if (!existing) {
      console.log(`SKIP  ${contractNumber} — not found in DB`);
      continue;
    }

    if (existing.posicionBolsa !== null) {
      console.log(
        `SKIP  ${contractNumber} — already has posicionBolsa=${existing.posicionBolsa}`
      );
      continue;
    }

    if (DRY_RUN) {
      console.log(`WOULD UPDATE  ${contractNumber} → ${posicionBolsa}`);
    } else {
      await prisma.contract.update({
        where: { id: existing.id },
        data: { posicionBolsa },
      });
      console.log(`UPDATED  ${contractNumber} → ${posicionBolsa}`);
    }
  }

  console.log("\nDone.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
