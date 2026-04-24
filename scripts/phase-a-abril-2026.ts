// ============================================================================
// Phase A — Abril 2026 cell inventory + DB baseline check (read-only)
// ============================================================================
// Per RECONCILIATION_PLAN_2026_JAN_MAY.md §3 Phase A. Abril-scoped.
//
// Key differences vs Febrero / Marzo:
//   - 2 entity blocks: EXPORTADORA (top) + STOCK_LOT_AFLOAT (bottom, `lote=Stocklot`).
//   - STOCK_LOT_AFLOAT has no MP and no subproducto (business-rules §1.2).
//   - STOCK_LOT_AFLOAT rows carry #REF! errors on COSTO FINANCIERO / UTILIDAD SIN CF /
//     TOTAL PAGO (the formulas depend on MP which doesn't exist). Per user
//     directive 3 (2026-04-24) these are tolerated — ETL will recompute via
//     calculateContract with montoCredito=0 and persist without crashing. Phase
//     A flags them as "info", not "error", so Phase B does not auto-pause.
//   - Duplicate contract numbers: expect at least GT260360 ×2 (stock-lot-afloat) and
//     possibly W26350-GT ×2 (Westrade).
//   - Clients expected: Serengetti, Stonex (in map), Westrade (new — flag),
//     Plateau Harvest (needs-create, pre-approved).
//
// Usage:  npx tsx scripts/phase-a-abril-2026.ts
// ============================================================================

import * as XLSX from "xlsx";
import * as fs from "node:fs";
import * as path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadVariantMap, resolveStrict, type DbClient } from "./lib/client-variants";

const MAYO_PATH = path.join(process.cwd(), "Mayo.xlsx");
const SHEET = "Abril";
const MONTH_NUM = 4;
const YEAR = 2026;

const DOCS_DIR = path.join(process.cwd(), "docs", "ssot");
const REPORTS_DIR = path.join(process.cwd(), "reports");

const prisma = new PrismaClient();

function cellOf(ws: XLSX.WorkSheet, r: number, c: number): XLSX.CellObject | undefined {
  return ws[XLSX.utils.encode_cell({ r, c })];
}
function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === "";
}
function sv(cell: XLSX.CellObject | undefined): string {
  if (!cell || isEmpty(cell.v)) return "";
  return String(cell.v).trim();
}
function nv(cell: XLSX.CellObject | undefined): number | null {
  if (!cell) return null;
  const n = Number(cell.v);
  return Number.isFinite(n) ? n : null;
}

