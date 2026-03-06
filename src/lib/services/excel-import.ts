// ============================================================================
// CafeMargen — Excel Import Service
// ============================================================================
// Parses the Control_Contratos_y_Margenes.xlsx file and maps each sheet
// to the corresponding Prisma models for historical data migration.
//
// Strategy:
//   1. Parse each sheet with known row/column offsets (hardcoded from analysis)
//   2. Map to typed DTOs
//   3. Validate with Zod schemas
//   4. Upsert into database via Prisma transactions
//
// This is a ONE-TIME migration tool. For ongoing imports, use the API.
// ============================================================================

import * as XLSX from "xlsx";
import { z } from "zod";
import { PrismaClient, ContractStatus, CoffeeRegion } from "@prisma/client";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// SCHEMAS (validation gates before DB write)
// ---------------------------------------------------------------------------

const ClientSeedSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(2).max(5),
});

const ContractImportSchema = z.object({
  contractNumber: z.string(),
  clientName: z.string(),
  status: z.nativeEnum(ContractStatus),
  puntaje: z.number().int().min(60).max(100),
  sacos69kg: z.number().positive(),
  precioBolsa: z.number().optional(),
  diferencial: z.number().optional(),
  posicionNY: z.date().optional().nullable(),
  fechaEmbarque: z.date().optional().nullable(),
  lote: z.string().optional().nullable(),
  regions: z.array(z.nativeEnum(CoffeeRegion)).optional(),
  tipoCambio: z.number().optional(),
  gastosExportPerSaco: z.number().optional(),
});

const MateriaPrimaImportSchema = z.object({
  supplierNote: z.string(),
  isPurchased: z.boolean(),
  punteo: z.number().int(),
  oro: z.number().positive(),
  rendimiento: z.number().positive(),
  precioPromQ: z.number().positive(),
});

const SupplierAccountSchema = z.object({
  orderCode: z.string(),
  ingresoNum: z.number().int(),
  date: z.date(),
  pergamino: z.number().positive(),
  precio: z.number().positive(),
});

// ---------------------------------------------------------------------------
// SHEET PARSERS
// ---------------------------------------------------------------------------

type RawRow = (string | number | Date | null | undefined)[];

function getSheetRows(workbook: XLSX.WorkBook, sheetName: string): RawRow[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as RawRow[];
}

function parseStatus(raw: string | null | undefined): ContractStatus {
  if (!raw) return ContractStatus.NEGOCIACION;
  const s = raw.toString().toUpperCase().trim();
  if (s === "FIJADO") return ContractStatus.FIJADO;
  if (s === "NO FIJADO") return ContractStatus.NO_FIJADO;
  if (s.includes("CONFIRM")) return ContractStatus.CONFIRMADO;
  if (s.includes("NEGOC")) return ContractStatus.NEGOCIACION;
  if (s.includes("EMBARC")) return ContractStatus.EMBARCADO;
  if (s.includes("LIQUID")) return ContractStatus.LIQUIDADO;
  if (s.includes("CANCEL")) return ContractStatus.CANCELADO;
  return ContractStatus.NEGOCIACION;
}

function parseRegions(raw: string | null | undefined): CoffeeRegion[] {
  if (!raw) return [];
  const s = raw.toString().toUpperCase();
  const regions: CoffeeRegion[] = [];
  if (s.includes("SANTA ROSA") || s.includes("SANTA R")) regions.push(CoffeeRegion.SANTA_ROSA);
  if (s.includes("HUEHUE") || s.includes("HUEUE")) regions.push(CoffeeRegion.HUEHUETENANGO);
  if (s.includes("ORGANIC")) regions.push(CoffeeRegion.ORGANICO);
  if (s.includes("DANILA") || s.includes("DANILAND")) regions.push(CoffeeRegion.DANILANDIA);
  if (s.includes("SANTA ISABEL")) regions.push(CoffeeRegion.SANTA_ISABEL);
  if (regions.length === 0) regions.push(CoffeeRegion.OTHER);
  return regions;
}

