// ============================================================================
// Phase A — Febrero 2026 cell inventory + DB baseline check (read-only)
// ============================================================================
// Per RECONCILIATION_PLAN_2026_JAN_MAY.md §3 Phase A.
// Produces two artifacts:
//   - docs/ssot/febrero-2026-cell-inventory.md  (every non-empty cell +
//     formulas + parsed contract / MP / subproducto / P&L sections)
//   - reports/phase-a-febrero-2026.md            (hygiene findings + DB
//     baseline: expected 0 rows in prod for month=2, per directive 2)
//
// Read-only. No DB mutation. No xlsx mutation. Feb-scoped.
//
// Usage:  npx tsx scripts/phase-a-febrero-2026.ts
// ============================================================================

import * as XLSX from "xlsx";
import * as fs from "node:fs";
import * as path from "node:path";
import { PrismaClient } from "@prisma/client";

const MAYO_PATH = path.join(process.cwd(), "Mayo.xlsx");
const SHEET = "Febrero";
const MONTH_NUM = 2;
const YEAR = 2026;

const DOCS_DIR = path.join(process.cwd(), "docs", "ssot");
const REPORTS_DIR = path.join(process.cwd(), "reports");

const prisma = new PrismaClient();

type Cell = XLSX.CellObject;

function cellOf(ws: XLSX.WorkSheet, r: number, c: number): Cell | undefined {
  return ws[XLSX.utils.encode_cell({ r, c })];
}

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === "";
}

function valStr(cell: Cell | undefined): string {
  if (!cell || isEmpty(cell.v)) return "";
  if (typeof cell.v === "number") {
    // Preserve precision for numerics
    return String(cell.v);
  }
  if (cell.v instanceof Date) return cell.v.toISOString();
  return String(cell.v);
}

function valNum(cell: Cell | undefined): number | null {
  if (!cell) return null;
  const n = Number(cell.v);
  return Number.isFinite(n) ? n : null;
}

type HygieneIssue = {
  severity: "error" | "warn" | "info";
  cell: string;
  finding: string;
};

const issues: HygieneIssue[] = [];
function flag(severity: HygieneIssue["severity"], cell: string, finding: string) {
  issues.push({ severity, cell, finding });
}

// Business rule precision thresholds (match Jan Phase D §5 Q4 resolution)
const EPS_MONETARY = 0.03;
const EPS_RATIO = 0.0001;

