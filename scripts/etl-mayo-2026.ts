// ============================================================================
// Phase C — Mayo 2026 clean-slate ETL
// ============================================================================
// Scope: month=5, year=2026 only (assertMonthNotJanuary at top).
// Source: sheet "MAYO" (CAPS) inside Mayo.xlsx.
//
// New in Mayo vs prior months:
//   - Parenthesis cliente pattern: "Falcon (Wastrade)" → importer=Falcon, client=Wastrade.
//     Persisted via Contract.importerId (Client table) — user 2026-04-24 option (b).
//   - Parenthesis contract-number pattern: "P2600329 (W26320-GT)" — two codes for
//     the same contract. Primary → Contract.contractNumber, inner → Contract.alternateContractNumber.
//   - 3 new clients auto-created via needs-create: LIST+BEISLER [LBR], Falcon [FAL], ICC [ICC].
//   - ONYX caps variant → Onyx canonical via normalize.
//   - Wastrade variant → Westrade canonical via variant map.
//   - Contract quality: puntaje (SCA) / defectos (BL pass-through) routed per cell content.
//
// Usage:
//   npx tsx scripts/etl-mayo-2026.ts --dry-run
//   npx tsx scripts/etl-mayo-2026.ts --execute
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
const SHEET = "MAYO";
const MONTH_NUM = 5;
const YEAR = 2026;
const SHIPMENT_NAME = "Mayo 2026 - Bloque único";
const REPORTS_DIR = path.join(process.cwd(), "reports");

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

function assertMonthNotJanuary(month: number, context: string) {
  if (month === 1) {
    throw new Error(`Directive 1 violation: month=1 in context="${context}". Aborting.`);
  }
}
assertMonthNotJanuary(MONTH_NUM, "module-load");

const prisma = new PrismaClient();

// ── Parsers ────────────────────────────────────────────────────────────────

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

function parseParenthesis(raw: string): { plain: string; paren: string } | null {
  const m = raw.match(/^(.+?)\s*\(\s*(.+?)\s*\)\s*$/);
  if (!m) return null;
  return { plain: m[1].trim(), paren: m[2].trim() };
}

// ── Sheet data ─────────────────────────────────────────────────────────────

