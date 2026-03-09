// ============================================================================
// HOPE COFFEE — Excel Data Import Script
// ============================================================================
// Parses docs/hopecoffee.xlsx and imports ALL business data into the database.
// Run with: npm run db:import
//
// This is a ONE-TIME migration tool. It reads every sheet, detects blocks
// (each STATUS: header = one block), and creates Shipments, Contracts,
// MateriaPrima, Subproductos, PurchaseOrders, and SupplierAccountEntries.
// ============================================================================

import * as XLSX from "xlsx";
import Decimal from "decimal.js";
import { PrismaClient, ContractStatus, CoffeeRegion } from "@prisma/client";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const prisma = new PrismaClient();
const EXCEL_PATH = "docs/hopecoffee.xlsx";

// ── Utility helpers ──────────────────────────────────────────────────────────

type RawRow = (string | number | Date | null | undefined)[];

function safeNum(val: unknown): number {
  if (val === null || val === undefined || val === "") return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function safeStr(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

function excelSerialToDate(serial: number): Date | null {
  if (!serial || serial < 1) return null;
  const utcDays = serial - 25569;
  return new Date(utcDays * 86400000);
}

// ── Status parsing ───────────────────────────────────────────────────────────

function parseBlockStatus(raw: string): ContractStatus {
  const s = raw.toUpperCase().trim();
  if (s.includes("CONFIRM")) return ContractStatus.CONFIRMADO;
  if (s.includes("NO FIJADO")) return ContractStatus.NO_FIJADO;
  if (s.includes("FIJADO")) return ContractStatus.FIJADO;
  if (s.includes("NEGOC")) return ContractStatus.NEGOCIACION;
  if (s.includes("EMBARC")) return ContractStatus.EMBARCADO;
  if (s.includes("LIQUID")) return ContractStatus.LIQUIDADO;
  if (s.includes("CANCEL")) return ContractStatus.CANCELADO;
  return ContractStatus.NEGOCIACION;
}

function parseRowStatus(raw: string): ContractStatus {
  const s = raw.toUpperCase().trim();
  if (s === "FIJADO") return ContractStatus.FIJADO;
  if (s === "NO FIJADO") return ContractStatus.NO_FIJADO;
  if (s.includes("CONFIRM")) return ContractStatus.CONFIRMADO;
  return ContractStatus.NEGOCIACION;
}

// ── Region parsing ───────────────────────────────────────────────────────────

function parseRegions(raw: string): CoffeeRegion[] {
  if (!raw) return [];
  const s = raw.toUpperCase();
  const regions: CoffeeRegion[] = [];
  if (s.includes("SANTA ROSA") || s.includes("SANTA R")) regions.push(CoffeeRegion.SANTA_ROSA);
  if (s.includes("HUEHUE") || s.includes("HUEUE") || s.includes("HUHEUE")) regions.push(CoffeeRegion.HUEHUETENANGO);
  if (s.includes("ORGANIC")) regions.push(CoffeeRegion.ORGANICO);
  if (s.includes("DANILA") || s.includes("DANILAND")) regions.push(CoffeeRegion.DANILANDIA);
  if (s.includes("SANTA ISABEL")) regions.push(CoffeeRegion.SANTA_ISABEL);
  if (s.includes("ROBUSTA")) regions.push(CoffeeRegion.OTHER);
  if (regions.length === 0) regions.push(CoffeeRegion.OTHER);
  return regions;
}

// ── Client normalization ─────────────────────────────────────────────────────

const CLIENT_MAP: Record<string, { name: string; code: string }> = {
  serengetti: { name: "Serengetti", code: "SER" },
  "swiss water": { name: "Swiss Water", code: "SWP" },
  opal: { name: "Opal", code: "OPL" },
  onyx: { name: "Onyx", code: "ONX" },
  atlas: { name: "Atlas", code: "ATL" },
  stonex: { name: "Stonex", code: "STX" },
  "sucafina specialty": { name: "Sucafina Specialty", code: "SUC" },
  sucafina: { name: "Sucafina Specialty", code: "SUC" },
  walker: { name: "Walker", code: "WLK" },
  lm: { name: "LM", code: "LMC" },
  florina: { name: "Florina", code: "FLO" },
  margaro: { name: "Margaro", code: "MAR" },
  sopex: { name: "Sopex", code: "SPX" },
};

function resolveClient(raw: string): { name: string; code: string } {
  const key = raw.toLowerCase().trim();
  if (CLIENT_MAP[key]) return CLIENT_MAP[key];
  const name = raw.trim();
  const code = name.substring(0, 3).toUpperCase();
  return { name, code };
}

// ── Supplier matching from MP notes ──────────────────────────────────────────

function matchSupplier(note: string): { code: string | null; isPurchased: boolean } {
  const s = note.toUpperCase();
  const isNotPurchased = s.includes("NO COMPRADO") || s.includes("NO_COMPRADO");
  let code: string | null = null;
  if (s.includes("JOSE DAVID") || s.includes("JOSÉ DAVID")) code = "JDG";
  else if (s.includes("KFINO") || s.includes("K-FINO")) code = "KFI";
  else if (s.includes("WALCO")) code = "WAL";
  return { code, isPurchased: !isNotPurchased && (code !== null || s.includes("COMPRADO") || s.includes("PARCIALMENTE")) };
}

// ── Parsed types ─────────────────────────────────────────────────────────────

interface ParsedContract {
  clientName: string;
  clientCode: string;
  contractNumber: string;
  status: ContractStatus;
  puntaje: number;
  sacos69kg: number;
  precioBolsa: number;
  diferencial: number;
  lote: string | null;
  gastosPerSaco: number;
}

interface ParsedMP {
  supplierNote: string;
  supplierCode: string | null;
  isPurchased: boolean;
  punteo: number;
  oro: number;
  rendimiento: number;
  precioPromQ: number;
}

interface ParsedSubproducto {
  contenedores: number;
  oroPerCont: number;
  precioSinIVA: number;
}

interface ParsedBlock {
  sheetName: string;
  blockIndex: number;
  status: ContractStatus;
  region: string;
  regions: CoffeeRegion[];
  numContainers: number;
  posicion: number | null;
  embarque: number | null;
  gastosPerSaco: number;
  contracts: ParsedContract[];
  materiaPrima: ParsedMP[];
  subproducto: ParsedSubproducto | null;
}

// ── Sheet row helper ─────────────────────────────────────────────────────────

function getRows(wb: XLSX.WorkBook, name: string): RawRow[] {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Sheet "${name}" not found`);
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as RawRow[];
}

// ── Column detection ─────────────────────────────────────────────────────────

interface ColMap {
  cliente: number;
  estatus: number;
  contrato: number;
  puntaje: number;
  sacos69: number;
  bolsa: number;
  diferencial: number;
  lote: number;
}

function findHeaderAndCols(
  rows: RawRow[],
  startRow: number,
  endRow: number
): { headerRow: number; cols: ColMap } | null {
  for (let i = startRow; i < Math.min(startRow + 10, endRow); i++) {
    const row = rows[i];
    if (!row) continue;
    const cells = row.map((c) => safeStr(c).toUpperCase());
    const puntajeIdx = cells.indexOf("PUNTAJE");
    const sacos69Idx = cells.findIndex((c) => c.includes("69 KG"));
    if (puntajeIdx < 0 || sacos69Idx < 0) continue;

    const cols: ColMap = {
      cliente: cells.findIndex((c) => c === "CLIENTE"),
      estatus: cells.findIndex((c) => c === "ESTATUS"),
      contrato: cells.findIndex((c) => c === "CONTRATO"),
      puntaje: puntajeIdx,
      sacos69: sacos69Idx,
      bolsa: cells.findIndex((c) => c === "BOLSA"),
      diferencial: cells.findIndex((c) => c === "DIFERENCIAL"),
      lote: cells.findIndex((c) => c === "LOTE"),
    };
    return { headerRow: i, cols };
  }
  return null;
}

// ── Block parser ─────────────────────────────────────────────────────────────

function parseSheet(wb: XLSX.WorkBook, sheetName: string): ParsedBlock[] {
  const rows = getRows(wb, sheetName);
  const blocks: ParsedBlock[] = [];

  // Find STATUS: markers
  const statusRowIdxs: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    for (const cell of row) {
      const s = safeStr(cell).toUpperCase();
      if (s === "STATUS:" || s.startsWith("STATUS:")) {
        statusRowIdxs.push(i);
        break;
      }
    }
  }

  if (statusRowIdxs.length === 0) return blocks;

  for (let bi = 0; bi < statusRowIdxs.length; bi++) {
    const blockStart = statusRowIdxs[bi];
    const blockEnd = bi + 1 < statusRowIdxs.length ? statusRowIdxs[bi + 1] : rows.length;
    const statusRow = rows[blockStart];

    // ── Parse status value ──
    let statusValue = "";
    if (statusRow) {
      for (let c = 0; c < statusRow.length; c++) {
        const s = safeStr(statusRow[c]).toUpperCase();
        if (s === "STATUS:") {
          statusValue = safeStr(statusRow[c + 1]);
          break;
        }
        if (s.startsWith("STATUS:")) {
          statusValue = s.replace("STATUS:", "").trim();
          break;
        }
      }
    }

    // ── Parse container count ──
    let numContainers = 0;
    if (statusRow) {
      for (const cell of statusRow) {
        const m = safeStr(cell).toLowerCase().match(/(\d+)\s*contenedor/);
        if (m) numContainers += parseInt(m[1]);
      }
    }
    if (numContainers === 0) numContainers = 1;

    // ── Parse REGION row (1-4 rows after STATUS) ──
    let region = "";
    let posicion: number | null = null;
    let embarque: number | null = null;
    let gastosPerSaco = 23; // default

    for (let r = blockStart + 1; r < Math.min(blockStart + 5, blockEnd); r++) {
      const row = rows[r];
      if (!row) continue;
      const cells = row.map((c) => safeStr(c).toUpperCase());
      const regionIdx = cells.findIndex(
        (c) => c === "REGION:" || c.startsWith("REGION:")
      );
      if (regionIdx < 0) continue;

      const regionCell = safeStr(rows[r]?.[regionIdx]);
      if (regionCell.toUpperCase() === "REGION:") {
        region = safeStr(rows[r]?.[regionIdx + 1]);
      } else {
        region = regionCell.replace(/REGION:\s*/i, "");
      }

      for (let c = 0; c < row.length; c++) {
        const label = cells[c];
        if (label === "POSICION" || label.includes("POSICION")) {
          const v = row[c + 1];
          if (typeof v === "number") posicion = v;
        }
        if (label.includes("EMBARQUE")) {
          const v = row[c + 1];
          if (typeof v === "number") embarque = v;
        }
        if (label === "GASTOS:" || label.includes("GASTOS:")) {
          const v = row[c + 1];
          if (typeof v === "number" && v >= 15 && v <= 30) gastosPerSaco = v;
        }
      }
      for (let c = regionIdx + 3; c < row.length; c++) {
        const v = safeNum(row[c]);
        if (v >= 20 && v <= 25 && !cells[c]) {
          gastosPerSaco = v;
          break;
        }
      }
      break;
    }

    // ── Find header row + columns ──
    const hdr = findHeaderAndCols(rows, blockStart, blockEnd);
    if (!hdr) continue;
    const { headerRow, cols } = hdr;

    // ── Parse contract rows ──
    const contracts: ParsedContract[] = [];
    let lastClient = "";
    const sheetDefaultClient = sheetName.toUpperCase().includes("SUCAFINA")
      ? "Sucafina Specialty"
      : sheetName;

    for (let r = headerRow + 1; r < blockEnd; r++) {
      const row = rows[r];
      if (!row) continue;

      // Stop at totals/empty
      if (row.every((c) => c === null)) break;
      if (row.some((c) => safeStr(c).toUpperCase() === "TOTAL")) break;

      const puntaje = safeNum(row[cols.puntaje]);
      const sacos69 = safeNum(row[cols.sacos69]);

      // Allow non-numeric puntaje (e.g. "SHB") — treat as 0 but still import
      const rawPuntaje = safeStr(row[cols.puntaje]);
      const isNonNumericPuntaje = rawPuntaje !== "" && puntaje === 0;

      if (sacos69 === 0) break;
      // If puntaje is 0 AND raw value is empty, it's a blank row — stop
      if (puntaje === 0 && !isNonNumericPuntaje) break;

      // ── Phantom total row detection ──
      // When BOTH CLIENTE and CONTRATO columns exist in the header,
      // a row with BOTH empty is a summary/total row — skip it
      let clientName =
        cols.cliente >= 0 ? safeStr(row[cols.cliente]) : "";
      const contractNum =
        cols.contrato >= 0 ? safeStr(row[cols.contrato]) : "";

      if (cols.cliente >= 0 && cols.contrato >= 0 && !clientName && !contractNum && contracts.length > 0) {
        // Phantom total detection: no client + no contract when both columns exist.
        // Break if: (a) sacos matches running sum, or (b) 2+ contracts above (always a total)
        const runningSum = contracts.reduce((sum, c) => sum + c.sacos69kg, 0);
        if (contracts.length >= 2 || Math.abs(sacos69 - runningSum) < 0.01) {
          break;
        }
      }

      if (!clientName) clientName = lastClient || sheetDefaultClient;
      if (clientName) lastClient = clientName;

      const resolved = resolveClient(clientName);
      const rowStatus =
        cols.estatus >= 0 ? safeStr(row[cols.estatus]) : "";

      contracts.push({
        clientName: resolved.name,
        clientCode: resolved.code,
        contractNumber:
          contractNum &&
          contractNum !== "No asigando" &&
          contractNum !== "No asignado" &&
          contractNum !== "Pendiente"
            ? contractNum
            : `PEND-${sheetName.substring(0, 3).toUpperCase()}-${bi}-${r}`,
        status: rowStatus ? parseRowStatus(rowStatus) : parseBlockStatus(statusValue),
        puntaje,
        sacos69kg: sacos69,
        precioBolsa: cols.bolsa >= 0 ? safeNum(row[cols.bolsa]) : 0,
        diferencial: cols.diferencial >= 0 ? safeNum(row[cols.diferencial]) : 0,
        lote: cols.lote >= 0 ? safeStr(row[cols.lote]) || null : null,
        gastosPerSaco,
      });
    }

    // ── Post-process: remove phantom total row at end of contracts ──
    // For blocks without CLIENTE column, the total row has sacos = sum of all others
    if (contracts.length >= 2 && cols.cliente < 0) {
      const lastContract = contracts[contracts.length - 1];
      const sumOthers = contracts
        .slice(0, -1)
        .reduce((sum, c) => sum + c.sacos69kg, 0);
      if (Math.abs(lastContract.sacos69kg - sumOthers) < 0.01) {
        contracts.pop();
      }
    }

    // ── Parse Materia Prima section ──
    const materiaPrima: ParsedMP[] = [];
    let mpHeaderRow = -1;

    for (let r = headerRow; r < blockEnd; r++) {
      const row = rows[r];
      if (!row) continue;
      if (row.some((c) => safeStr(c).toUpperCase() === "PUNTEO")) {
        mpHeaderRow = r;
        break;
      }
    }

    if (mpHeaderRow >= 0) {
      const mpHdr = rows[mpHeaderRow]!;
      const mpCells = mpHdr.map((c) => safeStr(c).toUpperCase());
      const mpPunteoCol = mpCells.indexOf("PUNTEO");
      const mpOroCol = mpCells.indexOf("ORO");
      const mpRendCol = mpCells.findIndex((c) => c.includes("RENDIMIENTO"));
      const mpPromQCol = mpCells.findIndex(
        (c) => c.includes("PROM") && c.includes("Q")
      );

      for (let r = mpHeaderRow + 1; r < blockEnd; r++) {
        const row = rows[r];
        if (!row) continue;
        if (row.some((c) => safeStr(c).toUpperCase() === "TOTAL")) break;

        const punteo = safeNum(row[mpPunteoCol]);
        const oro = safeNum(row[mpOroCol]);
        // Allow punteo=0 for non-numeric grades (e.g. "SHB") as long as oro > 0
        if (oro === 0) continue;

        const rendimiento = safeNum(row[mpRendCol]) || 1.32;
        const promQ = safeNum(row[mpPromQCol]);

        // Supplier note is the text cell before the numeric MP columns
        let supplierNote = "";
        for (let c = 0; c < mpPunteoCol; c++) {
          const cell = safeStr(row[c]);
          if (
            cell.length > 2 &&
            !["Fijado", "No fijado", "No Fijado"].includes(cell) &&
            isNaN(Number(cell))
          ) {
            supplierNote = cell;
          }
        }

        const { code, isPurchased } = matchSupplier(supplierNote);
        materiaPrima.push({
          supplierNote,
          supplierCode: code,
          isPurchased,
          punteo,
          oro,
          rendimiento,
          precioPromQ: promQ,
        });
      }
    }

    // ── Parse Subproducto section ──
    let subproducto: ParsedSubproducto | null = null;

    for (let r = headerRow; r < blockEnd; r++) {
      const row = rows[r];
      if (!row) continue;
      const cells = row.map((c) => safeStr(c).toUpperCase());
      const subIdx = cells.indexOf("SUBPRODUCTO");
      if (subIdx < 0) continue;

      const contIdx = cells.indexOf("CONTENEDORES");
      if (contIdx < 0) continue;

      const dataRow = rows[r + 1];
      if (!dataRow) break;

      const contenedores = safeNum(dataRow[contIdx]);
      const oroPerCont = safeNum(dataRow[contIdx + 1]) || 25;
      const precioSinIVA = safeNum(dataRow[contIdx + 3]) || 2000;

      if (contenedores > 0) {
        subproducto = { contenedores, oroPerCont, precioSinIVA };
      }
      break;
    }

    blocks.push({
      sheetName,
      blockIndex: bi,
      status: parseBlockStatus(statusValue),
      region,
      regions: parseRegions(region),
      numContainers,
      posicion,
      embarque,
      gastosPerSaco,
      contracts,
      materiaPrima,
      subproducto,
    });
  }

  return blocks;
}

// ── Purchase Order parser (Hoja3) ────────────────────────────────────────────

interface ParsedPO {
  orderNumber: string;
  pergamino: number;
  precio: number;
  totalCafe: number;
  fletePorQQ: number;
  totalFlete: number;
  seguridad: number;
  seguro: number;
  cadena: number;
  cargas: number;
  descargas: number;
  costoTotal: number;
  precioPromedio: number;
}

function parsePurchaseOrders(wb: XLSX.WorkBook): ParsedPO[] {
  const rows = getRows(wb, "Hoja3");
  const orders: ParsedPO[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const first = safeStr(row[0]);
    if (!first.startsWith("OC-")) continue;

    orders.push({
      orderNumber: first,
      pergamino: safeNum(row[1]),
      precio: safeNum(row[2]),
      totalCafe: safeNum(row[3]),
      fletePorQQ: safeNum(row[4]),
      totalFlete: safeNum(row[5]),
      seguridad: safeNum(row[6]),
      seguro: safeNum(row[7]),
      cadena: safeNum(row[8]),
      cargas: safeNum(row[9]),
      descargas: safeNum(row[10]),
      costoTotal: safeNum(row[11]),
      precioPromedio: safeNum(row[13]),
    });
  }

  return orders;
}

// ── K-Finos Account parser ───────────────────────────────────────────────────

interface ParsedAccountEntry {
  orderCode: string;
  ingresoNum: number;
  date: Date;
  pergamino: number;
  precio: number;
}

function parseKfinosAccount(wb: XLSX.WorkBook): ParsedAccountEntry[] {
  const rows = getRows(wb, "ESTADO CUENTA KFINOS");
  const entries: ParsedAccountEntry[] = [];

  // 3 parallel column groups (0-indexed):
  // Group 1: FECHA=0, ORDEN=1, INGRESO=2, PEGAMINO=3, PRECIO=4, TOTAL=5
  // Group 2: FECHA=7, ORDEN=8, INGRESO=9, PEGAMINO=10, PRECIO=11, TOTAL=12
  // Group 3: FECHA=14, ORDEN=15, INGRESO=16, PEGAMINO=17, PRECIO=18, TOTAL=19
  const colGroups = [
    { dateCol: 0, orderCol: 1, ingresoCol: 2, pergCol: 3, precioCol: 4 },
    { dateCol: 7, orderCol: 8, ingresoCol: 9, pergCol: 10, precioCol: 11 },
    { dateCol: 14, orderCol: 15, ingresoCol: 16, pergCol: 17, precioCol: 18 },
  ];

  // Data starts at row 1 (row 0 is header)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    // Process each column group independently
    for (const grp of colGroups) {
      const orderCode = safeStr(row[grp.orderCol]);
      const ingreso = safeNum(row[grp.ingresoCol]);
      const perg = safeNum(row[grp.pergCol]);
      const precio = safeNum(row[grp.precioCol]);

      // Skip non-data rows: TOTAL rows, empty rows, header-like rows
      if (!orderCode || orderCode === "TOTAL" || orderCode === "ORDEN") continue;
      if (ingreso === 0 || perg === 0) continue;

      const dateVal = row[grp.dateCol];
      let date: Date | null = null;
      if (typeof dateVal === "number") date = excelSerialToDate(dateVal);
      else if (dateVal instanceof Date) date = dateVal;
      if (!date) continue;

      entries.push({ orderCode, ingresoNum: ingreso, date, pergamino: perg, precio });
    }
  }

  return entries;
}

// ── Shipment name & month resolver ───────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  Enero: 1,
  Febrero: 2,
  Marzo: 3,
  Abril: 4,
  Mayo: 5,
  Negociacion: 6,
};

function shipmentMeta(
  sheetName: string,
  blockIndex: number,
  totalBlocks: number
): { name: string; month: number; year: number } {
  const month = MONTH_MAP[sheetName] ?? 7;
  const year = 2026;
  const suffix = totalBlocks > 1 ? ` - Bloque ${blockIndex + 1}` : "";
  return { name: `${sheetName} ${year}${suffix}`, month, year };
}

function clientShipmentMeta(
  sheetName: string,
  blockIndex: number,
  totalBlocks: number
): { name: string; month: number; year: number } {
  const month =
    sheetName === "SERENGETTI" ? 1 :
    sheetName === "onyx" ? 2 :
    sheetName === "SUCAFINA SPECIALTY" ? 3 : 7;
  const year = 2025;
  const suffix = totalBlocks > 1 ? ` - Bloque ${blockIndex + 1}` : "";
  return { name: `${sheetName}${suffix}`, month, year };
}

// ── Main import ──────────────────────────────────────────────────────────────

async function main() {
  console.log("📊 Reading Excel file:", EXCEL_PATH);
  const wb = XLSX.readFile(EXCEL_PATH);

  // ── Parse all sheets ──
  const MONTHLY_SHEETS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Negociacion"];
  const CLIENT_SHEETS = ["SERENGETTI", "SUCAFINA SPECIALTY", "onyx"];

  const allBlocks: ParsedBlock[] = [];
  for (const name of [...MONTHLY_SHEETS, ...CLIENT_SHEETS]) {
    try {
      const blocks = parseSheet(wb, name);
      allBlocks.push(...blocks);
      console.log(`  📄 ${name}: ${blocks.length} block(s), ${blocks.reduce((s, b) => s + b.contracts.length, 0)} contracts, ${blocks.reduce((s, b) => s + b.materiaPrima.length, 0)} MP`);
    } catch (err) {
      console.error(`  ❌ ${name}: ${(err as Error).message}`);
    }
  }

  const purchaseOrders = parsePurchaseOrders(wb);
  console.log(`  📄 Hoja3: ${purchaseOrders.length} purchase orders`);

  const kfinosEntries = parseKfinosAccount(wb);
  console.log(`  📄 ESTADO CUENTA KFINOS: ${kfinosEntries.length} entries`);

  // Count totals before import
  const totalContracts = allBlocks.reduce((s, b) => s + b.contracts.length, 0);
  const totalMP = allBlocks.reduce((s, b) => s + b.materiaPrima.length, 0);
  const totalSub = allBlocks.filter(b => b.subproducto).length;
  console.log(`\n  📊 Parsed totals: ${allBlocks.length} blocks, ${totalContracts} contracts, ${totalMP} MP, ${totalSub} sub, ${kfinosEntries.length} entries`);

  console.log(`\n🔄 Importing into database...\n`);

  // Track created contract numbers to deduplicate across sheets
  // Only dedup real contract numbers (P####), not generated PEND- ones
  const createdContracts = new Set<string>();

  let stats = {
    clients: 0,
    shipments: 0,
    contracts: 0,
    contractsSkipped: 0,
    materiaPrima: 0,
    subproductos: 0,
    purchaseOrders: 0,
    supplierEntries: 0,
  };

  // ── Ensure all clients exist ──
  const seenClientCodes = new Set<string>();
  for (const block of allBlocks) {
    for (const c of block.contracts) {
      if (seenClientCodes.has(c.clientCode)) continue;
      seenClientCodes.add(c.clientCode);
      const existing = await prisma.client.findUnique({ where: { code: c.clientCode } });
      if (!existing) {
        await prisma.client.create({
          data: { name: c.clientName, code: c.clientCode },
        });
        stats.clients++;
        console.log(`  ✅ Client: ${c.clientName} (${c.clientCode})`);
      }
    }
  }

  // ── Get references ──
  const defaultConfig = await prisma.exportCostConfig.findFirst({ where: { isDefault: true } });
  const suppliers = await prisma.supplier.findMany();
  const supplierByCode = new Map(suppliers.map((s) => [s.code, s]));
  const clients = await prisma.client.findMany();
  const clientByCode = new Map(clients.map((c) => [c.code, c]));

  // ── Import blocks ──
  for (const block of allBlocks) {
    const isClientSheet = CLIENT_SHEETS.includes(block.sheetName);
    const blocksInSheet = allBlocks.filter((b) => b.sheetName === block.sheetName);
    const meta = isClientSheet
      ? clientShipmentMeta(block.sheetName, block.blockIndex, blocksInSheet.length)
      : shipmentMeta(block.sheetName, block.blockIndex, blocksInSheet.length);

    // Check for existing shipment with same name
    const existingShipment = await prisma.shipment.findFirst({
      where: { name: meta.name },
    });
    if (existingShipment) {
      console.log(`  ⏩ Shipment already exists: ${meta.name}`);
      continue;
    }

    const shipment = await prisma.shipment.create({
      data: {
        name: meta.name,
        month: meta.month,
        year: meta.year,
        status: "PREPARACION",
        numContainers: block.numContainers,
        regions: block.region || null,
        posicionDate: block.posicion ? excelSerialToDate(block.posicion) : null,
        embarqueDate: block.embarque ? excelSerialToDate(block.embarque) : null,
        gastosPerSaco: block.gastosPerSaco,
        exportCostConfigId: defaultConfig?.id ?? null,
      },
    });
    stats.shipments++;

    // ── Create contracts ──
    for (const c of block.contracts) {
      // Dedup: client sheet contracts with real numbers that already exist from monthly sheets → skip
      // Monthly sheet contracts with duplicate numbers → suffix to make unique
      const isRealNumber = !c.contractNumber.startsWith("PEND-");
      const isClientSheet = CLIENT_SHEETS.includes(block.sheetName);
      if (isRealNumber && createdContracts.has(c.contractNumber)) {
        if (isClientSheet) {
          stats.contractsSkipped++;
          continue;
        }
        // Monthly sheet: same contract split across shipments — suffix with block info
        c.contractNumber = `${c.contractNumber}-${block.sheetName.substring(0, 3).toUpperCase()}${block.blockIndex + 1}`;
      }

      const client = clientByCode.get(c.clientCode);
      if (!client) {
        console.error(`    ❌ Client not found: ${c.clientCode}`);
        continue;
      }

      await prisma.contract.create({
        data: {
          contractNumber: c.contractNumber,
          clientId: client.id,
          shipmentId: shipment.id,
          status: c.status,
          regions: block.regions,
          puntaje: c.puntaje,
          sacos69kg: c.sacos69kg,
          sacos46kg: c.sacos69kg * 1.5,
          rendimiento: 1.32,
          precioBolsa: c.precioBolsa || null,
          diferencial: c.diferencial || null,
          precioBolsaDif:
            c.precioBolsa && c.diferencial
              ? c.precioBolsa + c.diferencial
              : c.precioBolsa || null,
          tipoCambio: 7.65,
          lote: c.lote,
          exportCostConfigId: defaultConfig?.id ?? null,
          cosecha: "25/26",
        },
      });
      if (isRealNumber) createdContracts.add(c.contractNumber);
      stats.contracts++;
    }

    // ── Create materia prima ──
    for (const mp of block.materiaPrima) {
      const supplier = mp.supplierCode
        ? supplierByCode.get(mp.supplierCode)
        : null;
      const pergamino = mp.oro * mp.rendimiento;
      const totalMP = pergamino * mp.precioPromQ;

      await prisma.materiaPrima.create({
        data: {
          shipmentId: shipment.id,
          supplierId: supplier?.id ?? null,
          supplierNote: mp.supplierNote || null,
          isPurchased: mp.isPurchased,
          punteo: mp.punteo,
          oro: mp.oro,
          rendimiento: mp.rendimiento,
          pergamino,
          precioPromQ: mp.precioPromQ,
          totalMP,
        },
      });
      stats.materiaPrima++;
    }

    // ── Create subproducto ──
    if (block.subproducto) {
      const sub = block.subproducto;
      const totalOro = sub.contenedores * sub.oroPerCont;
      const totalPerga = totalOro * sub.precioSinIVA;

      await prisma.subproducto.create({
        data: {
          shipmentId: shipment.id,
          contenedores: sub.contenedores,
          oroPerCont: sub.oroPerCont,
          totalOro,
          precioSinIVA: sub.precioSinIVA,
          totalPerga,
        },
      });
      stats.subproductos++;
    }

    console.log(
      `  ✅ ${meta.name}: ${block.contracts.length} contracts (${stats.contractsSkipped > 0 ? stats.contractsSkipped + ' deduped' : 'all new'}), ${block.materiaPrima.length} MP, ${block.subproducto ? 1 : 0} subproducto`
    );
  }

  // ── Import Purchase Orders ──
  const jdgSupplier = supplierByCode.get("JDG");
  if (jdgSupplier) {
    for (const po of purchaseOrders) {
      const existing = await prisma.purchaseOrder.findUnique({
        where: { orderNumber: po.orderNumber },
      });
      if (existing) continue;

      const costoTotal =
        po.totalCafe +
        po.totalFlete +
        po.seguridad +
        po.seguro +
        po.cadena +
        po.cargas +
        po.descargas;

      await prisma.purchaseOrder.create({
        data: {
          orderNumber: po.orderNumber,
          supplierId: jdgSupplier.id,
          date: new Date("2025-12-01"),
          status: "RECIBIDO",
          cosecha: "25/26",
          quintalesPerg: po.pergamino,
          precioPerg: po.precio,
          totalCafe: po.totalCafe,
          fletePorQQ: po.fletePorQQ,
          totalFlete: po.totalFlete,
          seguridad: po.seguridad,
          seguro: po.seguro,
          cadena: po.cadena,
          cargas: po.cargas,
          descargas: po.descargas,
          costoTotalAccum: costoTotal,
          precioPromedio: po.pergamino > 0 ? costoTotal / po.pergamino : 0,
        },
      });
      stats.purchaseOrders++;
    }
    console.log(`  ✅ ${stats.purchaseOrders} purchase orders`);
  }

  // ── Import K-Finos Account Entries ──
  const kfiSupplier = supplierByCode.get("KFI");
  if (kfiSupplier) {
    for (const entry of kfinosEntries) {
      await prisma.supplierAccountEntry.create({
        data: {
          supplierId: kfiSupplier.id,
          orderCode: entry.orderCode,
          ingresoNum: entry.ingresoNum,
          date: entry.date,
          pergamino: entry.pergamino,
          precio: entry.precio,
          total: entry.pergamino * entry.precio,
        },
      });
      stats.supplierEntries++;
    }
    console.log(`  ✅ ${stats.supplierEntries} K-Finos account entries`);
  }

  // ── Recalculate all contracts and shipment aggregations ──
  console.log("\n📊 Recalculating contract fields and shipment aggregations...");

  const SACO_CONV = new Decimal("1.5");
  const LBS_KGS = new Decimal("1.01411");
  const COM_PER_QQ = new Decimal("1.50");
  const LBS_PER_KG = new Decimal("2.2046");

  const allShipments = await prisma.shipment.findMany({
    include: { contracts: true, materiaPrima: true, subproductos: true },
  });

  for (const ship of allShipments) {
    const gastosPerSaco = new Decimal(Number(ship.gastosPerSaco) || 23);

    // Calculate each contract
    for (const c of ship.contracts) {
      const sacos69 = new Decimal(Number(c.sacos69kg));
      const bolsa = new Decimal(Number(c.precioBolsa) || 0);
      const dif = new Decimal(Number(c.diferencial) || 0);
      const tc = new Decimal(Number(c.tipoCambio) || 7.65);

      const sacos46 = sacos69.mul(SACO_CONV);
      const precioBolsaDif = bolsa.plus(dif);

      let facturacionLbs: Decimal;
      if (c.tipoFacturacion === "LIBRAS_ESPANOLAS") {
        facturacionLbs = sacos69.mul(69).mul(LBS_PER_KG).mul(precioBolsaDif.div(100));
      } else {
        facturacionLbs = sacos46.mul(precioBolsaDif);
      }

      const facturacionKgs = facturacionLbs.mul(LBS_KGS);
      const gastosExport = gastosPerSaco.mul(sacos69);
      const utilidadSinGE = facturacionKgs.minus(gastosExport);
      const comisionCompra = sacos46.mul(COM_PER_QQ);
      const comisionVenta = sacos46.mul(COM_PER_QQ);

      let costoFinanciero = new Decimal(0);
      if (c.costoFinanciero != null) {
        costoFinanciero = new Decimal(Number(c.costoFinanciero));
      } else if (c.montoCredito != null && Number(c.montoCredito) > 0) {
        costoFinanciero = new Decimal(Number(c.montoCredito))
          .mul(new Decimal("0.08").div(12))
          .mul(2)
          .div(tc);
      }

      const utilidadSinCF = utilidadSinGE.minus(costoFinanciero);
      const totalPagoQTZ = utilidadSinCF.mul(tc);

      await prisma.contract.update({
        where: { id: c.id },
        data: {
          sacos46kg: sacos46.toNumber(),
          precioBolsaDif: precioBolsaDif.toNumber(),
          facturacionLbs: facturacionLbs.toNumber(),
          facturacionKgs: facturacionKgs.toNumber(),
          gastosExport: gastosExport.toNumber(),
          utilidadSinGE: utilidadSinGE.toNumber(),
          costoFinanciero: costoFinanciero.toNumber(),
          utilidadSinCF: utilidadSinCF.toNumber(),
          totalPagoQTZ: totalPagoQTZ.toNumber(),
          comisionCompra: comisionCompra.toNumber(),
          comisionVenta: comisionVenta.toNumber(),
          computedAt: new Date(),
        },
      });
    }

    // Aggregate shipment totals
    const updatedContracts = await prisma.contract.findMany({
      where: { shipmentId: ship.id },
    });

    let totSacos46 = new Decimal(0);
    let totFactLbs = new Decimal(0);
    let totFactKgs = new Decimal(0);
    let totGastos = new Decimal(0);
    let totUtilSinGE = new Decimal(0);
    let totCostoFin = new Decimal(0);
    let totUtilSinCF = new Decimal(0);
    let totPagoQTZ = new Decimal(0);
    let totComision = new Decimal(0);

    for (const c of updatedContracts) {
      totSacos46 = totSacos46.plus(new Decimal(Number(c.sacos46kg)));
      totFactLbs = totFactLbs.plus(new Decimal(Number(c.facturacionLbs) || 0));
      totFactKgs = totFactKgs.plus(new Decimal(Number(c.facturacionKgs) || 0));
      totGastos = totGastos.plus(new Decimal(Number(c.gastosExport) || 0));
      totUtilSinGE = totUtilSinGE.plus(new Decimal(Number(c.utilidadSinGE) || 0));
      totCostoFin = totCostoFin.plus(new Decimal(Number(c.costoFinanciero) || 0));
      totUtilSinCF = totUtilSinCF.plus(new Decimal(Number(c.utilidadSinCF) || 0));
      totPagoQTZ = totPagoQTZ.plus(new Decimal(Number(c.totalPagoQTZ) || 0));
      const comC = new Decimal(Number(c.comisionCompra) || 0);
      const comV = new Decimal(Number(c.comisionVenta) || 0);
      totComision = totComision.plus(comC).plus(comV);
    }

    const totMP = ship.materiaPrima.reduce(
      (sum, mp) => sum.plus(new Decimal(Number(mp.totalMP))),
      new Decimal(0)
    );
    const totSub = ship.subproductos.reduce(
      (sum, sp) => sum.plus(new Decimal(Number(sp.totalPerga))),
      new Decimal(0)
    );

    const utilidadBruta = totPagoQTZ.minus(totMP).plus(totSub).minus(totComision);
    const margenBruto = totPagoQTZ.isZero()
      ? new Decimal(0)
      : utilidadBruta.div(totPagoQTZ);

    await prisma.shipment.update({
      where: { id: ship.id },
      data: {
        totalSacos69: updatedContracts.reduce((s, c) => s + Number(c.sacos69kg), 0),
        totalSacos46: totSacos46.toNumber(),
        totalFacturacionLbs: totFactLbs.toNumber(),
        totalFacturacionKgs: totFactKgs.toNumber(),
        totalGastosExport: totGastos.toNumber(),
        totalUtilidadSinGE: totUtilSinGE.toNumber(),
        totalCostoFinanc: totCostoFin.toNumber(),
        totalUtilidadSinCF: totUtilSinCF.toNumber(),
        totalPagoQTZ: totPagoQTZ.toNumber(),
        totalMateriaPrima: totMP.toNumber(),
        totalComision: totComision.toNumber(),
        totalSubproducto: totSub.toNumber(),
        utilidadBruta: utilidadBruta.toNumber(),
        margenBruto: margenBruto.toNumber(),
        aggregatedAt: new Date(),
      },
    });

    console.log(`  ✅ ${ship.name}: Q${totPagoQTZ.toFixed(2)} revenue, ${margenBruto.mul(100).toFixed(2)}% margin`);
  }

  console.log("\n🎉 Import complete!\n");
  console.log("  Clients created:", stats.clients);
  console.log("  Shipments created:", stats.shipments);
  console.log("  Contracts created:", stats.contracts, `(${stats.contractsSkipped} duplicates skipped)`);
  console.log("  Materia Prima created:", stats.materiaPrima);
  console.log("  Subproductos created:", stats.subproductos);
  console.log("  Purchase Orders created:", stats.purchaseOrders);
  console.log("  Supplier Entries created:", stats.supplierEntries);
}

main()
  .catch((err) => {
    console.error("❌ Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
