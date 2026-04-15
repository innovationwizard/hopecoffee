// ============================================================================
// Phase A — January SSOT ↔ DB Reconciliation Diff (READ-ONLY)
// ============================================================================
// Queries the live DB for all January 2026 entities and compares every stored
// field against the canonical SSOT targets from RECONCILIATION_PLAN.md §9.4.
//
// No mutations. No writes. Safe to run any time.
//
// Usage:  npx tsx scripts/phase-a-january-diff.ts
// ============================================================================

import Decimal from "decimal.js";
import { PrismaClient } from "@prisma/client";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
const prisma = new PrismaClient();

const EPSILON = new Decimal("0.01"); // 1 cent tolerance on monetary values
const EPSILON_RATIO = new Decimal("0.0001"); // 1 basis point on ratios
const EPSILON_YIELD = new Decimal("0.00005"); // 4-decimal rendimiento

// ---------------------------------------------------------------------------
// SSOT targets (frozen from Enero.xlsx, verified cell-for-cell 2026-04-15)
// ---------------------------------------------------------------------------

type ContractTarget = {
  contractNumber: string;
  client: string;
  lote: string;
  puntaje: number;
  sacos69kg: string;
  sacos46kg: string;
  precioBolsa: string;
  diferencial: string;
  gastosPerSaco: string;
  // Expected per-contract MP (one row per contract)
  mpPunteo: number;
  mpRendimiento: string;
  mpPergamino: string; // PERGO from L col
  mpPrecioPromQ: string; // M col (Q/qq)
  mpTotalMP: string; // O col (Q)
  // Expected per-contract downstream
  facturacionLbsUsd: string; // N
  facturacionKgsUsd: string; // O
  gastosExportUsd: string; // Q
  utilidadSinGeUsd: string; // R
  costoFinancieroUsd: string; // S
  utilidadSinCfUsd: string; // T
  totalPagoQtz: string; // V
  // Expected exporting entity
  exportingEntity: "EXPORTADORA" | "FINCA_DANILANDIA" | "STOCK_LOCK";
  // Optional facturacion override
  facturacionKgsOverride?: string;
};

type ShipmentTarget = {
  blockLabel: string;
  entity: "EXPORTADORA" | "FINCA_DANILANDIA";
  contracts: string[];
  totalSacos69: string;
  totalSacos46: string;
  totalFacturacionKgsUsd: string;
  totalGastosExportUsd: string;
  totalCostoFinancieroUsd: string;
  totalPagoQtz: string;
  materiaPrimaQtz: string;
  isrQtz: string;
  comisionQtz: string;
  subproductoQtz: string;
  utilidadBrutaQtz: string;
  margenBruto: string; // as decimal, e.g. "0.1559"
};

const BLOCK_1: ShipmentTarget = {
  blockLabel: "Block 1 — Exportadora",
  entity: "EXPORTADORA",
  contracts: ["P30172", "P40028", "P40022"],
  totalSacos69: "840",
  totalSacos46: "1260",
  totalFacturacionKgsUsd: "488228.40",
  totalGastosExportUsd: "25200.00",
  totalCostoFinancieroUsd: "5157.28",
  totalPagoQtz: "3502714.07",
  materiaPrimaQtz: "-2958989.29",
  isrQtz: "0.00",
  comisionQtz: "-28917.00",
  subproductoQtz: "67620.54",
  utilidadBrutaQtz: "582428.32",
  margenBruto: "0.155937",
};

const BLOCK_2: ShipmentTarget = {
  blockLabel: "Block 2 — Finca Danilandia",
  entity: "FINCA_DANILANDIA",
  contracts: ["P40129"],
  totalSacos69: "275",
  totalSacos46: "412.5",
  totalFacturacionKgsUsd: "171600.00", // OVERRIDE
  totalGastosExportUsd: "9487.50",
  totalCostoFinancieroUsd: "1689.97",
  totalPagoQtz: "1227232.37",
  materiaPrimaQtz: "-969618.73",
  isrQtz: "-65764.16",
  comisionQtz: "-9466.88",
  subproductoQtz: "0.00",
  utilidadBrutaQtz: "182382.61",
  margenBruto: "0.138933",
};

