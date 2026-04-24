// Phase D — Mayo 2026 post-ETL parity (read-only)
import * as XLSX from "xlsx";
import * as fs from "node:fs";
import * as path from "node:path";
import { PrismaClient } from "@prisma/client";

const MAYO_PATH = path.join(process.cwd(), "Mayo.xlsx");
const SHEET = "MAYO";
const MONTH_NUM = 5;
const YEAR = 2026;
const REPORTS_DIR = path.join(process.cwd(), "reports");
const EPS = 0.03;
const EPS_RATIO = 0.0001;
const prisma = new PrismaClient();

function cellOf(ws: XLSX.WorkSheet, r: number, c: number) {
  return ws[XLSX.utils.encode_cell({ r, c })];
}
function sv(cell: XLSX.CellObject | undefined) {
  return !cell || cell.v == null || cell.v === "" ? "" : String(cell.v).trim();
}
function nv(cell: XLSX.CellObject | undefined) {
  if (!cell) return NaN;
  const n = Number(cell.v);
  return Number.isFinite(n) ? n : NaN;
}
function parseParen(raw: string) {
  const m = raw.match(/^(.+?)\s*\(\s*(.+?)\s*\)\s*$/);
  return m ? { plain: m[1].trim(), paren: m[2].trim() } : null;
}

type Diff = { entity: string; field: string; sheet: number | string; db: number | string; severity: "ok" | "mismatch" };

