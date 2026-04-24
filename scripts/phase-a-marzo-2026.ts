// ============================================================================
// Phase A — Marzo 2026 cell inventory + DB baseline check (read-only)
// ============================================================================
// Per RECONCILIATION_PLAN_2026_JAN_MAY.md §3 Phase A. Strict per-month scope
// (directive 3): Marzo-only by name and by content.
//
// Artifacts:
//   - docs/ssot/marzo-2026-cell-inventory.md  (full non-empty cell dump)
//   - reports/phase-a-marzo-2026.md            (hygiene + DB baseline +
//                                               variant-map resolution preview)
//
// Read-only. No DB mutation. No xlsx mutation.
//
// Usage:  npx tsx scripts/phase-a-marzo-2026.ts
// ============================================================================

import * as XLSX from "xlsx";
import * as fs from "node:fs";
import * as path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  loadVariantMap,
  resolveStrict,
  type DbClient,
} from "./lib/client-variants";

const MAYO_PATH = path.join(process.cwd(), "Mayo.xlsx");
const SHEET = "Marzo";
const MONTH_NUM = 3;
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
function sv(cell: Cell | undefined): string {
  if (!cell || isEmpty(cell.v)) return "";
  return String(cell.v).trim();
}
function nv(cell: Cell | undefined): number | null {
  if (!cell) return null;
  const n = Number(cell.v);
  return Number.isFinite(n) ? n : null;
}

type HygieneIssue = { severity: "error" | "warn" | "info"; cell: string; finding: string };
const issues: HygieneIssue[] = [];
function flag(severity: HygieneIssue["severity"], cell: string, finding: string) {
  issues.push({ severity, cell, finding });
}

const EPS_MONETARY = 0.03;

