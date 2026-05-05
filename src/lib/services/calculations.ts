// ============================================================================
// HOPE COFFEE — Calculation Engine
// ============================================================================
// Replicates ALL Excel formulas as pure, testable functions.
// Every formula is documented with its Excel origin cell/logic.
// Uses Decimal.js for financial precision (no floating-point drift).
// ============================================================================

import Decimal from "decimal.js";

// Configure Decimal.js for financial calculations
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface ContractInput {
  sacos69kg: number;
  /**
   * SCA-style cupping score (typically 81-85+). Required for EXPORTADORA /
   * FINCA_DANILANDIA contracts where the exporter physically cupped the
   * coffee; null/undefined for STOCK_LOT_AFLOAT contracts where the broker never
   * touched the coffee and quality is expressed via `defectos` instead.
   * Not used in any formula — stored for display / legal pass-through.
   * See feedback_no_data_dismissed_quality.md.
   */
  puntaje?: number | null;
  precioBolsa: number;       // USD per 100lb sack
  diferencial: number;        // USD differential
  gastosExportPerSaco: number; // Export cost per 69kg sack
  tipoCambio: number;         // GTQ/USD exchange rate
  costoFinanciero?: number;   // Optional override
  /**
   * Manual facturación kgs override for exceptional legal-document cases.
   * When set, replaces the computed facturacionKgs verbatim. facturacionLbs
   * is set to the same value since there is no separate "libras view" when
   * the override is active (the legal contract literal is what is billed).
   */
  facturacionKgsOverride?: number;
  montoCredito?: number;      // Credit amount in GTQ (for auto financial cost)
  /**
   * Stock-lock cost of goods sold, USD per quintal (= per sacos46kg).
   * Used exclusively for STOCK_LOT_AFLOAT contracts (buy FOB, sell FOB, no MP).
   * When set, calculateContract subtracts `stockLotAfloatCostPerQQ × sacos46kg`
   * from utilidadSinCF before totalPagoQTZ, reflecting the real ~$15/qq
   * financial margin described in business_rules §1.2. Null/undef means no
   * deduction (default for all non-stock-lot-afloat contracts).
   */
  stockLotAfloatCostPerQQ?: number;
}

export interface ContractCalculation {
  sacos46kg: Decimal;
  precioBolsaDif: Decimal;
  facturacionLbs: Decimal;
  facturacionKgs: Decimal;
  gastosExportacion: Decimal;
  utilidadSinGastosExport: Decimal;
  costoFinanciero: Decimal;
  utilidadSinCostoFinanciero: Decimal;
  /**
   * Stock-lock cost of goods in USD = stockLotAfloatCostPerQQ × sacos46kg.
   * 0 when the input has no stockLotAfloatCostPerQQ (every non-stock-lot-afloat case).
   */
  stockLotAfloatCost: Decimal;
  totalPagoQTZ: Decimal;
  comisionCompra: Decimal;
  comisionVenta: Decimal;
  totalComision: Decimal;
}

export interface MateriaPrimaInput {
  punteo: number;
  oro: number;          // sacos 46kg (gold coffee)
  rendimiento: number;  // yield factor (typically 1.32)
  precioPromQ: number;  // average price in Quetzales per quintal pergamino
}

export interface MateriaPrimaCalculation {
  pergamino: Decimal;   // oro × rendimiento
  totalMP: Decimal;     // pergamino × precioPromQ
}

export interface SubproductoInput {
  contenedores: number;
  oroPerContenedor: number; // typically 25
  precioSinIVA: number;     // typically 2000
}

export interface SubproductoCalculation {
  totalOro: Decimal;
  totalPergamino: Decimal;
}

export interface ShipmentMarginResult {
  totalFacturacionQTZ: Decimal;
  totalMateriaPrima: Decimal;
  totalISR: Decimal;
  totalComision: Decimal; // in QTZ
  totalSubproducto: Decimal;
  utilidadBruta: Decimal;
  margenBruto: Decimal; // percentage as decimal
}

