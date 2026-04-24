// ============================================================================
// ⚠️  JAN-SCOPED FROZEN REFERENCE (read-only) — 2026-04-23
// ============================================================================
// Per RECONCILIATION_PLAN_2026_JAN_MAY.md §1.2, the Jan 2026 prod DB is frozen
// and this validator has been scoped to Jan 2026 queries only. Safe to run
// (read-only), but its purpose is historical verification of the Jan import
// and it is not part of any ongoing Feb–May ETL workflow.
//
// Originally: scripts/validate-importer-assertions.ts (whole-DB).
// Renamed:    scripts/validate-importer-assertions-january.ts (Jan-only).
// ============================================================================

// Importer fix validation — assertions (read-only, Jan-only).
// Verifies the three structural fixes landed in commit 3554d2b:
//   (1) MateriaPrimaAllocation rows exist and link each MP row to a contract.
//   (2) Contract.rendimiento is sourced from the paired MP row (not all 1.32).
//   (3) Contract.gastosPerSaco is persisted (not all null).
// Scope narrowed to January 2026 shipments. Exits non-zero on failure.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Every query in this validator restricts to Jan 2026 via this filter.
const JAN = { year: 2026, month: 1 } as const;

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
  console.log(" Importer fix validation — assertions (Jan 2026 scope)");
  console.log("=".repeat(78));
  console.log("");

  // --- Baseline counts (Jan-scoped) ---
  const contractCount = await prisma.contract.count({
    where: { shipment: JAN },
  });
  const mpCount = await prisma.materiaPrima.count({
    where: { shipment: JAN },
  });
  const allocCount = await prisma.materiaPrimaAllocation.count({
    where: { materiaPrima: { shipment: JAN } },
  });
  const shipmentCount = await prisma.shipment.count({ where: JAN });

  console.log(
    ` Baseline (Jan 2026): ${shipmentCount} shipments, ${contractCount} contracts, ${mpCount} MP rows, ${allocCount} allocations`
  );
  console.log("");

  record(
    "importer populated Jan 2026",
    contractCount > 0 && mpCount > 0,
    `contracts=${contractCount} MP=${mpCount}`
  );

  // ==========================================================================
  // FIX 1 — MateriaPrimaAllocation rows exist (Jan-scoped)
  // ==========================================================================

  record(
    "FIX 1 — Jan allocations exist",
    allocCount > 0,
    `allocation count = ${allocCount} (expected > 0)`
  );

  // Every Jan allocation should point at a real contract + real MP row.
  const orphanAllocs = await prisma.materiaPrimaAllocation.findMany({
    where: { materiaPrima: { shipment: JAN } },
    include: { contract: true, materiaPrima: true },
  });
  const orphans = orphanAllocs.filter(
    (a) => a.contract == null || a.materiaPrima == null
  );
  record(
    "FIX 1 — no orphan allocations in Jan",
    orphans.length === 0,
    `orphan count = ${orphans.length}`
  );

  // Sample: a Jan shipment with contracts and MP.
  const sampleShipment = await prisma.shipment.findFirst({
    where: {
      ...JAN,
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
    record(
      `FIX 1 — sample Jan shipment "${sampleShipment.name}": every MP row has ≥1 allocation (when counts match)`,
      sameCount ? mpWithAllocs.length === mpRows.length : true,
      `${mpWithAllocs.length}/${mpRows.length} allocated; counts ${sameCount ? "match" : "differ"} (skipped if differ)`
    );
  } else {
    record(
      "FIX 1 — sample Jan shipment with contracts+MP",
      false,
      "no Jan shipment found with both contracts and MP rows"
    );
  }

  // ==========================================================================
  // FIX 2 — rendimiento is sourced from the paired MP row (Jan-scoped)
  // ==========================================================================

  const distinctMpRendimientos = await prisma.$queryRaw<
    { rendimiento: string; n: bigint }[]
  >`SELECT mp."rendimiento"::text AS rendimiento, COUNT(*) AS n
    FROM materia_prima mp
    INNER JOIN shipments s ON mp."shipmentId" = s.id
    WHERE s.year = 2026 AND s.month = 1
    GROUP BY mp."rendimiento"
    ORDER BY n DESC`;

  record(
    "FIX 2 — Jan MateriaPrima rendimientos vary (not all hardcoded to 1.32)",
    distinctMpRendimientos.length > 1 ||
      (distinctMpRendimientos.length === 1 &&
        distinctMpRendimientos[0].rendimiento !== "1.320000"),
    `distinct values = ${distinctMpRendimientos.length}: ${distinctMpRendimientos
      .slice(0, 5)
      .map((r) => `${r.rendimiento}×${r.n}`)
      .join(", ")}`
  );

  // Every Jan contract with ≥1 allocation must have a resolvable MP rendimiento.
  const contractsWithAllocs = await prisma.contract.findMany({
    where: { shipment: JAN },
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
    "FIX 2 — every allocated Jan contract resolves to a valid MP rendimiento",
    unresolvable === 0 && resolvable > 0,
    `${resolvable} resolvable, ${unresolvable} unresolvable`
  );

  // ==========================================================================
  // FIX 3 — Contract.gastosPerSaco persisted (Jan-scoped)
  // ==========================================================================

  const nonNullGastos = await prisma.contract.count({
    where: { shipment: JAN, gastosPerSaco: { not: null } },
  });
  const distinctGastos = await prisma.$queryRaw<
    { gastosPerSaco: string | null; n: bigint }[]
  >`SELECT c."gastosPerSaco"::text AS "gastosPerSaco", COUNT(*) AS n
    FROM contracts c
    INNER JOIN shipments s ON c."shipmentId" = s.id
    WHERE s.year = 2026 AND s.month = 1
    GROUP BY c."gastosPerSaco"
    ORDER BY n DESC`;

  record(
    "FIX 3 — Jan Contract.gastosPerSaco is persisted for ≥1 contract",
    nonNullGastos > 0,
    `${nonNullGastos}/${contractCount} Jan contracts have gastosPerSaco set; values = ${distinctGastos
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