async function main() {
  const wb = XLSX.readFile(MAYO_PATH);
  const ws = wb.Sheets[SHEET];
  const range = XLSX.utils.decode_range(ws["!ref"]!);

  type SC = { contrato: string; sacos69: number; sacos46: number; bolsaDif: number; factLbs: number; factKgs: number; gastosTotal: number; utilSinGE: number; costoFin: number; utilSinCF: number; totalPago: number };
  const sheetContracts: SC[] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const raw = sv(cellOf(ws, r, 4));
    const est = sv(cellOf(ws, r, 5));
    if (!raw || /^CONTRATO$/i.test(raw)) continue;
    if (!/^(Fijado|No\s*Fijado|FIJADO|NO\s*FIJADO)$/i.test(est)) continue;
    const paren = parseParen(raw);
    sheetContracts.push({
      contrato: paren ? paren.plain : raw,
      sacos69: nv(cellOf(ws, r, 8)),
      sacos46: nv(cellOf(ws, r, 9)),
      bolsaDif: nv(cellOf(ws, r, 12)),
      factLbs: nv(cellOf(ws, r, 13)),
      factKgs: nv(cellOf(ws, r, 14)),
      gastosTotal: nv(cellOf(ws, r, 16)),
      utilSinGE: nv(cellOf(ws, r, 17)),
      costoFin: nv(cellOf(ws, r, 18)),
      utilSinCF: nv(cellOf(ws, r, 19)),
      totalPago: nv(cellOf(ws, r, 21)),
    });
  }

  // Suffix duplicates
  const cnt = new Map<string, number>();
  for (const s of sheetContracts) cnt.set(s.contrato, (cnt.get(s.contrato) ?? 0) + 1);
  const ctr = new Map<string, number>();
  const sheetWithFinal = sheetContracts.map((s) => {
    const n = cnt.get(s.contrato) ?? 0;
    let fn = s.contrato;
    if (n > 1) {
      const idx = (ctr.get(s.contrato) ?? 0) + 1;
      ctr.set(s.contrato, idx);
      fn = `${s.contrato}-${String(idx).padStart(2, "0")}`;
    }
    return { ...s, finalContract: fn };
  });

  // Sheet aggregates — find UTILIDAD BRUTA label
  let utilRow = -1;
  for (let r = range.s.r; r <= range.e.r; r++) {
    if (sv(cellOf(ws, r, 19)).toUpperCase() === "UTILIDAD BRUTA") {
      utilRow = r;
      break;
    }
  }
  const sheetUtil = utilRow >= 0 ? nv(cellOf(ws, utilRow, 21)) : NaN;
  const sheetMargen = utilRow >= 0 ? nv(cellOf(ws, utilRow, 17)) : NaN;

  // DB
  const shipment = await prisma.shipment.findFirst({
    where: { year: YEAR, month: MONTH_NUM },
    include: { contracts: true },
  });
  if (!shipment) {
    console.error("No Mayo shipment");
    await prisma.$disconnect();
    process.exit(1);
  }
  const dbBy = new Map(shipment.contracts.map((c) => [c.contractNumber, c]));

  const diffs: Diff[] = [];
  const push = (entity: string, field: string, sheet: number, db: number, eps = EPS) => {
    const ok = !Number.isFinite(sheet) || Math.abs(db - sheet) <= eps;
    diffs.push({ entity, field, sheet, db, severity: ok ? "ok" : "mismatch" });
  };

  for (const s of sheetWithFinal) {
    const d = dbBy.get(s.finalContract);
    if (!d) {
      diffs.push({ entity: s.finalContract, field: "<existence>", sheet: "present", db: "missing", severity: "mismatch" });
      continue;
    }
    push(s.finalContract, "sacos69", s.sacos69, Number(d.sacos69kg));
    push(s.finalContract, "sacos46", s.sacos46, Number(d.sacos46kg));
    push(s.finalContract, "bolsaDif", s.bolsaDif, Number(d.precioBolsaDif ?? 0));
    push(s.finalContract, "factLbs", s.factLbs, Number(d.facturacionLbs ?? 0));
    push(s.finalContract, "factKgs", s.factKgs, Number(d.facturacionKgs ?? 0));
    push(s.finalContract, "gastosExport", s.gastosTotal, Number(d.gastosExport ?? 0));
    push(s.finalContract, "utilSinGE", s.utilSinGE, Number(d.utilidadSinGE ?? 0));
    push(s.finalContract, "costoFin", s.costoFin, Number(d.costoFinanciero ?? 0));
    push(s.finalContract, "utilSinCF", s.utilSinCF, Number(d.utilidadSinCF ?? 0));
    push(s.finalContract, "totalPago", s.totalPago, Number(d.totalPagoQTZ ?? 0));
  }
  if (Number.isFinite(sheetUtil) && shipment.utilidadBruta != null) push("Shipment", "utilidadBruta", sheetUtil, Number(shipment.utilidadBruta));
  if (Number.isFinite(sheetMargen) && shipment.margenBruto != null) push("Shipment", "margenBruto", sheetMargen, Number(shipment.margenBruto), EPS_RATIO);

  const ok = diffs.filter((d) => d.severity === "ok").length;
  const mis = diffs.filter((d) => d.severity === "mismatch").length;

  const today = new Date().toISOString().slice(0, 10);
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const reportPath = path.join(REPORTS_DIR, `phase-d-mayo-2026-${today}.md`);
  const L: string[] = [];
  L.push(`# Phase D — Mayo 2026 parity`);
  L.push(``);
  L.push(`Shipment ${shipment.id} · Utilidad Q ${Number(shipment.utilidadBruta ?? 0).toFixed(2)} · Margen ${(Number(shipment.margenBruto ?? 0) * 100).toFixed(2)}%`);
  L.push(``);
  L.push(`**${ok} OK / ${mis} MISMATCH (of ${diffs.length})**`);
  L.push(``);
  if (mis > 0) {
    L.push(`## Mismatches`);
    L.push(``);
    L.push(`| Entity | Field | Sheet | DB |`);
    L.push(`|--------|-------|-------|-----|`);
    for (const d of diffs.filter((x) => x.severity === "mismatch")) L.push(`| ${d.entity} | ${d.field} | ${d.sheet} | ${d.db} |`);
    L.push(``);
  }
  L.push(`## All comparisons`);
  L.push(``);
  L.push(`| Entity | Field | Sheet | DB | |`);
  L.push(`|--------|-------|-------|-----|---|`);
  for (const d of diffs) L.push(`| ${d.entity} | ${d.field} | ${d.sheet} | ${d.db} | ${d.severity === "ok" ? "✓" : "✗"} |`);
  fs.writeFileSync(reportPath, L.join("\n") + "\n");

  console.log(`${ok} OK / ${mis} MISMATCH (of ${diffs.length})`);
  console.log(`Shipment: ${shipment.name}`);
  console.log(`  Utilidad Q ${Number(shipment.utilidadBruta ?? 0).toFixed(2)}   Margen ${(Number(shipment.margenBruto ?? 0) * 100).toFixed(2)}%`);
  console.log(`  Sheet:    Utilidad Q ${Number.isFinite(sheetUtil) ? sheetUtil.toFixed(2) : "?"}   Margen ${Number.isFinite(sheetMargen) ? (sheetMargen * 100).toFixed(2) + "%" : "?"}`);
  console.log(` → wrote ${reportPath}`);
  if (mis > 0) {
    for (const d of diffs.filter((x) => x.severity === "mismatch")) console.log(`  ${d.entity}.${d.field}: sheet=${d.sheet} db=${d.db}`);
  }
  await prisma.$disconnect();
  if (mis > 0) process.exit(1);
}
main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
