// ============================================================================
// January 2026 SSOT regression gate
// ============================================================================
// Asserts cell-for-cell parity between calculateContract + business rules and
// the canonical values in Enero.xlsx, verified against the live sheet on
// 2026-04-15 (post-Friday L13/L14/L15 fix, post-Q3 O31/M31 fix, post-P40129
// O27 legal-document override).
//
// Source: RECONCILIATION_PLAN.md §9.4 targets, re-verified via direct xlsx
// cell dump. See phase-a-january-diff.ts for the DB-side comparison.
// ============================================================================

import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { calculateContract } from "../calculations";
import { calculateShipmentMargin } from "../calculations";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const TC = 7.65;

// 2-decimal monetary tolerance for persist-layer rounding.
const CENT = 0.01;

interface Case {
  name: string;
  input: {
    sacos69kg: number;
    puntaje: number;
    precioBolsa: number;
    diferencial: number;
    gastosExportPerSaco: number;
    tipoCambio: number;
    /** Per-contract MP total (QTZ) — drives costoFinanciero per SSOT S_i */
    montoCredito: number;
    facturacionKgsOverride?: number;
  };
  expect: {
    facturacionLbs: number; // SSOT col N
    facturacionKgs: number; // SSOT col O
    gastosExportacion: number; // SSOT col Q
    utilidadSinGE: number; // SSOT col R
    costoFinanciero: number; // SSOT col S
    utilidadSinCF: number; // SSOT col T
    totalPagoQTZ: number; // SSOT col V
  };
}

// Per-contract MP totals (O_i) from Enero.xlsx cells:
const MP_P30172 = 1020265.017037; // 1777.25 × 574.0695
const MP_P40028 = 971011.65170625; // 1777.25 × 546.35625
const MP_P40022 = 967712.625; // 1777.25 × 544.5
const MP_P40129 = 969618.725625; // 1777.25 × 545.5725

const CASES: Case[] = [
  {
    name: "P30172 — Swiss Water / Danilandia (Block 1)",
    input: {
      sacos69kg: 290,
      puntaje: 82,
      precioBolsa: 350,
      diferencial: 37,
      gastosExportPerSaco: 20,
      tipoCambio: TC,
      montoCredito: MP_P30172,
    },
    expect: {
      facturacionLbs: 168345,
      facturacionKgs: 170721.35802,
      gastosExportacion: 8700,
      utilidadSinGE: 162021.35802,
      costoFinanciero: 1778.239684,
      utilidadSinCF: 160243.118336,
      totalPagoQTZ: 1225859.855268,
    },
  },
  {
    name: "P40028 — Serengetti / Santa Rosa (Block 1)",
    input: {
      sacos69kg: 275,
      puntaje: 82,
      precioBolsa: 358,
      diferencial: 15,
      gastosExportPerSaco: 20,
      tipoCambio: TC,
      montoCredito: MP_P40028,
    },
    expect: {
      facturacionLbs: 153862.5,
      facturacionKgs: 156034.42305,
      gastosExportacion: 8250,
      utilidadSinGE: 147784.42305,
      costoFinanciero: 1692.395025,
      utilidadSinCF: 146092.028025,
      totalPagoQTZ: 1117604.014391,
    },
  },
  {
    name: "P40022 — Serengetti / Huehue (Block 1)",
    input: {
      sacos69kg: 275,
      puntaje: 83,
      precioBolsa: 358,
      diferencial: 28,
      gastosExportPerSaco: 20,
      tipoCambio: TC,
      montoCredito: MP_P40022,
    },
    expect: {
      facturacionLbs: 159225,
      facturacionKgs: 161472.6201,
      gastosExportacion: 8250,
      utilidadSinGE: 153222.6201,
      costoFinanciero: 1686.645098,
      utilidadSinCF: 151535.975002,
      totalPagoQTZ: 1159250.208765,
    },
  },
  {
    name: "P40129 — Serengetti / Organico (Block 2) — legal-doc override",
    input: {
      sacos69kg: 275,
      puntaje: 82,
      precioBolsa: 376,
      diferencial: 40,
      gastosExportPerSaco: 23,
      tipoCambio: TC,
      montoCredito: MP_P40129,
      // Legal contract drafted at libras value; see RECONCILIATION_PLAN §9.3.
      facturacionKgsOverride: 171600,
    },
    expect: {
      facturacionLbs: 171600, // override applies to both N and O
      facturacionKgs: 171600,
      gastosExportacion: 9487.5,
      utilidadSinGE: 162112.5,
      costoFinanciero: 1689.967278,
      utilidadSinCF: 160422.532722,
      totalPagoQTZ: 1227232.375325,
    },
  },
];