export interface PurchaseOrderInput {
  quintalesPergamino: number;
  precioPorQQ: number;
  fletePorQQ: number;
  seguridad: number;
  seguro: number;
  cadena?: number;
  cargas?: number;
  descargas?: number;
}

export interface PurchaseOrderCalculation {
  totalCafe: Decimal;
  totalFlete: Decimal;
  costoTotalAcumulado: Decimal;
  precioPromedio: Decimal;
}

export interface FarmFinancingInput {
  totalQuetzales: number;
  tipoCambio: number;
  aumentoPorcentaje: number; // 0.20 = 20%
  porcentajePrestamo: number; // 0.70 = 70%
}

export interface FarmFinancingCalculation {
  totalUSD: Decimal;
  nuevoTotal: Decimal;
  totalPrestamo: Decimal;
}

// ---------------------------------------------------------------------------
// CONSTANTS (from Excel hardcoded values)
// ---------------------------------------------------------------------------

/** Conversion factor: 69kg sacks → 46kg sacks (×1.5) */
const SACO_CONVERSION = new Decimal("1.5");

/**
 * Kilo conversion factor applied to facturacionLbs.
 * Excel formula: facturacionLbs × 1.01411... (accounts for lb→kg + adjustments)
 * Derived from: (46 / 100) × (100 / 46) × 1.01411 ≈ 1.01411
 */
const LBS_TO_KGS_FACTOR = new Decimal("1.01411");

/** Commission per quintal (100 lb) — buy side and sell side each */
const COMISION_POR_QQ = new Decimal("1.50");

/** Libras españolas conversion: kg per saco × lbs per kg */
const LBS_PER_KG = new Decimal("2.2046");

/** Annual interest rate for financial cost formula */
const TASA_ANUAL = new Decimal("0.08");

/** Typical financing duration in months */
const MESES_FINANCIAMIENTO = new Decimal("2");

// ---------------------------------------------------------------------------
// CONTRACT CALCULATIONS
// ---------------------------------------------------------------------------

/**
 * Calculate all derived fields for a single contract line.
 *
 * Excel mapping (SERENGETTI sheet, row 8):
 *   sacos46kg         = sacos69kg × 1.5                    (col E → col F)
 *   precioBolsaDif    = bolsa + diferencial                 (col H + col I)
 *   facturacionLbs    = sacos46kg × precioBolsaDif          (col J)
 *   facturacionKgs    = facturacionLbs × 1.01411            (col K)
 *   gastosExportacion = gastosPerSaco × sacos46kg           (col L)
 *   utilidadSinGE     = facturacionKgs - gastosExportacion  (col M)
 *   costoFinanciero   = computed or override                (col N)
 *   utilidadSinCF     = utilidadSinGE - costoFinanciero     (col O)
 *   totalPagoQTZ      = utilidadSinCF × tipoCambio          (col Q)
 */
