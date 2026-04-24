// ============================================================================
// Phase D — Marzo 2026 post-ETL parity check (read-only)
// ============================================================================
// Re-reads the Marzo sheet + the Mar 2026 DB state and diffs every value.
// Handles POUS-00003761 split: compares each DB -01/-02 contract against its
// corresponding sheet row (positionally).
//
// Usage:  npx tsx scripts/phase-d-marzo-2026-parity.ts
// ============================================================================

import * as XLSX from "xlsx";
import * as fs from "node:fs";
import * as path from "node:path";
import { PrismaClient } from "@prisma/client";

const MAYO_PATH = path.join(process.cwd(), "Mayo.xlsx");
const SHEET = "Marzo";
const MONTH_NUM = 3;
const YEAR = 2026;
const REPORTS_DIR = path.join(process.cwd(), "reports");
const EPS_MONETARY = 0.03;
const EPS_RATIO = 0.0001;

const prisma = new PrismaClient();

function cellOf(ws: XLSX.WorkSheet, r: number, c: number): XLSX.CellObject | undefined {
  return ws[XLSX.utils.encode_cell({ r, c })];
}
function sv(cell: XLSX.CellObject | undefined): string {
  if (!cell || cell.v === null || cell.v === undefined || cell.v === "") return "";
  return String(cell.v).trim();
}
function nv(cell: XLSX.CellObject | undefined): number {
  if (!cell) return NaN;
  const n = Number(cell.v);
  return Number.isFinite(n) ? n : NaN;
}

type Diff = {
  entity: string;
  field: string;
  sheet: number | string | null;
  db: number | string | null;
  delta: number | null;
  severity: "ok" | "mismatch";
};

function approxEq(a: number | null, b: number | null, eps: number): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) <= eps;
}