describe("January 2026 SSOT parity — calculateContract", () => {
  for (const tc of CASES) {
    it(tc.name, () => {
      // Tolerance = 2 decimals (±0.005 monetary units). This matches the
      // DB's @db.Decimal(14, 2) persist precision and the SSOT's displayed
      // precision in the xlsx. Tighter than this gets into sub-cent rounding
      // noise from Decimal.js operation chains.
      const r = calculateContract(tc.input);
      expect(r.facturacionLbs.toNumber()).toBeCloseTo(tc.expect.facturacionLbs, 2);
      expect(r.facturacionKgs.toNumber()).toBeCloseTo(tc.expect.facturacionKgs, 2);
      expect(r.gastosExportacion.toNumber()).toBeCloseTo(tc.expect.gastosExportacion, 2);
      expect(r.utilidadSinGastosExport.toNumber()).toBeCloseTo(tc.expect.utilidadSinGE, 2);
      expect(r.costoFinanciero.toNumber()).toBeCloseTo(tc.expect.costoFinanciero, 2);
      expect(r.utilidadSinCostoFinanciero.toNumber()).toBeCloseTo(tc.expect.utilidadSinCF, 2);
      expect(r.totalPagoQTZ.toNumber()).toBeCloseTo(tc.expect.totalPagoQTZ, 2);
    });
  }
});

describe("January 2026 SSOT parity — shipment margins", () => {
  // Block 1 targets (V20, R20) straight from Enero.xlsx after all fixes.
  it("Enero Bloque 1 / Exportadora — utilidad 582,428.32 Q / margen 15.59%", () => {
    // Sum per-contract pagoQTZ (SSOT V7+V8+V9).
    const totalPagoQTZ = new Decimal(1225859.855268)
      .plus(1117604.014391)
      .plus(1159250.208765);
    // Σ O_i × TC (facturación kgs in QTZ).
    const totalFacturacionQTZ = new Decimal(170721.35802)
      .plus(156034.42305)
      .plus(161472.6201)
      .mul(TC);
    const totalMP = new Decimal(MP_P30172).plus(MP_P40028).plus(MP_P40022);
    // Block 1 has no ISR.
    const totalISR = new Decimal(0);
    // Commission: 3 × 1260 × 7.65 = 28,917 Q (SSOT V18).
    const totalComision = new Decimal(3 * 1260 * 7.65);
    // Subproducto (SSOT V19): 1 contenedor × 33 qq × 2049.1071... ≈ 67,620.54 Q.
    const totalSubproducto = new Decimal(67620.535714);

    const margin = calculateShipmentMargin(
      totalFacturacionQTZ,
      totalPagoQTZ,
      totalMP,
      totalISR,
      totalComision,
      totalSubproducto
    );
    expect(margin.utilidadBruta.toNumber()).toBeCloseTo(582428.32, 0); // ±$1
    expect(margin.margenBruto.toNumber()).toBeCloseTo(0.15594, 4); // 15.594%
  });

  it("Enero Bloque 2 / Finca Danilandia — utilidad 182,382.61 Q / margen 13.89%", () => {
    const totalPagoQTZ = new Decimal(1227232.375325);
    const totalFacturacionQTZ = new Decimal(171600).mul(TC); // 1,312,740
    const totalMP = new Decimal(MP_P40129);
    const totalISR = new Decimal(65764.16);
    const totalComision = new Decimal(3 * 412.5 * 7.65); // 9,466.875
    const totalSubproducto = new Decimal(0);

    const margin = calculateShipmentMargin(
      totalFacturacionQTZ,
      totalPagoQTZ,
      totalMP,
      totalISR,
      totalComision,
      totalSubproducto
    );
    expect(margin.utilidadBruta.toNumber()).toBeCloseTo(182382.61, 1); // ±10¢
    expect(margin.margenBruto.toNumber()).toBeCloseTo(0.138933, 4);
  });
});

// Static token reference so linters don't flag the CENT constant as unused
// even if future tolerance tightening removes its only consumer.
void CENT;