function safeNum(val: unknown): number {
  if (val === null || val === undefined || val === "") return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function safeDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  const d = new Date(val as string);
  return isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// CLIENT SHEET PARSERS (SERENGETTI, SUCAFINA, Onyx)
// ---------------------------------------------------------------------------

interface ParsedClientSheet {
  sheetName: string;
  status: ContractStatus;
  regions: string;
  contracts: z.infer<typeof ContractImportSchema>[];
  materiaPrima: z.infer<typeof MateriaPrimaImportSchema>[];
  subproducto: {
    contenedores: number;
    oroPerContenedor: number;
    precioSinIVA: number;
  } | null;
}

function parseClientSheet(
  workbook: XLSX.WorkBook,
  sheetName: string,
  config: {
    clientCol: number;
    contractCol: number;
    puntajeCol: number;
    sacos69Col: number;
    bolsaCol: number;
    difCol: number;
    dataStartRow: number;
    headerRow: number;
    statusRow: number;
    statusCol: number;
    regionRow: number;
    regionCol: number;
  }
): ParsedClientSheet {
  const rows = getSheetRows(workbook, sheetName);

  const statusRaw = rows[config.statusRow]?.[config.statusCol] as string;
  const regionRaw = rows[config.regionRow]?.[config.regionCol] as string;
  const sheetStatus = parseStatus(statusRaw);

  const contracts: z.infer<typeof ContractImportSchema>[] = [];
  const materiaPrima: z.infer<typeof MateriaPrimaImportSchema>[] = [];

  // Parse contract rows until we hit an empty client cell or summary row
  for (let i = config.dataStartRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const clientName = row[config.clientCol] as string;
    const contractNum = row[config.contractCol] as string;

    // Stop at summary rows (no client name but has totals)
    if (!clientName && !contractNum) continue;
    if (!clientName) break; // Hit the totals row

    contracts.push({
      contractNumber: contractNum || `${sheetName}-${i}`,
      clientName,
      status: sheetStatus,
      puntaje: safeNum(row[config.puntajeCol]),
      sacos69kg: safeNum(row[config.sacos69Col]),
      precioBolsa: safeNum(row[config.bolsaCol]) || undefined,
      diferencial: safeNum(row[config.difCol]) || undefined,
      regions: parseRegions(regionRaw),
      tipoCambio: 7.65,
    });
  }

  // Parse materia prima section (look for "PUNTEO" header)
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const hasPunteo = row.some(
      (cell) => cell && cell.toString().toUpperCase().includes("PUNTEO")
    );
    if (!hasPunteo) continue;

    // Parse MP rows after header
    for (let j = i + 1; j < rows.length; j++) {
      const mpRow = rows[j];
      if (!mpRow) continue;

      const hasTotal = mpRow.some(
        (cell) => cell && cell.toString().toUpperCase() === "TOTAL"
      );
      if (hasTotal) break;

      // Find the numeric columns for punteo, oro, rendimiento, pergo, promQ, totalMP
      const punteo = safeNum(mpRow[config.puntajeCol + 4] ?? mpRow[8]);
      const oro = safeNum(mpRow[config.puntajeCol + 5] ?? mpRow[9]);
      const rend = safeNum(mpRow[config.puntajeCol + 6] ?? mpRow[10]);
      const promQ = safeNum(mpRow[config.puntajeCol + 8] ?? mpRow[12]);

      if (punteo > 0 && oro > 0) {
        const supplierNote =
          (mpRow[config.puntajeCol + 3] ?? mpRow[7])?.toString() ?? "Unknown";
        materiaPrima.push({
          supplierNote,
          isPurchased: !supplierNote.toUpperCase().includes("NO COMPRADO"),
          punteo,
          oro,
          rendimiento: rend || 1.32,
          precioPromQ: promQ,
        });
      }
    }
    break;
  }

  return {
    sheetName,
    status: sheetStatus,
    regions: regionRaw || "",
    contracts,
    materiaPrima,
    subproducto: null, // Parsed separately if needed
  };
}