export function calculateContract(input: ContractInput): ContractCalculation {
  const sacos69 = new Decimal(input.sacos69kg);
  const bolsa = new Decimal(input.precioBolsa);
  const dif = new Decimal(input.diferencial);
  const gastosPerSaco = new Decimal(input.gastosExportPerSaco);
  const tc = new Decimal(input.tipoCambio);

  const sacos46kg = sacos69.mul(SACO_CONVERSION);
  const precioBolsaDif = bolsa.plus(dif);

  // Facturación — business_rules §1.5, §1.6, §2.3: single kg path.
  //   facturacionLbs = sacos46 × (bolsa + dif)           (SSOT col N)
  //   facturacionKgs = sacos69 × 69 × 2.2046 × ((bolsa+dif)/100)  (SSOT col O)
  // The legacy LBS_TO_KGS_FACTOR (1.01411) is a 5-digit approximation of
  // (69 × 2.2046 / 100) / 1.5 = 1.01411733… and drifts ~$1/contract. We
  // compute facturacionKgs directly from the canonical kg formula so the
  // app matches the SSOT cell-for-cell.
  const facturacionLbsComputed = sacos46kg.mul(precioBolsaDif);
  const facturacionKgsComputed = sacos69
    .mul(69)
    .mul(LBS_PER_KG)
    .mul(precioBolsaDif.div(100));

  // Legal-document override: when set, skip the formula and use the literal.
  // Both facturacionLbs and facturacionKgs take the override so every
  // downstream field that reads either one stays internally consistent.
  const hasOverride = input.facturacionKgsOverride != null;
  const facturacionKgs = hasOverride
    ? new Decimal(input.facturacionKgsOverride!)
    : facturacionKgsComputed;
  const facturacionLbs = hasOverride ? facturacionKgs : facturacionLbsComputed;

  // gastos_exportacion = rate per quintal × quintales (business_rules §1.7).
  // quintal = 100 lb = 46 kg, so multiply by sacos46kg. SSOT: Q = P × J.
  const gastosExportacion = gastosPerSaco.mul(sacos46kg);
  const utilidadSinGastosExport = facturacionKgs.minus(gastosExportacion);

  // Commissions: 1.50 USD/quintal each (buy + sell)
  const comisionCompra = sacos46kg.mul(COMISION_POR_QQ);
  const comisionVenta = sacos46kg.mul(COMISION_POR_QQ);
  const totalComision = comisionCompra.plus(comisionVenta);

  // Financial cost: explicit override > auto-calc from montoCredito > zero
  let costoFinanciero: Decimal;
  if (input.costoFinanciero != null) {
    costoFinanciero = new Decimal(input.costoFinanciero);
  } else if (input.montoCredito != null && input.montoCredito > 0) {
    // monto_crédito × (8% / 12) × 2 meses / tipo_cambio
    costoFinanciero = new Decimal(input.montoCredito)
      .mul(TASA_ANUAL.div(12))
      .mul(MESES_FINANCIAMIENTO)
      .div(tc);
  } else {
    costoFinanciero = new Decimal(0);
  }

  const utilidadSinCostoFinanciero = utilidadSinGastosExport.minus(costoFinanciero);

  // Stock-lock COGS branch (business_rules §1.2). For Buy-FOB/Sell-FOB
  // contracts, the full facturación is NOT profit — we must deduct the cost
  // of goods to reveal the real ~$15/qq financial margin. stockLotAfloatCostPerQQ
  // is nullable: when unset (every non-stock-lot-afloat contract) stockLotAfloatCost = 0
  // and this branch is a no-op, so existing callers are unaffected.
  const stockLotAfloatCost =
    input.stockLotAfloatCostPerQQ != null && input.stockLotAfloatCostPerQQ > 0
      ? new Decimal(input.stockLotAfloatCostPerQQ).mul(sacos46kg)
      : new Decimal(0);
  const utilAfterStockLotAfloatCost = utilidadSinCostoFinanciero.minus(stockLotAfloatCost);

  const totalPagoQTZ = utilAfterStockLotAfloatCost.mul(tc);

  return {
    sacos46kg,
    precioBolsaDif,
    facturacionLbs,
    facturacionKgs,
    gastosExportacion,
    utilidadSinGastosExport,
    costoFinanciero,
    utilidadSinCostoFinanciero,
    stockLotAfloatCost,
    totalPagoQTZ,
    comisionCompra,
    comisionVenta,
    totalComision,
  };
}

// ---------------------------------------------------------------------------
// MATERIA PRIMA CALCULATIONS
// ---------------------------------------------------------------------------

/**
 * Calculate raw material cost for a purchase lot.
 *
 * Excel mapping (Enero sheet, rows 14-17):
 *   pergamino = oro × rendimiento   (col L = col J × col K)
 *   totalMP   = pergamino × promQ   (col O = col L × col M)
 */
