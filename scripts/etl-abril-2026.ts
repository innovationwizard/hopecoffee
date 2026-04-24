// ============================================================================
// Phase C — Abril 2026 clean-slate ETL
// ============================================================================
// Scope: month=4, year=2026 only (assertMonthNotJanuary at top).
// Source of truth: sheet "Abril" inside Mayo.xlsx at repo root.
//
// Differences vs Marzo:
//   - 2 entity blocks → 2 shipments:
//       "Abril 2026 - Bloque 1"  Exportadora (7 contracts, 7 MP, 1 subproducto)
//       "Abril 2026 - Bloque 2"  Stock Lot Afloat  (2 contracts, 0 MP, 0 subproducto)
//   - Stock-lock contracts: montoCredito=0, no MP row, no subproducto.
//     calculateContract still runs (produces costoFinanciero=0, utilSinCF=
//     utilSinGE, totalPago=utilSinCF×TC). Sheet #REF! values are ignored.
//   - Two duplicate splits: W26350-GT → -01/-02 (Exp), GT260360 → -01/-02 (SL).
//   - Two needs-create clients: Westrade [WST], Plateau Harvest [PLH]. Both
//     are pre-approved via `docs/client-variant-map.md`.
//
// Usage:
//   npx tsx scripts/etl-abril-2026.ts --dry-run
//   npx tsx scripts/etl-abril-2026.ts --execute
// ============================================================================

import * as XLSX from "xlsx";
import * as fs from "node:fs";
import * as path from "node:path";
import Decimal from "decimal.js";
import {
  ContractStatus,
  CoffeeRegion,
  ExportingEntity,
  PosicionBolsa,
  PrismaClient,
  ShipmentStatus,
} from "@prisma/client";
import { calculateContract } from "../src/lib/services/calculations";
import { recalculateShipment } from "../src/lib/services/shipment-aggregation";
import {
  loadVariantMap,
  resolveStrict,
  type StrictResolve,
  type DbClient,
} from "./lib/client-variants";

// ── Constants ───────────────────────────────────────────────────────────────

const MAYO_PATH = path.join(process.cwd(), "Mayo.xlsx");
const SHEET = "Abril";
const MONTH_NUM = 4;
const YEAR = 2026;
const SHIPMENT_NAME_EXP = "Abril 2026 - Bloque 1";
const SHIPMENT_NAME_SL = "Abril 2026 - Bloque 2";
const REPORTS_DIR = path.join(process.cwd(), "reports");

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

function assertMonthNotJanuary(month: number, context: string) {
  if (month === 1) {
    throw new Error(
      `Directive 1 violation: attempted to operate on month=1 in context="${context}". Aborting.`
    );
  }
}
assertMonthNotJanuary(MONTH_NUM, "module-load");

const prisma = new PrismaClient();

// ── Sheet parsing ───────────────────────────────────────────────────────────

type SheetContract = {
  row: number;
  contrato: string;
  embarque: string;
  posicion: string;
  cliente: string;
  estatus: string;
  lote: string;
  // Quality: exactly one of { puntaje, defectos } is typically set per the
  // exporter-vs-broker case distinction (feedback_no_data_dismissed_quality.md).
  puntaje: number | null;
  defectos: number | null;
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
  tipoCambio: number;
  isStockLotAfloat: boolean;
};

type SheetMP = {
  row: number;
  contrato: string;
  proveedor: string;
  punteo: number;
  oro: number;
  rendimiento: number;
  pergo: number;
  promQ: number;
  totalMP: number;
};

type SheetSubproducto = {
  contenedores: number;
  oroPerCont: number;
  totalOro: number;
  precioSinIVA: number;
  totalPerga: number;
};

type SheetData = {
  hash: string;
  contracts: SheetContract[];
  mp: SheetMP[];
  subproducto: SheetSubproducto | null;
};

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

