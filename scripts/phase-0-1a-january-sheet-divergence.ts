// ============================================================================
// Phase 0.1a — January sheet divergence check (read-only, flag-only)
// ============================================================================
// Per RECONCILIATION_PLAN_2026_JAN_MAY.md §3 Phase 0.1a and directive 8:
// reads the Enero sheet inside Mayo.xlsx and the current Jan 2026 prod DB
// state, diffs the two, and writes a report. NO PROD MUTATION, ever — this
// script does not call any .update() / .create() / .delete(). Per directive 1
// Jan is frozen and any correction must be applied via the app, not here.
//
// Scope: Jan-only by naming + by filtering. Every DB query and every xlsx
// read is scoped to Jan 2026 (shipments: year=2026 AND month=1; xlsx: sheet
// name "Enero" only).
//
// Output: reports/january-divergence-YYYY-MM-DD.md
//
// Usage:  npx tsx scripts/phase-0-1a-january-sheet-divergence.ts
// ============================================================================

import * as XLSX from "xlsx";
import * as fs from "node:fs";
import * as path from "node:path";
import { PrismaClient } from "@prisma/client";
import Decimal from "decimal.js";

const MAYO_PATH = path.join(process.cwd(), "Mayo.xlsx");
const REPORTS_DIR = path.join(process.cwd(), "reports");
const SHEET = "Enero";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
const prisma = new PrismaClient();

// Jan-scoped filter used by every DB query in this script.
const JAN = { year: 2026, month: 1 } as const;

type SheetRow = {
  row: number;
  embarque: string;
  posicion: string;
  cliente: string;
  contrato: string;
  estatus: string;
  lote: string;
  puntaje: string | number | null;
  sacos69: number | null;
  sacos46: number | null;
  bolsa: number | null;
  diferencial: number | null;
  bolsaDif: number | null;
  facturacionLibras: number | null;
  facturacionKilos: number | null;
  gastosPorSaco: number | null;
  gastosTotal: number | null;
  utilidadSinGE: number | null;
  costoFinanciero: number | null;
  utilidadSinCF: number | null;
  tipoCambio: number | null;
  totalPago: number | null;
};

function readCell(ws: XLSX.WorkSheet, addr: string): unknown {
  const c = ws[addr];
  return c == null ? null : c.v;
}

function asNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function asStringOrEmpty(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function scanEneroSheet(): { rows: SheetRow[]; raw: Record<string, unknown> } {
  const wb = XLSX.readFile(MAYO_PATH);
  const ws = wb.Sheets[SHEET];
  if (!ws) throw new Error(`Sheet '${SHEET}' not found in ${MAYO_PATH}`);

  const ref = ws["!ref"];
  if (!ref) throw new Error(`Sheet '${SHEET}' has no used range`);

  const range = XLSX.utils.decode_range(ref);
  const rows: SheetRow[] = [];

  // Scan rows, pick contract rows heuristically: col E (CONTRATO) has a truthy
  // alphanumeric contract identifier AND col F (ESTATUS) has Fijado/No Fijado.
  for (let r = range.s.r; r <= range.e.r; r++) {
    const contratoRaw = readCell(ws, XLSX.utils.encode_cell({ r, c: 4 })); // E
    const estatusRaw = readCell(ws, XLSX.utils.encode_cell({ r, c: 5 })); // F
    const contrato = asStringOrEmpty(contratoRaw);
    const estatus = asStringOrEmpty(estatusRaw);
    if (!contrato) continue;
    // skip header-ish rows
    if (/^CONTRATO$/i.test(contrato)) continue;
    // skip if estatus cell doesn't look like a contract status
    if (!/^(Fijado|No\s*Fijado|No\s*fijado|FIJADO|NO\s*FIJADO)$/i.test(estatus)) continue;

    rows.push({
      row: r + 1,
      embarque: asStringOrEmpty(readCell(ws, XLSX.utils.encode_cell({ r, c: 1 }))), // B
      posicion: asStringOrEmpty(readCell(ws, XLSX.utils.encode_cell({ r, c: 2 }))), // C
      cliente: asStringOrEmpty(readCell(ws, XLSX.utils.encode_cell({ r, c: 3 }))), // D
      contrato,
      estatus,
      lote: asStringOrEmpty(readCell(ws, XLSX.utils.encode_cell({ r, c: 6 }))), // G
      puntaje:
        asNumberOrNull(readCell(ws, XLSX.utils.encode_cell({ r, c: 7 }))) ??
        (asStringOrEmpty(readCell(ws, XLSX.utils.encode_cell({ r, c: 7 }))) || null), // H (num or text)
      sacos69: asNumberOrNull(readCell(ws, XLSX.utils.encode_cell({ r, c: 8 }))), // I
      sacos46: asNumberOrNull(readCell(ws, XLSX.utils.encode_cell({ r, c: 9 }))), // J
      bolsa: asNumberOrNull(readCell(ws, XLSX.utils.encode_cell({ r, c: 10 }))), // K
      diferencial: asNumberOrNull(readCell(ws, XLSX.utils.encode_cell({ r, c: 11 }))), // L
      bolsaDif: asNumberOrNull(readCell(ws, XLSX.utils.encode_cell({ r, c: 12 }))), // M
      facturacionLibras: asNumberOrNull(readCell(ws, XLSX.utils.encode_cell({ r, c: 13 }))), // N
      facturacionKilos: asNumberOrNull(readCell(ws, XLSX.utils.encode_cell({ r, c: 14 }))), // O
      gastosPorSaco: asNumberOrNull(readCell(ws, XLSX.utils.encode_cell({ r, c: 15 }))), // P
      gastosTotal: asNumberOrNull(readCell(ws, XLSX.utils.encode_cell({ r, c: 16 }))), // Q
      utilidadSinGE: asNumberOrNull(readCell(ws, XLSX.utils.encode_cell({ r, c: 17 }))), // R
      costoFinanciero: asNumberOrNull(readCell(ws, XLSX.utils.encode_cell({ r, c: 18 }))), // S
      utilidadSinCF: asNumberOrNull(readCell(ws, XLSX.utils.encode_cell({ r, c: 19 }))), // T
      tipoCambio: asNumberOrNull(readCell(ws, XLSX.utils.encode_cell({ r, c: 20 }))), // U
      totalPago: asNumberOrNull(readCell(ws, XLSX.utils.encode_cell({ r, c: 21 }))), // V
    });
  }

  return { rows, raw: {} };
}

async function loadDbJanContracts() {
  return prisma.contract.findMany({
    where: { shipment: JAN },
    include: {
      shipment: true,
      materiaPrimaAllocations: { include: { materiaPrima: true } },
    },
    orderBy: { contractNumber: "asc" },
  });
}

type Divergence = {
  contrato: string;
  field: string;
  sheet: string | number | null | undefined;
  db: string | number | null | undefined;
  delta: string | null;
  note?: string;
};

function approxEq(a: number | null, b: number | null, eps = 0.03): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) <= eps;
}

function fmtDelta(a: number | null, b: number | null): string | null {
  if (a === null || b === null) return null;
  return (a - b).toFixed(6);
}

