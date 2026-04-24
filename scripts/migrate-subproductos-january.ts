// ============================================================================
// ⚠️  JAN-SCOPED FROZEN REFERENCE — 2026-04-23
// ============================================================================
// Per RECONCILIATION_PLAN_2026_JAN_MAY.md §1.2, the Jan 2026 prod DB is frozen.
// The original script iterated every Subproducto in the DB (whole-DB scope
// forbidden by directive 6 of 2026-04-23). It has been renamed to
// scripts/migrate-subproductos-january.ts and scoped to Jan 2026 subproductos.
//
// The top-level `throw` below prevents accidental execution. Do not run.
// For any non-Jan month, build an equivalent per-month migration step inside
// the per-month ETL script.
// ============================================================================

throw new Error(
  "scripts/migrate-subproductos-january.ts — decommissioned 2026-04-23. Jan prod DB is frozen; see RECONCILIATION_PLAN_2026_JAN_MAY.md §1.2."
);

/**
 * Migration script: Subproducto records -> MillingOutput (Jan 2026 scope only)
 *
 * For each existing Jan 2026 Subproducto record, creates:
 * 1. A synthetic MillingOrder (status: COMPLETADO)
 * 2. A MillingOutput (outputType: SEGUNDA)
 * 3. A corresponding Lot (stage: SUBPRODUCTO)
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("Starting Subproducto -> MillingOutput migration (Jan 2026 only)...\n");

  const subproductos = await prisma.subproducto.findMany({
    where: { shipment: { year: 2026, month: 1 } },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${subproductos.length} Subproducto records to migrate.\n`);

  if (subproductos.length === 0) {
    console.log("Nothing to migrate.");
    return;
  }

  let migrated = 0;

  for (let i = 0; i < subproductos.length; i++) {
    const sub = subproductos[i];
    const seq = String(i + 1).padStart(4, "0");
    const orderNumber = `TRIA-MIGR-${seq}`;
    const lotNumber = `LOT-MIGR-${seq}`;

    const totalOro = Number(sub.totalOro);
    const precioSinIVA = Number(sub.precioSinIVA);
    const costPerQQ = totalOro > 0 ? precioSinIVA : 0;

    await prisma.$transaction(async (tx: any) => {
      // Create synthetic milling order
      const mo = await tx.millingOrder.create({
        data: {
          orderNumber,
          date: sub.createdAt,
          status: "COMPLETADO",
          notes: `Migrado de Subproducto (shipmentId: ${sub.shipmentId})`,
        },
      });

      // Create output lot
      const lot = await tx.lot.create({
        data: {
          lotNumber,
          stage: "SUBPRODUCTO",
          quantityQQ: totalOro,
          costPerQQ,
        },
      });

      // Create milling output
      await tx.millingOutput.create({
        data: {
          millingOrderId: mo.id,
          lotId: lot.id,
          quantityQQ: totalOro,
          outputType: "SEGUNDA",
          costPerQQ,
        },
      });
    });

    migrated++;
    console.log(`  [${migrated}/${subproductos.length}] ${orderNumber} — ${totalOro} QQ (${lotNumber})`);
  }

  // Verify
  const millingCount = await prisma.millingOrder.count({
    where: { orderNumber: { startsWith: "TRIA-MIGR-" } },
  });
  const outputCount = await prisma.millingOutput.count({
    where: { millingOrder: { orderNumber: { startsWith: "TRIA-MIGR-" } } },
  });

  console.log(`\nMigration complete.`);
  console.log(`  Subproductos processed: ${migrated}`);
  console.log(`  MillingOrders created:  ${millingCount}`);
  console.log(`  MillingOutputs created: ${outputCount}`);

  if (millingCount !== subproductos.length || outputCount !== subproductos.length) {
    console.error("WARNING: Count mismatch! Expected", subproductos.length, "of each.");
  } else {
    console.log("  Counts verified OK.");
  }
}

main()
  .catch((err: Error) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
