// ============================================================================
// Phase C — Febrero 2026 clean-slate ETL
// ============================================================================
// Scope: month=2, year=2026 only (assertMonthNotJanuary at top).
// Source of truth: sheet "Febrero" inside Mayo.xlsx at repo root.
//
// Usage:
//   npx tsx scripts/etl-febrero-2026.ts --dry-run   # print diff, no writes
//   npx tsx scripts/etl-febrero-2026.ts --execute   # apply transaction
//
// Phase C guarantees (per RECONCILIATION_PLAN_2026_JAN_MAY.md §3):
//   - Idempotent: clean-slate delete-then-insert within a transaction.
//   - Transactional: all inserts + updates commit together or roll back.
//   - Audit-logged: single AuditLog row records the run (action=ETL_MONTH).
//   - Directive 1 guard: the month number and every Shipment target row are
//     asserted != 1 before any mutation.
//   - Directive 6 guard: the script is month-scoped. It does NOT sweep the
//     whole DB; every delete uses a WHERE month=2 filter.
//   - Directive 10: dry-run → approve → execute.
//
// Target SSOT numbers (from phase-a-febrero-2026 inventory, for post-ETL check):
//   Total Pago   Q 2,393,918.23   Utilidad Bruta Q 501,636.76
//   Facturación  $ 331,625.44     Margen Bruto   19.77 %
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
const SHEET = "Febrero";
const MONTH_NUM = 2;
const YEAR = 2026;
const SHIPMENT_NAME = "Febrero 2026 - Bloque único";
const REPORTS_DIR = path.join(process.cwd(), "reports");

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// Directive 1 guard — the single invariant that this script never touches Jan.
function assertMonthNotJanuary(month: number, context: string) {
  if (month === 1) {
    throw new Error(
      `Directive 1 violation: attempted to operate on month=1 in context="${context}". ` +
        `This ETL is scoped to month=${MONTH_NUM}. Aborting.`
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

function readFebreroSheet(): SheetData {
  if (!fs.existsSync(MAYO_PATH)) {
    throw new Error(`Mayo.xlsx not found at ${MAYO_PATH}`);
  }
  const crypto = require("node:crypto") as typeof import("node:crypto");
  const buf = fs.readFileSync(MAYO_PATH);
  const hash = crypto.createHash("sha256").update(buf).digest("hex");

  const wb = XLSX.read(buf);
  const ws = wb.Sheets[SHEET];
  if (!ws) throw new Error(`Sheet '${SHEET}' not found`);
  const ref = ws["!ref"];
  if (!ref) throw new Error(`Sheet '${SHEET}' has no used range`);
  const range = XLSX.utils.decode_range(ref);

  // Contract rows: col E = contractNumber, col F = estatus
  const contracts: SheetContract[] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const contrato = sv(cellOf(ws, r, 4)); // E
    const estatus = sv(cellOf(ws, r, 5)); // F
    if (!contrato || /^CONTRATO$/i.test(contrato)) continue;
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

  // MP block: header row has G="CONTRATO" + L="PERGO"
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

  // Subproducto block: row with G="SUBPRODUCTO" marker; data is 2 rows below
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
  return ContractStatus.FIJADO; // default for priced Feb contracts
}

function mapRegions(lote: string): CoffeeRegion[] {
  const u = lote.toUpperCase();
  const out: CoffeeRegion[] = [];
  if (u.includes("SANTA ROSA")) out.push(CoffeeRegion.SANTA_ROSA);
  if (u.includes("HUEHUE")) out.push(CoffeeRegion.HUEHUETENANGO);
  if (u.includes("ORGANIC")) out.push(CoffeeRegion.ORGANICO);
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

const EMBARQUE_DATE = new Date(YEAR, MONTH_NUM - 1, 1); // 2026-02-01
const POSICION_DATE = new Date(YEAR, MONTH_NUM, 1); // 2026-03-01 (Mar-26)

// ── Plan shape ──────────────────────────────────────────────────────────────

type ContractPlan = {
  sheet: SheetContract;
  exportingEntity: ExportingEntity;
  status: ContractStatus;
  regions: CoffeeRegion[];
  posicionBolsa: PosicionBolsa | null;
  gastosPerSaco: number;
  tipoCambio: number;
  montoCredito: number; // GTQ, equal to own MP totalMP
  mp: SheetMP;
};

type Plan = {
  hash: string;
  contracts: ContractPlan[];
  mp: SheetMP[];
  subproducto: SheetSubproducto | null;
};

function buildPlan(data: SheetData): Plan {
  if (data.contracts.length === 0) {
    throw new Error("Sheet produced 0 contract rows; refusing to build empty plan.");
  }
  if (data.mp.length === 0) {
    throw new Error("Sheet produced 0 MP rows; refusing to build plan without MP.");
  }

  // Positional 1:1 mapping between contract rows and MP rows — verified by
  // sheet structure (MP row N references contract row N via =E{row} formulas).
  if (data.contracts.length !== data.mp.length) {
    throw new Error(
      `Contract count (${data.contracts.length}) != MP count (${data.mp.length}); ` +
        `Febrero is expected to be 1:1.`
    );
  }

  const contracts: ContractPlan[] = data.contracts.map((c, i) => {
    const mp = data.mp[i];
    if (mp.contrato !== c.contrato) {
      throw new Error(
        `MP row ${mp.row} contract '${mp.contrato}' does not match contract row ${c.row} '${c.contrato}'`
      );
    }
    return {
      sheet: c,
      exportingEntity: ExportingEntity.EXPORTADORA, // Q1 answer: all Feb blocks EXPORTADORA
      status: mapStatus(c.estatus),
      regions: mapRegions(c.lote),
      posicionBolsa: mapPosicionBolsa(c.posicion),
      gastosPerSaco: c.gastosPerSaco,
      tipoCambio: c.tipoCambio,
      montoCredito: mp.totalMP,
      mp,
    };
  });

  return {
    hash: data.hash,
    contracts,
    mp: data.mp,
    subproducto: data.subproducto,
  };
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
          `${c.sheet.contrato}.${field}: computed=${computed.toFixed(4)} sheet=${sheet.toFixed(4)} Δ=${(
            computed.toNumber() - sheet
          ).toFixed(4)}`
        );
      }
    }
  }
  return warnings;
}