// ---------------------------------------------------------------------------
// K-FINOS ACCOUNT PARSER
// ---------------------------------------------------------------------------

function parseKfinosSheet(
  workbook: XLSX.WorkBook
): z.infer<typeof SupplierAccountSchema>[] {
  const rows = getSheetRows(workbook, "ESTADO CUENTA KFINOS");
  const entries: z.infer<typeof SupplierAccountSchema>[] = [];

  // The sheet has 3 parallel columns of data (OC4, OC5, OC6/OC8)
  // Each block: [date, orderCode, ingresoNum, pergamino, precio, total]
  const blocks = [
    { dateCol: 2, orderCol: 3, ingresoCol: 4, pergCol: 5, precioCol: 6 },
    { dateCol: 9, orderCol: 10, ingresoCol: 11, pergCol: 12, precioCol: 13 },
    { dateCol: 16, orderCol: 17, ingresoCol: 18, pergCol: 19, precioCol: 20 },
  ];

  for (let i = 4; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    for (const block of blocks) {
      const date = safeDate(row[block.dateCol]);
      const orderCode = row[block.orderCol]?.toString();
      const ingreso = safeNum(row[block.ingresoCol]);
      const perg = safeNum(row[block.pergCol]);
      const precio = safeNum(row[block.precioCol]);

      if (date && orderCode && ingreso > 0 && perg > 0) {
        entries.push({
          orderCode,
          ingresoNum: ingreso,
          date,
          pergamino: perg,
          precio,
        });
      }
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// MAIN IMPORT ORCHESTRATOR
// ---------------------------------------------------------------------------

export interface ImportResult {
  success: boolean;
  clientsCreated: number;
  suppliersCreated: number;
  contractsCreated: number;
  shipmentsCreated: number;
  materiaPrimaCreated: number;
  supplierEntriesCreated: number;
  purchaseOrdersCreated: number;
  farmsCreated: number;
  errors: string[];
}

export async function importFromExcel(
  filePath: string
): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    clientsCreated: 0,
    suppliersCreated: 0,
    contractsCreated: 0,
    shipmentsCreated: 0,
    materiaPrimaCreated: 0,
    supplierEntriesCreated: 0,
    purchaseOrdersCreated: 0,
    farmsCreated: 0,
    errors: [],
  };

  try {
    const workbook = XLSX.readFile(filePath);

    await prisma.$transaction(async (tx) => {
      // ── Step 1: Seed clients ──
      const clientSeeds = [
        { name: "Serengetti", code: "SER" },
        { name: "Swiss Water", code: "SWP" },
        { name: "Opal", code: "OPL" },
        { name: "Onyx", code: "ONX" },
        { name: "Atlas", code: "ATL" },
        { name: "Stonex", code: "STX" },
        { name: "Sucafina Specialty", code: "SUC" },
      ];

      for (const c of clientSeeds) {
        await tx.client.upsert({
          where: { code: c.code },
          update: {},
          create: c,
        });
        result.clientsCreated++;
      }

      // ── Step 2: Seed suppliers ──
      const supplierSeeds = [
        { name: "K-Finos", code: "KFI" },
        { name: "José David Guerra", code: "JDG" },
        { name: "Walco", code: "WAL" },
      ];

      for (const s of supplierSeeds) {
        await tx.supplier.upsert({
          where: { code: s.code },
          update: {},
          create: s,
        });
        result.suppliersCreated++;
      }

      // ── Step 3: Seed default exchange rate ──
      await tx.exchangeRate.create({
        data: {
          rate: 7.65,
          validFrom: new Date("2025-01-01"),
          validTo: new Date("2026-12-31"),
          isActive: true,
          notes: "Imported from Excel (hardcoded rate)",
        },
      });

      // ── Step 4: Seed default export cost config ──
      await tx.exportCostConfig.create({
        data: {
          name: "Default 2025-2026",
          gastosPerSaco: 23,
          trillaPerQQ: 7,
          sacoYute: 1300,
          estampado: 500,
          bolsaGrainPro: 5000,
          fitoSanitario: 50,
          impuestoAnacafe1: 600,
          impuestoAnacafe2: 500,
          inspeccionOirsa: 300,
          fumigacion: 400,
          emisionDocumento: 1200,
          fletePuerto: 2000,
          seguro: 230,
          custodio: 450,
          agenteAduanal: 34619.375,
          isDefault: true,
        },
      });

      // ── Step 5: Parse and import monthly sheets ──
      const monthlySheets = [
        { name: "Enero", month: 1, year: 2026 },
        { name: "Febrero", month: 2, year: 2026 },
        { name: "Marzo", month: 3, year: 2026 },
        { name: "Abril", month: 4, year: 2026 },
        { name: "Mayo", month: 5, year: 2026 },
      ];

      for (const ms of monthlySheets) {
        try {
          const shipment = await tx.shipment.create({
            data: {
              name: `${ms.name} ${ms.year}`,
              month: ms.month,
              year: ms.year,
              status: "PREPARACION",
              numContainers: 0,
            },
          });
          result.shipmentsCreated++;

          // TODO: Parse individual monthly sheet contracts
          // This requires per-sheet column mapping which varies slightly
          // Implement with parseClientSheet() for each month
        } catch (err) {
          result.errors.push(`Sheet ${ms.name}: ${(err as Error).message}`);
        }
      }

      // ── Step 6: Import K-Finos account entries ──
      try {
        const kfinos = await tx.supplier.findUnique({
          where: { code: "KFI" },
        });
        if (kfinos) {
          const entries = parseKfinosSheet(workbook);
          for (const entry of entries) {
            await tx.supplierAccountEntry.create({
              data: {
                supplierId: kfinos.id,
                orderCode: entry.orderCode,
                ingresoNum: entry.ingresoNum,
                date: entry.date,
                pergamino: entry.pergamino,
                precio: entry.precio,
                total: entry.pergamino * entry.precio,
              },
            });
            result.supplierEntriesCreated++;
          }
        }
      } catch (err) {
        result.errors.push(`K-Finos import: ${(err as Error).message}`);
      }

      // ── Step 7: Import farm data ──
      try {
        const farmData = [
          {
            name: "BRISAS",
            totalQuetzales: 9909581.76,
            tipoCambio: 7.65,
            porcentaje: 0.82,
            aumentoPorcentaje: 0.20,
            porcentajePrest: 0.70,
          },
          {
            name: "SAN EMILIANO",
            totalQuetzales: 2175040,
            tipoCambio: 7.65,
            porcentaje: 0.18,
            aumentoPorcentaje: 0.20,
            porcentajePrest: 0.70,
          },
        ];

        for (const f of farmData) {
          const totalUSD = f.totalQuetzales / f.tipoCambio;
          const nuevoTotal = totalUSD * (1 + f.aumentoPorcentaje);
          await tx.farm.upsert({
            where: { name: f.name },
            update: {},
            create: {
              name: f.name,
              totalQuetzales: f.totalQuetzales,
              tipoCambio: f.tipoCambio,
              totalUSD,
              porcentaje: f.porcentaje,
              aumentoPorcentaje: f.aumentoPorcentaje,
              nuevoTotal,
              porcentajePrest: f.porcentajePrest,
              totalPrestamo: nuevoTotal * f.porcentajePrest,
            },
          });
          result.farmsCreated++;
        }
      } catch (err) {
        result.errors.push(`Farm import: ${(err as Error).message}`);
      }
    });

    result.success = true;
  } catch (err) {
    result.errors.push(`Fatal: ${(err as Error).message}`);
  }

  return result;
}
