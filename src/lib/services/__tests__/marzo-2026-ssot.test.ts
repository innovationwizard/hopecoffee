// ============================================================================
// Marzo 2026 SSOT regression gate
// ============================================================================
// Asserts cell-for-cell parity between calculateContract + business rules and
// the canonical values in Mayo.xlsx sheet "Marzo" (SHA-256
// d5cc26b3afc0d772c07cff9105e2ca9d0e2b966e84247bacf44b5c9e3e85f87f, captured
// 2026-04-24).
//
// Source: docs/ssot/marzo-2026-cell-inventory.md + Phase D parity report
// (110 OK / 0 MISMATCH).
//
// Notes:
//   - 6 contracts including POUS-00003761 split into -01 (Orgnaico, 100 sacos,
//     dif=50) and -02 (Huehue, 175 sacos, dif=38) per duplicate-contract rule.
//   - Per-contract MP totals drive per-contract costoFinanciero (§2.7).
// ============================================================================

import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { calculateContract, calculateShipmentMargin } from "../calculations";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const TC = 7.65;

interface Case {
  name: string;
  input: {
    sacos69kg: number;
    puntaje: number;
    precioBolsa: number;
    diferencial: number;
    gastosExportPerSaco: number;
    tipoCambio: number;
    montoCredito: number;
  };
  expect: {
    facturacionLbs: number;
    facturacionKgs: number;
    gastosExportacion: number;
    utilidadSinGE: number;
    costoFinanciero: number;
    utilidadSinCF: number;
    totalPagoQTZ: number;
  };
}

// Per-contract MP totals (O_i) = promQ × pergo (promQ = 1782.34 via =Enero!M13)
const MP_STANDARD = 970484.13; // 1782.34 × 544.50 (for 275-sacos contracts)
const MP_POUS_01 = 352903.32; // 1782.34 × 198.00 (100 sacos × 1.5 × 1.32)
const MP_POUS_02 = 617580.81; // 1782.34 × 346.50 (175 sacos × 1.5 × 1.32)