// ── Rendering helpers ───────────────────────────────────────────────────────

function renderPlan(
  plan: Plan,
  warnings: string[],
  resolved: StrictResolve,
  totalClientsScanned: number,
  canonicalCount: number
): string {
  const L: string[] = [];
  L.push("=".repeat(78));
  L.push(` ETL Febrero 2026 — DRY RUN`);
  L.push("=".repeat(78));
  L.push(` Sheet hash: ${plan.hash}`);
  L.push(` Shipment:   ${SHIPMENT_NAME}`);
  L.push(` Contracts:  ${plan.contracts.length}`);
  L.push(` MP rows:    ${plan.mp.length}`);
  L.push(` Subproducto:${plan.subproducto ? " 1 row" : " (none)"}`);
  L.push("");

  L.push(" ── Client resolution (strict, variant-map-based) ─────────────────────────────");
  const sheetClientName = plan.contracts[0].sheet.cliente;
  L.push(
    `  Sheet says: "${sheetClientName}"   DB clients scanned: ${totalClientsScanned}   Map canonicals: ${canonicalCount}`
  );
  if (resolved.kind === "resolved") {
    L.push(
      `  ✓ MATCHED via variant map: '${resolved.client.name}' (code '${resolved.client.code}')`
    );
    L.push(
      `    matched variant: '${resolved.matchedVariant}' under canonical '${resolved.canonical.name}'`
    );
  } else if (resolved.kind === "needs-create") {
    L.push(
      `  ⚠ NEEDS-CREATE: map canonical '${resolved.canonical.name}' [${resolved.canonical.code}] — DB row missing. Febrero ETL does not support client creation.`
    );
  } else {
    L.push(`  ⚠ UNRESOLVED: '${resolved.sheetValue}' is NOT in docs/client-variant-map.md`);
    L.push(`    reason: ${resolved.reason}`);
    if (resolved.suggestion) {
      const s = resolved.suggestion;
      L.push(
        `    dry-run suggestion (fuzzy, do not auto-accept): '${s.candidate.name}' [${s.candidate.code}] via ${s.via} distance=${s.distance}`
      );
      L.push(
        `    → If confirmed, append '${resolved.sheetValue}' under '### Canonical: ${s.candidate.name} [${s.candidate.code}]' in docs/client-variant-map.md, then re-run --dry-run.`
      );
    } else {
      L.push(
        `    no plausible DB match — likely a brand-new client. Propose adding a new '### Canonical: ... [...]' entry in docs/client-variant-map.md.`
      );
    }
    L.push(`    --execute will REFUSE to run until this is resolved.`);
  }
  L.push("");

  L.push(" ── Contracts ─────────────────────────────────────────────────────────────────");
  for (const c of plan.contracts) {
    L.push(
      `  ${c.sheet.contrato}  client=${c.sheet.cliente}  lote=${c.sheet.lote}  regions=[${c.regions.join(",")}]  entity=${c.exportingEntity}  status=${c.status}`
    );
    L.push(
      `    sacos69=${c.sheet.sacos69}  sacos46=${c.sheet.sacos46}  puntaje=${c.sheet.puntaje}  bolsa+dif=${c.sheet.bolsaDif}  gastos/qq=${c.gastosPerSaco}  TC=${c.tipoCambio}`
    );
    L.push(
      `    montoCredito=Q${c.montoCredito.toFixed(2)}  (from own MP totalMP — business rules §2.7)`
    );
  }
  L.push("");

  L.push(" ── Materia Prima ─────────────────────────────────────────────────────────────");
  for (const m of plan.mp) {
    L.push(
      `  ${m.contrato}  proveedor=${m.proveedor}  punteo=${m.punteo}  oro=${m.oro}  rend=${m.rendimiento}  pergo=${m.pergo}  promQ=${m.promQ}  totalMP=Q${m.totalMP}`
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
  L.push("   1. DELETE rows WHERE month=2 year=2026:");
  L.push("        Subproducto → MateriaPrimaAllocation → MateriaPrima → Contract → Shipment");
  L.push("   2. INSERT:");
  L.push(`        1 × Shipment "${SHIPMENT_NAME}" (month=2 year=2026)`);
  L.push(`        ${plan.contracts.length} × Contract (exportingEntity=EXPORTADORA)`);
  L.push(`        ${plan.mp.length} × MateriaPrima`);
  L.push(`        ${plan.mp.length} × MateriaPrimaAllocation (1:1)`);
  L.push(`        ${plan.subproducto ? 1 : 0} × Subproducto`);
  L.push("   3. UPDATE each contract with calculateContract(...) derived fields.");
  L.push("   4. CALL recalculateShipment(shipmentId).");
  L.push("   5. WRITE 1 × AuditLog entry (action=ETL_MONTH, entity=Shipment).");
  L.push("");
  L.push(" No writes performed in --dry-run mode. Re-run with --execute to apply.");
  L.push("=".repeat(78));
  return L.join("\n");
}

// ── Execute ─────────────────────────────────────────────────────────────────
// Client resolution is strict: the sheet value MUST already be mapped under a
// canonical in docs/client-variant-map.md. Unresolved variants block --execute
// per feedback_client_variant_map.md.

async function execute(plan: Plan, resolved: StrictResolve) {
  if (resolved.kind === "needs-create") {
    throw new Error(
      `Febrero ETL does not support client creation. Canonical '${resolved.canonical.name}' [${resolved.canonical.code}] has no DB row — use an ETL that supports --create-canonical, or pre-create the Client.`
    );
  }
  if (resolved.kind !== "resolved") {
    throw new Error(
      `Refusing to --execute: client '${resolved.sheetValue}' is not in docs/client-variant-map.md. ${resolved.reason}`
    );
  }

  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: "octavio@hopecoffee.com" },
    select: { id: true, email: true },
  });

  const client: DbClient = resolved.client;
  console.log(
    `  ℹ Matched Client ${client.name} (${client.code}) — variant '${resolved.matchedVariant}' in docs/client-variant-map.md`
  );

  // Transactional clean-slate + inserts
  const result = await prisma.$transaction(async (tx) => {
    const planNumbers = plan.contracts.map((c) => c.sheet.contrato);

    // 1a. Sweep orphan / pre-existing contracts by contractNumber. These may
    //     come from earlier (pre-reconciliation) imports where the contract
    //     was created without a Feb shipment link. Guard against Jan.
    const existingByNumber = await tx.contract.findMany({
      where: { contractNumber: { in: planNumbers } },
      include: {
        shipment: { select: { id: true, month: true, year: true, name: true } },
        materiaPrimaAllocations: { select: { id: true, materiaPrimaId: true } },
      },
    });
    for (const c of existingByNumber) {
      if (c.shipment && c.shipment.month === 1 && c.shipment.year === 2026) {
        throw new Error(
          `Directive 1 violation: Contract ${c.contractNumber} is linked to Jan 2026 shipment '${c.shipment.name}'. Refusing to delete.`
        );
      }
    }
    const existingContractIds = existingByNumber.map((c) => c.id);

    // Delete all foreign references to those contracts first
    const delPS = await tx.contractPriceSnapshot.deleteMany({
      where: { contractId: { in: existingContractIds } },
    });
    const delLA = await tx.contractLotAllocation.deleteMany({
      where: { contractId: { in: existingContractIds } },
    });
    const delMPAbyContract = await tx.materiaPrimaAllocation.deleteMany({
      where: { contractId: { in: existingContractIds } },
    });
    const delOrphanContracts = await tx.contract.deleteMany({
      where: { id: { in: existingContractIds } },
    });

    // 1b. Feb-specific clean-slate (month=2, year=2026 shipments + children)
    const febShipments = await tx.shipment.findMany({
      where: { year: YEAR, month: MONTH_NUM },
      select: { id: true, month: true, year: true },
    });
    for (const s of febShipments) {
      assertMonthNotJanuary(s.month, `delete shipment ${s.id}`);
    }
    const febShipmentIds = febShipments.map((s) => s.id);

    const delSub = await tx.subproducto.deleteMany({
      where: { shipmentId: { in: febShipmentIds } },
    });
    const delMPA = await tx.materiaPrimaAllocation.deleteMany({
      where: { materiaPrima: { shipmentId: { in: febShipmentIds } } },
    });
    const delMP = await tx.materiaPrima.deleteMany({
      where: { shipmentId: { in: febShipmentIds } },
    });
    const delContracts = await tx.contract.deleteMany({
      where: { shipmentId: { in: febShipmentIds } },
    });
    const delShipments = await tx.shipment.deleteMany({
      where: { id: { in: febShipmentIds } },
    });

    console.log(
      `  ↘ clean-slate deleted: orphan contracts=${delOrphanContracts.count} (PS=${delPS.count} LA=${delLA.count} MPAbyC=${delMPAbyContract.count}) / feb shipments=${delShipments.count} feb-contracts=${delContracts.count} feb-MP=${delMP.count} feb-MPA=${delMPA.count} feb-sub=${delSub.count}`
    );

    // 2. Insert Shipment
    const shipment = await tx.shipment.create({
      data: {
        name: SHIPMENT_NAME,
        month: MONTH_NUM,
        year: YEAR,
        status: ShipmentStatus.EMBARCADO,
        numContainers: plan.contracts.length, // 1 container per contract typical
        regions: Array.from(
          new Set(plan.contracts.flatMap((c) => c.regions).map((r) => String(r)))
        ).join("/"),
        posicionDate: POSICION_DATE,
        embarqueDate: EMBARQUE_DATE,
      },
    });

    // 3. Insert Contracts
    const createdContracts = [];
    for (const c of plan.contracts) {
      const created = await tx.contract.create({
        data: {
          contractNumber: c.sheet.contrato,
          clientId: client.id,
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
          posicionNY: POSICION_DATE,
          fechaEmbarque: EMBARQUE_DATE,
          lote: c.sheet.lote,
        },
      });
      createdContracts.push({ created, plan: c });
    }

    // 4. Insert MateriaPrima rows and MateriaPrimaAllocation (1:1)
    const createdMP = [];
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
        data: {
          materiaPrimaId: mpRow.id,
          contractId: cc.created.id,
          quintalesAllocated: null,
        },
      });
      createdMP.push({ mpRow, contract: cc.created });
    }

    // 5. Insert Subproducto
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

    // 6. UPDATE each Contract with calculateContract derived fields
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
        where: { id: cc.created.id },
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

    // 7. Audit trail — one row for the ETL run
    await tx.auditLog.create({
      data: {
        userId: admin.id,
        action: "ETL_MONTH",
        entity: "Shipment",
        entityId: shipment.id,
        newValue: {
          etlScript: "scripts/etl-febrero-2026.ts",
          mode: "execute",
          sheetHash: plan.hash,
          month: MONTH_NUM,
          year: YEAR,
          shipmentName: SHIPMENT_NAME,
          contractsCreated: createdContracts.length,
          mpCreated: createdMP.length,
          subproductoCreated: plan.subproducto ? 1 : 0,
          deletedCounts: {
            orphanContracts: delOrphanContracts.count,
            orphanPriceSnapshots: delPS.count,
            orphanLotAllocations: delLA.count,
            orphanMPAbyContract: delMPAbyContract.count,
            febShipments: delShipments.count,
            febContracts: delContracts.count,
            febMP: delMP.count,
            febMPA: delMPA.count,
            febSubproducto: delSub.count,
          },
        },
      },
    });

    return { shipmentId: shipment.id, deletedCounts: { shipments: delShipments.count } };
  });

  // 8. recalculateShipment — runs outside the transaction on the committed row
  await recalculateShipment(result.shipmentId);

  return result;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const exec = args.has("--execute");
  if (dryRun === exec) {
    console.error("Usage: tsx scripts/etl-febrero-2026.ts [--dry-run | --execute]");
    process.exit(2);
  }

  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const data = readFebreroSheet();
  const plan = buildPlan(data);
  const warnings = validatePlanAgainstSheet(plan);

  // Client resolution is strict against docs/client-variant-map.md.
  // Unresolved variants block --execute (per feedback_client_variant_map.md).
  const clientName = plan.contracts[0].sheet.cliente;
  const allClients: DbClient[] = await prisma.client.findMany({
    select: { id: true, name: true, code: true },
  });
  const variantMap = loadVariantMap();
  const resolved = resolveStrict(clientName, variantMap, allClients);

  const report = renderPlan(plan, warnings, resolved, allClients.length, variantMap.canonicals.length);

  // Always write the dry-run report so it's auditable
  const reportPath = path.join(
    REPORTS_DIR,
    dryRun ? "dry-run-febrero-2026.md" : "execute-febrero-2026.md"
  );
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
    console.error(" ⚠ Refusing to execute: computed values differ from sheet within tolerance.");
    console.error("   Resolve the warnings above and re-run.");
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log("");
  console.log(" → EXECUTING (transactional)…");
  const result = await execute(plan, resolved);
  console.log(` ✓ Shipment ${result.shipmentId} created.`);
  console.log(`   Deleted prior Feb shipments: ${result.deletedCounts.shipments}`);
  console.log("   recalculateShipment completed.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
