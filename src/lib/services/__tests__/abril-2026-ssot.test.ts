// ============================================================================
// Abril 2026 SSOT regression gate
// ============================================================================
// Asserts cell-for-cell parity between calculateContract + business rules and
// Mayo.xlsx "Abril" sheet. First month to exercise:
//   - 2 entity blocks (EXPORTADORA + STOCK_LOT_AFLOAT) → 2 shipments.
//   - Stock-lock contracts with montoCredito=0 (no MP, no subproducto).
//   - Stock-lock sheet cells #REF! on costoFin/utilSinCF/totalPago — DB
//     values come from calculateContract (authoritative, not sheet).
//
// Streamlined coverage (vs Marzo's 6-contract enumeration):
//   - 2 representative Exportadora cases (P40031, W26350-GT-02 — suffixed big-sacos).
//   - 2 Stock-lock cases (GT260360-01 / -02) with limited field set.
//   - 2 shipment-margin aggregates (Bloque 1 + Bloque 2).
//
// Phase D parity is the exhaustive gate (148 OK / 0 MISMATCH / 6 SKIPPED).
// ============================================================================

import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { calculateContract, calculateShipmentMargin } from "../calculations";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const TC = 7.65;
const MP_STANDARD = 970484.13; // 1782.34 × 544.50 (for 275-sacos contracts)

// ── Exportadora ────────────────────────────────────────────────────────────

describe("Abril 2026 Exportadora — calculateContract", () => {
  it("P40031 — Serengetti / Santa Rosa (gastos 14.12)", () => {
    const r = calculateContract({
      sacos69kg: 275,
      puntaje: 82,
      precioBolsa: 310.35,
      diferencial: 15,
      gastosExportPerSaco: 14.12,
      tipoCambio: TC,
      montoCredito: MP_STANDARD,
    });
    expect(r.facturacionLbs.toNumber()).toBeCloseTo(134206.875, 2); // N5 literal
    expect(r.facturacionKgs.toNumber()).toBeCloseTo(136101.34, 2); // O5
    expect(r.gastosExportacion.toNumber()).toBeCloseTo(5824.5, 2); // Q5
    expect(r.utilidadSinGastosExport.toNumber()).toBeCloseTo(130276.84, 2); // R5
    expect(r.costoFinanciero.toNumber()).toBeCloseTo(1691.48, 2); // S5
    expect(r.utilidadSinCostoFinanciero.toNumber()).toBeCloseTo(128585.36, 2); // T5
    expect(r.totalPagoQTZ.toNumber()).toBeCloseTo(983678.03, 2); // V5
  });

  it("W26350-GT-02 — Westrade 550-sacos (suffixed, 2× MP)", () => {
    const r = calculateContract({
      sacos69kg: 550,
      puntaje: 83,
      precioBolsa: 311.45,
      diferencial: 40,
      gastosExportPerSaco: 23,
      tipoCambio: TC,
      montoCredito: MP_STANDARD * 2, // 1,940,968.26
    });
    expect(r.facturacionLbs.toNumber()).toBeCloseTo(289946.25, 2); // N11
    expect(r.facturacionKgs.toNumber()).toBeCloseTo(294039.13, 2); // O11
    expect(r.gastosExportacion.toNumber()).toBeCloseTo(18975, 2); // Q11
    expect(r.utilidadSinGastosExport.toNumber()).toBeCloseTo(275064.13, 2); // R11
    expect(r.costoFinanciero.toNumber()).toBeCloseTo(3382.95, 2); // S11
    expect(r.utilidadSinCostoFinanciero.toNumber()).toBeCloseTo(271681.18, 2); // T11
    expect(r.totalPagoQTZ.toNumber()).toBeCloseTo(2078361.03, 2); // V11
  });
});

// ── Stock Lot Afloat ────────────────────────────────────────────────────────────
// Sheet has #REF! on S/T/V cells — only factLbs/factKgs/gastos/utilSinGE are
// sheet-valid. costoFin/utilSinCF/totalPago derive from montoCredito=0.