function readSheet(): SheetData {
  if (!fs.existsSync(MAYO_PATH)) throw new Error(`Mayo.xlsx not found at ${MAYO_PATH}`);
  const crypto = require("node:crypto") as typeof import("node:crypto");
  const buf = fs.readFileSync(MAYO_PATH);
  const hash = crypto.createHash("sha256").update(buf).digest("hex");

  const wb = XLSX.read(buf);
  const ws = wb.Sheets[SHEET];
  if (!ws) throw new Error(`Sheet '${SHEET}' not found`);
  const ref = ws["!ref"];
  if (!ref) throw new Error(`Sheet '${SHEET}' has no used range`);
  const range = XLSX.utils.decode_range(ref);

  const contracts: SheetContract[] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const contrato = sv(cellOf(ws, r, 4));
    const estatus = sv(cellOf(ws, r, 5));
    if (!contrato || /^CONTRATO$/i.test(contrato)) continue;
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
      // Quality parsing — never dismiss the data per user directive 2026-04-24:
      //   numeric (e.g. 82)      → puntaje = 82, defectos = null
      //   "<N> defectos" text   → puntaje = null, defectos = N (broker / BL pass-through)
      //   anything else         → both null
      ...(() => {
        const cell = cellOf(ws, r, 7);
        const raw = cell?.v;
        if (typeof raw === "number" && Number.isFinite(raw)) {
          return { puntaje: raw, defectos: null };
        }
        if (typeof raw === "string") {
          const m = raw.match(/(\d+)\s*defectos/i);
          if (m) return { puntaje: null, defectos: parseInt(m[1], 10) };
        }
        return { puntaje: null, defectos: null };
      })(),
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
      tipoCambio: nv(cellOf(ws, r, 20)),
      isStockLotAfloat,
    });
  }

  const mp: SheetMP[] = [];
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
      if (!contrato) break;
      if (/^TOTAL/i.test(contrato)) break;
      mp.push({
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

  // Subproducto via "CONTENEDORES" in col J
  let subHeaderRow = -1;
  for (let r = range.s.r; r <= range.e.r; r++) {
    if (sv(cellOf(ws, r, 9)).toUpperCase() === "CONTENEDORES") {
      subHeaderRow = r;
      break;
    }
  }
  let subproducto: SheetSubproducto | null = null;
  if (subHeaderRow >= 0) {
    for (const offset of [1, 2]) {
      const dr = subHeaderRow + offset;
      const contenedores = nv(cellOf(ws, dr, 9));
      if (Number.isFinite(contenedores) && contenedores > 0) {
        subproducto = {
          contenedores,
          oroPerCont: nv(cellOf(ws, dr, 10)),
          totalOro: nv(cellOf(ws, dr, 11)),
          precioSinIVA: nv(cellOf(ws, dr, 12)),
          totalPerga: nv(cellOf(ws, dr, 14)),
        };
        break;
      }
    }
  }

  return { hash, contracts, mp, subproducto };
}

// ── Enum / region mapping ───────────────────────────────────────────────────

function mapStatus(estatus: string): ContractStatus {
  const s = estatus.toUpperCase();
  if (s === "FIJADO") return ContractStatus.FIJADO;
  if (s.replace(/\s/g, "") === "NOFIJADO") return ContractStatus.NO_FIJADO;
  if (s === "CONFIRMADO") return ContractStatus.CONFIRMADO;
  return ContractStatus.FIJADO;
}

function mapRegions(lote: string): CoffeeRegion[] {
  const u = lote.toUpperCase();
  const out: CoffeeRegion[] = [];
  if (u.includes("SANTA ROSA")) out.push(CoffeeRegion.SANTA_ROSA);
  if (u.includes("HUEHUE")) out.push(CoffeeRegion.HUEHUETENANGO);
  if (u.includes("ORGANIC") || u.includes("ORGNAIC")) out.push(CoffeeRegion.ORGANICO);
  if (u.includes("DANILA")) out.push(CoffeeRegion.DANILANDIA);
  return out;
}

function mapPosicionBolsa(posicion: string): PosicionBolsa | null {
  const p = posicion.toUpperCase();
  if (p.startsWith("MAR")) return PosicionBolsa.MAR;
  if (p.startsWith("MAY")) return PosicionBolsa.MAY;
  if (p.startsWith("JUL")) return PosicionBolsa.JUL;
  if (p.startsWith("SEP")) return PosicionBolsa.SEP;
  if (p.startsWith("DEC") || p.startsWith("DIC")) return PosicionBolsa.DEC;
  return null;
}

const EMBARQUE_DATE = new Date(YEAR, MONTH_NUM - 1, 1);

function parsePosicionDate(posicion: string): Date {
  const m = posicion.match(/^([A-Za-z]+)-(\d{2})$/);
  if (!m) return new Date(YEAR, MONTH_NUM, 1);
  const monthNames: Record<string, number> = {
    JAN: 0, ENE: 0, FEB: 1, MAR: 2, APR: 3, ABR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, AGO: 7,
    SEP: 8, OCT: 9, NOV: 10, DEC: 11, DIC: 11,
  };
  const mo = monthNames[m[1].toUpperCase().slice(0, 3)];
  if (mo == null) return new Date(YEAR, MONTH_NUM, 1);
  const yr = 2000 + parseInt(m[2], 10);
  return new Date(yr, mo, 1);
}

// ── Plan shape ──────────────────────────────────────────────────────────────

type ContractPlan = {
  sheet: SheetContract;
  finalContractNumber: string;
  exportingEntity: ExportingEntity;
  status: ContractStatus;
  regions: CoffeeRegion[];
  posicionBolsa: PosicionBolsa | null;
  posicionDate: Date;
  gastosPerSaco: number;
  tipoCambio: number;
  montoCredito: number; // 0 for stock-lot-afloat
  mp: SheetMP | null; // null for stock-lot-afloat
  clienteResolution: StrictResolve;
};

type Plan = {
  hash: string;
  expContracts: ContractPlan[];
  slContracts: ContractPlan[];
  mp: SheetMP[];
  subproducto: SheetSubproducto | null;
  uniqueClienteResolutions: Map<string, StrictResolve>;
};

function applySuffix(
  sheetContract: SheetContract,
  countByName: Map<string, number>,
  counterByName: Map<string, number>
): string {
  const n = countByName.get(sheetContract.contrato) ?? 0;
  if (n <= 1) return sheetContract.contrato;
  const idx = (counterByName.get(sheetContract.contrato) ?? 0) + 1;
  counterByName.set(sheetContract.contrato, idx);
  return `${sheetContract.contrato}-${String(idx).padStart(2, "0")}`;
}

function buildPlan(
  data: SheetData,
  variantMap: ReturnType<typeof loadVariantMap>,
  dbClients: DbClient[]
): Plan {
  if (data.contracts.length === 0) throw new Error("0 contract rows");

  const expContractsRaw = data.contracts.filter((c) => !c.isStockLotAfloat);
  const slContractsRaw = data.contracts.filter((c) => c.isStockLotAfloat);

  if (expContractsRaw.length !== data.mp.length) {
    throw new Error(
      `Exportadora contracts=${expContractsRaw.length} but MP rows=${data.mp.length}; expected 1:1.`
    );
  }

  // Duplicate counts across ALL contracts (exp + stock-lot-afloat) — same contract
  // number can in principle repeat in either block (though typically within).
  const countByName = new Map<string, number>();
  for (const c of data.contracts) countByName.set(c.contrato, (countByName.get(c.contrato) ?? 0) + 1);
  const counterByName = new Map<string, number>();

  // Client resolution cache
  const uniqueClienteResolutions = new Map<string, StrictResolve>();
  for (const c of data.contracts) {
    if (!uniqueClienteResolutions.has(c.cliente)) {
      uniqueClienteResolutions.set(c.cliente, resolveStrict(c.cliente, variantMap, dbClients));
    }
  }

  const expContracts: ContractPlan[] = expContractsRaw.map((c, i) => {
    const mp = data.mp[i];
    if (mp.contrato !== c.contrato) {
      throw new Error(
        `Positional pairing broken: exp contract row ${c.row} '${c.contrato}' vs MP row ${mp.row} '${mp.contrato}'.`
      );
    }
    return {
      sheet: c,
      finalContractNumber: applySuffix(c, countByName, counterByName),
      exportingEntity: ExportingEntity.EXPORTADORA,
      status: mapStatus(c.estatus),
      regions: mapRegions(c.lote),
      posicionBolsa: mapPosicionBolsa(c.posicion),
      posicionDate: parsePosicionDate(c.posicion),
      gastosPerSaco: c.gastosPerSaco,
      tipoCambio: c.tipoCambio,
      montoCredito: mp.totalMP,
      mp,
      clienteResolution: uniqueClienteResolutions.get(c.cliente)!,
    };
  });

  const slContracts: ContractPlan[] = slContractsRaw.map((c) => ({
    sheet: c,
    finalContractNumber: applySuffix(c, countByName, counterByName),
    exportingEntity: ExportingEntity.STOCK_LOT_AFLOAT,
    status: mapStatus(c.estatus),
    regions: mapRegions(c.lote),
    posicionBolsa: mapPosicionBolsa(c.posicion),
    posicionDate: parsePosicionDate(c.posicion),
    gastosPerSaco: c.gastosPerSaco,
    tipoCambio: c.tipoCambio,
    montoCredito: 0, // per user directive 4 — stock-lot-afloat has no MP
    mp: null,
    clienteResolution: uniqueClienteResolutions.get(c.cliente)!,
  }));

  return {
    hash: data.hash,
    expContracts,
    slContracts,
    mp: data.mp,
    subproducto: data.subproducto,
    uniqueClienteResolutions,
  };
}

// ── Validation against sheet target values ──────────────────────────────────

function validatePlanAgainstSheet(plan: Plan): string[] {
  const warnings: string[] = [];
  const EPS = 0.03;

  // Only validate Exportadora contracts — stock-lot-afloat sheet values are #REF!,
  // so the ETL provides the canonical values rather than the sheet.
  for (const c of plan.expContracts) {
    const calc = calculateContract({
      sacos69kg: c.sheet.sacos69,
      puntaje: c.sheet.puntaje != null ? Math.round(c.sheet.puntaje) : null,
      precioBolsa: c.sheet.bolsa,
      diferencial: c.sheet.diferencial,
      gastosExportPerSaco: c.gastosPerSaco,
      tipoCambio: c.tipoCambio,
      montoCredito: c.montoCredito,
    });
    const pairs: [string, Decimal, number][] = [
      ["facturacionLbs", calc.facturacionLbs, c.sheet.factLbs],
      ["facturacionKgs", calc.facturacionKgs, c.sheet.factKgs],
      ["gastosExportacion", calc.gastosExportacion, c.sheet.gastosTotal],
      ["utilidadSinGE", calc.utilidadSinGastosExport, c.sheet.utilSinGE],
    ];
    for (const [field, computed, sheet] of pairs) {
      if (!Number.isFinite(sheet)) continue;
      const delta = Math.abs(computed.toNumber() - sheet);
      if (delta > EPS) {
        warnings.push(
          `${c.finalContractNumber}.${field}: computed=${computed.toFixed(4)} sheet=${sheet.toFixed(4)} Δ=${(computed.toNumber() - sheet).toFixed(4)}`
        );
      }
    }
  }
  return warnings;
}

// ── Rendering ───────────────────────────────────────────────────────────────

function renderPlan(plan: Plan, warnings: string[], totalClientsScanned: number, canonicalCount: number): string {
  const L: string[] = [];
  L.push("=".repeat(78));
  L.push(` ETL ${SHEET} 2026 — DRY RUN`);
  L.push("=".repeat(78));
  L.push(` Sheet hash: ${plan.hash}`);
  L.push(` Shipments:  2 (${SHIPMENT_NAME_EXP} + ${SHIPMENT_NAME_SL})`);
  L.push(` Contracts:  ${plan.expContracts.length + plan.slContracts.length} (${plan.expContracts.length} Exp + ${plan.slContracts.length} Stock Lot Afloat)`);
  L.push(` MP rows:    ${plan.mp.length} (Exportadora only)`);
  L.push(` Subproducto: ${plan.subproducto ? "1 row (Exportadora)" : "(none)"}`);
  L.push("");

  L.push(" ── Client resolution (strict, variant-map-based) ─────────────────────────────");
  L.push(`  DB clients scanned: ${totalClientsScanned}   Map canonicals: ${canonicalCount}`);
  let allResolvedOrCreatable = true;
  for (const [cliente, res] of plan.uniqueClienteResolutions) {
    if (res.kind === "resolved") {
      L.push(`  ✓ '${cliente}' → '${res.client.name}' [${res.client.code}] via '${res.matchedVariant}' (existing DB row)`);
    } else if (res.kind === "needs-create") {
      L.push(`  ➕ '${cliente}' → will CREATE DB row for canonical '${res.canonical.name}' [${res.canonical.code}] (pre-approved in map)`);
    } else {
      allResolvedOrCreatable = false;
      const s = res.suggestion
        ? `${res.suggestion.candidate.name} [${res.suggestion.candidate.code}] via ${res.suggestion.via} d=${res.suggestion.distance}`
        : "no plausible match";
      L.push(`  ⚠ '${cliente}' UNRESOLVED — suggestion: ${s}`);
    }
  }
  if (!allResolvedOrCreatable) {
    L.push("  ⚠ --execute will REFUSE until all unresolved clients are appended to the variant map.");
  }
  L.push("");

  const renderBlock = (title: string, contracts: ContractPlan[], shipmentName: string) => {
    L.push(` ── ${title} → ${shipmentName} ───────────────────────────────────────`);
    for (const c of contracts) {
      const suffix = c.finalContractNumber !== c.sheet.contrato ? ` (SUFFIXED from '${c.sheet.contrato}')` : "";
      L.push(
        `  ${c.finalContractNumber}${suffix}  client=${c.sheet.cliente}  entity=${c.exportingEntity}  lote=${c.sheet.lote}  status=${c.status}`
      );
      L.push(
        `    sacos69=${c.sheet.sacos69}  sacos46=${c.sheet.sacos46}  puntaje=${c.sheet.puntaje}  bolsa+dif=${c.sheet.bolsaDif}  dif=${c.sheet.diferencial}  gastos/qq=${c.gastosPerSaco}  TC=${c.tipoCambio}  pos=${c.sheet.posicion}→${c.posicionBolsa}`
      );
      L.push(`    montoCredito=Q${c.montoCredito.toFixed(2)}${c.exportingEntity === "STOCK_LOT_AFLOAT" ? " (stock-lot-afloat, no MP)" : ""}`);
    }
    L.push("");
  };

  renderBlock("Exportadora contracts", plan.expContracts, SHIPMENT_NAME_EXP);
  renderBlock("Stock-lock contracts", plan.slContracts, SHIPMENT_NAME_SL);

  L.push(" ── Materia Prima (Exportadora only) ──────────────────────────────────────────");
  for (let i = 0; i < plan.mp.length; i++) {
    const m = plan.mp[i];
    const cp = plan.expContracts[i];
    const suffix = cp.finalContractNumber !== m.contrato ? ` → links to ${cp.finalContractNumber}` : "";
    L.push(
      `  ${m.contrato}${suffix}  proveedor=${m.proveedor}  oro=${m.oro}  rend=${m.rendimiento}  pergo=${m.pergo}  promQ=${m.promQ}  totalMP=Q${m.totalMP}`
    );
  }
  L.push("");

  if (plan.subproducto) {
    L.push(" ── Subproducto (Exportadora) ─────────────────────────────────────────────────");
    const s = plan.subproducto;
    L.push(
      `  contenedores=${s.contenedores}  oroPerCont=${s.oroPerCont}  totalOro=${s.totalOro}  precioSinIVA=${s.precioSinIVA}  totalPerga=Q${s.totalPerga}`
    );
    L.push("");
  }

  L.push(" ── Computed validation vs sheet (Exportadora only, ±0.03) ────────────────────");
  if (warnings.length === 0) {
    L.push("  ✓ All computed Exportadora values match sheet within tolerance.");
    L.push("  (Stock-lock rows excluded — sheet carries #REF! per user directive 3.)");
  } else {
    L.push(`  ⚠ ${warnings.length} divergence(s):`);
    for (const w of warnings) L.push(`    - ${w}`);
  }
  L.push("");

  L.push(" ── Mutations that --execute would perform ───────────────────────────────────");
  L.push("   1a. DELETE existing Contract(s) by final contractNumber (Jan guard applies).");
  L.push("   1b. DELETE Abril 2026 shipments cascade.");
  L.push("   1c. CREATE DB Client rows for needs-create canonicals (Westrade, Plateau Harvest).");
  L.push(`   2.  INSERT 2 × Shipment ("${SHIPMENT_NAME_EXP}", "${SHIPMENT_NAME_SL}")`);
  L.push(`        ${plan.expContracts.length} × Contract on Bloque 1 (EXPORTADORA)`);
  L.push(`        ${plan.slContracts.length} × Contract on Bloque 2 (STOCK_LOT_AFLOAT, montoCredito=0)`);
  L.push(`        ${plan.mp.length} × MateriaPrima on Bloque 1`);
  L.push(`        ${plan.mp.length} × MateriaPrimaAllocation on Bloque 1 (1:1)`);
  L.push(`        ${plan.subproducto ? 1 : 0} × Subproducto on Bloque 1`);
  L.push("   3.  UPDATE each contract via calculateContract(...).");
  L.push("   4.  CALL recalculateShipment() on both shipments.");
  L.push("   5.  WRITE 1 × AuditLog entry.");
  L.push("");
  L.push("=".repeat(78));
  return L.join("\n");
}

// ── Execute ─────────────────────────────────────────────────────────────────

async function execute(plan: Plan): Promise<{ expShipmentId: string; slShipmentId: string }> {
  // Validate all clients are resolvable (resolved or needs-create)
  for (const [cliente, res] of plan.uniqueClienteResolutions) {
    if (res.kind === "unresolved") {
      throw new Error(
        `Refusing to --execute: cliente '${cliente}' is not mapped in docs/client-variant-map.md. ${res.reason}`
      );
    }
  }

  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: "octavio@hopecoffee.com" },
    select: { id: true, email: true },
  });
  console.log(`  ℹ Admin user: ${admin.email}`);

  const result = await prisma.$transaction(
    async (tx) => {
      // 1c. Create needs-create clients first (outside shipment scope)
      const createdClients: { code: string; id: string; name: string }[] = [];
      for (const [cliente, res] of plan.uniqueClienteResolutions) {
        if (res.kind === "needs-create") {
          const created = await tx.client.create({
            data: {
              name: res.canonical.name,
              code: res.canonical.code,
            },
          });
          createdClients.push({ code: created.code, id: created.id, name: created.name });
          console.log(`  ➕ Created Client ${created.name} (${created.code}) for sheet '${cliente}'`);
        }
      }

      // Rebuild client-by-cliente map with new IDs
      const clientByCliente = new Map<string, { id: string; name: string; code: string }>();
      for (const [cliente, res] of plan.uniqueClienteResolutions) {
        if (res.kind === "resolved") {
          clientByCliente.set(cliente, res.client);
        } else if (res.kind === "needs-create") {
          const created = createdClients.find((c) => c.code === res.canonical.code)!;
          clientByCliente.set(cliente, created);
        }
      }

      // 1a. Sweep existing contracts by name
      const allContracts = [...plan.expContracts, ...plan.slContracts];
      const finalNumbers = allContracts.map((c) => c.finalContractNumber);
      const rawNumbers = allContracts.map((c) => c.sheet.contrato);
      const allNumbers = Array.from(new Set([...finalNumbers, ...rawNumbers]));

      const existingByNumber = await tx.contract.findMany({
        where: { contractNumber: { in: allNumbers } },
        include: { shipment: { select: { month: true, year: true, name: true } } },
      });
      for (const c of existingByNumber) {
        if (c.shipment && c.shipment.month === 1 && c.shipment.year === 2026) {
          throw new Error(
            `Directive 1 violation: Contract ${c.contractNumber} linked to Jan 2026 shipment '${c.shipment.name}'.`
          );
        }
      }
      const existingIds = existingByNumber.map((c) => c.id);
      const delPS = await tx.contractPriceSnapshot.deleteMany({ where: { contractId: { in: existingIds } } });
      const delLA = await tx.contractLotAllocation.deleteMany({ where: { contractId: { in: existingIds } } });
      const delMPAbyC = await tx.materiaPrimaAllocation.deleteMany({ where: { contractId: { in: existingIds } } });
      const delOrphanC = await tx.contract.deleteMany({ where: { id: { in: existingIds } } });

      // 1b. Abril shipments cascade
      const aprShipments = await tx.shipment.findMany({
        where: { year: YEAR, month: MONTH_NUM },
        select: { id: true, month: true, year: true },
      });
      for (const s of aprShipments) assertMonthNotJanuary(s.month, `delete shipment ${s.id}`);
      const aprIds = aprShipments.map((s) => s.id);
      const delSub = await tx.subproducto.deleteMany({ where: { shipmentId: { in: aprIds } } });
      const delMPA = await tx.materiaPrimaAllocation.deleteMany({
        where: { materiaPrima: { shipmentId: { in: aprIds } } },
      });
      const delMP = await tx.materiaPrima.deleteMany({ where: { shipmentId: { in: aprIds } } });
      const delContracts = await tx.contract.deleteMany({ where: { shipmentId: { in: aprIds } } });
      const delShipments = await tx.shipment.deleteMany({ where: { id: { in: aprIds } } });

      console.log(
        `  ↘ clean-slate: orphans=${delOrphanC.count} (PS=${delPS.count} LA=${delLA.count} MPAbyC=${delMPAbyC.count}) / apr-shipments=${delShipments.count} apr-contracts=${delContracts.count} apr-MP=${delMP.count} apr-MPA=${delMPA.count} apr-sub=${delSub.count}`
      );

      // 2. Shipments — two of them
      const earliestPosicionExp = plan.expContracts.length > 0
        ? plan.expContracts.map((c) => c.posicionDate).sort((a, b) => a.getTime() - b.getTime())[0]
        : EMBARQUE_DATE;
      const earliestPosicionSL = plan.slContracts.length > 0
        ? plan.slContracts.map((c) => c.posicionDate).sort((a, b) => a.getTime() - b.getTime())[0]
        : EMBARQUE_DATE;

      const expShipment = await tx.shipment.create({
        data: {
          name: SHIPMENT_NAME_EXP,
          month: MONTH_NUM,
          year: YEAR,
          status: ShipmentStatus.EMBARCADO,
          numContainers: plan.expContracts.length,
          regions: Array.from(new Set(plan.expContracts.flatMap((c) => c.regions).map(String))).join("/"),
          posicionDate: earliestPosicionExp,
          embarqueDate: EMBARQUE_DATE,
        },
      });
      const slShipment = await tx.shipment.create({
        data: {
          name: SHIPMENT_NAME_SL,
          month: MONTH_NUM,
          year: YEAR,
          status: ShipmentStatus.EMBARCADO,
          numContainers: plan.slContracts.length,
          regions: Array.from(new Set(plan.slContracts.flatMap((c) => c.regions).map(String))).join("/"),
          posicionDate: earliestPosicionSL,
          embarqueDate: EMBARQUE_DATE,
        },
      });

      // 3. Contracts
      const created: { id: string; plan: ContractPlan; shipmentId: string }[] = [];
      for (const c of plan.expContracts) {
        const client = clientByCliente.get(c.sheet.cliente)!;
        const cr = await tx.contract.create({
          data: {
            contractNumber: c.finalContractNumber,
            clientId: client.id,
            shipmentId: expShipment.id,
            status: c.status,
            regions: c.regions,
            exportingEntity: c.exportingEntity,
            puntaje: c.sheet.puntaje != null ? Math.round(c.sheet.puntaje) : null,
            defectos: c.sheet.defectos,
            sacos69kg: c.sheet.sacos69,
            sacos46kg: c.sheet.sacos46,
            precioBolsa: c.sheet.bolsa,
            diferencial: c.sheet.diferencial,
            precioBolsaDif: c.sheet.bolsaDif,
            tipoCambio: c.tipoCambio,
            gastosPerSaco: c.gastosPerSaco,
            cfTasaAnual: 0.08,
            cfMeses: 2,
            cosecha: "25-26",
            montoCredito: c.montoCredito,
            posicionBolsa: c.posicionBolsa ?? undefined,
            posicionNY: c.posicionDate,
            fechaEmbarque: EMBARQUE_DATE,
            lote: c.sheet.lote,
          },
        });
        created.push({ id: cr.id, plan: c, shipmentId: expShipment.id });
      }
      for (const c of plan.slContracts) {
        const client = clientByCliente.get(c.sheet.cliente)!;
        const cr = await tx.contract.create({
          data: {
            contractNumber: c.finalContractNumber,
            clientId: client.id,
            shipmentId: slShipment.id,
            status: c.status,
            regions: c.regions,
            exportingEntity: c.exportingEntity,
            puntaje: c.sheet.puntaje != null ? Math.round(c.sheet.puntaje) : null,
            defectos: c.sheet.defectos,
            sacos69kg: c.sheet.sacos69,
            sacos46kg: c.sheet.sacos46,
            precioBolsa: c.sheet.bolsa,
            diferencial: c.sheet.diferencial,
            precioBolsaDif: c.sheet.bolsaDif,
            tipoCambio: c.tipoCambio,
            gastosPerSaco: c.gastosPerSaco,
            cfTasaAnual: 0.08,
            cfMeses: 0, // stock-lot-afloat: no financing months
            cosecha: "25-26",
            montoCredito: 0,
            posicionBolsa: c.posicionBolsa ?? undefined,
            posicionNY: c.posicionDate,
            fechaEmbarque: EMBARQUE_DATE,
            lote: c.sheet.lote,
          },
        });
        created.push({ id: cr.id, plan: c, shipmentId: slShipment.id });
      }

      // 4. MP + MPA (Exportadora only, 1:1 positional)
      for (let i = 0; i < plan.expContracts.length; i++) {
        const cc = created[i];
        const m = cc.plan.mp!;
        const mpRow = await tx.materiaPrima.create({
          data: {
            shipmentId: expShipment.id,
            supplierNote: m.proveedor,
            isPurchased: true,
            punteo: Math.round(m.punteo),
            oro: m.oro,
            rendimiento: m.rendimiento,
            pergamino: m.pergo,
            precioPromQ: m.promQ,
            totalMP: m.totalMP,
          },
        });
        await tx.materiaPrimaAllocation.create({
          data: { materiaPrimaId: mpRow.id, contractId: cc.id, quintalesAllocated: null },
        });
      }

      // 5. Subproducto (Exportadora only)
      if (plan.subproducto) {
        await tx.subproducto.create({
          data: {
            shipmentId: expShipment.id,
            contenedores: plan.subproducto.contenedores,
            oroPerCont: plan.subproducto.oroPerCont,
            totalOro: plan.subproducto.totalOro,
            precioSinIVA: plan.subproducto.precioSinIVA,
            totalPerga: plan.subproducto.totalPerga,
          },
        });
      }

      // 6. Update contract derived fields
      for (const cc of created) {
        const c = cc.plan;
        const calc = calculateContract({
          sacos69kg: c.sheet.sacos69,
          puntaje: c.sheet.puntaje != null ? Math.round(c.sheet.puntaje) : null,
          precioBolsa: c.sheet.bolsa,
          diferencial: c.sheet.diferencial,
          gastosExportPerSaco: c.gastosPerSaco,
          tipoCambio: c.tipoCambio,
          montoCredito: c.montoCredito,
        });
        await tx.contract.update({
          where: { id: cc.id },
          data: {
            sacos46kg: calc.sacos46kg.toNumber(),
            precioBolsaDif: calc.precioBolsaDif.toNumber(),
            facturacionLbs: calc.facturacionLbs.toNumber(),
            facturacionKgs: calc.facturacionKgs.toNumber(),
            gastosExport: calc.gastosExportacion.toNumber(),
            utilidadSinGE: calc.utilidadSinGastosExport.toNumber(),
            costoFinanciero: calc.costoFinanciero.toNumber(),
            utilidadSinCF: calc.utilidadSinCostoFinanciero.toNumber(),
            totalPagoQTZ: calc.totalPagoQTZ.toNumber(),
            comisionCompra: calc.comisionCompra.toNumber(),
            comisionVenta: calc.comisionVenta.toNumber(),
            computedAt: new Date(),
          },
        });
      }

      // 7. AuditLog
      await tx.auditLog.create({
        data: {
          userId: admin.id,
          action: "ETL_MONTH",
          entity: "Shipment",
          entityId: expShipment.id,
          newValue: {
            etlScript: "scripts/etl-abril-2026.ts",
            mode: "execute",
            sheetHash: plan.hash,
            month: MONTH_NUM,
            year: YEAR,
            shipments: [
              { id: expShipment.id, name: SHIPMENT_NAME_EXP, entity: "EXPORTADORA", contracts: plan.expContracts.length, mp: plan.mp.length, subproducto: plan.subproducto ? 1 : 0 },
              { id: slShipment.id, name: SHIPMENT_NAME_SL, entity: "STOCK_LOT_AFLOAT", contracts: plan.slContracts.length, mp: 0, subproducto: 0 },
            ],
            clientsCreated: createdClients.map((c) => ({ code: c.code, name: c.name })),
            suffixedContracts: [...plan.expContracts, ...plan.slContracts]
              .filter((c) => c.finalContractNumber !== c.sheet.contrato)
              .map((c) => ({ raw: c.sheet.contrato, final: c.finalContractNumber })),
            deletedCounts: {
              orphanContracts: delOrphanC.count,
              orphanPriceSnapshots: delPS.count,
              orphanLotAllocations: delLA.count,
              orphanMPAbyContract: delMPAbyC.count,
              aprShipments: delShipments.count,
              aprContracts: delContracts.count,
              aprMP: delMP.count,
              aprMPA: delMPA.count,
              aprSubproducto: delSub.count,
            },
          },
        },
      });

      return { expShipmentId: expShipment.id, slShipmentId: slShipment.id };
    },
    { maxWait: 15000, timeout: 60000 }
  );

  await recalculateShipment(result.expShipmentId);
  await recalculateShipment(result.slShipmentId);
  return result;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const exec = args.has("--execute");
  if (dryRun === exec) {
    console.error(`Usage: tsx scripts/etl-${SHEET.toLowerCase()}-2026.ts [--dry-run | --execute]`);
    process.exit(2);
  }

  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const data = readSheet();
  const variantMap = loadVariantMap();
  const allClients: DbClient[] = await prisma.client.findMany({
    select: { id: true, name: true, code: true },
  });
  const plan = buildPlan(data, variantMap, allClients);
  const warnings = validatePlanAgainstSheet(plan);
  const report = renderPlan(plan, warnings, allClients.length, variantMap.canonicals.length);

  const reportPath = path.join(REPORTS_DIR, dryRun ? `dry-run-${SHEET.toLowerCase()}-2026.md` : `execute-${SHEET.toLowerCase()}-2026.md`);
  fs.writeFileSync(reportPath, report + "\n");
  console.log(report);
  console.log(` → wrote ${reportPath}`);

  if (dryRun) {
    console.log("");
    console.log(" --dry-run: no writes performed.");
    await prisma.$disconnect();
    return;
  }

  if (warnings.length > 0) {
    console.error("");
    console.error(" ⚠ Refusing to execute: computed-vs-sheet warnings present.");
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log("");
  console.log(" → EXECUTING (transactional)…");
  const result = await execute(plan);
  console.log(` ✓ Shipments created: Exp=${result.expShipmentId}, SL=${result.slShipmentId}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