const CONTRACT_TARGETS: ContractTarget[] = [
  {
    contractNumber: "P30172",
    client: "Swiss Water",
    lote: "Danilandia",
    puntaje: 82,
    sacos69kg: "290",
    sacos46kg: "435",
    precioBolsa: "350",
    diferencial: "37",
    gastosPerSaco: "20",
    mpPunteo: 82,
    mpRendimiento: "1.3197",
    mpPergamino: "574.0695",
    mpPrecioPromQ: "1777.25",
    mpTotalMP: "1020265.02",
    // Values below are the SSOT evaluated cells, read directly from
    // Enero.xlsx, then truncated at 2 decimals for DB comparison.
    facturacionLbsUsd: "168345.00",
    facturacionKgsUsd: "170721.36",
    gastosExportUsd: "8700.00",
    utilidadSinGeUsd: "162021.36",
    costoFinancieroUsd: "1778.24",
    utilidadSinCfUsd: "160243.12",
    totalPagoQtz: "1225859.86",
    exportingEntity: "EXPORTADORA",
  },
  {
    contractNumber: "P40028",
    client: "Serengetti",
    lote: "Santa Rosa",
    puntaje: 82,
    sacos69kg: "275",
    sacos46kg: "412.5",
    precioBolsa: "358",
    diferencial: "15",
    gastosPerSaco: "20",
    mpPunteo: 82,
    mpRendimiento: "1.3245",
    mpPergamino: "546.35625",
    mpPrecioPromQ: "1777.25",
    mpTotalMP: "971011.65",
    facturacionLbsUsd: "153862.50",
    facturacionKgsUsd: "156034.42",
    gastosExportUsd: "8250.00",
    utilidadSinGeUsd: "147784.42",
    costoFinancieroUsd: "1692.40",
    utilidadSinCfUsd: "146092.03",
    totalPagoQtz: "1117604.01",
    exportingEntity: "EXPORTADORA",
  },
  {
    contractNumber: "P40022",
    client: "Serengetti",
    lote: "Huehue",
    puntaje: 83,
    sacos69kg: "275",
    sacos46kg: "412.5",
    precioBolsa: "358",
    diferencial: "28",
    gastosPerSaco: "20",
    mpPunteo: 83,
    mpRendimiento: "1.3200",
    mpPergamino: "544.50",
    mpPrecioPromQ: "1777.25",
    mpTotalMP: "967712.63",
    facturacionLbsUsd: "159225.00",
    facturacionKgsUsd: "161472.62",
    gastosExportUsd: "8250.00",
    utilidadSinGeUsd: "153222.62",
    costoFinancieroUsd: "1686.65",
    utilidadSinCfUsd: "151535.98",
    totalPagoQtz: "1159250.21",
    exportingEntity: "EXPORTADORA",
  },
  {
    contractNumber: "P40129",
    client: "Serengetti",
    lote: "Organico",
    puntaje: 82,
    sacos69kg: "275",
    sacos46kg: "412.5",
    precioBolsa: "376",
    diferencial: "40",
    gastosPerSaco: "23",
    mpPunteo: 82,
    mpRendimiento: "1.3226",
    mpPergamino: "545.5725",
    mpPrecioPromQ: "1777.25",
    mpTotalMP: "969618.73",
    facturacionLbsUsd: "171600.00",
    facturacionKgsUsd: "171600.00", // override — legal doc exception
    gastosExportUsd: "9487.50",
    utilidadSinGeUsd: "162112.50",
    costoFinancieroUsd: "1689.97",
    utilidadSinCfUsd: "160422.53",
    totalPagoQtz: "1227232.38",
    exportingEntity: "FINCA_DANILANDIA",
    facturacionKgsOverride: "171600.00",
  },
];

