// ============================================================================
// Importer fix validation — assertions (read-only)
// ============================================================================
// Runs after scripts/import-excel.ts has populated a fresh database. Verifies
// the three structural fixes landed in commit 3554d2b:
//
//   (1) MateriaPrimaAllocation rows exist and link each MP row to a contract.
//   (2) Contract.rendimiento is sourced from the paired MP row (not all 1.32).
//   (3) Contract.gastosPerSaco is persisted (not all null).
//
// Intentionally tolerant: this script does NOT compare values to Enero.xlsx
// post-fix SSOT, because scripts/import-excel.ts reads docs/hopecoffee.xlsx
// (the CFO's master workbook) which is a different snapshot than Enero.xlsx
// (the January standalone). The goal here is structural correctness of the
// importer, not SSOT parity. SSOT parity is the job of phase-a-january-diff.ts
// against a reconciled DB.
//
// Exits non-zero on any assertion failure so the parent shell script can
// fail loudly.
//
// Usage: npx tsx scripts/validate-importer-assertions.ts
//   (expects DATABASE_URL in env to point at the DB just populated)
// ============================================================================

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];

function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  const tag = pass ? "  ✓" : "  ✗";
  console.log(`${tag} ${name}${detail ? " — " + detail : ""}`);
}

async function main() {
  console.log("");
  console.log("=".repeat(78));
  console.log(" Importer fix validation — assertions");
  console.log("=".repeat(78));
  console.log("");

  // --- Baseline counts ---
  const contractCount = await prisma.contract.count();
  const mpCount = await prisma.materiaPrima.count();
  const allocCount = await prisma.materiaPrimaAllocation.count();
  const shipmentCount = await prisma.shipment.count();

  console.log(
    ` Baseline: ${shipmentCount} shipments, ${contractCount} contracts, ${mpCount} MP rows, ${allocCount} allocations`
  );
  console.log("");

  record(
    "importer populated the DB",
    contractCount > 0 && mpCount > 0,
    `contracts=${contractCount} MP=${mpCount}`
  );

  // ==========================================================================
  // FIX 1 — MateriaPrimaAllocation rows exist
  // ==========================================================================
  // Before the fix: 0 allocations DB-wide regardless of contract/MP count.
  // After the fix: at least one allocation per block where contracts.length
  // === materiaPrima.length (the positional 1:1 case).
  // ==========================================================================

  record(
    "FIX 1 — allocations are being created by the importer",
    allocCount > 0,
    `allocation count = ${allocCount} (expected > 0)`
  );

  // Every allocation should point at a real contract + real MP row
  const orphanAllocs = await prisma.materiaPrimaAllocation.findMany({
    include: { contract: true, materiaPrima: true },
  });
  const orphans = orphanAllocs.filter(
    (a) => a.contract == null || a.materiaPrima == null
  );
  record(
    "FIX 1 — no orphan allocations (every row has valid FKs)",
    orphans.length === 0,
    `orphan count = ${orphans.length}`
  );

  // Sample: pick a shipment that has contracts and MP and check that every
  // MP row in that shipment has at least one allocation (positional match
  // should have created one per MP row).
  const sampleShipment = await prisma.shipment.findFirst({
    where: {
      contracts: { some: {} },
      materiaPrima: { some: {} },
    },
    include: {
      contracts: true,
      materiaPrima: { include: { allocations: true } },
    },
  });
  if (sampleShipment) {
    const mpRows = sampleShipment.materiaPrima;
    const mpWithAllocs = mpRows.filter((m) => m.allocations.length > 0);
    const sameCount =
      sampleShipment.contracts.length === mpRows.length;
    // Only require every-MP-has-alloc when the positional match applied.
    const expected = sameCount ? mpRows.length : mpWithAllocs.length;
    record(
      `FIX 1 — sample shipment "${sampleShipment.name}": every MP row has ≥1 allocation (when counts match)`,
      sameCount ? mpWithAllocs.length === mpRows.length : true,
      `${mpWithAllocs.length}/${mpRows.length} allocated; counts ${sameCount ? "match" : "differ"} (skipped if differ)`
    );
    void expected;
  } else {
    record(
      "FIX 1 — sample shipment with contracts+MP",
      false,
      "no shipment found with both contracts and MP rows"
    );
  }

  // ==========================================================================
  // FIX 2 — rendimiento is sourced from the paired MP row (not Contract)
  // ==========================================================================
  // Contract.rendimiento was dropped from the schema. The authoritative
  // per-batch yield lives on MateriaPrima.rendimiento, reachable from the
  // contract via MateriaPrimaAllocation. We check that MP rendimientos vary
  // across rows (proof the xlsx values were read, not defaulted to 1.32) and
  // that every contract with ≥1 allocation can resolve its yield via the
  // join chain.
  // ==========================================================================

  const distinctMpRendimientos = await prisma.$queryRaw<
    { rendimiento: string; n: bigint }[]
  >`SELECT "rendimiento"::text AS rendimiento, COUNT(*) AS n FROM materia_prima GROUP BY "rendimiento" ORDER BY n DESC`;

  record(
    "FIX 2 — MateriaPrima rendimientos vary (not all hardcoded to 1.32)",
    distinctMpRendimientos.length > 1 ||
      (distinctMpRendimientos.length === 1 &&
        distinctMpRendimientos[0].rendimiento !== "1.320000"),
    `distinct values = ${distinctMpRendimientos.length}: ${distinctMpRendimientos
      .slice(0, 5)
      .map((r) => `${r.rendimiento}×${r.n}`)
      .join(", ")}`
  );

  // Every contract with ≥1 allocation must have a resolvable MP rendimiento.
  const contractsWithAllocs = await prisma.contract.findMany({
    include: {
      materiaPrimaAllocations: { include: { materiaPrima: true } },
    },
  });
  let resolvable = 0;
  let unresolvable = 0;
  for (const c of contractsWithAllocs) {
    if (c.materiaPrimaAllocations.length === 0) continue;
    const firstRend = Number(
      c.materiaPrimaAllocations[0].materiaPrima.rendimiento
    );
    if (Number.isFinite(firstRend) && firstRend > 0) resolvable++;
    else unresolvable++;
  }
  record(
    "FIX 2 — every allocated contract resolves to a valid MP rendimiento",
    unresolvable === 0 && resolvable > 0,
    `${resolvable} resolvable, ${unresolvable} unresolvable`
  );

  // ==========================================================================
  // FIX 3 — Contract.gastosPerSaco persisted (not all null)
  // ==========================================================================
  // Before the fix: every contract had gastosPerSaco = null. After the fix:
  // contracts carry the parsed block rate (typically 20 or 23 per January).
  // ==========================================================================

  const gastosStats = await prisma.contract.aggregate({
    _count: { _all: true },
  });
  const nonNullGastos = await prisma.contract.count({
    where: { gastosPerSaco: { not: null } },
  });
  const distinctGastos = await prisma.$queryRaw<
    { gastosPerSaco: string | null; n: bigint }[]
  >`SELECT "gastosPerSaco"::text AS "gastosPerSaco", COUNT(*) AS n FROM contracts GROUP BY "gastosPerSaco" ORDER BY n DESC`;

  record(
    "FIX 3 — Contract.gastosPerSaco is persisted for ≥1 contract",
    nonNullGastos > 0,
    `${nonNullGastos}/${gastosStats._count._all} contracts have gastosPerSaco set; values = ${distinctGastos
      .slice(0, 5)
      .map((r) => `${r.gastosPerSaco ?? "null"}×${r.n}`)
      .join(", ")}`
  );

  // ==========================================================================
  // Summary
  // ==========================================================================
  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass).length;

  console.log("");
  console.log("=".repeat(78));
  console.log(` Summary: ${passed} passed, ${failed} failed (of ${checks.length})`);
  console.log("=".repeat(78));
  console.log("");

  await prisma.$disconnect();

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