export function calculateMateriaPrima(
  input: MateriaPrimaInput
): MateriaPrimaCalculation {
  const oro = new Decimal(input.oro);
  const rend = new Decimal(input.rendimiento);
  const precio = new Decimal(input.precioPromQ);

  const pergamino = oro.mul(rend);
  const totalMP = pergamino.mul(precio);

  return { pergamino, totalMP };
}

// ---------------------------------------------------------------------------
// SUBPRODUCTO CALCULATIONS
// ---------------------------------------------------------------------------

/**
 * Calculate by-product (subproducto) revenue.
 *
 * Excel mapping (SERENGETTI sheet, rows 19-20):
 *   totalOro      = contenedores × oroPerContenedor  (col L)
 *   totalPergamino = totalOro × precioSinIVA          (col O)
 */
export function calculateSubproducto(
  input: SubproductoInput
): SubproductoCalculation {
  const cont = new Decimal(input.contenedores);
  const oroPer = new Decimal(input.oroPerContenedor);
  const precio = new Decimal(input.precioSinIVA);

  const totalOro = cont.mul(oroPer);
  const totalPergamino = totalOro.mul(precio);

  return { totalOro, totalPergamino };
}

// ---------------------------------------------------------------------------
// SHIPMENT MARGIN CALCULATIONS (P&L per shipment)
// ---------------------------------------------------------------------------

/**
 * Calculate gross margin for a shipment (all contracts + materia prima + subproductos).
 *
 * Excel mapping (bottom section of each monthly sheet):
 *   utilidadBruta  = totalPagoQTZ - materiaPrima - ISR - comisionQTZ + subproducto
 *   margenBruto    = utilidadBruta / totalFacturacionQTZ
 *
 * All values in QTZ. ISR is a stored/editable field (not auto-computed — the Excel
 * has it as a hardcoded value, selectively applied per shipment).
 * Denominator is gross billing (facturacionKgs × tipoCambio) matching the Excel SSOT.
 */
export function calculateShipmentMargin(
  totalFacturacionQTZ: Decimal,
  totalPagoQTZ: Decimal,
  totalMateriaPrima: Decimal,
  totalISR: Decimal,
  totalComisionQTZ: Decimal,
  totalSubproducto: Decimal
): ShipmentMarginResult {
  // utilidadBruta = revenue - costs - ISR - commissions + by-product revenue
  const utilidadBruta = totalPagoQTZ
    .minus(totalMateriaPrima)
    .minus(totalISR)
    .minus(totalComisionQTZ)
    .plus(totalSubproducto);

  // Margin denominator is gross billing (facturacionKgs × tipoCambio)
  const margenBruto = totalFacturacionQTZ.isZero()
    ? new Decimal(0)
    : utilidadBruta.div(totalFacturacionQTZ);

  return {
    totalFacturacionQTZ,
    totalMateriaPrima,
    totalISR,
    totalComision: totalComisionQTZ,
    totalSubproducto,
    utilidadBruta,
    margenBruto,
  };
}

// ---------------------------------------------------------------------------
// PURCHASE ORDER CALCULATIONS
// ---------------------------------------------------------------------------

/**
 * Calculate all-in cost for a raw material purchase order.
 *
 * Excel mapping (Hoja3 sheet, rows 3-4):
 *   totalCafe   = quintales × precio
 *   totalFlete  = quintales × fletePorQQ
 *   costoTotal  = totalCafe + totalFlete + seguridad + seguro + cadena + cargas + descargas
 *   precioAvg   = costoTotal / quintales
 */
export function calculatePurchaseOrder(
  input: PurchaseOrderInput
): PurchaseOrderCalculation {
  const qq = new Decimal(input.quintalesPergamino);
  const precio = new Decimal(input.precioPorQQ);
  const fletePQQ = new Decimal(input.fletePorQQ);

  const totalCafe = qq.mul(precio);
  const totalFlete = qq.mul(fletePQQ);

  const extras = new Decimal(input.seguridad)
    .plus(input.seguro)
    .plus(input.cadena ?? 0)
    .plus(input.cargas ?? 0)
    .plus(input.descargas ?? 0);

  const costoTotalAcumulado = totalCafe.plus(totalFlete).plus(extras);
  const precioPromedio = qq.isZero()
    ? new Decimal(0)
    : costoTotalAcumulado.div(qq);

  return { totalCafe, totalFlete, costoTotalAcumulado, precioPromedio };
}