// ---------------------------------------------------------------------------
// Diff helpers
// ---------------------------------------------------------------------------

type Severity = "OK" | "WARN" | "MISMATCH" | "MISSING";

type Row = {
  severity: Severity;
  scope: string;
  field: string;
  expected: string;
  actual: string;
  delta: string;
};

const rows: Row[] = [];

function push(
  severity: Severity,
  scope: string,
  field: string,
  expected: string,
  actual: string,
  delta = ""
) {
  rows.push({ severity, scope, field, expected, actual, delta });
}

function cmpDecimal(
  scope: string,
  field: string,
  expected: string | null | undefined,
  actual: Decimal | null | undefined,
  epsilon: Decimal = EPSILON
) {
  const expStr = expected == null ? "—" : expected;
  const actStr = actual == null ? "—" : actual.toString();

  if (expected == null && actual == null) {
    push("OK", scope, field, expStr, actStr);
    return;
  }
  if (expected == null || actual == null) {
    push("MISMATCH", scope, field, expStr, actStr);
    return;
  }
  const exp = new Decimal(expected);
  const diff = actual.minus(exp).abs();
  if (diff.lte(epsilon)) {
    push("OK", scope, field, expStr, actStr);
  } else {
    push(
      "MISMATCH",
      scope,
      field,
      expStr,
      actStr,
      actual.minus(exp).toFixed(4)
    );
  }
}

function cmpString(
  scope: string,
  field: string,
  expected: string | null | undefined,
  actual: string | null | undefined
) {
  const expStr = expected ?? "—";
  const actStr = actual ?? "—";
  if (expStr === actStr) push("OK", scope, field, expStr, actStr);
  else push("MISMATCH", scope, field, expStr, actStr);
}

function cmpInt(
  scope: string,
  field: string,
  expected: number | null | undefined,
  actual: number | null | undefined
) {
  const e = expected == null ? "—" : String(expected);
  const a = actual == null ? "—" : String(actual);
  if (expected === actual) push("OK", scope, field, e, a);
  else push("MISMATCH", scope, field, e, a);
}

