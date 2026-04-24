// ============================================================================
// Febrero 2026 SSOT regression gate
// ============================================================================
// Asserts cell-for-cell parity between calculateContract + business rules and
// the canonical values in Mayo.xlsx sheet "Febrero" (SHA-256
// d5cc26b3afc0d772c07cff9105e2ca9d0e2b966e84247bacf44b5c9e3e85f87f, captured
// 2026-04-24).
//
// Source: docs/ssot/febrero-2026-cell-inventory.md + reports/phase-d-febrero-
// 2026-*.md (Phase D parity: 38 OK / 0 MISMATCH).
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
    /** Per-contract MP total (QTZ) — drives costoFinanciero per SSOT S_i */
    montoCredito: number;
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

// Per-contract MP totals (O_i) from Mayo.xlsx "Febrero" cells.
// Formula: promQ × pergo = 1782.34 × 544.50 = 970,484.13
const MP_P40029 = 970484.13;
const MP_P40023 = 970484.13;

const CASES: Case[] = [
  {
    name: "P40029 — Serengetti / Santa Rosa",
    input: {
      sacos69kg: 275,
      puntaje: 82,
      precioBolsa: 380,
      diferencial: 15,
      gastosExportPerSaco: 14.12,
      tipoCambio: TC,
      montoCredito: MP_P40029,
    },
    // 2-decimal xlsx display values (matches @db.Decimal(14,2) persist layer).
    expect: {
      facturacionLbs: 162937.5, // N7
      facturacionKgs: 165237.53, // O7
      gastosExportacion: 5824.5, // Q7
      utilidadSinGE: 159413.03, // R7
      costoFinanciero: 1691.48, // S7
      utilidadSinCF: 157721.55, // T7
      totalPagoQTZ: 1206569.86, // V7
    },
  },
  {
    name: "P40023 — Serengetti / Huehuetenango",
    input: {
      sacos69kg: 275,
      puntaje: 83,
      precioBolsa: 369.75,
      diferencial: 28,
      gastosExportPerSaco: 23,
      tipoCambio: TC,
      montoCredito: MP_P40023,
    },
    expect: {
      facturacionLbs: 164071.875, // N8 (xlsx literal; display rounds to 164,071.88)
      facturacionKgs: 166387.91, // O8
      gastosExportacion: 9487.5, // Q8
      utilidadSinGE: 156900.41, // R8
      costoFinanciero: 1691.48, // S8
      utilidadSinCF: 155208.94, // T8
      totalPagoQTZ: 1187348.38, // V8
    },
  },
];

describe("Febrero 2026 SSOT parity — calculateContract", () => {
  for (const tc of CASES) {
    it(tc.name, () => {
      const r = calculateContract(tc.input);
      // Tolerance = 2 decimals (±0.005). Matches @db.Decimal(14,2) persist
      // precision and xlsx displayed precision.
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

describe("Febrero 2026 SSOT parity — shipment margins", () => {
  // Single-block month ("Febrero 2026 - Bloque único"). Targets from V18 / R18.
  it("Febrero 2026 - Bloque único / Exportadora — utilidad 501,636.76 Q / margen 19.77%", () => {
    const totalPagoQTZ = new Decimal(1206569.859).plus(1187348.3821);
    const totalFacturacionQTZ = new Decimal(165237.5258)
      .plus(166387.9105)
      .mul(TC);
    const totalMP = new Decimal(MP_P40029).plus(MP_P40023);
    // No ISR on Febrero (per Q6 — ISR is a post-load app-side CRUD).
    const totalISR = new Decimal(0);
    // Commission: 3 × 825 × 7.65 = 18,933.75 (SSOT V16).
    const totalComision = new Decimal(3 * 825 * 7.65);
    // Subproducto (SSOT V17): 1 contenedor × 33 qq × 2049.1071... ≈ 67,620.54 Q.
    const totalSubproducto = new Decimal(67620.535714);

    const margin = calculateShipmentMargin(
      totalFacturacionQTZ,
      totalPagoQTZ,
      totalMP,
      totalISR,
      totalComision,
      totalSubproducto
    );

    expect(margin.utilidadBruta.toNumber()).toBeCloseTo(501636.76, 0); // ±$1
    expect(margin.margenBruto.toNumber()).toBeCloseTo(0.19773, 4); // 19.773%
  });
});