type SheetContract = {
  row: number;
  contrato: string; // primary (outside if parenthesis, raw otherwise)
  alternateContrato: string | null; // inside code if parenthesis
  embarque: string;
  posicion: string;
  cliente: string; // effective client (inside paren) — used for variant-map resolution
  importer: string | null; // plain name in parenthesis pattern, null otherwise
  estatus: string;
  lote: string;
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

function readSheet(): SheetData {
  if (!fs.existsSync(MAYO_PATH)) throw new Error(`Mayo.xlsx not found`);
  const crypto = require("node:crypto") as typeof import("node:crypto");
  const buf = fs.readFileSync(MAYO_PATH);
  const hash = crypto.createHash("sha256").update(buf).digest("hex");

  const wb = XLSX.read(buf);
  const ws = wb.Sheets[SHEET];
  if (!ws) throw new Error(`Sheet '${SHEET}' not found`);
  const range = XLSX.utils.decode_range(ws["!ref"]!);

  const contracts: SheetContract[] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const contratoRaw = sv(cellOf(ws, r, 4));
    const estatus = sv(cellOf(ws, r, 5));
    if (!contratoRaw || /^CONTRATO$/i.test(contratoRaw)) continue;
    if (!/^(Fijado|No\s*Fijado|FIJADO|NO\s*FIJADO)$/i.test(estatus)) continue;

    const contratoParen = parseParenthesis(contratoRaw);
    const contrato = contratoParen ? contratoParen.plain : contratoRaw;
    const alternateContrato = contratoParen ? contratoParen.paren : null;

    const clienteRaw = sv(cellOf(ws, r, 3));
    const clienteParen = parseParenthesis(clienteRaw);
    const cliente = clienteParen ? clienteParen.paren : clienteRaw;
    const importer = clienteParen ? clienteParen.plain : null;

    // Quality parsing
    let puntaje: number | null = null;
    let defectos: number | null = null;
    const qualityCell = cellOf(ws, r, 7);
    if (qualityCell) {
      if (typeof qualityCell.v === "number" && Number.isFinite(qualityCell.v)) {
        puntaje = qualityCell.v;
      } else if (typeof qualityCell.v === "string") {
        const m = qualityCell.v.match(/(\d+)\s*defectos/i);
        if (m) defectos = parseInt(m[1], 10);
      }
    }

    contracts.push({
      row: r + 1,
      contrato,
      alternateContrato,
      embarque: posicionString(cellOf(ws, r, 1)),
      posicion: posicionString(cellOf(ws, r, 2)),
      cliente,
      importer,
      estatus,
      lote: sv(cellOf(ws, r, 6)),
      puntaje,
      defectos,
      sacos69: nv(cellOf(ws, r, 8)),
      sacos46: nv(cellOf(ws, r, 9)),
      bolsa: nv(cellOf(ws, r, 10)),
      // When the sheet's M (bolsaDif) is a LITERAL and L (diferencial) is
      // empty — as with ONYX OC26-09 / OC26-08 in Mayo — back-derive the
      // diferencial from M − K so `bolsa + diferencial` sums to the sheet's
      // literal. Preserves the sheet's authoritative M value per
      // feedback_no_data_dismissed_quality.md (don't silently zero the spread).
      diferencial: (() => {
        const rawDif = nv(cellOf(ws, r, 11));
        if (Number.isFinite(rawDif)) return rawDif;
        const mCell = cellOf(ws, r, 12);
        const bolsa = nv(cellOf(ws, r, 10));
        const mVal = mCell ? Number(mCell.v) : NaN;
        if (Number.isFinite(mVal) && Number.isFinite(bolsa)) return mVal - bolsa;
        return 0;
      })(),
      bolsaDif: nv(cellOf(ws, r, 12)),
      factLbs: nv(cellOf(ws, r, 13)),
      factKgs: nv(cellOf(ws, r, 14)),
      gastosPerSaco: nv(cellOf(ws, r, 15)),
      gastosTotal: nv(cellOf(ws, r, 16)),
      utilSinGE: nv(cellOf(ws, r, 17)),
      tipoCambio: nv(cellOf(ws, r, 20)),
    });
  }

  // MP block
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
      // Apply parenthesis parsing to MP contrato so positional matching
      // with contract rows (which use the plain part) stays aligned.
      const mpParen = parseParenthesis(contrato);
      mp.push({
        row: r + 1,
        contrato: mpParen ? mpParen.plain : contrato,
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

  // Subproducto
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
  if (u.includes("HUEHUE") || u.includes("HB")) out.push(CoffeeRegion.HUEHUETENANGO);
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
    JAN: 0, ENE: 0, FEB: 1, MAR: 2, APR: 3, ABR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, AGO: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11, DIC: 11,
  };
  const mo = monthNames[m[1].toUpperCase().slice(0, 3)];
  if (mo == null) return new Date(YEAR, MONTH_NUM, 1);
  return new Date(2000 + parseInt(m[2], 10), mo, 1);
}

// ── Plan ───────────────────────────────────────────────────────────────────

type ContractPlan = {
  sheet: SheetContract;
  finalContractNumber: string;
  alternateContractNumber: string | null;
  status: ContractStatus;
  regions: CoffeeRegion[];
  posicionBolsa: PosicionBolsa | null;
  posicionDate: Date;
  montoCredito: number;
  mp: SheetMP;
  clienteResolution: StrictResolve;
  importerResolution: StrictResolve | null;
};

type Plan = {
  hash: string;
  contracts: ContractPlan[];
  mp: SheetMP[];
  subproducto: SheetSubproducto | null;
  // Unique-cliente + unique-importer resolutions, keyed by the raw sheet name.
  clienteResolutions: Map<string, StrictResolve>;
  importerResolutions: Map<string, StrictResolve>;
};

function buildPlan(data: SheetData, variantMap: ReturnType<typeof loadVariantMap>, dbClients: DbClient[]): Plan {
  if (data.contracts.length === 0) throw new Error("0 contract rows");
  if (data.contracts.length !== data.mp.length) {
    throw new Error(`Contracts=${data.contracts.length} != MP=${data.mp.length}. Mayo expected 1:1.`);
  }

  // Duplicate suffixing
  const countByName = new Map<string, number>();
  for (const c of data.contracts) countByName.set(c.contrato, (countByName.get(c.contrato) ?? 0) + 1);
  const counterByName = new Map<string, number>();

  // Resolution caches
  const clienteResolutions = new Map<string, StrictResolve>();
  for (const c of data.contracts) {
    if (!clienteResolutions.has(c.cliente)) {
      clienteResolutions.set(c.cliente, resolveStrict(c.cliente, variantMap, dbClients));
    }
  }
  const importerResolutions = new Map<string, StrictResolve>();
  for (const c of data.contracts) {
    if (c.importer && !importerResolutions.has(c.importer)) {
      importerResolutions.set(c.importer, resolveStrict(c.importer, variantMap, dbClients));
    }
  }

  const contracts: ContractPlan[] = data.contracts.map((c, i) => {
    const mp = data.mp[i];
    if (mp.contrato !== c.contrato) {
      throw new Error(
        `Positional pairing broken: contract row ${c.row} '${c.contrato}' vs MP row ${mp.row} '${mp.contrato}'.`
      );
    }
    const n = countByName.get(c.contrato) ?? 0;
    let finalNumber = c.contrato;
    if (n > 1) {
      const idx = (counterByName.get(c.contrato) ?? 0) + 1;
      counterByName.set(c.contrato, idx);
      finalNumber = `${c.contrato}-${String(idx).padStart(2, "0")}`;
    }
    return {
      sheet: c,
      finalContractNumber: finalNumber,
      alternateContractNumber: c.alternateContrato,
      status: mapStatus(c.estatus),
      regions: mapRegions(c.lote),
      posicionBolsa: mapPosicionBolsa(c.posicion),
      posicionDate: parsePosicionDate(c.posicion),
      montoCredito: mp.totalMP,
      mp,
      clienteResolution: clienteResolutions.get(c.cliente)!,
      importerResolution: c.importer ? importerResolutions.get(c.importer)! : null,
    };
  });

  return { hash: data.hash, contracts, mp: data.mp, subproducto: data.subproducto, clienteResolutions, importerResolutions };
}

// ── Validation ─────────────────────────────────────────────────────────────

function validatePlanAgainstSheet(plan: Plan): string[] {
  const warnings: string[] = [];
  const EPS = 0.03;
  for (const c of plan.contracts) {
    const calc = calculateContract({
      sacos69kg: c.sheet.sacos69,
      puntaje: c.sheet.puntaje,
      precioBolsa: c.sheet.bolsa,
      diferencial: c.sheet.diferencial,
      gastosExportPerSaco: c.sheet.gastosPerSaco,
      tipoCambio: c.sheet.tipoCambio,
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
  L.push(` Shipment:   ${SHIPMENT_NAME}`);
  L.push(` Contracts:  ${plan.contracts.length}   MP: ${plan.mp.length}   Subproducto: ${plan.subproducto ? "1" : "0"}`);
  L.push("");

  L.push(" ── Client resolution ─────────────────────────────────────────────────────────");
  L.push(`  DB scanned: ${totalClientsScanned}   Map canonicals: ${canonicalCount}`);
  let allOK = true;
  for (const [cliente, res] of plan.clienteResolutions) {
    if (res.kind === "resolved") {
      L.push(`  ✓ client '${cliente}' → ${res.client.name} [${res.client.code}] (variant '${res.matchedVariant}')`);
    } else if (res.kind === "needs-create") {
      L.push(`  ➕ client '${cliente}' → will CREATE ${res.canonical.name} [${res.canonical.code}]`);
    } else {
      allOK = false;
      L.push(`  ⚠ client '${cliente}' UNRESOLVED — suggestion: ${res.suggestion ? res.suggestion.candidate.name : "(none)"}`);
    }
  }
  for (const [importer, res] of plan.importerResolutions) {
    if (res.kind === "resolved") {
      L.push(`  ✓ importer '${importer}' → ${res.client.name} [${res.client.code}] (variant '${res.matchedVariant}')`);
    } else if (res.kind === "needs-create") {
      L.push(`  ➕ importer '${importer}' → will CREATE ${res.canonical.name} [${res.canonical.code}]`);
    } else {
      allOK = false;
      L.push(`  ⚠ importer '${importer}' UNRESOLVED`);
    }
  }
  if (!allOK) L.push("  ⚠ --execute will REFUSE until all entities resolvable.");
  L.push("");

  L.push(" ── Contracts ─────────────────────────────────────────────────────────────────");
  for (const c of plan.contracts) {
    const suffix = c.finalContractNumber !== c.sheet.contrato ? ` (SUFFIXED from '${c.sheet.contrato}')` : "";
    const alt = c.alternateContractNumber ? ` alt='${c.alternateContractNumber}'` : "";
    const imp = c.sheet.importer ? ` importer='${c.sheet.importer}'` : "";
    const qual = c.sheet.puntaje != null ? `puntaje=${c.sheet.puntaje}` : c.sheet.defectos != null ? `defectos=${c.sheet.defectos}` : "—";
    L.push(
      `  ${c.finalContractNumber}${suffix}${alt}  client='${c.sheet.cliente}'${imp}  lote=${c.sheet.lote}  ${qual}`
    );
    L.push(
      `    sacos69=${c.sheet.sacos69} sacos46=${c.sheet.sacos46} bolsa+dif=${c.sheet.bolsaDif} dif=${c.sheet.diferencial} gastos/qq=${c.sheet.gastosPerSaco} TC=${c.sheet.tipoCambio} pos=${c.sheet.posicion}→${c.posicionBolsa}`
    );
    L.push(`    montoCredito=Q${c.montoCredito.toFixed(2)}`);
  }
  L.push("");

  L.push(" ── MP ─────────────────────────────────────────────────────────────────");
  for (let i = 0; i < plan.mp.length; i++) {
    const m = plan.mp[i];
    const cp = plan.contracts[i];
    const link = cp.finalContractNumber !== m.contrato ? ` → ${cp.finalContractNumber}` : "";
    L.push(`  ${m.contrato}${link}  oro=${m.oro} rend=${m.rendimiento} pergo=${m.pergo} promQ=${m.promQ} total=Q${m.totalMP}`);
  }
  L.push("");

  if (plan.subproducto) {
    const s = plan.subproducto;
    L.push(" ── Subproducto ───────────────────────────────────────────────────────────────");
    L.push(`  contenedores=${s.contenedores} × ${s.oroPerCont} = ${s.totalOro} × Q${s.precioSinIVA} = Q${s.totalPerga}`);
    L.push("");
  }

  L.push(" ── Computed validation (±0.03) ─────────────────────────────────────────────");
  if (warnings.length === 0) {
    L.push("  ✓ All computed values match sheet.");
  } else {
    L.push(`  ⚠ ${warnings.length} divergence(s):`);
    for (const w of warnings) L.push(`    - ${w}`);
  }
  L.push("");

  L.push(" ── Planned mutations ──────────────────────────────────────────────────────");
  const createsClient = Array.from(plan.clienteResolutions.values()).filter((r) => r.kind === "needs-create").length;
  const createsImp = Array.from(plan.importerResolutions.values()).filter((r) => r.kind === "needs-create").length;
  L.push(`   1a. CREATE ${createsClient + createsImp} Client(s): ${createsClient} buyer, ${createsImp} importer`);
  L.push("   1b. DELETE existing Contract(s) by final contractNumber (Jan guard).");
  L.push("   1c. DELETE Mayo 2026 shipments cascade.");
  L.push(`   2.  INSERT 1 × Shipment "${SHIPMENT_NAME}"`);
  L.push(`        ${plan.contracts.length} × Contract (with importerId + alternateContractNumber where applicable)`);
  L.push(`        ${plan.mp.length} × MateriaPrima + ${plan.mp.length} × MateriaPrimaAllocation`);
  L.push(`        ${plan.subproducto ? 1 : 0} × Subproducto`);
  L.push("   3.  UPDATE contracts via calculateContract(...).");
  L.push("   4.  CALL recalculateShipment().");
  L.push("   5.  WRITE 1 × AuditLog.");
  L.push("=".repeat(78));
  return L.join("\n");
}

// ── Execute ────────────────────────────────────────────────────────────────

async function execute(plan: Plan) {
  for (const [name, res] of plan.clienteResolutions) {
    if (res.kind === "unresolved") throw new Error(`Unresolved client '${name}': ${res.reason}`);
  }
  for (const [name, res] of plan.importerResolutions) {
    if (res.kind === "unresolved") throw new Error(`Unresolved importer '${name}': ${res.reason}`);
  }

  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: "octavio@hopecoffee.com" },
    select: { id: true },
  });

  const result = await prisma.$transaction(
    async (tx) => {
      // 1a. Create needs-create clients (both buyers + importers)
      const createdByCode = new Map<string, { id: string; name: string; code: string }>();
      const resolveCanonicalCodes = (m: Map<string, StrictResolve>) =>
        Array.from(m.values())
          .filter((r): r is Extract<StrictResolve, { kind: "needs-create" }> => r.kind === "needs-create")
          .map((r) => ({ code: r.canonical.code, name: r.canonical.name }));
      const toCreate = [
        ...resolveCanonicalCodes(plan.clienteResolutions),
        ...resolveCanonicalCodes(plan.importerResolutions),
      ];
      const uniqCodes = Array.from(new Set(toCreate.map((t) => t.code)));
      for (const code of uniqCodes) {
        const t = toCreate.find((x) => x.code === code)!;
        const created = await tx.client.create({ data: { name: t.name, code: t.code } });
        createdByCode.set(code, { id: created.id, name: created.name, code: created.code });
        console.log(`  ➕ Created Client ${created.name} (${created.code})`);
      }

      const resolveToDbClient = (res: StrictResolve) => {
        if (res.kind === "resolved") return res.client;
        if (res.kind === "needs-create") return createdByCode.get(res.canonical.code)!;
        throw new Error("unresolved in execute path");
      };
      const clientIdByName = new Map<string, string>();
      for (const [name, res] of plan.clienteResolutions) clientIdByName.set(name, resolveToDbClient(res).id);
      const importerIdByName = new Map<string, string>();
      for (const [name, res] of plan.importerResolutions) importerIdByName.set(name, resolveToDbClient(res).id);

      // 1b/1c. Clean-slate
      const allNumbers = Array.from(
        new Set(plan.contracts.flatMap((c) => [c.sheet.contrato, c.finalContractNumber]))
      );
      const existing = await tx.contract.findMany({
        where: { contractNumber: { in: allNumbers } },
        include: { shipment: { select: { month: true, year: true, name: true } } },
      });
      for (const c of existing) {
        if (c.shipment && c.shipment.month === 1 && c.shipment.year === 2026) {
          throw new Error(`Directive 1 violation on ${c.contractNumber}`);
        }
      }
      const existingIds = existing.map((c) => c.id);
      await tx.contractPriceSnapshot.deleteMany({ where: { contractId: { in: existingIds } } });
      await tx.contractLotAllocation.deleteMany({ where: { contractId: { in: existingIds } } });
      await tx.materiaPrimaAllocation.deleteMany({ where: { contractId: { in: existingIds } } });
      const delOrphanC = await tx.contract.deleteMany({ where: { id: { in: existingIds } } });

      const mayShipments = await tx.shipment.findMany({
        where: { year: YEAR, month: MONTH_NUM },
        select: { id: true, month: true },
      });
      for (const s of mayShipments) assertMonthNotJanuary(s.month, `delete shipment ${s.id}`);
      const sids = mayShipments.map((s) => s.id);
      const delSub = await tx.subproducto.deleteMany({ where: { shipmentId: { in: sids } } });
      const delMPA = await tx.materiaPrimaAllocation.deleteMany({
        where: { materiaPrima: { shipmentId: { in: sids } } },
      });
      const delMP = await tx.materiaPrima.deleteMany({ where: { shipmentId: { in: sids } } });
      const delC = await tx.contract.deleteMany({ where: { shipmentId: { in: sids } } });
      const delS = await tx.shipment.deleteMany({ where: { id: { in: sids } } });

      console.log(
        `  ↘ clean-slate: orphans=${delOrphanC.count} may-ships=${delS.count} may-C=${delC.count} may-MP=${delMP.count} may-MPA=${delMPA.count} may-sub=${delSub.count}`
      );

      // 2. Shipment
      const earliestPos = plan.contracts
        .map((c) => c.posicionDate)
        .sort((a, b) => a.getTime() - b.getTime())[0];
      const shipment = await tx.shipment.create({
        data: {
          name: SHIPMENT_NAME,
          month: MONTH_NUM,
          year: YEAR,
          status: ShipmentStatus.EMBARCADO,
          numContainers: plan.contracts.length,
          regions: Array.from(new Set(plan.contracts.flatMap((c) => c.regions).map(String))).join("/"),
          posicionDate: earliestPos,
          embarqueDate: EMBARQUE_DATE,
        },
      });

      // 3. Contracts (all EXPORTADORA for Mayo)
      const created: { id: string; plan: ContractPlan }[] = [];
      for (const c of plan.contracts) {
        const clientId = clientIdByName.get(c.sheet.cliente)!;
        const importerId = c.sheet.importer ? importerIdByName.get(c.sheet.importer)! : null;
        const cr = await tx.contract.create({
          data: {
            contractNumber: c.finalContractNumber,
            alternateContractNumber: c.alternateContractNumber,
            clientId,
            importerId,
            shipmentId: shipment.id,
            status: c.status,
            regions: c.regions,
            exportingEntity: ExportingEntity.EXPORTADORA,
            puntaje: c.sheet.puntaje != null ? Math.round(c.sheet.puntaje) : null,
            defectos: c.sheet.defectos,
            sacos69kg: c.sheet.sacos69,
            sacos46kg: c.sheet.sacos46,
            precioBolsa: c.sheet.bolsa,
            diferencial: c.sheet.diferencial,
            precioBolsaDif: c.sheet.bolsaDif,
            tipoCambio: c.sheet.tipoCambio,
            gastosPerSaco: c.sheet.gastosPerSaco,
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
        created.push({ id: cr.id, plan: c });
      }

      // 4. MP + MPA
      for (let i = 0; i < plan.contracts.length; i++) {
        const cc = created[i];
        const m = cc.plan.mp;
        const mpRow = await tx.materiaPrima.create({
          data: {
            shipmentId: shipment.id,
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

      // 5. Subproducto
      if (plan.subproducto) {
        await tx.subproducto.create({
          data: {
            shipmentId: shipment.id,
            contenedores: plan.subproducto.contenedores,
            oroPerCont: plan.subproducto.oroPerCont,
            totalOro: plan.subproducto.totalOro,
            precioSinIVA: plan.subproducto.precioSinIVA,
            totalPerga: plan.subproducto.totalPerga,
          },
        });
      }

      // 6. Update contracts
      for (const cc of created) {
        const c = cc.plan;
        const calc = calculateContract({
          sacos69kg: c.sheet.sacos69,
          puntaje: c.sheet.puntaje,
          precioBolsa: c.sheet.bolsa,
          diferencial: c.sheet.diferencial,
          gastosExportPerSaco: c.sheet.gastosPerSaco,
          tipoCambio: c.sheet.tipoCambio,
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
          entityId: shipment.id,
          newValue: {
            etlScript: "scripts/etl-mayo-2026.ts",
            sheetHash: plan.hash,
            month: MONTH_NUM,
            year: YEAR,
            shipmentName: SHIPMENT_NAME,
            contractsCreated: plan.contracts.length,
            clientsCreated: Array.from(createdByCode.values()).map((c) => ({ name: c.name, code: c.code })),
            suffixedContracts: plan.contracts
              .filter((c) => c.finalContractNumber !== c.sheet.contrato)
              .map((c) => ({ raw: c.sheet.contrato, final: c.finalContractNumber })),
            parenthesisContracts: plan.contracts
              .filter((c) => c.alternateContractNumber)
              .map((c) => ({
                contract: c.finalContractNumber,
                alternate: c.alternateContractNumber,
                importer: c.sheet.importer,
              })),
          },
        },
      });

      return { shipmentId: shipment.id };
    },
    { maxWait: 15000, timeout: 90000 }
  );

  await recalculateShipment(result.shipmentId);
  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const exec = args.has("--execute");
  if (dryRun === exec) {
    console.error("Usage: tsx scripts/etl-mayo-2026.ts [--dry-run | --execute]");
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

  const reportPath = path.join(REPORTS_DIR, dryRun ? "dry-run-mayo-2026.md" : "execute-mayo-2026.md");
  fs.writeFileSync(reportPath, report + "\n");
  console.log(report);
  console.log(` → wrote ${reportPath}`);

  if (dryRun) {
    console.log("\n --dry-run: no writes performed.");
    await prisma.$disconnect();
    return;
  }

  if (warnings.length > 0) {
    console.error("\n ⚠ Refusing to execute: warnings present.");
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log("\n → EXECUTING…");
  const result = await execute(plan);
  console.log(` ✓ Shipment ${result.shipmentId} created.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