// ---------------------------------------------------------------------------
// FARM FINANCING CALCULATIONS
// ---------------------------------------------------------------------------

/**
 * Calculate farm financing terms.
 *
 * Excel mapping (Hoja2 sheet, rows 5-7):
 *   totalUSD      = totalQuetzales / tipoCambio
 *   nuevoTotal    = totalUSD × (1 + aumentoPorcentaje)
 *   totalPrestamo = nuevoTotal × porcentajePrestamo
 */
export function calculateFarmFinancing(
  input: FarmFinancingInput
): FarmFinancingCalculation {
  const totalQ = new Decimal(input.totalQuetzales);
  const tc = new Decimal(input.tipoCambio);
  const aumento = new Decimal(input.aumentoPorcentaje);
  const pctPrestamo = new Decimal(input.porcentajePrestamo);

  const totalUSD = totalQ.div(tc);
  const nuevoTotal = totalUSD.mul(aumento.plus(1));
  const totalPrestamo = nuevoTotal.mul(pctPrestamo);

  return { totalUSD, nuevoTotal, totalPrestamo };
}

// ---------------------------------------------------------------------------
// UTILITY: Aggregate contracts for a shipment
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// FINANCIAL COST (standalone utility)
// ---------------------------------------------------------------------------

/**
 * Calculate financial cost from credit amount.
 * Formula from COFFEE.md: monto_crédito × (8% / 12) × 2_meses / tipo_de_cambio
 */
export function calculateFinancialCost(
  montoCredito: number,
  tipoCambio: number
): Decimal {
  return new Decimal(montoCredito)
    .mul(TASA_ANUAL.div(12))
    .mul(MESES_FINANCIAMIENTO)
    .div(new Decimal(tipoCambio));
}

// ---------------------------------------------------------------------------
// UTILITY: Aggregate contracts for a shipment
// ---------------------------------------------------------------------------

export function aggregateContracts(
  contracts: ContractCalculation[]
): {
  totalSacos46: Decimal;
  totalFactLbs: Decimal;
  totalFactKgs: Decimal;
  totalGastos: Decimal;
  totalUtilSinGE: Decimal;
  totalCostoFin: Decimal;
  totalUtilSinCF: Decimal;
  totalPagoQTZ: Decimal;
  totalComision: Decimal;
} {
  return contracts.reduce(
    (acc, c) => ({
      totalSacos46: acc.totalSacos46.plus(c.sacos46kg),
      totalFactLbs: acc.totalFactLbs.plus(c.facturacionLbs),
      totalFactKgs: acc.totalFactKgs.plus(c.facturacionKgs),
      totalGastos: acc.totalGastos.plus(c.gastosExportacion),
      totalUtilSinGE: acc.totalUtilSinGE.plus(c.utilidadSinGastosExport),
      totalCostoFin: acc.totalCostoFin.plus(c.costoFinanciero),
      totalUtilSinCF: acc.totalUtilSinCF.plus(c.utilidadSinCostoFinanciero),
      totalPagoQTZ: acc.totalPagoQTZ.plus(c.totalPagoQTZ),
      totalComision: acc.totalComision.plus(c.totalComision),
    }),
    {
      totalSacos46: new Decimal(0),
      totalFactLbs: new Decimal(0),
      totalFactKgs: new Decimal(0),
      totalGastos: new Decimal(0),
      totalUtilSinGE: new Decimal(0),
      totalCostoFin: new Decimal(0),
      totalUtilSinCF: new Decimal(0),
      totalPagoQTZ: new Decimal(0),
      totalComision: new Decimal(0),
    }
  );
}