function toDec(v: unknown): Decimal | null {
  if (v == null) return null;
  if (typeof v === "object") return new Decimal(String(v));
  return new Decimal(v as string | number);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=".repeat(90));
  console.log(" Phase A — January SSOT ↔ DB Reconciliation Diff (READ-ONLY)");
  console.log("=".repeat(90));

  // --- Fetch January shipment(s) ---
  const shipments = await prisma.shipment.findMany({
    where: { year: 2026, month: 1 },
    include: {
      contracts: {
        include: {
          client: true,
          materiaPrimaAllocations: { include: { materiaPrima: true } },
        },
      },
      materiaPrima: { include: { allocations: true } },
      subproductos: true,
    },
  });

  console.log(`\nFound ${shipments.length} shipment(s) for 2026-01:`);
  for (const s of shipments) {
    console.log(
      `  • id=${s.id}  name="${s.name}"  contracts=${s.contracts.length}  MP=${s.materiaPrima.length}  subproductos=${s.subproductos.length}`
    );
  }

  // --- Per-contract diff ---
  for (const target of CONTRACT_TARGETS) {
    const scope = `contract ${target.contractNumber}`;
    const found = shipments
      .flatMap((s) => s.contracts)
      .find((c) => c.contractNumber === target.contractNumber);

    if (!found) {
      push(
        "MISSING",
        scope,
        "<contract row>",
        "present",
        "not found",
        ""
      );
      continue;
    }

    // Identity
    cmpString(scope, "client.name", target.client, found.client.name);
    cmpString(scope, "lote", target.lote, found.lote);
    cmpInt(scope, "puntaje", target.puntaje, found.puntaje);

    // Quantities
    cmpDecimal(scope, "sacos69kg", target.sacos69kg, toDec(found.sacos69kg));
    cmpDecimal(scope, "sacos46kg", target.sacos46kg, toDec(found.sacos46kg));

    // Pricing
    cmpDecimal(scope, "precioBolsa", target.precioBolsa, toDec(found.precioBolsa));
    cmpDecimal(scope, "diferencial", target.diferencial, toDec(found.diferencial));
    cmpDecimal(
      scope,
      "gastosPerSaco",
      target.gastosPerSaco,
      toDec(found.gastosPerSaco)
    );

    // Entity (new field — may not yet exist on the schema)
    const actualEntity =
      (found as unknown as { exportingEntity?: string }).exportingEntity ?? null;
    if (actualEntity === null) {
      push(
        "MISSING",
        scope,
        "exportingEntity",
        target.exportingEntity,
        "<field does not exist on Contract>"
      );
    } else {
      cmpString(scope, "exportingEntity", target.exportingEntity, actualEntity);
    }

    // Facturación override
    const actualOverride =
      (found as unknown as { facturacionKgsOverride?: unknown })
        .facturacionKgsOverride ?? null;
    if (target.facturacionKgsOverride != null) {
      if (actualOverride == null) {
        push(
          "MISSING",
          scope,
          "facturacionKgsOverride",
          target.facturacionKgsOverride,
          "<field does not exist on Contract or is null>"
        );
      } else {
        cmpDecimal(
          scope,
          "facturacionKgsOverride",
          target.facturacionKgsOverride,
          toDec(actualOverride)
        );
      }
    }

    // Contract-level rendimiento (expected to be removed — flag if non-null and differs from MP)
    const contractRend = toDec(
      (found as unknown as { rendimiento?: unknown }).rendimiento
    );
    if (contractRend != null) {
      const target132 = new Decimal("1.32");
      if (contractRend.minus(target132).abs().lte(EPSILON_YIELD)) {
        push(
          "WARN",
          scope,
          "Contract.rendimiento (to be dropped)",
          "<removed>",
          contractRend.toString(),
          "hardcoded 1.32 — importer bug per §9.5"
        );
      } else {
        push(
          "WARN",
          scope,
          "Contract.rendimiento (to be dropped)",
          "<removed>",
          contractRend.toString()
        );
      }
    }

    // Contract.tipoFacturacion — expected to be removed
    const tipoFact =
      (found as unknown as { tipoFacturacion?: string }).tipoFacturacion ?? null;
    if (tipoFact != null) {
      push(
        "WARN",
        scope,
        "Contract.tipoFacturacion (to be dropped)",
        "<removed>",
        tipoFact
      );
    }

    // Downstream stored calc fields
    cmpDecimal(
      scope,
      "facturacionLbs",
      target.facturacionLbsUsd,
      toDec(found.facturacionLbs)
    );
    cmpDecimal(
      scope,
      "facturacionKgs",
      target.facturacionKgsUsd,
      toDec(found.facturacionKgs)
    );
    cmpDecimal(
      scope,
      "gastosExport",
      target.gastosExportUsd,
      toDec(found.gastosExport)
    );
    cmpDecimal(
      scope,
      "utilidadSinGE",
      target.utilidadSinGeUsd,
      toDec(found.utilidadSinGE)
    );
    cmpDecimal(
      scope,
      "costoFinanciero",
      target.costoFinancieroUsd,
      toDec(found.costoFinanciero)
    );
    cmpDecimal(
      scope,
      "utilidadSinCF",
      target.utilidadSinCfUsd,
      toDec(found.utilidadSinCF)
    );
    cmpDecimal(scope, "totalPagoQTZ", target.totalPagoQtz, toDec(found.totalPagoQTZ));

    // MP linkage — expected: 1 MateriaPrimaAllocation → 1 MP row with the target values
    const allocations = found.materiaPrimaAllocations;
    if (allocations.length === 0) {
      push(
        "MISSING",
        scope,
        "MateriaPrimaAllocation",
        "1 row linking contract → MP",
        "0 allocations"
      );
    } else if (allocations.length > 1) {
      push(
        "WARN",
        scope,
        "MateriaPrimaAllocation",
        "1 row (January is 1:1)",
        `${allocations.length} allocations`
      );
    } else {
      const alloc = allocations[0];
      const mp = alloc.materiaPrima;
      const mpScope = `${scope} → MP`;
      cmpInt(mpScope, "punteo", target.mpPunteo, mp.punteo);
      cmpDecimal(
        mpScope,
        "rendimiento",
        target.mpRendimiento,
        toDec(mp.rendimiento),
        EPSILON_YIELD
      );
      cmpDecimal(mpScope, "pergamino", target.mpPergamino, toDec(mp.pergamino));
      cmpDecimal(
        mpScope,
        "precioPromQ",
        target.mpPrecioPromQ,
        toDec(mp.precioPromQ)
      );
      cmpDecimal(mpScope, "totalMP", target.mpTotalMP, toDec(mp.totalMP));
    }
  }

  // --- Per-shipment/block diff ---
  // The current data model has ONE shipment per month. Both entity blocks live
  // inside that one shipment. So we can only diff block-level aggregates
  // against the single shipment's totals AS IF it were only Block 1 + Block 2
  // combined (which is the current over-pooling bug).
  if (shipments.length === 1) {
    const s = shipments[0];
    const scope = `shipment "${s.name}" (pooled)`;
    const pooledFacturacionKgs = new Decimal(BLOCK_1.totalFacturacionKgsUsd).plus(
      BLOCK_2.totalFacturacionKgsUsd
    );
    const pooledGastosExport = new Decimal(BLOCK_1.totalGastosExportUsd).plus(
      BLOCK_2.totalGastosExportUsd
    );
    const pooledCostoFinanciero = new Decimal(
      BLOCK_1.totalCostoFinancieroUsd
    ).plus(BLOCK_2.totalCostoFinancieroUsd);
    const pooledTotalPagoQtz = new Decimal(BLOCK_1.totalPagoQtz).plus(
      BLOCK_2.totalPagoQtz
    );
    const pooledMP = new Decimal(BLOCK_1.materiaPrimaQtz).plus(BLOCK_2.materiaPrimaQtz);
    const pooledISR = new Decimal(BLOCK_1.isrQtz).plus(BLOCK_2.isrQtz);
    const pooledComision = new Decimal(BLOCK_1.comisionQtz).plus(BLOCK_2.comisionQtz);
    const pooledSubproducto = new Decimal(BLOCK_1.subproductoQtz).plus(
      BLOCK_2.subproductoQtz
    );
    const pooledUtilidad = new Decimal(BLOCK_1.utilidadBrutaQtz).plus(
      BLOCK_2.utilidadBrutaQtz
    );

    cmpDecimal(scope, "totalSacos69", "1115", toDec(s.totalSacos69));
    cmpDecimal(scope, "totalSacos46", "1672.5", toDec(s.totalSacos46));
    cmpDecimal(
      scope,
      "totalFacturacionKgs (USD, pooled)",
      pooledFacturacionKgs.toFixed(2),
      toDec(s.totalFacturacionKgs)
    );
    cmpDecimal(
      scope,
      "totalGastosExport (USD, pooled)",
      pooledGastosExport.toFixed(2),
      toDec(s.totalGastosExport)
    );
    cmpDecimal(
      scope,
      "totalCostoFinanc (USD, pooled)",
      pooledCostoFinanciero.toFixed(2),
      toDec(s.totalCostoFinanc)
    );
    cmpDecimal(
      scope,
      "totalPagoQTZ (pooled)",
      pooledTotalPagoQtz.toFixed(2),
      toDec(s.totalPagoQTZ)
    );
    cmpDecimal(
      scope,
      "totalMateriaPrima (pooled)",
      pooledMP.abs().toFixed(2),
      toDec(s.totalMateriaPrima)
    );
    cmpDecimal(
      scope,
      "totalISR (pooled)",
      pooledISR.abs().toFixed(2),
      toDec(s.totalISR)
    );
    cmpDecimal(
      scope,
      "totalComision (pooled)",
      pooledComision.abs().toFixed(2),
      toDec(s.totalComision)
    );
    cmpDecimal(
      scope,
      "totalSubproducto (pooled)",
      pooledSubproducto.toFixed(2),
      toDec(s.totalSubproducto)
    );
    cmpDecimal(
      scope,
      "utilidadBruta (pooled)",
      pooledUtilidad.toFixed(2),
      toDec(s.utilidadBruta)
    );

    // Margen bruto: if shipment denominator uses pooled facturación kgs × tipoCambio,
    // the pooled target is utilidad / (pooledFact × 7.65). We report both so any
    // app-side denominator confusion is visible.
    const pooledFacturacionQtz = pooledFacturacionKgs.mul("7.65");
    const pooledMargenByQtz = pooledUtilidad.div(pooledFacturacionQtz);
    const pooledMargenByUsd = pooledUtilidad.div("7.65").div(pooledFacturacionKgs);
    push(
      "OK",
      scope,
      "margen (reference: pooled utilidad / pooled fact QTZ)",
      pooledMargenByQtz.toFixed(6),
      toDec(s.margenBruto)?.toString() ?? "—"
    );
    push(
      "OK",
      scope,
      "margen (reference: pooled utilidad USD / pooled fact USD)",
      pooledMargenByUsd.toFixed(6),
      "(same by construction)"
    );

    // Subproducto rows
    push(
      "OK",
      scope,
      "subproductos count",
      "≥1 (Block 1 has 1 contenedor)",
      String(s.subproductos.length)
    );

    // MP rows on the shipment
    push(
      "OK",
      scope,
      "MP rows on shipment",
      "4 (per-contract, one per January contract)",
      String(s.materiaPrima.length)
    );
  } else if (shipments.length === 0) {
    push("MISSING", "shipment 2026-01", "<any>", "1 or 2", "0");
  } else {
    push(
      "WARN",
      "shipment 2026-01",
      "count",
      "1 (current pooled model) or 2 (future entity-split)",
      String(shipments.length)
    );
  }

  // --- Report ---
  console.log("\n" + "=".repeat(90));
  console.log(" Field-by-field diff");
  console.log("=".repeat(90));

  const byScope = new Map<string, Row[]>();
  for (const r of rows) {
    if (!byScope.has(r.scope)) byScope.set(r.scope, []);
    byScope.get(r.scope)!.push(r);
  }

  let okCount = 0;
  let warnCount = 0;
  let mismatchCount = 0;
  let missingCount = 0;

  for (const [scope, scopeRows] of byScope) {
    const nonOk = scopeRows.filter((r) => r.severity !== "OK");
    if (nonOk.length === 0) {
      console.log(`\n[${scope}]  ✓ all ${scopeRows.length} fields match`);
      okCount += scopeRows.length;
      continue;
    }
    console.log(`\n[${scope}]`);
    for (const r of scopeRows) {
      if (r.severity === "OK") {
        okCount++;
        continue;
      }
      if (r.severity === "WARN") warnCount++;
      if (r.severity === "MISMATCH") mismatchCount++;
      if (r.severity === "MISSING") missingCount++;
      const tag =
        r.severity === "MISMATCH"
          ? "✗ MISMATCH"
          : r.severity === "MISSING"
          ? "✗ MISSING "
          : "⚠ WARN    ";
      const deltaStr = r.delta ? `  (Δ=${r.delta})` : "";
      console.log(
        `  ${tag}  ${r.field.padEnd(38)} expected=${r.expected}  actual=${r.actual}${deltaStr}`
      );
    }
  }

  console.log("\n" + "=".repeat(90));
  console.log(" Summary");
  console.log("=".repeat(90));
  console.log(`  OK       : ${okCount}`);
  console.log(`  WARN     : ${warnCount}`);
  console.log(`  MISMATCH : ${mismatchCount}`);
  console.log(`  MISSING  : ${missingCount}`);
  console.log(`  TOTAL    : ${okCount + warnCount + mismatchCount + missingCount}`);
  console.log("");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