async function main() {
  console.log("");
  console.log("=".repeat(78));
  console.log(` Phase D — ${SHEET} 2026 parity check (read-only)`);
  console.log("=".repeat(78));

  const wb = XLSX.readFile(MAYO_PATH);
  const ws = wb.Sheets[SHEET];
  if (!ws) throw new Error(`Sheet '${SHEET}' not found`);
  const range = XLSX.utils.decode_range(ws["!ref"]!);

  // Sheet contracts (preserving insertion order for suffix alignment)
  type SC = {
    contrato: string;
    row: number;
    sacos69: number;
    sacos46: number;
    bolsa: number;
    diferencial: number;
    bolsaDif: number;
    factLbs: number;
    factKgs: number;
    gastosPerSaco: number;
    gastosTotal: number;
    utilSinGE: number;
    costoFin: number;
    utilSinCF: number;
    tipoCambio: number;
    totalPago: number;
  };
  const sheetContracts: SC[] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const contrato = sv(cellOf(ws, r, 4));
    const estatus = sv(cellOf(ws, r, 5));
    if (!contrato || /^CONTRATO$/i.test(contrato)) continue;
    if (!/^(Fijado|No\s*Fijado|FIJADO|NO\s*FIJADO)$/i.test(estatus)) continue;
    sheetContracts.push({
      contrato,
      row: r + 1,
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

  // Apply the same suffix rule the ETL used
  const countByName = new Map<string, number>();
  for (const s of sheetContracts) countByName.set(s.contrato, (countByName.get(s.contrato) ?? 0) + 1);
  const counter = new Map<string, number>();
  const sheetWithFinal = sheetContracts.map((s) => {
    const n = countByName.get(s.contrato) ?? 0;
    let finalN = s.contrato;
    if (n > 1) {
      const idx = (counter.get(s.contrato) ?? 0) + 1;
      counter.set(s.contrato, idx);
      finalN = `${s.contrato}-${String(idx).padStart(2, "0")}`;
    }
    return { ...s, finalContract: finalN };
  });

  // Sheet MP block
  type SMP = { contrato: string; rendimiento: number; pergo: number; promQ: number; totalMP: number };
  const sheetMP: SMP[] = [];
  let mpHeaderRow = -1;
  for (let r = range.s.r; r <= range.e.r; r++) {
    if (sv(cellOf(ws, r, 11)).toUpperCase() === "PERGO" && sv(cellOf(ws, r, 6)).toUpperCase() === "CONTRATO") {
      mpHeaderRow = r;
      break;
    }
  }
  if (mpHeaderRow >= 0) {
    for (let r = mpHeaderRow + 1; r <= range.e.r; r++) {
      const contrato = sv(cellOf(ws, r, 6));
      if (!contrato || /^TOTAL/i.test(contrato)) break;
      sheetMP.push({
        contrato,
        rendimiento: nv(cellOf(ws, r, 10)),
        pergo: nv(cellOf(ws, r, 11)),
        promQ: nv(cellOf(ws, r, 12)),
        totalMP: nv(cellOf(ws, r, 14)),
      });
    }
  }

  // Sheet aggregates (utilidad bruta + margen on the right-side P&L column)
  // Find the UTILIDAD BRUTA row by scanning col T.
  let utilRow = -1;
  for (let r = range.s.r; r <= range.e.r; r++) {
    if (sv(cellOf(ws, r, 19)).toUpperCase() === "UTILIDAD BRUTA") {
      utilRow = r;
      break;
    }
  }
  const sheetUtilidadBruta = utilRow >= 0 ? nv(cellOf(ws, utilRow, 21)) : NaN;
  const sheetMargenBruto = utilRow >= 0 ? nv(cellOf(ws, utilRow, 17)) : NaN;

  // DB
  const shipment = await prisma.shipment.findFirst({
    where: { year: YEAR, month: MONTH_NUM },
    include: {
      contracts: { include: { materiaPrimaAllocations: { include: { materiaPrima: true } } } },
      materiaPrima: true,
      subproductos: true,
    },
  });
  if (!shipment) {
    console.error(`✗ No ${SHEET} ${YEAR} shipment in DB.`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const dbByNumero = new Map(shipment.contracts.map((c) => [c.contractNumber, c]));
  const diffs: Diff[] = [];
  const push = (entity: string, field: string, sheet: number, db: number, eps = EPS_MONETARY) => {
    const delta = db - sheet;
    const ok = approxEq(sheet, db, eps);
    diffs.push({ entity, field, sheet, db, delta, severity: ok ? "ok" : "mismatch" });
  };

  for (let i = 0; i < sheetWithFinal.length; i++) {
    const s = sheetWithFinal[i];
    const d = dbByNumero.get(s.finalContract);
    if (!d) {
      diffs.push({ entity: s.finalContract, field: "<existence>", sheet: "present", db: "missing", delta: null, severity: "mismatch" });
      continue;
    }
    push(s.finalContract, "sacos69kg", s.sacos69, Number(d.sacos69kg));
    push(s.finalContract, "sacos46kg", s.sacos46, Number(d.sacos46kg));
    push(s.finalContract, "precioBolsa", s.bolsa, Number(d.precioBolsa ?? 0));
    push(s.finalContract, "diferencial", s.diferencial, Number(d.diferencial ?? 0));
    push(s.finalContract, "precioBolsaDif", s.bolsaDif, Number(d.precioBolsaDif ?? 0));
    push(s.finalContract, "facturacionLbs", s.factLbs, Number(d.facturacionLbs ?? 0));
    push(s.finalContract, "facturacionKgs", s.factKgs, Number(d.facturacionKgs ?? 0));
    push(s.finalContract, "gastosPerSaco", s.gastosPerSaco, Number(d.gastosPerSaco ?? 0));
    push(s.finalContract, "gastosExport", s.gastosTotal, Number(d.gastosExport ?? 0));
    push(s.finalContract, "utilidadSinGE", s.utilSinGE, Number(d.utilidadSinGE ?? 0));
    push(s.finalContract, "costoFinanciero", s.costoFin, Number(d.costoFinanciero ?? 0));
    push(s.finalContract, "utilidadSinCF", s.utilSinCF, Number(d.utilidadSinCF ?? 0));
    push(s.finalContract, "totalPagoQTZ", s.totalPago, Number(d.totalPagoQTZ ?? 0));
    push(s.finalContract, "tipoCambio", s.tipoCambio, Number(d.tipoCambio ?? 0), EPS_RATIO);

    const alloc = d.materiaPrimaAllocations[0];
    if (alloc) {
      const mp = alloc.materiaPrima;
      const sheetMPRow = sheetMP[i]; // 1:1 positional
      if (sheetMPRow) {
        push(s.finalContract, "mp.rendimiento", sheetMPRow.rendimiento, Number(mp.rendimiento), 0.00005);
        push(s.finalContract, "mp.pergamino", sheetMPRow.pergo, Number(mp.pergamino));
        push(s.finalContract, "mp.precioPromQ", sheetMPRow.promQ, Number(mp.precioPromQ));
        push(s.finalContract, "mp.totalMP", sheetMPRow.totalMP, Number(mp.totalMP));
      }
    }
  }

  if (Number.isFinite(sheetUtilidadBruta) && shipment.utilidadBruta != null) {
    push("Shipment", "utilidadBruta", sheetUtilidadBruta, Number(shipment.utilidadBruta));
  }
  if (Number.isFinite(sheetMargenBruto) && shipment.margenBruto != null) {
    push("Shipment", "margenBruto", sheetMargenBruto, Number(shipment.margenBruto), EPS_RATIO);
  }

  const okCount = diffs.filter((d) => d.severity === "ok").length;
  const misCount = diffs.filter((d) => d.severity === "mismatch").length;

  const today = new Date().toISOString().slice(0, 10);
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const reportPath = path.join(REPORTS_DIR, `phase-d-${SHEET.toLowerCase()}-2026-${today}.md`);

  const L: string[] = [];
  L.push(`# Phase D — ${SHEET} 2026 parity report`);
  L.push("");
  L.push(`**Generated:** ${new Date().toISOString()}`);
  L.push(`**Sheet:** \`${SHEET}\` in \`Mayo.xlsx\``);
  L.push(`**Shipment ID:** \`${shipment.id}\``);
  L.push(`**Shipment name:** ${shipment.name}`);
  L.push("");
  L.push(`**Totals:** ${okCount} OK / ${misCount} MISMATCH  (of ${diffs.length})`);
  L.push("");
  L.push(`**SSOT targets vs DB:**`);
  L.push(`- Utilidad Bruta: sheet Q ${Number.isFinite(sheetUtilidadBruta) ? sheetUtilidadBruta.toFixed(2) : "?"} · db Q ${Number(shipment.utilidadBruta ?? 0).toFixed(2)}`);
  L.push(`- Margen Bruto:   sheet ${Number.isFinite(sheetMargenBruto) ? (sheetMargenBruto * 100).toFixed(2) + " %" : "?"} · db ${(Number(shipment.margenBruto ?? 0) * 100).toFixed(2)} %`);
  L.push("");

  if (misCount > 0) {
    L.push("## Mismatches");
    L.push("");
    L.push("| Entity | Field | Sheet | DB | Δ (db−sheet) |");
    L.push("|--------|-------|-------|----|---------------|");
    for (const d of diffs.filter((x) => x.severity === "mismatch")) {
      L.push(`| ${d.entity} | ${d.field} | ${d.sheet} | ${d.db} | ${d.delta ?? "-"} |`);
    }
    L.push("");
  }
  L.push("## All comparisons (compact)");
  L.push("");
  L.push("| Entity | Field | Sheet | DB | Δ |");
  L.push("|--------|-------|-------|----|----|");
  for (const d of diffs) {
    const mark = d.severity === "ok" ? "✓" : "✗";
    L.push(`| ${d.entity} | ${d.field} | ${d.sheet} | ${d.db} | ${mark} ${d.delta ?? ""} |`);
  }
  fs.writeFileSync(reportPath, L.join("\n") + "\n");

  console.log("");
  console.log(` ${okCount} OK  /  ${misCount} MISMATCH   (of ${diffs.length})`);
  console.log(` Utilidad Bruta: sheet Q ${Number.isFinite(sheetUtilidadBruta) ? sheetUtilidadBruta.toFixed(2) : "?"}  vs  db Q ${Number(shipment.utilidadBruta ?? 0).toFixed(2)}`);
  console.log(` Margen Bruto:   sheet ${Number.isFinite(sheetMargenBruto) ? (sheetMargenBruto * 100).toFixed(2) + "%" : "?"}  vs  db ${(Number(shipment.margenBruto ?? 0) * 100).toFixed(2)}%`);
  console.log(` → wrote ${reportPath}`);

  if (misCount > 0) {
    console.log("");
    console.log(" Mismatches:");
    for (const d of diffs.filter((x) => x.severity === "mismatch")) {
      console.log(`  ${d.entity}.${d.field}: sheet=${d.sheet} db=${d.db} Δ=${d.delta}`);
    }
  }

  console.log("");
  console.log("=".repeat(78));
  await prisma.$disconnect();
  if (misCount > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
