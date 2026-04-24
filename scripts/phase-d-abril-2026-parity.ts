// ============================================================================
// Phase D — Abril 2026 post-ETL parity check (read-only)
// ============================================================================
// Compares Mayo.xlsx "Abril" sheet against both Apr 2026 shipments.
// Stock-lock rows: skip costoFin / utilSinCF / totalPago comparisons (sheet
// values are #REF!). For stock-lot-afloat the DB is authoritative.
// ============================================================================

import * as XLSX from "xlsx";
import * as fs from "node:fs";
import * as path from "node:path";
import { PrismaClient } from "@prisma/client";

const MAYO_PATH = path.join(process.cwd(), "Mayo.xlsx");
const SHEET = "Abril";
const MONTH_NUM = 4;
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
  severity: "ok" | "mismatch" | "skipped";
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

  type SC = {
    contrato: string;
    row: number;
    isStockLotAfloat: boolean;
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
    const lote = sv(cellOf(ws, r, 6));
    sheetContracts.push({
      contrato,
      row: r + 1,
      isStockLotAfloat: /stocklot|stock\s*lock/i.test(lote),
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

  // Apply -01/-02 suffixing (same rule as ETL)
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

  // MP block (Exportadora only)
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

  // DB: both shipments
  const shipments = await prisma.shipment.findMany({
    where: { year: YEAR, month: MONTH_NUM },
    include: {
      contracts: { include: { materiaPrimaAllocations: { include: { materiaPrima: true } } } },
      subproductos: true,
    },
    orderBy: { name: "asc" },
  });
  if (shipments.length !== 2) {
    console.error(`✗ Expected 2 shipments, found ${shipments.length}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const dbContracts = shipments.flatMap((s) => s.contracts);
  const dbByNumero = new Map(dbContracts.map((c) => [c.contractNumber, c]));

  const diffs: Diff[] = [];
  const push = (entity: string, field: string, sheet: number, db: number, eps = EPS_MONETARY) => {
    const delta = db - sheet;
    const ok = approxEq(sheet, db, eps);
    diffs.push({ entity, field, sheet, db, delta, severity: ok ? "ok" : "mismatch" });
  };
  const skip = (entity: string, field: string, reason: string) => {
    diffs.push({ entity, field, sheet: reason, db: null, delta: null, severity: "skipped" });
  };

  // Filter expContracts in the positional order for MP alignment
  const sheetExpContracts = sheetWithFinal.filter((s) => !s.isStockLotAfloat);

  for (let i = 0; i < sheetWithFinal.length; i++) {
    const s = sheetWithFinal[i];
    const d = dbByNumero.get(s.finalContract);
    if (!d) {
      diffs.push({ entity: s.finalContract, field: "<existence>", sheet: "present", db: "missing", delta: null, severity: "mismatch" });
      continue;
    }

    // Per-contract fields that are sheet-valid for both Exp and SL
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
    push(s.finalContract, "tipoCambio", s.tipoCambio, Number(d.tipoCambio ?? 0), EPS_RATIO);

    if (s.isStockLotAfloat) {
      // Sheet values are #REF!; DB is authoritative.
      skip(s.finalContract, "costoFinanciero", "stock-lot-afloat: sheet #REF!");
      skip(s.finalContract, "utilidadSinCF", "stock-lot-afloat: sheet #REF!");
      skip(s.finalContract, "totalPagoQTZ", "stock-lot-afloat: sheet #REF!");
    } else {
      push(s.finalContract, "costoFinanciero", s.costoFin, Number(d.costoFinanciero ?? 0));
      push(s.finalContract, "utilidadSinCF", s.utilSinCF, Number(d.utilidadSinCF ?? 0));
      push(s.finalContract, "totalPagoQTZ", s.totalPago, Number(d.totalPagoQTZ ?? 0));
    }

    // MP comparison (Exportadora only)
    if (!s.isStockLotAfloat) {
      const expIdx = sheetExpContracts.findIndex((x) => x.finalContract === s.finalContract);
      const alloc = d.materiaPrimaAllocations[0];
      if (alloc && expIdx >= 0) {
        const mp = alloc.materiaPrima;
        const sheetMPRow = sheetMP[expIdx];
        if (sheetMPRow) {
          push(s.finalContract, "mp.rendimiento", sheetMPRow.rendimiento, Number(mp.rendimiento), 0.00005);
          push(s.finalContract, "mp.pergamino", sheetMPRow.pergo, Number(mp.pergamino));
          push(s.finalContract, "mp.precioPromQ", sheetMPRow.promQ, Number(mp.precioPromQ));
          push(s.finalContract, "mp.totalMP", sheetMPRow.totalMP, Number(mp.totalMP));
        }
      }
    }
  }

  const okCount = diffs.filter((d) => d.severity === "ok").length;
  const misCount = diffs.filter((d) => d.severity === "mismatch").length;
  const skippedCount = diffs.filter((d) => d.severity === "skipped").length;

  const today = new Date().toISOString().slice(0, 10);
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const reportPath = path.join(REPORTS_DIR, `phase-d-${SHEET.toLowerCase()}-2026-${today}.md`);

  const L: string[] = [];
  L.push(`# Phase D — ${SHEET} 2026 parity report`);
  L.push("");
  L.push(`**Generated:** ${new Date().toISOString()}`);
  L.push(`**Totals:** ${okCount} OK / ${misCount} MISMATCH / ${skippedCount} SKIPPED (of ${diffs.length})`);
  L.push("");
  L.push("## Shipments");
  L.push("");
  L.push("| Name | Entity | Contracts | Utilidad Bruta Q | Margen Bruto |");
  L.push("|------|--------|-----------|-------------------|---------------|");
  for (const s of shipments) {
    const entity = s.contracts[0]?.exportingEntity ?? "?";
    L.push(
      `| ${s.name} | ${entity} | ${s.contracts.length} | ${Number(s.utilidadBruta ?? 0).toFixed(2)} | ${(Number(s.margenBruto ?? 0) * 100).toFixed(2)}% |`
    );
  }
  L.push("");

  if (misCount > 0) {
    L.push("## Mismatches");
    L.push("");
    L.push("| Entity | Field | Sheet | DB | Δ |");
    L.push("|--------|-------|-------|----|----|");
    for (const d of diffs.filter((x) => x.severity === "mismatch")) {
      L.push(`| ${d.entity} | ${d.field} | ${d.sheet} | ${d.db} | ${d.delta ?? "-"} |`);
    }
    L.push("");
  }

  L.push("## All comparisons");
  L.push("");
  L.push("| Entity | Field | Sheet | DB | Status |");
  L.push("|--------|-------|-------|----|--------|");
  for (const d of diffs) {
    const mark = d.severity === "ok" ? "✓" : d.severity === "skipped" ? "—" : "✗";
    L.push(`| ${d.entity} | ${d.field} | ${d.sheet} | ${d.db ?? ""} | ${mark} ${d.delta ?? ""} |`);
  }
  fs.writeFileSync(reportPath, L.join("\n") + "\n");

  console.log("");
  console.log(` ${okCount} OK  /  ${misCount} MISMATCH  /  ${skippedCount} SKIPPED   (of ${diffs.length})`);
  for (const s of shipments) {
    const entity = s.contracts[0]?.exportingEntity ?? "?";
    console.log(
      `  ${s.name} [${entity}]: Utilidad Q ${Number(s.utilidadBruta ?? 0).toFixed(2)}  Margen ${(Number(s.margenBruto ?? 0) * 100).toFixed(2)}%`
    );
  }
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