describe("Abril 2026 Stock Lot Afloat — calculateContract with montoCredito=0", () => {
  it("GT260360-01 — Plateau Harvest / Stocklot (dif=-37)", () => {
    const r = calculateContract({
      sacos69kg: 275,
      puntaje: 0, // textual "300 defectos" on sheet → 0 sentinel
      precioBolsa: 302,
      diferencial: -37,
      gastosExportPerSaco: 23,
      tipoCambio: TC,
      montoCredito: 0, // stock-lot-afloat per directive 4
    });
    expect(r.facturacionLbs.toNumber()).toBeCloseTo(109312.5, 2); // N36 (non-#REF!)
    expect(r.facturacionKgs.toNumber()).toBeCloseTo(110855.56, 2); // O36 (non-#REF!)
    expect(r.gastosExportacion.toNumber()).toBeCloseTo(9487.5, 2); // Q36 (non-#REF!)
    expect(r.utilidadSinGastosExport.toNumber()).toBeCloseTo(101368.06, 2); // R36 (non-#REF!)
    // With montoCredito=0, costoFin collapses to 0 and utilSinCF = utilSinGE
    expect(r.costoFinanciero.toNumber()).toBeCloseTo(0, 2);
    expect(r.utilidadSinCostoFinanciero.toNumber()).toBeCloseTo(101368.06, 2);
    expect(r.totalPagoQTZ.toNumber()).toBeCloseTo(775465.62, 0); // ±$1
  });

  it("GT260360-02 — Plateau Harvest / Stocklot (dif=-52)", () => {
    const r = calculateContract({
      sacos69kg: 275,
      puntaje: 0,
      precioBolsa: 302,
      diferencial: -52,
      gastosExportPerSaco: 23,
      tipoCambio: TC,
      montoCredito: 0,
    });
    expect(r.facturacionLbs.toNumber()).toBeCloseTo(103125, 2); // 412.5 × 250
    expect(r.facturacionKgs.toNumber()).toBeCloseTo(104580.71, 2); // 275×69×2.2046×2.5
    expect(r.gastosExportacion.toNumber()).toBeCloseTo(9487.5, 2);
    expect(r.utilidadSinGastosExport.toNumber()).toBeCloseTo(95093.21, 2);
    expect(r.costoFinanciero.toNumber()).toBeCloseTo(0, 2);
    expect(r.utilidadSinCostoFinanciero.toNumber()).toBeCloseTo(95093.21, 2);
    expect(r.totalPagoQTZ.toNumber()).toBeCloseTo(727463.07, 0); // ±$1
  });
});

// ── Shipment margins — both blocks ────────────────────────────────────────

describe("Abril 2026 SSOT parity — shipment margins", () => {
  it("Bloque 1 / Exportadora — utilidad Q 695,754.10 / margen 8.98%", () => {
    // Sum per-contract V from xlsx cells V5..V11 (literals).
    const totalPagoQTZ = new Decimal(983678.0318433753)
      .plus(997258.2892758752)
      .plus(778100.8495781102)
      .plus(287476.845681375)
      .plus(1024619.7410872501)
      .plus(1038540.4797281253)
      .plus(2078361.0273772504);
    // Σ facturación kgs USD × TC.
    const totalFacturacionQTZ = new Decimal(136101.33924750003)
      .plus(141539.53629750002)
      .plus(109159.59835740001)
      .plus(39628.4841675)
      .plus(145116.196665)
      .plus(146935.90106250002)
      .plus(294039.13126500003)
      .mul(TC);
    // Per-contract MP totals sum.
    const totalMP = new Decimal(MP_STANDARD)
      .mul(4) // P40031, P40025, W26342-GT, W26350-GT-01
      .plus(726980.84) // SCS_177612
      .plus(264677.49) // SCS_177617
      .plus(MP_STANDARD * 2); // W26350-GT-02 (550 sacos)
    const totalISR = new Decimal(0);
    // Commission: 3 × Σsacos46 × TC. sacos46 sum = 412.5×4 + 309 + 112.5 + 825 = 2896.5
    const totalComision = new Decimal(3).mul(2896.5).mul(TC);
    // Subproducto: 5.7491 contenedores × 33 × 2049.1071
    const totalSubproducto = new Decimal(5.749090909090909)
      .mul(33)
      .mul(2049.1071428571427);

    const margin = calculateShipmentMargin(
      totalFacturacionQTZ,
      totalPagoQTZ,
      totalMP,
      totalISR,
      totalComision,
      totalSubproducto
    );
    expect(margin.utilidadBruta.toNumber()).toBeCloseTo(695754.1, 0); // ±$1
    expect(margin.margenBruto.toNumber()).toBeCloseTo(0.0898, 4); // 8.98%
  });

  it("Bloque 2 / Stock Lot Afloat — utilidad Q 1,483,994.97 / margen 90.04%", () => {
    // Stock-lock: no MP, no subproducto; utilidad = totalPago - comisión
    // totalPago = (utilSinGE × TC) per contract since costoFin=0.
    // utilSinGE_01 = 101368.06, utilSinGE_02 = 95093.21
    const totalPagoQTZ = new Decimal(101368.05525)
      .plus(95093.20525)
      .mul(TC);
    const totalFacturacionQTZ = new Decimal(110855.55525)
      .plus(104580.70525) // sheet O37 ≈ 104580.705
      .mul(TC);
    const totalMP = new Decimal(0);
    const totalISR = new Decimal(0);
    // Commission: 3 × 825 × 7.65 = 18,933.75
    const totalComision = new Decimal(3).mul(825).mul(TC);
    const totalSubproducto = new Decimal(0);

    const margin = calculateShipmentMargin(
      totalFacturacionQTZ,
      totalPagoQTZ,
      totalMP,
      totalISR,
      totalComision,
      totalSubproducto
    );
    expect(margin.utilidadBruta.toNumber()).toBeCloseTo(1483994.97, 0);
    expect(margin.margenBruto.toNumber()).toBeCloseTo(0.9004, 3);
  });
});