const CASES: Case[] = [
  {
    name: "P40030 — Serengetti / Santa Rosa",
    input: {
      sacos69kg: 275,
      puntaje: 82,
      precioBolsa: 293,
      diferencial: 15,
      gastosExportPerSaco: 14.12,
      tipoCambio: TC,
      montoCredito: MP_STANDARD,
    },
    expect: {
      facturacionLbs: 127050, // N6
      facturacionKgs: 128843.44, // O6
      gastosExportacion: 5824.5, // Q6
      utilidadSinGE: 123018.94, // R6
      costoFinanciero: 1691.48, // S6
      utilidadSinCF: 121327.46, // T6
      totalPagoQTZ: 928155.09, // V6
    },
  },
  {
    name: "P40024 — Serengetti / Huehuetenango",
    input: {
      sacos69kg: 275,
      puntaje: 83,
      precioBolsa: 294.55,
      diferencial: 28,
      gastosExportPerSaco: 23,
      tipoCambio: TC,
      montoCredito: MP_STANDARD,
    },
    expect: {
      facturacionLbs: 133051.875, // N7 (literal; display 133,051.88)
      facturacionKgs: 134930.04, // O7
      gastosExportacion: 9487.5, // Q7
      utilidadSinGE: 125442.54, // R7
      costoFinanciero: 1691.48, // S7
      utilidadSinCF: 123751.06, // T7
      totalPagoQTZ: 946695.61, // V7
    },
  },
  {
    name: "POUS-00003748 — Opal / Huehuetenango",
    input: {
      sacos69kg: 275,
      puntaje: 83,
      precioBolsa: 314.1,
      diferencial: 40,
      gastosExportPerSaco: 20,
      tipoCambio: TC,
      montoCredito: MP_STANDARD,
    },
    expect: {
      facturacionLbs: 146066.25, // N8
      facturacionKgs: 148128.12, // O8
      gastosExportacion: 8250, // Q8
      utilidadSinGE: 139878.12, // R8
      costoFinanciero: 1691.48, // S8
      utilidadSinCF: 138186.65, // T8 (xlsx 138186.6456; display 138,186.65)
      totalPagoQTZ: 1057127.84, // V8
    },
  },
  {
    name: "POUS-00003761-01 — Opal / Orgnaico (split from duplicate)",
    input: {
      sacos69kg: 100,
      puntaje: 83,
      precioBolsa: 314.1,
      diferencial: 50,
      gastosExportPerSaco: 23,
      tipoCambio: TC,
      montoCredito: MP_POUS_01,
    },
    expect: {
      facturacionLbs: 54615, // N9
      facturacionKgs: 55385.95, // O9 (xlsx 55385.945; display 55,385.95)
      gastosExportacion: 3450, // Q9
      utilidadSinGE: 51935.95, // R9
      costoFinanciero: 615.08, // S9
      utilidadSinCF: 51320.86, // T9 (xlsx 51320.8633; display 51,320.86)
      totalPagoQTZ: 392604.6, // V9 (xlsx 392604.604; display 392,604.60)
    },
  },
  {
    name: "POUS-00003761-02 — Opal / Huehuetenango (split from duplicate)",
    input: {
      sacos69kg: 175,
      puntaje: 83,
      precioBolsa: 314.1,
      diferencial: 38,
      gastosExportPerSaco: 23,
      tipoCambio: TC,
      montoCredito: MP_POUS_02,
    },
    expect: {
      facturacionLbs: 92426.25, // N10
      facturacionKgs: 93730.94, // O10 (xlsx 93730.939; display 93,730.94)
      gastosExportacion: 6037.5, // Q10
      utilidadSinGE: 87693.44, // R10
      costoFinanciero: 1076.39, // S10 (xlsx 1076.3936)
      utilidadSinCF: 86617.05, // T10 (xlsx 86617.0454; display 86,617.05)
      totalPagoQTZ: 662620.4, // V10 (xlsx 662620.397; display 662,620.40)
    },
  },
  {
    name: "1002605 — Onyx / Santa Rosa",
    input: {
      sacos69kg: 275,
      puntaje: 81,
      precioBolsa: 300.8,
      diferencial: 40,
      gastosExportPerSaco: 14.12,
      tipoCambio: TC,
      montoCredito: MP_STANDARD,
    },
    expect: {
      facturacionLbs: 140580, // N11
      facturacionKgs: 142564.43, // O11 (xlsx 142564.427; display 142,564.43)
      gastosExportacion: 5824.5, // Q11
      utilidadSinGE: 136739.93, // R11 (xlsx 136739.927)
      costoFinanciero: 1691.48, // S11
      utilidadSinCF: 135048.45, // T11
      totalPagoQTZ: 1033120.66, // V11 (xlsx 1033120.655; display 1,033,120.66)
    },
  },
];

describe("Marzo 2026 SSOT parity — calculateContract", () => {
  for (const tc of CASES) {
    it(tc.name, () => {
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

describe("Marzo 2026 SSOT parity — shipment margins", () => {
  it("Marzo 2026 - Bloque único / Exportadora — utilidad Q 323,430.77 / margen 6.01%", () => {
    // Sum per-contract V from the xlsx (exact literals; see V6..V11).
    const totalPagoQTZ = new Decimal(928155.0857700001)
      .plus(946695.6063963753)
      .plus(1057127.8386652502)
      .plus(392604.60425100004)
      .plus(662620.3971292502)
      .plus(1033120.655292);
    // Σ facturacion kgs USD × TC (xlsx O12 = 703582.91).
    const totalFacturacionQTZ = new Decimal(703582.9058175001).mul(TC);
    // Per-contract MP totals sum.
    const totalMP = new Decimal(MP_STANDARD)
      .mul(4)
      .plus(MP_POUS_01)
      .plus(MP_POUS_02);
    // No ISR on Mar (per Q6 — ISR is a post-load app-side CRUD).
    const totalISR = new Decimal(0);
    // Commission: 3 × Σsacos46 × 7.65 = 3 × 2062.5 × 7.65 = 47,334.375
    const totalComision = new Decimal(3).mul(2062.5).mul(TC);
    // Subproducto: 3 contenedores × 33 qq × 2049.1071... = 202,861.6071
    const totalSubproducto = new Decimal(99).mul(2049.1071428571427);

    const margin = calculateShipmentMargin(
      totalFacturacionQTZ,
      totalPagoQTZ,
      totalMP,
      totalISR,
      totalComision,
      totalSubproducto
    );
    expect(margin.utilidadBruta.toNumber()).toBeCloseTo(323430.77, 0); // ±$1
    expect(margin.margenBruto.toNumber()).toBeCloseTo(0.0601, 4); // 6.01%
  });
});