// Posición may be text ("May-26") or Excel serial (46143).
const POSICION_MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
function posicionString(cell: XLSX.CellObject | undefined): string {
  if (!cell || cell.v == null || cell.v === "") return "";
  if (typeof cell.v === "string") return cell.v.trim();
  if (cell.v instanceof Date) {
    const mo = POSICION_MONTH_ABBR[cell.v.getUTCMonth()];
    const y = String(cell.v.getUTCFullYear() % 100).padStart(2, "0");
    return `${mo}-${y}`;
  }
  if (typeof cell.v === "number") {
    const ms = (cell.v - 25569) * 86400000;
    const d = new Date(ms);
    const mo = POSICION_MONTH_ABBR[d.getUTCMonth()];
    const y = String(d.getUTCFullYear() % 100).padStart(2, "0");
    return `${mo}-${y}`;
  }
  return String(cell.v).trim();
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
  // Pass 1 — contract rows
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
    isStockLotAfloat: boolean;
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
    const lote = sv(cellOf(ws, r, 6));
    const isStockLotAfloat = /stocklot|stock\s*lock/i.test(lote);
    contracts.push({
      row: r + 1,
      contrato,
      embarque: posicionString(cellOf(ws, r, 1)),
      posicion: posicionString(cellOf(ws, r, 2)),
      cliente: sv(cellOf(ws, r, 3)),
      estatus,
      lote,
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
      isStockLotAfloat,
    });
  }

  const exportadoraContracts = contracts.filter((c) => !c.isStockLotAfloat);
  const stockLotAfloatContracts = contracts.filter((c) => c.isStockLotAfloat);
  const stockLotAfloatRowSet = new Set(stockLotAfloatContracts.map((c) => c.row));
  // Also tolerate the TOTAL row immediately below the last stock-lot-afloat contract
  // (it aggregates stock-lot-afloat values which themselves are #REF!).
  if (stockLotAfloatContracts.length > 0) {
    stockLotAfloatRowSet.add(Math.max(...stockLotAfloatContracts.map((c) => c.row)) + 1);
  }

  // -------------------------------------------------------------------------
  // Pass 2 — every non-empty cell with #REF! tolerance for stock-lot-afloat rows
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
        if (stockLotAfloatRowSet.has(rec.row)) {
          flag(
            "info",
            rec.addr,
            `Excel error in stock-lot-afloat row — tolerated per user directive 3 (ETL recomputes via calculateContract with montoCredito=0): ${cell.v}`
          );
        } else {
          flag("error", rec.addr, `Excel error in cell: ${cell.v}`);
        }
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

  // Duplicate contractNumber detection
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
      `Duplicate contractNumber '${num}' across rows ${rows.map((r) => r.row).join(", ")}. Diferencial values: ${rows.map((r) => r.diferencial ?? "?").join(", ")}. Phase C will split with -01/-02 suffixes.`
    );
  }

  // Formula cross-checks for non-stock-lot-afloat contracts
  for (const c of contracts) {
    if (c.isStockLotAfloat) continue; // skip — #REF! values expected downstream
    if (c.sacos46 != null && c.bolsaDif != null && c.factLbs != null) {
      const expected = c.sacos46 * c.bolsaDif;
      if (Math.abs(expected - c.factLbs) > EPS_MONETARY) {
        flag("warn", `N${c.row}`, `facturacionLbs mismatch: cell=${c.factLbs} expected=${expected.toFixed(2)} (J×M)`);
      }
    }
    if (c.sacos69 != null && c.bolsaDif != null && c.factKgs != null) {
      const expected = c.sacos69 * 69 * 2.2046 * (c.bolsaDif / 100);
      if (Math.abs(expected - c.factKgs) > EPS_MONETARY) {
        flag("warn", `O${c.row}`, `facturacionKgs mismatch: cell=${c.factKgs} expected=${expected.toFixed(4)} (I×69×2.2046×M/100)`);
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
  // Pass 3 — MP block (only covers Exportadora contracts)
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

  // Verify MP aligns with Exportadora contracts only
  if (exportadoraContracts.length !== mpRows.length) {
    flag(
      "warn",
      "(MP block)",
      `Exportadora contracts=${exportadoraContracts.length}, MP rows=${mpRows.length}. Expected 1:1 after stock-lot-afloat filtered out.`
    );
  }

  for (const m of mpRows) {
    if (m.rendimiento != null && m.oro != null && m.pergo != null) {
      const expected = m.rendimiento * m.oro;
      if (Math.abs(expected - m.pergo) > 0.05) {
        flag("warn", `L${m.row}`, `pergo mismatch: cell=${m.pergo} expected=${expected.toFixed(4)} (K×J)`);
      }
    }
    if (m.pergo != null && m.promQ != null && m.totalMP != null) {
      const expected = m.pergo * m.promQ;
      if (Math.abs(expected - m.totalMP) > 1.0) {
        flag("warn", `(totalMP)${m.row}`, `totalMP mismatch: cell=${m.totalMP} expected=${expected.toFixed(2)} (L×M)`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Pass 4 — subproducto
  // -------------------------------------------------------------------------
  // Detect subproducto header by "CONTENEDORES" in col J (consistent across
  // Febrero row 16, Marzo row 23, Abril row 23 — more stable than looking for
  // the "SUBPRODUCTO" label which drifts between col G and col I).
  let subHeaderRow = -1;
  for (let r = range.s.r; r <= range.e.r; r++) {
    if (sv(cellOf(ws, r, 9)).toUpperCase() === "CONTENEDORES") {
      subHeaderRow = r;
      break;
    }
  }
  let subData: {
    headerRow: number;
    contenedores: number | null;
    oroPerCont: number | null;
    totalOro: number | null;
    precioSinIva: number | null;
    totalPerg: number | null;
  } | null = null;
  if (subHeaderRow >= 0) {
    // Data row is usually +1 (Abril) but some months put it +2 (Febrero). Probe.
    for (const offset of [1, 2]) {
      const dr = subHeaderRow + offset;
      const contenedores = nv(cellOf(ws, dr, 9));
      if (contenedores !== null && contenedores > 0) {
        subData = {
          headerRow: dr,
          contenedores,
          oroPerCont: nv(cellOf(ws, dr, 10)),
          totalOro: nv(cellOf(ws, dr, 11)),
          precioSinIva: nv(cellOf(ws, dr, 12)),
          totalPerg: nv(cellOf(ws, dr, 14)),
        };
        break;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Pass 5 — variant-map resolution preview
  // -------------------------------------------------------------------------
  const variantMap = loadVariantMap();
  const dbClientsAll: DbClient[] = await prisma.client.findMany({
    select: { id: true, name: true, code: true },
  });
  type VariantCheck = {
    cliente: string;
    rows: number[];
    resolution:
      | { kind: "resolved"; canonical: string; code: string; via: string }
      | { kind: "needs-create"; canonical: string; code: string; via: string }
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
        resolution: {
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
        resolution: {
          kind: "needs-create",
          canonical: res.canonical.name,
          code: res.canonical.code,
          via: res.matchedVariant,
        },
      });
      flag(
        "info",
        `D${rows[0]}`,
        `Client '${cliente}' is NEEDS-CREATE (map canonical '${res.canonical.name}' [${res.canonical.code}], DB row missing). Abril ETL will create it on --execute.`
      );
    } else {
      const s = res.suggestion
        ? `${res.suggestion.candidate.name} [${res.suggestion.candidate.code}] via ${res.suggestion.via} d=${res.suggestion.distance}`
        : null;
      variantChecks.push({
        cliente,
        rows,
        resolution: { kind: "unresolved", suggestion: s },
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
  const dbShipments = await prisma.shipment.count({ where: { year: YEAR, month: MONTH_NUM } });
  const dbContracts = await prisma.contract.count({ where: { shipment: { year: YEAR, month: MONTH_NUM } } });
  const dbMP = await prisma.materiaPrima.count({ where: { shipment: { year: YEAR, month: MONTH_NUM } } });
  const dbAllocs = await prisma.materiaPrimaAllocation.count({
    where: { materiaPrima: { shipment: { year: YEAR, month: MONTH_NUM } } },
  });
  const dbSub = await prisma.subproducto.count({ where: { shipment: { year: YEAR, month: MONTH_NUM } } });

  // Orphan contracts by number (both raw and -NN suffixed possibilities)
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

  const inv: string[] = [];
  inv.push(`# ${SHEET} 2026 — Cell Inventory`);
  inv.push("");
  inv.push(`**Generated:** ${now}`);
  inv.push(`**Sheet:** \`${SHEET}\` (in \`Mayo.xlsx\`)`);
  inv.push(`**Used range:** \`${ref}\``);
  inv.push(`**Non-empty cells:** ${allCells.length}`);
  inv.push("");
  inv.push(`## 1. Contract rows`);
  inv.push("");
  inv.push(`Found ${contracts.length} contract rows (${exportadoraContracts.length} Exportadora + ${stockLotAfloatContracts.length} Stock Lot Afloat).`);
  inv.push("");
  inv.push("| Row | Entity | Contrato | Cliente | Lote | Sacos 69 | Bolsa+Dif | Gastos/qq | Fact. Kgs | Costo Fin | Total Pago |");
  inv.push("|-----|--------|----------|---------|------|----------|-----------|-----------|-----------|-----------|-------------|");
  for (const c of contracts) {
    const entity = c.isStockLotAfloat ? "STOCK_LOT_AFLOAT" : "EXPORTADORA";
    inv.push(
      `| ${c.row} | ${entity} | ${c.contrato} | ${c.cliente} | ${c.lote} | ${c.sacos69 ?? "-"} | ${c.bolsaDif ?? "-"} | ${c.gastosPerSaco ?? "-"} | ${c.factKgs ?? "-"} | ${c.costoFin ?? "#REF!/null"} | ${c.totalPago ?? "#REF!/null"} |`
    );
  }
  inv.push("");
  inv.push("## 2. Materia Prima (Exportadora block only)");
  inv.push("");
  inv.push(
    mpHeaderRow >= 0
      ? `MP header row: ${mpHeaderRow + 1}. Found ${mpRows.length} MP rows.`
      : "⚠️ No MP header row detected."
  );
  inv.push("");
  inv.push("| Row | Contrato | Proveedor | Rend. | Pergo | Prom. Q | Total MP |");
  inv.push("|-----|----------|-----------|-------|-------|---------|----------|");
  for (const m of mpRows) {
    inv.push(
      `| ${m.row} | ${m.contrato} | ${m.proveedor} | ${m.rendimiento ?? "-"} | ${m.pergo ?? "-"} | ${m.promQ ?? "-"} | ${m.totalMP ?? "-"} |`
    );
  }
  inv.push("");
  inv.push("## 3. Subproducto (Exportadora block only)");
  inv.push("");
  if (subData) {
    inv.push(`- Contenedores: ${subData.contenedores ?? "-"}`);
    inv.push(`- Oro × contenedor: ${subData.oroPerCont ?? "-"}`);
    inv.push(`- Total Oro: ${subData.totalOro ?? "-"}`);
    inv.push(`- Precio sin IVA: ${subData.precioSinIva ?? "-"}`);
    inv.push(`- Total Pergamino: ${subData.totalPerg ?? "-"}`);
  } else {
    inv.push("⚠️ No subproducto section detected.");
  }
  inv.push("");
  inv.push("## 4. Every non-empty cell");
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

  const invPath = path.join(DOCS_DIR, `${SHEET.toLowerCase()}-2026-cell-inventory.md`);
  fs.writeFileSync(invPath, inv.join("\n") + "\n");
  console.log(` → wrote ${invPath}`);

  // Phase A report
  const rep: string[] = [];
  rep.push(`# Phase A — ${SHEET} 2026 Report`);
  rep.push("");
  rep.push(`**Generated:** ${now}`);
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
    rep.push(`**Orphan contracts to sweep:** ${existingByNumber.length}`);
    rep.push("");
    for (const c of existingByNumber) {
      rep.push(
        `- ${c.contractNumber} — shipment: ${c.shipment ? `${c.shipment.name} (m=${c.shipment.month}, y=${c.shipment.year})` : "(null)"}`
      );
    }
    rep.push("");
  }

  rep.push("## SSOT summary");
  rep.push("");
  rep.push(`- Total contract rows: **${contracts.length}** (${exportadoraContracts.length} Exportadora + ${stockLotAfloatContracts.length} Stock Lot Afloat)`);
  rep.push(`- MP rows: **${mpRows.length}** (expected to match Exportadora count: ${exportadoraContracts.length})`);
  rep.push(`- Subproducto: **${subData ? "1 block" : "0 blocks"}**`);
  rep.push(`- Duplicate contract-numbers (split candidates): **${dupeGroups.length}** — ${dupeGroups.map((d) => d[0]).join(", ") || "none"}`);
  rep.push(`- Cross-sheet refs: **${issues.filter((i) => i.finding.startsWith("Cross-sheet")).length}**`);
  rep.push(`- Excel errors (#REF!) flagged as blocking: **${issues.filter((i) => i.severity === "error" && i.finding.startsWith("Excel error")).length}**`);
  rep.push(`- Excel errors tolerated on stock-lot-afloat rows: **${issues.filter((i) => i.severity === "info" && i.finding.includes("Excel error in stock-lot-afloat")).length}**`);
  rep.push(`- Formula / literal mismatches: **${issues.filter((i) => i.severity === "warn").length}**`);
  rep.push(`- Variant-map unresolved: **${variantChecks.filter((v) => v.resolution.kind === "unresolved").length}**`);
  rep.push(`- Variant-map needs-create: **${variantChecks.filter((v) => v.resolution.kind === "needs-create").length}**`);
  rep.push("");

  rep.push("## Variant-map resolution");
  rep.push("");
  rep.push("| Sheet cliente | Rows | Resolution |");
  rep.push("|---------------|------|-----------|");
  for (const v of variantChecks) {
    const detail =
      v.resolution.kind === "resolved"
        ? `✓ → ${v.resolution.canonical} [${v.resolution.code}] (variant: ${v.resolution.via})`
        : v.resolution.kind === "needs-create"
          ? `⚠ needs-create → ${v.resolution.canonical} [${v.resolution.code}] (ETL will create on --execute)`
          : `⚠ unresolved${v.resolution.suggestion ? ` — suggestion: ${v.resolution.suggestion}` : ""} (APPEND TO MAP before --execute)`;
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
  rep.push("| Entity | Contrato | Cliente | Lote | Sacos 69 | Bolsa+Dif | Gastos/qq | Fact. Kgs | Total Pago |");
  rep.push("|--------|----------|---------|------|----------|-----------|-----------|-----------|-------------|");
  for (const c of contracts) {
    const entity = c.isStockLotAfloat ? "STOCK_LOT_AFLOAT" : "EXPORTADORA";
    rep.push(
      `| ${entity} | ${c.contrato} | ${c.cliente} | ${c.lote} | ${c.sacos69 ?? "-"} | ${c.bolsaDif ?? "-"} | ${c.gastosPerSaco ?? "-"} | ${c.factKgs ?? "-"} | ${c.totalPago ?? "#REF!/null"} |`
    );
  }
  rep.push("");

  rep.push("## MP summary");
  rep.push("");
  rep.push("| Contrato | Rendimiento | Pergamino | Prom. Q | Total MP |");
  rep.push("|----------|-------------|-----------|---------|----------|");
  for (const m of mpRows) {
    rep.push(`| ${m.contrato} | ${m.rendimiento ?? "-"} | ${m.pergo ?? "-"} | ${m.promQ ?? "-"} | ${m.totalMP ?? "-"} |`);
  }
  rep.push("");

  rep.push("## Phase B decision");
  rep.push("");
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warnCount = issues.filter((i) => i.severity === "warn").length;
  const unresolvedVariants = variantChecks.filter((v) => v.resolution.kind === "unresolved").length;
  const needsCreate = variantChecks.filter((v) => v.resolution.kind === "needs-create").length;
  if (errorCount > 0 || unresolvedVariants > 0) {
    rep.push(
      `⚠️ **PAUSED per directive 9**. ${unresolvedVariants} unresolved variant(s), ${errorCount} blocking error(s). Append unresolved variants to \`docs/client-variant-map.md\` before --execute.`
    );
  } else if (warnCount > 0) {
    rep.push("⚠️ **Review warnings** before Phase C.");
  } else {
    rep.push(`✓ **Phase B: green.** ${needsCreate} needs-create client(s) will be auto-created on --execute. Safe to proceed to Phase C.`);
  }
  rep.push("");

  const repPath = path.join(REPORTS_DIR, `phase-a-${SHEET.toLowerCase()}-2026.md`);
  fs.writeFileSync(repPath, rep.join("\n") + "\n");
  console.log(` → wrote ${repPath}`);

  console.log("");
  console.log(` Contracts: ${contracts.length} (${exportadoraContracts.length} Exp + ${stockLotAfloatContracts.length} SL)   MP rows: ${mpRows.length}   Subproducto: ${subData ? "yes" : "no"}`);
  console.log(` Duplicate contract-numbers: ${dupeGroups.length} — ${dupeGroups.map((d) => d[0]).join(", ") || "none"}`);
  console.log(` DB baseline: shipments=${dbShipments} contracts=${dbContracts} MP=${dbMP} MPA=${dbAllocs} sub=${dbSub}`);
  console.log(` Orphans by number: ${existingByNumber.length}`);
  console.log(` Hygiene: ${issues.length} — ${errorCount} error · ${warnCount} warn · ${issues.length - errorCount - warnCount} info`);
  for (const i of issues.slice(0, 40)) {
    console.log(`  [${i.severity}] ${i.cell}: ${i.finding}`);
  }

  console.log("");
  console.log("=".repeat(78));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