async function main() {
  console.log("");
  console.log("=".repeat(78));
  console.log(" Phase A — Febrero 2026 cell inventory + DB baseline");
  console.log("=".repeat(78));

  if (!fs.existsSync(MAYO_PATH)) {
    console.error(`✗ Mayo.xlsx not found at ${MAYO_PATH}`);
    process.exit(1);
  }
  if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const wb = XLSX.readFile(MAYO_PATH);
  const ws = wb.Sheets[SHEET];
  if (!ws) {
    console.error(`✗ Sheet '${SHEET}' not found`);
    process.exit(1);
  }

  const ref = ws["!ref"]!;
  const range = XLSX.utils.decode_range(ref);
  console.log(` Sheet: ${SHEET}   Range: ${ref}   Rows: ${range.e.r - range.s.r + 1}`);

  // -------------------------------------------------------------------------
  // Pass 1 — collect every non-empty cell with formula & value
  // -------------------------------------------------------------------------
  type CellRec = { addr: string; col: string; row: number; v: unknown; f?: string; t?: string };
  const allCells: CellRec[] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = cellOf(ws, r, c);
      if (!cell || isEmpty(cell.v)) continue;
      allCells.push({
        addr: XLSX.utils.encode_cell({ r, c }),
        col: XLSX.utils.encode_col(c),
        row: r + 1,
        v: cell.v,
        f: cell.f,
        t: cell.t,
      });

      // Hygiene: #REF! or other Excel errors surface as cell.t === 'e'
      if (cell.t === "e") {
        flag("error", XLSX.utils.encode_cell({ r, c }), `Excel error in cell: ${cell.v}`);
      }
      // Cross-sheet references
      if (cell.f && /!(?!\$|\d)/.test(cell.f)) {
        const m = cell.f.match(/([A-Za-z_]+)!/);
        if (m && m[1] !== SHEET) {
          flag(
            "info",
            XLSX.utils.encode_cell({ r, c }),
            `Cross-sheet reference in formula (to '${m[1]}'): ${cell.f}`
          );
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Pass 2 — identify contract rows (col E = contract number, col F = estatus)
  // -------------------------------------------------------------------------
  type ContractRow = {
    row: number;
    contrato: string;
    embarque: string;
    posicion: string;
    cliente: string;
    estatus: string;
    lote: string;
    puntaje: number | null;
    sacos69: number | null;
    sacos46: number | null;
    bolsa: number | null;
    diferencial: number | null;
    bolsaDif: number | null;
    factLbs: number | null;
    factKgs: number | null;
    gastosPerSaco: number | null;
    gastosTotal: number | null;
    utilSinGE: number | null;
    costoFin: number | null;
    utilSinCF: number | null;
    tipoCambio: number | null;
    totalPago: number | null;
  };

  const contracts: ContractRow[] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const cE = cellOf(ws, r, 4); // E = CONTRATO
    const cF = cellOf(ws, r, 5); // F = ESTATUS
    if (!cE || isEmpty(cE.v)) continue;
    const contrato = String(cE.v).trim();
    if (/^CONTRATO$/i.test(contrato)) continue;
    const estatus = cF ? String(cF.v || "").trim() : "";
    if (!/^(Fijado|No\s*Fijado|FIJADO|NO\s*FIJADO)$/i.test(estatus)) continue;
    contracts.push({
      row: r + 1,
      contrato,
      embarque: valStr(cellOf(ws, r, 1)), // B
      posicion: valStr(cellOf(ws, r, 2)), // C
      cliente: valStr(cellOf(ws, r, 3)), // D
      estatus,
      lote: valStr(cellOf(ws, r, 6)), // G
      puntaje: valNum(cellOf(ws, r, 7)), // H
      sacos69: valNum(cellOf(ws, r, 8)), // I
      sacos46: valNum(cellOf(ws, r, 9)), // J
      bolsa: valNum(cellOf(ws, r, 10)), // K
      diferencial: valNum(cellOf(ws, r, 11)), // L
      bolsaDif: valNum(cellOf(ws, r, 12)), // M
      factLbs: valNum(cellOf(ws, r, 13)), // N
      factKgs: valNum(cellOf(ws, r, 14)), // O
      gastosPerSaco: valNum(cellOf(ws, r, 15)), // P
      gastosTotal: valNum(cellOf(ws, r, 16)), // Q
      utilSinGE: valNum(cellOf(ws, r, 17)), // R
      costoFin: valNum(cellOf(ws, r, 18)), // S
      utilSinCF: valNum(cellOf(ws, r, 19)), // T
      tipoCambio: valNum(cellOf(ws, r, 20)), // U
      totalPago: valNum(cellOf(ws, r, 21)), // V
    });
  }

  // Hygiene: verify derived fields against business-rules formulas
  for (const c of contracts) {
    // N = J × M
    if (c.sacos46 != null && c.bolsaDif != null && c.factLbs != null) {
      const expected = c.sacos46 * c.bolsaDif;
      if (Math.abs(expected - c.factLbs) > EPS_MONETARY) {
        flag(
          "warn",
          `N${c.row}`,
          `facturacionLbs mismatch: cell=${c.factLbs} expected=${expected.toFixed(2)} (J×M)`
        );
      }
    }
    // O = I × 69 × 2.2046 × (M/100)
    if (c.sacos69 != null && c.bolsaDif != null && c.factKgs != null) {
      const expected = c.sacos69 * 69 * 2.2046 * (c.bolsaDif / 100);
      if (Math.abs(expected - c.factKgs) > EPS_MONETARY) {
        flag(
          "warn",
          `O${c.row}`,
          `facturacionKgs mismatch: cell=${c.factKgs} expected=${expected.toFixed(4)} (I×69×2.2046×M/100). Could indicate a legal-doc override.`
        );
      }
    }
    // Q = P × J
    if (c.gastosPerSaco != null && c.sacos46 != null && c.gastosTotal != null) {
      const expected = c.gastosPerSaco * c.sacos46;
      if (Math.abs(expected - c.gastosTotal) > EPS_MONETARY) {
        flag(
          "warn",
          `Q${c.row}`,
          `gastosExport mismatch: cell=${c.gastosTotal} expected=${expected.toFixed(4)} (P×J)`
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // Pass 3 — MP block (header row has E=CONTRATO, F=PROVEEDOR, L=PERGO)
  // -------------------------------------------------------------------------
  type MpRow = {
    row: number;
    contrato: string;
    proveedor: string;
    punteo: number | null;
    oro: number | null;
    rendimiento: number | null;
    pergo: number | null;
    promQ: number | null;
    totalMP: number | null;
  };

  const mpRows: MpRow[] = [];
  let mpHeaderRow = -1;
  // Anchor detection on the "PERGO" label in col L (most reliable marker across
  // the Mayo.xlsx format, where MP columns are G/H/I/J/K/L/M/O not E/F/…).
  for (let r = range.s.r; r <= range.e.r; r++) {
    const lStr = valStr(cellOf(ws, r, 11)).toUpperCase();
    const gStr = valStr(cellOf(ws, r, 6)).toUpperCase();
    if (lStr === "PERGO" && gStr === "CONTRATO") {
      mpHeaderRow = r;
      break;
    }
  }
  if (mpHeaderRow >= 0) {
    for (let r = mpHeaderRow + 1; r <= range.e.r; r++) {
      const cG = cellOf(ws, r, 6); // G = CONTRATO
      const contrato = valStr(cG).trim();
      if (!contrato) break;
      if (/^TOTAL$/i.test(contrato) || /^TOTALES$/i.test(contrato)) break;
      mpRows.push({
        row: r + 1,
        contrato,
        proveedor: valStr(cellOf(ws, r, 7)), // H
        punteo: valNum(cellOf(ws, r, 8)), // I
        oro: valNum(cellOf(ws, r, 9)), // J
        rendimiento: valNum(cellOf(ws, r, 10)), // K
        pergo: valNum(cellOf(ws, r, 11)), // L
        promQ: valNum(cellOf(ws, r, 12)), // M
        totalMP: valNum(cellOf(ws, r, 14)), // O
      });
    }
  }

  // Hygiene: verify MP derived fields
  for (const m of mpRows) {
    if (m.rendimiento != null && m.oro != null && m.pergo != null) {
      const expected = m.rendimiento * m.oro;
      if (Math.abs(expected - m.pergo) > 0.05) {
        flag(
          "warn",
          `L${m.row}`,
          `pergo mismatch: cell=${m.pergo} expected=${expected.toFixed(4)} (K×I = rendimiento × oro)`
        );
      }
    }
    if (m.pergo != null && m.promQ != null && m.totalMP != null) {
      const expected = m.pergo * m.promQ;
      if (Math.abs(expected - m.totalMP) > 1.0) {
        flag(
          "warn",
          `(totalMP)${m.row}`,
          `totalMP mismatch: cell=${m.totalMP} expected=${expected.toFixed(2)} (L×M = pergo × promQ)`
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // Pass 4 — subproducto row (detect via "SUBPRODUCTO" marker + "CONTENEDORES")
  // -------------------------------------------------------------------------
  let subHeaderRow = -1;
  for (let r = range.s.r; r <= range.e.r; r++) {
    const gStr = valStr(cellOf(ws, r, 6)).toUpperCase();
    if (gStr === "SUBPRODUCTO") {
      // likely a label row; next row often has data
      subHeaderRow = r;
      break;
    }
  }
  const subData = subHeaderRow >= 0
    ? {
        headerRow: subHeaderRow + 1,
        contenedores: valNum(cellOf(ws, subHeaderRow + 2, 9)),
        oroPerCont: valNum(cellOf(ws, subHeaderRow + 2, 10)),
        totalOro: valNum(cellOf(ws, subHeaderRow + 2, 11)),
        precioSinIva: valNum(cellOf(ws, subHeaderRow + 2, 12)),
        totalPerg: valNum(cellOf(ws, subHeaderRow + 2, 14)),
      }
    : null;

  // -------------------------------------------------------------------------
  // Pass 5 — DB baseline: count Feb 2026 rows; expected 0 per directive 2
  // -------------------------------------------------------------------------
  const dbShipments = await prisma.shipment.count({
    where: { year: YEAR, month: MONTH_NUM },
  });
  const dbContracts = await prisma.contract.count({
    where: { shipment: { year: YEAR, month: MONTH_NUM } },
  });
  const dbMP = await prisma.materiaPrima.count({
    where: { shipment: { year: YEAR, month: MONTH_NUM } },
  });
  const dbAllocs = await prisma.materiaPrimaAllocation.count({
    where: { materiaPrima: { shipment: { year: YEAR, month: MONTH_NUM } } },
  });
  const dbSub = await prisma.subproducto.count({
    where: { shipment: { year: YEAR, month: MONTH_NUM } },
  });

  if (dbShipments + dbContracts + dbMP + dbAllocs + dbSub > 0) {
    flag(
      "info",
      "(DB)",
      `Prod DB is NOT clean-slate for Feb 2026: shipments=${dbShipments} contracts=${dbContracts} MP=${dbMP} allocations=${dbAllocs} subproducto=${dbSub}. Phase C must truncate before inserting.`
    );
  }

  // -------------------------------------------------------------------------
  // Write artifacts
  // -------------------------------------------------------------------------
  const now = new Date().toISOString();

  // 1. Cell inventory
  const inv: string[] = [];
  inv.push(`# Febrero 2026 — Cell Inventory`);
  inv.push("");
  inv.push(`**Generated:** ${now}`);
  inv.push(`**Sheet:** \`${SHEET}\` (in \`Mayo.xlsx\`)`);
  inv.push(`**Used range:** \`${ref}\``);
  inv.push(`**Non-empty cells:** ${allCells.length}`);
  inv.push("");
  inv.push(`> Scope: Febrero only (\`month=${MONTH_NUM}\`, \`year=${YEAR}\`). Read-only. No DB or xlsx mutation.`);
  inv.push("");

  inv.push("## 1. Contract rows");
  inv.push("");
  inv.push(`Found ${contracts.length} contract rows.`);
  inv.push("");
  inv.push("| Row | Contrato | Cliente | Lote | Puntaje | Sacos 69 | Sacos 46 | Bolsa | Dif | Bolsa+Dif | Gastos/saco | Gastos Total | Tipo Cambio | Total Pago Q |");
  inv.push("|-----|----------|---------|------|---------|----------|----------|-------|-----|-----------|-------------|--------------|-------------|---------------|");
  for (const c of contracts) {
    inv.push(
      `| ${c.row} | ${c.contrato} | ${c.cliente} | ${c.lote} | ${c.puntaje ?? "-"} | ${c.sacos69 ?? "-"} | ${c.sacos46 ?? "-"} | ${c.bolsa ?? "-"} | ${c.diferencial ?? "-"} | ${c.bolsaDif ?? "-"} | ${c.gastosPerSaco ?? "-"} | ${c.gastosTotal ?? "-"} | ${c.tipoCambio ?? "-"} | ${c.totalPago ?? "-"} |`
    );
  }
  inv.push("");

  inv.push("## 2. Materia Prima rows");
  inv.push("");
  if (mpHeaderRow >= 0) {
    inv.push(`MP header row: ${mpHeaderRow + 1}. Found ${mpRows.length} MP rows.`);
  } else {
    inv.push("⚠️ No MP header row detected in expected layout.");
  }
  inv.push("");
  inv.push("| Row | Contrato | Proveedor | Punteo | Oro | Rendimiento | Pergo | Prom. Q | Total MP |");
  inv.push("|-----|----------|-----------|--------|-----|-------------|-------|---------|----------|");
  for (const m of mpRows) {
    inv.push(
      `| ${m.row} | ${m.contrato} | ${m.proveedor} | ${m.punteo ?? "-"} | ${m.oro ?? "-"} | ${m.rendimiento ?? "-"} | ${m.pergo ?? "-"} | ${m.promQ ?? "-"} | ${m.totalMP ?? "-"} |`
    );
  }
  inv.push("");

  inv.push("## 3. Subproducto");
  inv.push("");
  if (subData) {
    inv.push(`Header row: ${subData.headerRow}`);
    inv.push(`- Contenedores: ${subData.contenedores ?? "-"}`);
    inv.push(`- Oro × contenedor: ${subData.oroPerCont ?? "-"}`);
    inv.push(`- Total Oro: ${subData.totalOro ?? "-"}`);
    inv.push(`- Precio sin IVA: ${subData.precioSinIva ?? "-"}`);
    inv.push(`- Total Pergamino (revenue): ${subData.totalPerg ?? "-"}`);
  } else {
    inv.push("⚠️ No subproducto section detected.");
  }
  inv.push("");

  inv.push("## 4. Every non-empty cell (formulas + literals)");
  inv.push("");
  inv.push("Format: `ADDR [t]: value (f=formula)` — grouped by row.");
  inv.push("");
  let curRow = -1;
  for (const cell of allCells.sort((a, b) => a.row - b.row || a.addr.localeCompare(b.addr))) {
    if (cell.row !== curRow) {
      if (curRow !== -1) inv.push("");
      inv.push(`### Row ${cell.row}`);
      curRow = cell.row;
    }
    const vs =
      typeof cell.v === "string"
        ? JSON.stringify(cell.v)
        : cell.v instanceof Date
          ? cell.v.toISOString()
          : String(cell.v);
    const fs = cell.f ? ` (f=\`${cell.f}\`)` : "";
    const tn = cell.t ? ` [${cell.t}]` : "";
    inv.push(`- \`${cell.addr}\`${tn}: ${vs}${fs}`);
  }
  inv.push("");
  inv.push("---");
  inv.push("*End of Febrero 2026 cell inventory.*");

  const invPath = path.join(DOCS_DIR, "febrero-2026-cell-inventory.md");
  fs.writeFileSync(invPath, inv.join("\n") + "\n");
  console.log(` → wrote ${invPath}`);

  // 2. Phase A report (hygiene + DB baseline)
  const rep: string[] = [];
  rep.push(`# Phase A — Febrero 2026 Report`);
  rep.push("");
  rep.push(`**Generated:** ${now}`);
  rep.push(`**Sheet:** \`${SHEET}\` in \`Mayo.xlsx\``);
  rep.push(`**Scope:** month=${MONTH_NUM}, year=${YEAR}. Read-only.`);
  rep.push("");
  rep.push("## DB baseline (Feb 2026)");
  rep.push("");
  rep.push(`| Table | Count | Expected (directive 2 clean-slate) |`);
  rep.push(`|-------|-------|------------------------------------|`);
  rep.push(`| Shipment | ${dbShipments} | 0 |`);
  rep.push(`| Contract | ${dbContracts} | 0 |`);
  rep.push(`| MateriaPrima | ${dbMP} | 0 |`);
  rep.push(`| MateriaPrimaAllocation | ${dbAllocs} | 0 |`);
  rep.push(`| Subproducto | ${dbSub} | 0 |`);
  rep.push("");

  rep.push("## SSOT summary");
  rep.push("");
  rep.push(`- Contract rows: **${contracts.length}**`);
  rep.push(`- MP rows: **${mpRows.length}**`);
  rep.push(`- Subproducto: **${subData ? "1 block" : "0 blocks"}**`);
  rep.push(`- Cross-sheet cell references: **${issues.filter((i) => i.finding.includes("Cross-sheet")).length}**`);
  rep.push(`- Excel errors (#REF! etc.): **${issues.filter((i) => i.severity === "error").length}**`);
  rep.push(`- Formula / literal mismatches: **${issues.filter((i) => i.severity === "warn").length}**`);
  rep.push("");

  rep.push("## Hygiene findings");
  rep.push("");
  if (issues.length === 0) {
    rep.push("✓ No hygiene issues detected.");
  } else {
    rep.push("| Severity | Cell | Finding |");
    rep.push("|----------|------|---------|");
    for (const i of issues) {
      rep.push(`| ${i.severity} | \`${i.cell}\` | ${i.finding} |`);
    }
  }
  rep.push("");

  rep.push("## Contract summary");
  rep.push("");
  rep.push("| Contrato | Cliente | Lote | Sacos 69 | Bolsa+Dif | Gastos/qq | Facturación Kgs | Total Pago Q |");
  rep.push("|----------|---------|------|----------|-----------|-----------|------------------|---------------|");
  for (const c of contracts) {
    rep.push(
      `| ${c.contrato} | ${c.cliente} | ${c.lote} | ${c.sacos69 ?? "-"} | ${c.bolsaDif ?? "-"} | ${c.gastosPerSaco ?? "-"} | ${c.factKgs ?? "-"} | ${c.totalPago ?? "-"} |`
    );
  }
  rep.push("");

  rep.push("## MP summary");
  rep.push("");
  rep.push("| Contrato | Proveedor | Rendimiento | Pergamino | Prom. Q | Total MP |");
  rep.push("|----------|-----------|-------------|-----------|---------|----------|");
  for (const m of mpRows) {
    rep.push(
      `| ${m.contrato} | ${m.proveedor} | ${m.rendimiento ?? "-"} | ${m.pergo ?? "-"} | ${m.promQ ?? "-"} | ${m.totalMP ?? "-"} |`
    );
  }
  rep.push("");

  rep.push("## Next step (Phase B)");
  rep.push("");
  if (issues.filter((i) => i.severity === "error").length > 0) {
    rep.push("⚠️ **Phase B paused per directive 9**: Excel errors present. Report to user, wait for CFO to fix cells and re-save `Mayo.xlsx`, then re-run Phase A.");
  } else if (issues.filter((i) => i.severity === "warn").length > 0) {
    rep.push("⚠️ **Phase B: review warnings**. Any warn-level finding indicates a formula/literal mismatch against business rules — report to user and decide per directive 9 (flag and wait) before Phase C.");
  } else {
    rep.push("✓ **Phase B: green**. No errors, no formula/literal mismatches. Safe to proceed to Phase C: write `scripts/etl-febrero-2026.ts` with `--dry-run` / `--execute` modes.");
  }
  rep.push("");
  rep.push("---");
  rep.push("*End of Phase A Febrero 2026 report.*");

  const repPath = path.join(REPORTS_DIR, "phase-a-febrero-2026.md");
  fs.writeFileSync(repPath, rep.join("\n") + "\n");
  console.log(` → wrote ${repPath}`);

  console.log("");
  console.log(` Contracts: ${contracts.length}   MP rows: ${mpRows.length}   Subproducto: ${subData ? "yes" : "no"}`);
  console.log(` DB baseline: shipments=${dbShipments} contracts=${dbContracts} MP=${dbMP} allocations=${dbAllocs} subproducto=${dbSub}`);
  console.log(` Hygiene issues: ${issues.length} (${issues.filter((i) => i.severity === "error").length} errors, ${issues.filter((i) => i.severity === "warn").length} warnings)`);
  for (const i of issues.slice(0, 20)) {
    console.log(`  [${i.severity}] ${i.cell}: ${i.finding}`);
  }
  console.log("");
  console.log("=".repeat(78));
  console.log(" Done.");
  console.log("=".repeat(78));
  console.log("");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