async function main() {
  console.log("");
  console.log("=".repeat(78));
  console.log(` Phase A — ${SHEET} 2026 cell inventory + DB baseline`);
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
      const rec: CellRec = {
        addr: XLSX.utils.encode_cell({ r, c }),
        col: XLSX.utils.encode_col(c),
        row: r + 1,
        v: cell.v,
        f: cell.f,
        t: cell.t,
      };
      allCells.push(rec);

      if (cell.t === "e") {
        flag("error", rec.addr, `Excel error in cell: ${cell.v}`);
      }
      if (cell.f) {
        const xrefs = cell.f.match(/([A-Za-z_][A-Za-z0-9_]*)!/g);
        if (xrefs) {
          for (const x of xrefs) {
            const name = x.slice(0, -1);
            if (name !== SHEET) {
              flag("info", rec.addr, `Cross-sheet reference (to '${name}'): ${cell.f}`);
            }
          }
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Pass 2 — contract rows (col E = contractNumber, col F = estatus)
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
    const cE = cellOf(ws, r, 4);
    const cF = cellOf(ws, r, 5);
    if (!cE || isEmpty(cE.v)) continue;
    const contrato = String(cE.v).trim();
    if (/^CONTRATO$/i.test(contrato)) continue;
    const estatus = cF ? String(cF.v || "").trim() : "";
    if (!/^(Fijado|No\s*Fijado|FIJADO|NO\s*FIJADO)$/i.test(estatus)) continue;
    contracts.push({
      row: r + 1,
      contrato,
      embarque: sv(cellOf(ws, r, 1)),
      posicion: sv(cellOf(ws, r, 2)),
      cliente: sv(cellOf(ws, r, 3)),
      estatus,
      lote: sv(cellOf(ws, r, 6)),
      puntaje: nv(cellOf(ws, r, 7)),
      sacos69: nv(cellOf(ws, r, 8)),
      sacos46: nv(cellOf(ws, r, 9)),
      bolsa: nv(cellOf(ws, r, 10)),
      diferencial: nv(cellOf(ws, r, 11)),
      bolsaDif: nv(cellOf(ws, r, 12)),
      factLbs: nv(cellOf(ws, r, 13)),
      factKgs: nv(cellOf(ws, r, 14)),
      gastosPerSaco: nv(cellOf(ws, r, 15)),
      gastosTotal: nv(cellOf(ws, r, 16)),
      utilSinGE: nv(cellOf(ws, r, 17)),
      costoFin: nv(cellOf(ws, r, 18)),
      utilSinCF: nv(cellOf(ws, r, 19)),
      tipoCambio: nv(cellOf(ws, r, 20)),
      totalPago: nv(cellOf(ws, r, 21)),
    });
  }

  // Duplicate contractNumber detection (per Abril pattern — same name, two rows
  // distinguished by DIFERENCIAL; Phase C will split with -01/-02 suffixes).
  const byContract = new Map<string, ContractRow[]>();
  for (const c of contracts) {
    const list = byContract.get(c.contrato) ?? [];
    list.push(c);
    byContract.set(c.contrato, list);
  }
  const dupeGroups = Array.from(byContract.entries()).filter(([, rows]) => rows.length > 1);
  for (const [num, rows] of dupeGroups) {
    flag(
      "info",
      `E${rows.map((r) => r.row).join(",E")}`,
      `Duplicate contractNumber '${num}' across rows ${rows.map((r) => r.row).join(", ")}. Diferencial values: ${rows.map((r) => r.diferencial ?? "?").join(", ")}. Phase C will split with -01/-02 suffixes per user Q2.`
    );
  }

  // Formula cross-checks against business rules
  for (const c of contracts) {
    if (c.sacos46 != null && c.bolsaDif != null && c.factLbs != null) {
      const expected = c.sacos46 * c.bolsaDif;
      if (Math.abs(expected - c.factLbs) > EPS_MONETARY) {
        flag("warn", `N${c.row}`, `facturacionLbs mismatch: cell=${c.factLbs} expected=${expected.toFixed(2)} (J×M)`);
      }
    }
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
    if (c.gastosPerSaco != null && c.sacos46 != null && c.gastosTotal != null) {
      const expected = c.gastosPerSaco * c.sacos46;
      if (Math.abs(expected - c.gastosTotal) > EPS_MONETARY) {
        flag("warn", `Q${c.row}`, `gastosExport mismatch: cell=${c.gastosTotal} expected=${expected.toFixed(4)} (P×J)`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Pass 3 — MP block (header at col L="PERGO" + col G="CONTRATO")
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
  for (let r = range.s.r; r <= range.e.r; r++) {
    if (sv(cellOf(ws, r, 11)).toUpperCase() === "PERGO" && sv(cellOf(ws, r, 6)).toUpperCase() === "CONTRATO") {
      mpHeaderRow = r;
      break;
    }
  }
  if (mpHeaderRow >= 0) {
    for (let r = mpHeaderRow + 1; r <= range.e.r; r++) {
      const cG = cellOf(ws, r, 6);
      const contrato = sv(cG).trim();
      if (!contrato) break;
      if (/^TOTAL/i.test(contrato)) break;
      mpRows.push({
        row: r + 1,
        contrato,
        proveedor: sv(cellOf(ws, r, 7)),
        punteo: nv(cellOf(ws, r, 8)),
        oro: nv(cellOf(ws, r, 9)),
        rendimiento: nv(cellOf(ws, r, 10)),
        pergo: nv(cellOf(ws, r, 11)),
        promQ: nv(cellOf(ws, r, 12)),
        totalMP: nv(cellOf(ws, r, 14)),
      });
    }
  }

  // MP hygiene cross-checks
  for (const m of mpRows) {
    if (m.rendimiento != null && m.oro != null && m.pergo != null) {
      const expected = m.rendimiento * m.oro;
      if (Math.abs(expected - m.pergo) > 0.05) {
        flag(
          "warn",
          `L${m.row}`,
          `pergo mismatch: cell=${m.pergo} expected=${expected.toFixed(4)} (K×J)`
        );
      }
    }
    if (m.pergo != null && m.promQ != null && m.totalMP != null) {
      const expected = m.pergo * m.promQ;
      if (Math.abs(expected - m.totalMP) > 1.0) {
        flag(
          "warn",
          `(totalMP)${m.row}`,
          `totalMP mismatch: cell=${m.totalMP} expected=${expected.toFixed(2)} (L×M)`
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // Pass 4 — subproducto (col G label "SUBPRODUCTO")
  // -------------------------------------------------------------------------
  let subHeaderRow = -1;
  for (let r = range.s.r; r <= range.e.r; r++) {
    if (sv(cellOf(ws, r, 6)).toUpperCase() === "SUBPRODUCTO") {
      subHeaderRow = r;
      break;
    }
  }
  const subData =
    subHeaderRow >= 0
      ? {
          headerRow: subHeaderRow + 1,
          contenedores: nv(cellOf(ws, subHeaderRow + 2, 9)),
          oroPerCont: nv(cellOf(ws, subHeaderRow + 2, 10)),
          totalOro: nv(cellOf(ws, subHeaderRow + 2, 11)),
          precioSinIva: nv(cellOf(ws, subHeaderRow + 2, 12)),
          totalPerg: nv(cellOf(ws, subHeaderRow + 2, 14)),
        }
      : null;

  // -------------------------------------------------------------------------
  // Pass 5 — Variant-map resolution preview (per feedback_client_variant_map.md)
  // -------------------------------------------------------------------------
  const variantMap = loadVariantMap();
  const dbClientsAll: DbClient[] = await prisma.client.findMany({
    select: { id: true, name: true, code: true },
  });
  type VariantCheck = {
    cliente: string;
    rows: number[];
    resolved:
      | { kind: "resolved"; canonical: string; code: string; via: string }
      | { kind: "unresolved"; suggestion: string | null };
  };
  const variantChecks: VariantCheck[] = [];
  const uniqueClients = new Map<string, number[]>();
  for (const c of contracts) {
    const list = uniqueClients.get(c.cliente) ?? [];
    list.push(c.row);
    uniqueClients.set(c.cliente, list);
  }
  for (const [cliente, rows] of uniqueClients.entries()) {
    const res = resolveStrict(cliente, variantMap, dbClientsAll);
    if (res.kind === "resolved") {
      variantChecks.push({
        cliente,
        rows,
        resolved: {
          kind: "resolved",
          canonical: res.canonical.name,
          code: res.canonical.code,
          via: res.matchedVariant,
        },
      });
    } else if (res.kind === "needs-create") {
      variantChecks.push({
        cliente,
        rows,
        resolved: { kind: "unresolved", suggestion: `NEEDS-CREATE: canonical '${res.canonical.name}' [${res.canonical.code}] in map but no DB row` },
      });
      flag(
        "warn",
        `D${rows[0]}`,
        `Client '${cliente}' is NEEDS-CREATE (map canonical '${res.canonical.name}' [${res.canonical.code}], DB row missing). Marzo ETL does not support creation.`
      );
    } else {
      const s = res.suggestion
        ? `${res.suggestion.candidate.name} [${res.suggestion.candidate.code}] via ${res.suggestion.via} d=${res.suggestion.distance}`
        : null;
      variantChecks.push({
        cliente,
        rows,
        resolved: { kind: "unresolved", suggestion: s },
      });
      flag(
        "error",
        `D${rows[0]}`,
        `Client '${cliente}' NOT in docs/client-variant-map.md. Phase C will REFUSE to --execute until this is appended.${s ? ` Suggestion (dry-run only): ${s}` : ""}`
      );
    }
  }

  // -------------------------------------------------------------------------
  // Pass 6 — DB baseline
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

  // Check for orphan contracts by number (same collision risk as Febrero)
  const contractNumbers = Array.from(new Set(contracts.map((c) => c.contrato)));
  const existingByNumber = await prisma.contract.findMany({
    where: { contractNumber: { in: contractNumbers } },
    select: {
      contractNumber: true,
      shipment: { select: { month: true, year: true, name: true } },
    },
  });
  for (const c of existingByNumber) {
    flag(
      "info",
      `(DB orphan)`,
      `contractNumber '${c.contractNumber}' already exists in DB (shipment=${c.shipment ? `${c.shipment.name} m=${c.shipment.month}` : "(null)"}); Phase C clean-slate will delete before re-insert.`
    );
  }

  // -------------------------------------------------------------------------
  // Write artifacts
  // -------------------------------------------------------------------------
  const now = new Date().toISOString();

  // 1. Cell inventory
  const inv: string[] = [];
  inv.push(`# ${SHEET} 2026 — Cell Inventory`);
  inv.push("");
  inv.push(`**Generated:** ${now}`);
  inv.push(`**Sheet:** \`${SHEET}\` (in \`Mayo.xlsx\`)`);
  inv.push(`**Used range:** \`${ref}\``);
  inv.push(`**Non-empty cells:** ${allCells.length}`);
  inv.push("");
  inv.push(`> Scope: ${SHEET} only (\`month=${MONTH_NUM}\`, \`year=${YEAR}\`). Read-only.`);
  inv.push("");
  inv.push("## 1. Contract rows");
  inv.push("");
  inv.push(`Found ${contracts.length} contract rows.`);
  inv.push("");
  inv.push("| Row | Contrato | Cliente | Lote | Puntaje | Sacos 69 | Sacos 46 | Bolsa | Dif | Bolsa+Dif | Gastos/saco | Gastos Total | TC | Total Pago Q |");
  inv.push("|-----|----------|---------|------|---------|----------|----------|-------|-----|-----------|-------------|--------------|-----|---------------|");
  for (const c of contracts) {
    inv.push(
      `| ${c.row} | ${c.contrato} | ${c.cliente} | ${c.lote} | ${c.puntaje ?? "-"} | ${c.sacos69 ?? "-"} | ${c.sacos46 ?? "-"} | ${c.bolsa ?? "-"} | ${c.diferencial ?? "-"} | ${c.bolsaDif ?? "-"} | ${c.gastosPerSaco ?? "-"} | ${c.gastosTotal ?? "-"} | ${c.tipoCambio ?? "-"} | ${c.totalPago ?? "-"} |`
    );
  }
  inv.push("");
  inv.push("## 2. Materia Prima rows");
  inv.push("");
  inv.push(
    mpHeaderRow >= 0
      ? `MP header row: ${mpHeaderRow + 1}. Found ${mpRows.length} MP rows.`
      : "⚠️ No MP header row detected."
  );
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
  inv.push(`*End of ${SHEET} 2026 cell inventory.*`);

  const invPath = path.join(DOCS_DIR, `${SHEET.toLowerCase()}-2026-cell-inventory.md`);
  fs.writeFileSync(invPath, inv.join("\n") + "\n");
  console.log(` → wrote ${invPath}`);

  // 2. Phase A report
  const rep: string[] = [];
  rep.push(`# Phase A — ${SHEET} 2026 Report`);
  rep.push("");
  rep.push(`**Generated:** ${now}`);
  rep.push(`**Sheet:** \`${SHEET}\` in \`Mayo.xlsx\``);
  rep.push(`**Scope:** month=${MONTH_NUM}, year=${YEAR}. Read-only.`);
  rep.push("");
  rep.push("## DB baseline");
  rep.push("");
  rep.push(`| Table | Count | Expected (directive 2 clean-slate) |`);
  rep.push(`|-------|-------|------------------------------------|`);
  rep.push(`| Shipment | ${dbShipments} | 0 |`);
  rep.push(`| Contract | ${dbContracts} | 0 |`);
  rep.push(`| MateriaPrima | ${dbMP} | 0 |`);
  rep.push(`| MateriaPrimaAllocation | ${dbAllocs} | 0 |`);
  rep.push(`| Subproducto | ${dbSub} | 0 |`);
  rep.push("");
  if (existingByNumber.length > 0) {
    rep.push(`**Orphan contracts to sweep in Phase C:** ${existingByNumber.length}`);
    rep.push("");
    rep.push("| Contract | Current shipment |");
    rep.push("|----------|------------------|");
    for (const c of existingByNumber) {
      rep.push(
        `| ${c.contractNumber} | ${c.shipment ? `${c.shipment.name} (m=${c.shipment.month}, y=${c.shipment.year})` : "(null)"} |`
      );
    }
    rep.push("");
  }

  rep.push("## SSOT summary");
  rep.push("");
  rep.push(`- Contract rows: **${contracts.length}**`);
  rep.push(`- MP rows: **${mpRows.length}**`);
  rep.push(`- Subproducto: **${subData ? "1 block" : "0 blocks"}**`);
  rep.push(`- Duplicate contract-numbers (split candidates): **${dupeGroups.length}**`);
  rep.push(`- Cross-sheet refs: **${issues.filter((i) => i.finding.startsWith("Cross-sheet")).length}**`);
  rep.push(`- Excel errors (#REF!): **${issues.filter((i) => i.severity === "error" && i.finding.startsWith("Excel error")).length}**`);
  rep.push(`- Formula / literal mismatches: **${issues.filter((i) => i.severity === "warn").length}**`);
  rep.push(`- Variant-map unresolved: **${variantChecks.filter((v) => v.resolved.kind === "unresolved").length}**`);
  rep.push("");

  rep.push("## Variant-map resolution");
  rep.push("");
  rep.push("| Sheet cliente | Rows | Resolution |");
  rep.push("|---------------|------|-----------|");
  for (const v of variantChecks) {
    const detail =
      v.resolved.kind === "resolved"
        ? `✓ → ${v.resolved.canonical} [${v.resolved.code}] (variant: ${v.resolved.via})`
        : `⚠ unresolved${v.resolved.suggestion ? ` — suggestion: ${v.resolved.suggestion}` : ""}`;
    rep.push(`| ${v.cliente} | ${v.rows.join(", ")} | ${detail} |`);
  }
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

  rep.push("## Phase B decision");
  rep.push("");
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warnCount = issues.filter((i) => i.severity === "warn").length;
  const unresolvedVariants = variantChecks.filter((v) => v.resolved.kind === "unresolved").length;
  if (errorCount > 0 || unresolvedVariants > 0) {
    rep.push(
      "⚠️ **PAUSED per directive 9 (flag and wait)**. Unresolved variant-map entries and/or Excel errors must be addressed before Phase C. Append variants to `docs/client-variant-map.md` (or create new canonicals); fix any `#REF!` in `Mayo.xlsx`."
    );
  } else if (warnCount > 0) {
    rep.push("⚠️ **Review warnings** before Phase C. Formula/literal mismatches may indicate an intentional override (like Jan P40129) or a spreadsheet bug.");
  } else {
    rep.push("✓ **Phase B: green.** No errors, no unresolved variants, no formula mismatches. Safe to proceed to Phase C: `scripts/etl-marzo-2026.ts`.");
  }
  rep.push("");
  rep.push("---");
  rep.push(`*End of Phase A ${SHEET} 2026 report.*`);

  const repPath = path.join(REPORTS_DIR, `phase-a-${SHEET.toLowerCase()}-2026.md`);
  fs.writeFileSync(repPath, rep.join("\n") + "\n");
  console.log(` → wrote ${repPath}`);

  console.log("");
  console.log(` Contracts: ${contracts.length}   MP rows: ${mpRows.length}   Subproducto: ${subData ? "yes" : "no"}`);
  console.log(` Duplicate contract-numbers: ${dupeGroups.length}`);
  console.log(` DB baseline: shipments=${dbShipments} contracts=${dbContracts} MP=${dbMP} allocations=${dbAllocs} subproducto=${dbSub}`);
  console.log(` Orphan contracts by number: ${existingByNumber.length}`);
  console.log(` Hygiene: ${issues.length} issue(s) — ${errorCount} error, ${warnCount} warn, ${issues.length - errorCount - warnCount} info`);
  for (const i of issues.slice(0, 30)) {
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
