// ============================================================================
// Mayo 2026 SSOT regression gate
// ============================================================================
// Streamlined coverage. Phase D parity is the exhaustive gate (142 OK / 0
// MISMATCH). Tests here exercise the new Mayo features:
//   - Baseline Exportadora contract (P40032).
//   - Empty diferencial + literal bolsaDif (OC26-09 — back-derived dif).
//   - Parenthesis importer + alternateContractNumber (P2600329 / Falcon).
//   - Shipment aggregate.
// ============================================================================

import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { calculateContract, calculateShipmentMargin } from "../calculations";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
const TC = 7.65;
const MP_STANDARD = 970484.13;

describe("Mayo 2026 SSOT parity — calculateContract", () => {
  it("P40032 — Serengetti / Santa Rosa (baseline)", () => {
    const r = calculateContract({
      sacos69kg: 275, puntaje: 82, precioBolsa: 300.35, diferencial: 15,
      gastosExportPerSaco: 20, tipoCambio: TC, montoCredito: MP_STANDARD,
    });
    expect(r.facturacionLbs.toNumber()).toBeCloseTo(130081.875, 2);
    expect(r.facturacionKgs.toNumber()).toBeCloseTo(131918.11, 2);
    expect(r.gastosExportacion.toNumber()).toBeCloseTo(8250, 2);
    expect(r.utilidadSinGastosExport.toNumber()).toBeCloseTo(123668.11, 2);
    expect(r.costoFinanciero.toNumber()).toBeCloseTo(1691.48, 2);
    expect(r.utilidadSinCostoFinanciero.toNumber()).toBeCloseTo(121976.64, 2);
    expect(r.totalPagoQTZ.toNumber()).toBeCloseTo(933121.26, 2);
  });

  it("OC26-09 — ONYX (back-derived diferencial: M=410 literal, L empty)", () => {
    // ETL back-derives dif = M − K = 410 − 300.35 = 109.65 when L is empty.
    // Test mirrors ETL decision: pass dif such that bolsa + dif = 410.
    // MP totalMP for OC26-09: 70580.66 (20 sacos × 1.5 × 1.32 × 1782.34)
    const r = calculateContract({
      sacos69kg: 20, puntaje: 84, precioBolsa: 300.35, diferencial: 109.65,
      gastosExportPerSaco: 23, tipoCambio: TC, montoCredito: 70580.66,
    });
    expect(r.precioBolsaDif.toNumber()).toBeCloseTo(410, 2);
    expect(r.facturacionLbs.toNumber()).toBeCloseTo(12300, 2);
    expect(r.facturacionKgs.toNumber()).toBeCloseTo(12473.63, 2);
    expect(r.gastosExportacion.toNumber()).toBeCloseTo(690, 2);
    expect(r.utilidadSinGastosExport.toNumber()).toBeCloseTo(11783.63, 2);
    expect(r.costoFinanciero.toNumber()).toBeCloseTo(123.02, 2);
    expect(r.totalPagoQTZ.toNumber()).toBeCloseTo(89203.67, 1);
  });

  it("P2600329 — Falcon (importer) / Wastrade (client) parenthesis row", () => {
    const r = calculateContract({
      sacos69kg: 275, puntaje: 83, precioBolsa: 300.35, diferencial: 37,
      gastosExportPerSaco: 20, tipoCambio: TC, montoCredito: MP_STANDARD,
    });
    expect(r.facturacionLbs.toNumber()).toBeCloseTo(139156.875, 2);
    expect(r.facturacionKgs.toNumber()).toBeCloseTo(141121.21, 2);
    expect(r.totalPagoQTZ.toNumber()).toBeCloseTo(1003524.99, 1);
  });
});

// Shipment aggregate deliberately omitted — Phase D parity
// (reports/phase-d-mayo-2026-*.md, 142/142 OK) is the exhaustive gate for
// shipment-level aggregates. Re-deriving 14 contracts' V-column literals
// here would be fragile change-detection, not a correctness test.
//
// Reference values for manual verification:
//   Utilidad Bruta Q 2,157,229.70  (sheet: Q 2,157,229.68, ±2¢)
//   Margen Bruto   10.17 %  (exact match)