async function main() {
  console.log("");
  console.log("=".repeat(78));
  console.log(" Phase 0.1a — January sheet divergence check");
  console.log(" (read-only, flag-only, no prod mutation)");
  console.log("=".repeat(78));
  console.log("");

  if (!fs.existsSync(MAYO_PATH)) {
    console.error(`✗ Mayo.xlsx not found at ${MAYO_PATH}`);
    process.exit(1);
  }
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const { rows: sheetRows } = scanEneroSheet();
  console.log(` Sheet 'Enero' in Mayo.xlsx: ${sheetRows.length} contract rows detected`);

  const dbContracts = await loadDbJanContracts();
  console.log(` Jan 2026 DB: ${dbContracts.length} contracts`);
  console.log("");

  const divergences: Divergence[] = [];

  // Index by contract number
  const sheetByContrato = new Map<string, SheetRow>();
  for (const r of sheetRows) sheetByContrato.set(r.contrato, r);

  const dbByNumero = new Map<string, (typeof dbContracts)[number]>();
  for (const c of dbContracts) dbByNumero.set(c.contractNumber, c);

  const allNumeros = new Set<string>([
    ...sheetByContrato.keys(),
    ...dbByNumero.keys(),
  ]);

  for (const numero of Array.from(allNumeros).sort()) {
    const s = sheetByContrato.get(numero);
    const d = dbByNumero.get(numero);

    if (!s) {
      divergences.push({
        contrato: numero,
        field: "<existence>",
        sheet: "(missing row)",
        db: "(present)",
        delta: null,
        note: "Contract in DB but not in Enero sheet of Mayo.xlsx",
      });
      continue;
    }
    if (!d) {
      divergences.push({
        contrato: numero,
        field: "<existence>",
        sheet: "(present)",
        db: "(missing)",
        delta: null,
        note: "Contract in Enero sheet but not in DB",
      });
      continue;
    }

    // Compare monetary fields
    const dbSacos69 = d.sacos69kg != null ? Number(d.sacos69kg) : null;
    const dbSacos46 = d.sacos46kg != null ? Number(d.sacos46kg) : null;
    const dbBolsa = d.precioBolsa != null ? Number(d.precioBolsa) : null;
    const dbDif = d.diferencial != null ? Number(d.diferencial) : null;
    const dbBolsaDif = d.precioBolsaDif != null ? Number(d.precioBolsaDif) : null;
    const dbFactLibras = d.facturacionLbs != null ? Number(d.facturacionLbs) : null;
    const dbFactKilos = d.facturacionKgs != null ? Number(d.facturacionKgs) : null;
    const dbGastosPerSaco = d.gastosPerSaco != null ? Number(d.gastosPerSaco) : null;
    const dbGastosExport = d.gastosExport != null ? Number(d.gastosExport) : null;
    const dbCostoFin = d.costoFinanciero != null ? Number(d.costoFinanciero) : null;
    const dbUtilSinCF = d.utilidadSinCF != null ? Number(d.utilidadSinCF) : null;
    const dbTotalPagoQTZ = d.totalPagoQTZ != null ? Number(d.totalPagoQTZ) : null;
    const dbTipoCambio = d.tipoCambio != null ? Number(d.tipoCambio) : null;

    const push = (
      field: string,
      sheet: number | string | null,
      db: number | string | null,
      eps = 0.03
    ) => {
      if (typeof sheet === "number" && typeof db === "number") {
        if (!approxEq(sheet, db, eps)) {
          divergences.push({
            contrato: numero,
            field,
            sheet,
            db,
            delta: fmtDelta(sheet, db),
          });
        }
      } else if (sheet !== db) {
        divergences.push({
          contrato: numero,
          field,
          sheet,
          db,
          delta: null,
        });
      }
    };

    push("sacos69kg", s.sacos69, dbSacos69);
    push("sacos46kg", s.sacos46, dbSacos46);
    push("precioBolsa", s.bolsa, dbBolsa);
    push("diferencial", s.diferencial, dbDif);
    push("precioBolsaDif", s.bolsaDif, dbBolsaDif);
    push("facturacionLbs", s.facturacionLibras, dbFactLibras);
    push("facturacionKgs", s.facturacionKilos, dbFactKilos);
    push("gastosPerSaco", s.gastosPorSaco, dbGastosPerSaco);
    push("gastosExport", s.gastosTotal, dbGastosExport);
    push("costoFinanciero", s.costoFinanciero, dbCostoFin);
    push("utilidadSinCF", s.utilidadSinCF, dbUtilSinCF);
    push("totalPagoQTZ", s.totalPago, dbTotalPagoQTZ);
    push("tipoCambio", s.tipoCambio, dbTipoCambio, 0.0001);
  }

  // Write report
  const today = new Date().toISOString().slice(0, 10);
  const reportPath = path.join(REPORTS_DIR, `january-divergence-${today}.md`);
  const lines: string[] = [];
  lines.push(`# January 2026 — Enero-sheet vs. Prod DB divergence report`);
  lines.push("");
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push(`**Scope:** Jan 2026 only, read-only, flag-only.`);
  lines.push(`**Directive 1 + 8:** January prod DB is frozen. This report documents differences only. **Do not apply corrections from this report via ETL** — apply via the app per user direction.`);
  lines.push("");
  lines.push(`**Sheet rows detected in Enero:** ${sheetRows.length}`);
  lines.push(`**DB contracts for Jan 2026:** ${dbContracts.length}`);
  lines.push(`**Divergences found:** ${divergences.length}`);
  lines.push("");

  if (divergences.length === 0) {
    lines.push("✓ No divergences detected within the compared field set.");
    lines.push("");
  } else {
    lines.push("## Divergences");
    lines.push("");
    lines.push("| Contrato | Field | Sheet value | DB value | Δ (sheet − db) |");
    lines.push("|----------|-------|-------------|----------|-----------------|");
    for (const d of divergences) {
      const s = d.sheet === null || d.sheet === undefined ? "(null)" : String(d.sheet);
      const v = d.db === null || d.db === undefined ? "(null)" : String(d.db);
      const delta = d.delta ?? (d.note ?? "-");
      lines.push(`| ${d.contrato} | ${d.field} | ${s} | ${v} | ${delta} |`);
    }
    lines.push("");
  }

  lines.push("## Field-coverage note");
  lines.push("");
  lines.push("This report compares the per-contract row fields that are read directly from the Enero sheet contract table (B:V). It does **not** yet compare:");
  lines.push("- MateriaPrima per-row details (rendimiento, pergamino, prom. Q, total MP) — the Jan sheet MP block sits outside this scan's scope.");
  lines.push("- Subproducto rows.");
  lines.push("- Shipment-aggregate fields (utilidadBruta, margenBruto).");
  lines.push("");
  lines.push("If you need deeper coverage, extend this script. The intentional minimalism matches directive 9 (flag and wait) — the user or CFO decides next steps after reviewing.");
  lines.push("");
  lines.push("## Sheet rows extracted");
  lines.push("");
  lines.push("| Row | Contrato | Cliente | Lote | Gastos/saco | Bolsa+Dif | Facturación Kgs | Total pago Q |");
  lines.push("|-----|----------|---------|------|-------------|-----------|------------------|---------------|");
  for (const r of sheetRows) {
    lines.push(
      `| ${r.row} | ${r.contrato} | ${r.cliente} | ${r.lote} | ${r.gastosPorSaco ?? "-"} | ${r.bolsaDif ?? "-"} | ${r.facturacionKilos ?? "-"} | ${r.totalPago ?? "-"} |`
    );
  }
  lines.push("");
  lines.push("---");
  lines.push("*End of divergence report.*");

  fs.writeFileSync(reportPath, lines.join("\n") + "\n");
  console.log(` → wrote ${reportPath}`);
  console.log(` Divergences found: ${divergences.length}`);

  if (divergences.length > 0) {
    console.log("");
    console.log(" Top 10 divergences:");
    for (const d of divergences.slice(0, 10)) {
      console.log(
        `  ${d.contrato}.${d.field}: sheet=${d.sheet} db=${d.db}` +
          (d.delta ? ` Δ=${d.delta}` : "") +
          (d.note ? ` (${d.note})` : "")
      );
    }
  }

  console.log("");
  console.log("=".repeat(78));
  console.log(" Done. Read-only. No DB mutation occurred.");
  console.log("=".repeat(78));
  console.log("");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
