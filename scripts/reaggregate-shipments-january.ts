// ============================================================================
// ⚠️  JAN-SCOPED FROZEN REFERENCE — 2026-04-23
// ============================================================================
// Per RECONCILIATION_PLAN_2026_JAN_MAY.md §1.2, the Jan 2026 prod DB is frozen.
// The original script swept every shipment in the DB (whole-DB scope forbidden
// by directive 6 of 2026-04-23). It has been renamed to
// scripts/reaggregate-shipments-january.ts and scoped to Jan 2026 shipments.
//
// The top-level `throw` below prevents accidental execution. Do not run.
// For any non-Jan month, call recalculateShipment(shipmentId) inline from the
// per-month ETL script.
// ============================================================================

throw new Error(
  "scripts/reaggregate-shipments-january.ts — decommissioned 2026-04-23. Jan prod DB is frozen; see RECONCILIATION_PLAN_2026_JAN_MAY.md §1.2."
);

/**
 * Re-aggregate Jan 2026 shipments (frozen reference — do not run).
 * Original whole-DB logic preserved below, now scoped to Jan only.
 */
import { PrismaClient } from "@prisma/client";
import { recalculateShipment } from "../src/lib/services/shipment-aggregation";

async function main() {
  const prisma = new PrismaClient();
  const shipments = await prisma.shipment.findMany({
    where: { year: 2026, month: 1 },
    select: { id: true, name: true },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });

  console.log(`Re-aggregating ${shipments.length} Jan 2026 shipments...`);

  for (const s of shipments) {
    await recalculateShipment(s.id);
    console.log(`  ✓ ${s.name}`);
  }

  console.log("Done.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
