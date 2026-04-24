// ============================================================================
// Phase C — Marzo 2026 clean-slate ETL
// ============================================================================
// Scope: month=3, year=2026 only (assertMonthNotJanuary at top).
// Source of truth: sheet "Marzo" inside Mayo.xlsx at repo root.
//
// Differences vs Febrero:
//   - 6 contracts across 3 clients (Serengetti, Opal, Onyx).
//   - One duplicate contractNumber (POUS-00003761 ×2) → split -01 / -02.
//   - DB has 5 legacy Mar shipments + 15 contracts + 16 MP + 5 subproductos
//     from the pre-reconciliation importer; clean-slate cascade-deletes them.
//   - Region map tolerates 'Orgnaico' typo.
//
// Usage:
//   npx tsx scripts/etl-marzo-2026.ts --dry-run
//   npx tsx scripts/etl-marzo-2026.ts --execute
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
const SHEET = "Marzo";
const MONTH_NUM = 3;
const YEAR = 2026;
const SHIPMENT_NAME = "Marzo 2026 - Bloque único";
const REPORTS_DIR = path.join(process.cwd(), "reports");

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

function assertMonthNotJanuary(month: number, context: string) {
  if (month === 1) {
    throw new Error(
      `Directive 1 violation: attempted to operate on month=1 in context="${context}". This ETL is scoped to month=${MONTH_NUM}. Aborting.`
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
  puntaje: number;
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

/**
 * Normalize a posicion cell to "Mmm-YY" regardless of whether the xlsx stores
 * it as text ("May-26"), a JS Date, or an Excel serial number. Marzo stores
 * serials; Febrero stored text.
 */
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
    // Excel serial → JS Date (UTC)
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

  // Contract rows
  const contracts: SheetContract[] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const contrato = sv(cellOf(ws, r, 4));
    const estatus = sv(cellOf(ws, r, 5));
    if (!contrato || /^CONTRATO$/i.test(contrato)) continue;
    if (!/^(Fijado|No\s*Fijado|FIJADO|NO\s*FIJADO)$/i.test(estatus)) continue;
    contracts.push({
      row: r + 1,
      contrato,
      embarque: posicionString(cellOf(ws, r, 1)),
      posicion: posicionString(cellOf(ws, r, 2)),
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

  // Subproducto
  let subHeaderRow = -1;
  for (let r = range.s.r; r <= range.e.r; r++) {
    if (sv(cellOf(ws, r, 6)).toUpperCase() === "SUBPRODUCTO") {
      subHeaderRow = r;
      break;
    }
  }
  let subproducto: SheetSubproducto | null = null;
  if (subHeaderRow >= 0) {
    const dr = subHeaderRow + 2;
    const contenedores = nv(cellOf(ws, dr, 9));
    if (Number.isFinite(contenedores)) {
      subproducto = {
        contenedores,
        oroPerCont: nv(cellOf(ws, dr, 10)),
        totalOro: nv(cellOf(ws, dr, 11)),
        precioSinIVA: nv(cellOf(ws, dr, 12)),
        totalPerga: nv(cellOf(ws, dr, 14)),
      };
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
  // 'ORGANIC' (correct) or 'ORGNAIC' (observed typo in Marzo row 10)
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

// Embarque date = first of month (2026-03-01); posicion from col C.
const EMBARQUE_DATE = new Date(YEAR, MONTH_NUM - 1, 1);

function parsePosicionDate(posicion: string): Date {
  // "May-26", "Jul-26", etc.
  const m = posicion.match(/^([A-Za-z]+)-(\d{2})$/);
  if (!m) return new Date(YEAR, MONTH_NUM, 1); // fallback: next month
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
  finalContractNumber: string; // with -NN suffix when duplicate
  exportingEntity: ExportingEntity;
  status: ContractStatus;
  regions: CoffeeRegion[];
  posicionBolsa: PosicionBolsa | null;
  posicionDate: Date;
  gastosPerSaco: number;
  tipoCambio: number;
  montoCredito: number;
  mp: SheetMP;
  clienteResolution: StrictResolve;
};

type Plan = {
  hash: string;
  contracts: ContractPlan[];
  mp: SheetMP[];
  subproducto: SheetSubproducto | null;
  uniqueClienteResolutions: Map<string, StrictResolve>;
};

function buildPlan(data: SheetData, variantMap: ReturnType<typeof loadVariantMap>, dbClients: DbClient[]): Plan {
  if (data.contracts.length === 0) throw new Error("Sheet produced 0 contract rows.");
  if (data.mp.length === 0) throw new Error("Sheet produced 0 MP rows.");
  if (data.contracts.length !== data.mp.length) {
    throw new Error(
      `Contract count (${data.contracts.length}) != MP count (${data.mp.length}); Marzo expected 1:1 positional.`
    );
  }

  // Duplicate suffixing
  const countByName = new Map<string, number>();
  for (const c of data.contracts) countByName.set(c.contrato, (countByName.get(c.contrato) ?? 0) + 1);
  const counterByName = new Map<string, number>();

  // Client resolution cache — one resolveStrict call per distinct cliente.
  const uniqueClienteResolutions = new Map<string, StrictResolve>();
  for (const c of data.contracts) {
    if (!uniqueClienteResolutions.has(c.cliente)) {
      uniqueClienteResolutions.set(c.cliente, resolveStrict(c.cliente, variantMap, dbClients));
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

  return { hash: data.hash, contracts, mp: data.mp, subproducto: data.subproducto, uniqueClienteResolutions };
}

// ── Validation against sheet target values ──────────────────────────────────

function validatePlanAgainstSheet(plan: Plan): string[] {
  const warnings: string[] = [];
  const EPS = 0.03;
  for (const c of plan.contracts) {
    const calc = calculateContract({
      sacos69kg: c.sheet.sacos69,
      puntaje: Math.round(c.sheet.puntaje),
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
      ["costoFinanciero", calc.costoFinanciero, c.sheet.costoFin],
      ["utilidadSinCF", calc.utilidadSinCostoFinanciero, c.sheet.utilSinCF],
      ["totalPagoQTZ", calc.totalPagoQTZ, c.sheet.totalPago],
    ];
    for (const [field, computed, sheet] of pairs) {
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
  L.push(` Contracts:  ${plan.contracts.length} (${new Set(plan.contracts.map((c) => c.sheet.cliente)).size} clients)`);
  L.push(` MP rows:    ${plan.mp.length}`);
  L.push(` Subproducto: ${plan.subproducto ? "1 row" : "(none)"}`);
  L.push("");

  L.push(" ── Client resolution (strict, variant-map-based) ─────────────────────────────");
  L.push(`  DB clients scanned: ${totalClientsScanned}   Map canonicals: ${canonicalCount}`);
  let allResolved = true;
  for (const [cliente, res] of plan.uniqueClienteResolutions) {
    if (res.kind === "resolved") {
      L.push(
        `  ✓ '${cliente}' → '${res.client.name}' [${res.client.code}] via '${res.matchedVariant}'`
      );
    } else if (res.kind === "needs-create") {
      allResolved = false;
      L.push(
        `  ⚠ '${cliente}' NEEDS-CREATE — map canonical '${res.canonical.name}' [${res.canonical.code}]. Marzo ETL does not support client creation.`
      );
    } else {
      allResolved = false;
      const s = res.suggestion
        ? `${res.suggestion.candidate.name} [${res.suggestion.candidate.code}] via ${res.suggestion.via} d=${res.suggestion.distance}`
        : "no plausible match";
      L.push(`  ⚠ '${cliente}' UNRESOLVED — suggestion: ${s}`);
      L.push(`    → append under appropriate canonical in docs/client-variant-map.md, then re-run`);
    }
  }
  if (!allResolved) {
    L.push("  ⚠ --execute will REFUSE until all clients are resolved in the variant map.");
  }
  L.push("");

  L.push(" ── Contracts ─────────────────────────────────────────────────────────────────");
  for (const c of plan.contracts) {
    const suffix = c.finalContractNumber !== c.sheet.contrato ? ` (SUFFIXED from '${c.sheet.contrato}')` : "";
    L.push(
      `  ${c.finalContractNumber}${suffix}  client=${c.sheet.cliente}  lote=${c.sheet.lote}  regions=[${c.regions.join(",")}]  status=${c.status}`
    );
    L.push(
      `    sacos69=${c.sheet.sacos69}  sacos46=${c.sheet.sacos46}  puntaje=${c.sheet.puntaje}  bolsa+dif=${c.sheet.bolsaDif}  dif=${c.sheet.diferencial}  gastos/qq=${c.gastosPerSaco}  TC=${c.tipoCambio}  pos=${c.sheet.posicion}→${c.posicionBolsa}`
    );
    L.push(
      `    montoCredito=Q${c.montoCredito.toFixed(2)}`
    );
  }
  L.push("");

  L.push(" ── Materia Prima ─────────────────────────────────────────────────────────────");
  for (let i = 0; i < plan.mp.length; i++) {
    const m = plan.mp[i];
    const suffix = plan.contracts[i].finalContractNumber !== m.contrato ? ` → links to ${plan.contracts[i].finalContractNumber}` : "";
    L.push(
      `  ${m.contrato}${suffix}  proveedor=${m.proveedor}  oro=${m.oro}  rend=${m.rendimiento}  pergo=${m.pergo}  promQ=${m.promQ}  totalMP=Q${m.totalMP}`
    );
  }
  L.push("");

  if (plan.subproducto) {
    L.push(" ── Subproducto ───────────────────────────────────────────────────────────────");
    const s = plan.subproducto;
    L.push(
      `  contenedores=${s.contenedores}  oroPerCont=${s.oroPerCont}  totalOro=${s.totalOro}  precioSinIVA=${s.precioSinIVA}  totalPerga=Q${s.totalPerga}`
    );
    L.push("");
  }

  L.push(" ── Computed validation vs sheet (tolerance ±0.03) ────────────────────────────");
  if (warnings.length === 0) {
    L.push("  ✓ All computed values match sheet values within tolerance.");
  } else {
    L.push(`  ⚠ ${warnings.length} divergence(s):`);
    for (const w of warnings) L.push(`    - ${w}`);
  }
  L.push("");

  L.push(" ── Mutations that --execute would perform ───────────────────────────────────");
  L.push("   1a. DELETE existing Contract(s) by final contractNumber (with Jan guard)");
  L.push("   1b. DELETE any Mar 2026 shipments cascade (Subproducto → MPA → MP → Contract → Shipment)");
  L.push(`   2.  INSERT 1 × Shipment "${SHIPMENT_NAME}"`);
  L.push(`        ${plan.contracts.length} × Contract (exportingEntity=EXPORTADORA)`);
  L.push(`        ${plan.mp.length} × MateriaPrima`);
  L.push(`        ${plan.mp.length} × MateriaPrimaAllocation (1:1)`);
  L.push(`        ${plan.subproducto ? 1 : 0} × Subproducto`);
  L.push("   3.  UPDATE each contract via calculateContract(...).");
  L.push("   4.  CALL recalculateShipment(shipmentId).");
  L.push("   5.  WRITE 1 × AuditLog entry (action=ETL_MONTH).");
  L.push("");
  L.push(" No writes performed in --dry-run mode.");
  L.push("=".repeat(78));
  return L.join("\n");
}

// ── Execute ─────────────────────────────────────────────────────────────────

async function execute(plan: Plan) {
  // Safety: all clients must be resolved
  for (const [cliente, res] of plan.uniqueClienteResolutions) {
    if (res.kind === "needs-create") {
      throw new Error(
        `Marzo ETL does not support client creation. Sheet cliente '${cliente}' maps to canonical '${res.canonical.name}' [${res.canonical.code}] but no DB row exists.`
      );
    }
    if (res.kind !== "resolved") {
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
  for (const [cliente, res] of plan.uniqueClienteResolutions) {
    if (res.kind === "resolved") {
      console.log(
        `  ℹ Matched Client ${res.client.name} (${res.client.code}) — sheet '${cliente}', variant '${res.matchedVariant}'`
      );
    }
  }

  const result = await prisma.$transaction(
    async (tx) => {
    const finalNumbers = plan.contracts.map((c) => c.finalContractNumber);
    const rawNumbers = plan.contracts.map((c) => c.sheet.contrato);
    const allNumbers = Array.from(new Set([...finalNumbers, ...rawNumbers]));

    // 1a. Sweep existing contracts by any of {final, raw} contractNumber. Jan guard.
    const existingByNumber = await tx.contract.findMany({
      where: { contractNumber: { in: allNumbers } },
      include: {
        shipment: { select: { id: true, month: true, year: true, name: true } },
      },
    });
    for (const c of existingByNumber) {
      if (c.shipment && c.shipment.month === 1 && c.shipment.year === 2026) {
        throw new Error(
          `Directive 1 violation: Contract ${c.contractNumber} is linked to Jan 2026 shipment '${c.shipment.name}'. Refusing to delete.`
        );
      }
    }
    const existingIds = existingByNumber.map((c) => c.id);
    const delPS = await tx.contractPriceSnapshot.deleteMany({ where: { contractId: { in: existingIds } } });
    const delLA = await tx.contractLotAllocation.deleteMany({ where: { contractId: { in: existingIds } } });
    const delMPAbyC = await tx.materiaPrimaAllocation.deleteMany({ where: { contractId: { in: existingIds } } });
    const delOrphanC = await tx.contract.deleteMany({ where: { id: { in: existingIds } } });

    // 1b. Mar 2026 shipments cascade
    const marShipments = await tx.shipment.findMany({
      where: { year: YEAR, month: MONTH_NUM },
      select: { id: true, month: true, year: true },
    });
    for (const s of marShipments) assertMonthNotJanuary(s.month, `delete shipment ${s.id}`);
    const marIds = marShipments.map((s) => s.id);
    const delSub = await tx.subproducto.deleteMany({ where: { shipmentId: { in: marIds } } });
    const delMPA = await tx.materiaPrimaAllocation.deleteMany({
      where: { materiaPrima: { shipmentId: { in: marIds } } },
    });
    const delMP = await tx.materiaPrima.deleteMany({ where: { shipmentId: { in: marIds } } });
    const delContracts = await tx.contract.deleteMany({ where: { shipmentId: { in: marIds } } });
    const delShipments = await tx.shipment.deleteMany({ where: { id: { in: marIds } } });

    console.log(
      `  ↘ clean-slate deleted: orphan-contracts=${delOrphanC.count} (PS=${delPS.count} LA=${delLA.count} MPAbyC=${delMPAbyC.count}) / mar shipments=${delShipments.count} mar-contracts=${delContracts.count} mar-MP=${delMP.count} mar-MPA=${delMPA.count} mar-sub=${delSub.count}`
    );

    // 2. Shipment
    const earliestPosicion = plan.contracts
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
        posicionDate: earliestPosicion,
        embarqueDate: EMBARQUE_DATE,
      },
    });

    // 3. Contracts
    const createdContracts: { id: string; plan: ContractPlan }[] = [];
    for (const c of plan.contracts) {
      const resolved = c.clienteResolution;
      if (resolved.kind !== "resolved") {
        throw new Error(`unreachable: cliente '${c.sheet.cliente}' not resolved`);
      }
      const created = await tx.contract.create({
        data: {
          contractNumber: c.finalContractNumber,
          clientId: resolved.client.id,
          shipmentId: shipment.id,
          status: c.status,
          regions: c.regions,
          exportingEntity: c.exportingEntity,
          puntaje: Math.round(c.sheet.puntaje),
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
      createdContracts.push({ id: created.id, plan: c });
    }

    // 4. MP + MPA (1:1 positional)
    for (const cc of createdContracts) {
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

    // 6. Update contracts with calculateContract
    for (const cc of createdContracts) {
      const c = cc.plan;
      const calc = calculateContract({
        sacos69kg: c.sheet.sacos69,
        puntaje: Math.round(c.sheet.puntaje),
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
        entityId: shipment.id,
        newValue: {
          etlScript: "scripts/etl-marzo-2026.ts",
          mode: "execute",
          sheetHash: plan.hash,
          month: MONTH_NUM,
          year: YEAR,
          shipmentName: SHIPMENT_NAME,
          contractsCreated: createdContracts.length,
          mpCreated: createdContracts.length,
          subproductoCreated: plan.subproducto ? 1 : 0,
          suffixedContracts: plan.contracts
            .filter((c) => c.finalContractNumber !== c.sheet.contrato)
            .map((c) => ({ raw: c.sheet.contrato, final: c.finalContractNumber })),
          deletedCounts: {
            orphanContracts: delOrphanC.count,
            orphanPriceSnapshots: delPS.count,
            orphanLotAllocations: delLA.count,
            orphanMPAbyContract: delMPAbyC.count,
            marShipments: delShipments.count,
            marContracts: delContracts.count,
            marMP: delMP.count,
            marMPA: delMPA.count,
            marSubproducto: delSub.count,
          },
        },
      },
    });

    return { shipmentId: shipment.id };
    },
    {
      // Defaults are maxWait 2 s / timeout 5 s; raise for larger months (Marzo
      // has 5 legacy shipments to cascade-delete + 6 inserts + 6 MP + 6 MPA +
      // 1 Subproducto + 6 updates). Mayo will need even more headroom.
      maxWait: 15000,
      timeout: 60000,
    }
  );

  await recalculateShipment(result.shipmentId);
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
  console.log(` ✓ Shipment ${result.shipmentId} created.`);
  console.log("   recalculateShipment completed.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
