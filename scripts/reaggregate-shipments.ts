/**
 * Re-aggregate all shipments to recompute P&L with corrected formula:
 * - ISR (6% of materia prima)
 * - Comision in QTZ (not USD)
 * - Margin denominator = facturacionKgs × tipoCambio (gross billing)
 *
 * Run: npx tsx scripts/reaggregate-shipments.ts
 */
import { PrismaClient } from "@prisma/client";
import { recalculateShipment } from "../src/lib/services/shipment-aggregation";

async function main() {
  const prisma = new PrismaClient();
  const shipments = await prisma.shipment.findMany({
    select: { id: true, name: true },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });

  console.log(`Re-aggregating ${shipments.length} shipments...`);

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
