/**
 * Migration script: Subproducto records -> MillingOutput
 *
 * For each existing Subproducto record, creates:
 * 1. A synthetic MillingOrder (status: COMPLETADO)
 * 2. A MillingOutput (outputType: SEGUNDA)
 * 3. A corresponding Lot (stage: SUBPRODUCTO)
 *
 * Run: npx tsx scripts/migrate-subproductos.ts
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("Starting Subproducto -> MillingOutput migration...\n");

  const subproductos = await prisma.subproducto.findMany({
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
