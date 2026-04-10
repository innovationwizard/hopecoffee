import { describe, it, expect } from "vitest";
import {
  calculateContract,
  calculateMateriaPrima,
  calculateSubproducto,
  calculateShipmentMargin,
  calculatePurchaseOrder,
  calculateFarmFinancing,
  calculateFinancialCost,
  aggregateContracts,
} from "../calculations";
import Decimal from "decimal.js";

describe("calculateContract", () => {
  const serengettiFixtures = [
    {
      label: "P40129 (bolsa=376, dif=40)",
      input: {
        sacos69kg: 275,
        puntaje: 82,
        precioBolsa: 376,
        diferencial: 40,
        gastosExportPerSaco: 34.5,
        tipoCambio: 7.65,
      },
      expected: {
        sacos46kg: 412.5,
        precioBolsaDif: 416,
        facturacionLbs: 171600,
      },
    },
    {
      label: "P40028 (bolsa=350, dif=15)",
      input: {
        sacos69kg: 275,
        puntaje: 82,
        precioBolsa: 350,
        diferencial: 15,
        gastosExportPerSaco: 34.5,
        tipoCambio: 7.65,
      },
      expected: {
        sacos46kg: 412.5,
        precioBolsaDif: 365,
        facturacionLbs: 150562.5,
      },
    },
  ];

  serengettiFixtures.forEach(({ label, input, expected }) => {
    it(`matches Excel for ${label}`, () => {
      const result = calculateContract(input);
      expect(result.sacos46kg.toNumber()).toBe(expected.sacos46kg);
      expect(result.precioBolsaDif.toNumber()).toBe(expected.precioBolsaDif);
      expect(result.facturacionLbs.toNumber()).toBe(expected.facturacionLbs);
    });
  });

  it("computes facturacionKgs with 1.01411 factor", () => {
    const result = calculateContract({
      sacos69kg: 275,
      puntaje: 82,
      precioBolsa: 376,
      diferencial: 40,
      gastosExportPerSaco: 34.5,
      tipoCambio: 7.65,
    });
    const expectedKgs = 171600 * 1.01411;
    expect(result.facturacionKgs.toNumber()).toBeCloseTo(expectedKgs, 2);
  });

  it("computes gastos exportacion correctly", () => {
    const result = calculateContract({
      sacos69kg: 275,
      puntaje: 82,
      precioBolsa: 376,
      diferencial: 40,
      gastosExportPerSaco: 34.5,
      tipoCambio: 7.65,
    });
    expect(result.gastosExportacion.toNumber()).toBe(9487.5);
  });

  it("handles zero inputs without crashing", () => {
    const result = calculateContract({
      sacos69kg: 0,
      puntaje: 82,
      precioBolsa: 0,
      diferencial: 0,
      gastosExportPerSaco: 0,
      tipoCambio: 7.65,
    });
    expect(result.totalPagoQTZ.toNumber()).toBe(0);
    expect(result.sacos46kg.toNumber()).toBe(0);
  });

  it("handles negative diferencial", () => {
    const result = calculateContract({
      sacos69kg: 275,
      puntaje: 82,
      precioBolsa: 376,
      diferencial: -20,
      gastosExportPerSaco: 34.5,
      tipoCambio: 7.65,
    });
    expect(result.precioBolsaDif.toNumber()).toBe(356);
    expect(result.facturacionLbs.toNumber()).toBe(412.5 * 356);
  });

  it("applies manual costoFinanciero override", () => {
    const result = calculateContract({
      sacos69kg: 275,
      puntaje: 82,
      precioBolsa: 376,
      diferencial: 40,
      gastosExportPerSaco: 34.5,
      tipoCambio: 7.65,
      costoFinanciero: 1000,
    });
    expect(result.costoFinanciero.toNumber()).toBe(1000);
    expect(result.utilidadSinCostoFinanciero.toNumber()).toBe(
      result.utilidadSinGastosExport.toNumber() - 1000
    );
  });

  it("computes commissions at 1.50 USD/quintal each", () => {
    const result = calculateContract({
      sacos69kg: 275,
      puntaje: 82,
      precioBolsa: 376,
      diferencial: 40,
      gastosExportPerSaco: 34.5,
      tipoCambio: 7.65,
    });
    // sacos46kg = 412.5, comision = 412.5 * 1.50 = 618.75 each
    expect(result.comisionCompra.toNumber()).toBe(618.75);
    expect(result.comisionVenta.toNumber()).toBe(618.75);
    expect(result.totalComision.toNumber()).toBe(1237.5);
  });

  it("LIBRAS_ESPANOLAS produces higher facturacion than GUATEMALTECAS", () => {
    const base = {
      sacos69kg: 275,
      puntaje: 82,
      precioBolsa: 300,
      diferencial: 37,
      gastosExportPerSaco: 23,
      tipoCambio: 7.65,
    };
    const guat = calculateContract({ ...base, tipoFacturacion: "LIBRAS_GUATEMALTECAS" });
    const esp = calculateContract({ ...base, tipoFacturacion: "LIBRAS_ESPANOLAS" });

    // Guatemaltecas: 412.5 * 337 = 139,012.50
    expect(guat.facturacionLbs.toNumber()).toBe(412.5 * 337);
    // Espanolas: (275 * 69 * 2.2046) * (337 / 100) ≈ 140,907+
    expect(esp.facturacionLbs.toNumber()).toBeGreaterThan(guat.facturacionLbs.toNumber());
    // Difference should be ~$1,900-2,100
    const diff = esp.facturacionLbs.minus(guat.facturacionLbs).toNumber();
    expect(diff).toBeGreaterThan(1800);
    expect(diff).toBeLessThan(2200);
  });

  it("default tipoFacturacion matches old behavior (regression)", () => {
    const input = {
      sacos69kg: 275,
      puntaje: 82,
      precioBolsa: 376,
      diferencial: 40,
      gastosExportPerSaco: 34.5,
      tipoCambio: 7.65,
    };
    const withDefault = calculateContract({ ...input, tipoFacturacion: "LIBRAS_GUATEMALTECAS" });
    const withoutType = calculateContract(input);
    expect(withDefault.facturacionLbs.toNumber()).toBe(withoutType.facturacionLbs.toNumber());
  });

  it("auto-calculates financial cost from montoCredito", () => {
    const result = calculateContract({
      sacos69kg: 275,
      puntaje: 82,
      precioBolsa: 376,
      diferencial: 40,
      gastosExportPerSaco: 34.5,
      tipoCambio: 7.65,
      montoCredito: 500000,
    });
    // 500000 * (0.08/12) * 2 / 7.65 ≈ 871.46
    expect(result.costoFinanciero.toNumber()).toBeCloseTo(871.46, 0);
  });
});

describe("calculateFinancialCost", () => {
  it("computes monto × (8%/12) × 2 / tipoCambio", () => {
    const result = calculateFinancialCost(500000, 7.65);
    // 500000 * 0.006667 * 2 / 7.65 ≈ 871.46
    expect(result.toNumber()).toBeCloseTo(871.46, 0);
  });
});

describe("calculateMateriaPrima", () => {
  it("matches Enero sheet MP line 1", () => {
    const result = calculateMateriaPrima({
      punteo: 82,
      oro: 412.49,
      rendimiento: 1.3197,
      precioPromQ: 2004.96,
    });
    expect(result.pergamino.toNumber()).toBeCloseTo(544.36, 0);
    expect(result.totalMP.toNumber()).toBeCloseTo(1091420, -2);
  });

  it("computes pergamino = oro * rendimiento", () => {
    const result = calculateMateriaPrima({
      punteo: 82,
      oro: 100,
      rendimiento: 1.32,
      precioPromQ: 2000,
    });
    expect(result.pergamino.toNumber()).toBe(132);
    expect(result.totalMP.toNumber()).toBe(264000);
  });
});

describe("calculateSubproducto", () => {
  it("computes by-product revenue", () => {
    const result = calculateSubproducto({
      contenedores: 4,
      oroPerContenedor: 25,
      precioSinIVA: 2000,
    });
    expect(result.totalOro.toNumber()).toBe(100);
    expect(result.totalPergamino.toNumber()).toBe(200000);
  });

  it("handles fractional containers", () => {
    const result = calculateSubproducto({
      contenedores: 0.6545,
      oroPerContenedor: 25,
      precioSinIVA: 2000,
    });
    expect(result.totalOro.toNumber()).toBeCloseTo(16.3625, 4);
    expect(result.totalPergamino.toNumber()).toBeCloseTo(32725, 0);
  });
});

describe("calculateShipmentMargin", () => {
  it("computes gross margin matching Excel SSOT (P40129 Enero)", () => {
    // From Enero.xlsx Bloque 2: facturacionKgs=171600 USD, tipoCambio=7.65
    const totalFacturacionQTZ = new Decimal(171600).mul(7.65); // Q 1,312,740
    const totalPagoQTZ = new Decimal("1225590.81");
    const totalMateriaPrima = new Decimal("1092736.25");
    const totalISR = new Decimal("65764.16"); // hardcoded in Excel SSOT
    const totalComisionQTZ = new Decimal("9466.88"); // already in QTZ
    const totalSubproducto = new Decimal(0);

    const result = calculateShipmentMargin(
      totalFacturacionQTZ,
      totalPagoQTZ,
      totalMateriaPrima,
      totalISR,
      totalComisionQTZ,
      totalSubproducto
    );

    // utilidadBruta = pago - MP - ISR - comision + subproducto
    // = 1,225,590.81 - 1,092,736.25 - 65,764.16 - 9,466.88 + 0 = 57,623.52
    expect(result.utilidadBruta.toNumber()).toBeCloseTo(57623.52, 0);

    // margin = utilidadBruta / totalFacturacionQTZ = 57,623.52 / 1,312,740 ≈ 4.39%
    expect(result.margenBruto.toNumber()).toBeCloseTo(0.0439, 3);
  });

  it("handles zero revenue without division error", () => {
    const result = calculateShipmentMargin(
      new Decimal(0),
      new Decimal(0),
      new Decimal(0),
      new Decimal(0),
      new Decimal(0),
      new Decimal(0)
    );
    expect(result.margenBruto.toNumber()).toBe(0);
  });
});

describe("calculatePurchaseOrder", () => {
  it("matches Hoja3 OC-2526-01", () => {
    const result = calculatePurchaseOrder({
      quintalesPergamino: 544.5,
      precioPorQQ: 1675,
      fletePorQQ: 15,
      seguridad: 650,
      seguro: 2280.09375,
    });
    expect(result.totalCafe.toNumber()).toBe(912037.5);
    expect(result.totalFlete.toNumber()).toBe(8167.5);
    expect(result.costoTotalAcumulado.toNumber()).toBeCloseTo(923135.09, 0);
  });

  it("includes all extras in total", () => {
    const result = calculatePurchaseOrder({
      quintalesPergamino: 100,
      precioPorQQ: 1000,
      fletePorQQ: 10,
      seguridad: 500,
      seguro: 200,
      cadena: 100,
      cargas: 50,
      descargas: 50,
    });
    expect(result.totalCafe.toNumber()).toBe(100000);
    expect(result.totalFlete.toNumber()).toBe(1000);
    expect(result.costoTotalAcumulado.toNumber()).toBe(101900);
    expect(result.precioPromedio.toNumber()).toBe(1019);
  });
});

describe("calculateFarmFinancing", () => {
  it("matches Hoja2 BRISAS", () => {
    const result = calculateFarmFinancing({
      totalQuetzales: 9909581.76,
      tipoCambio: 7.65,
      aumentoPorcentaje: 0.2,
      porcentajePrestamo: 0.7,
    });
    expect(result.totalUSD.toNumber()).toBeCloseTo(1295370.16, 0);
    expect(result.totalPrestamo.toNumber()).toBeCloseTo(1088110.94, 0);
  });

  it("matches Hoja2 SAN EMILIANO", () => {
    const result = calculateFarmFinancing({
      totalQuetzales: 2175040,
      tipoCambio: 7.65,
      aumentoPorcentaje: 0.2,
      porcentajePrestamo: 0.7,
    });
    expect(result.totalUSD.toNumber()).toBeCloseTo(284318.95, 0);
    expect(result.totalPrestamo.toNumber()).toBeCloseTo(238827.92, 0);
  });
});

describe("aggregateContracts", () => {
  it("sums all contract calculations", () => {
    const c1 = calculateContract({
      sacos69kg: 275,
      puntaje: 82,
      precioBolsa: 376,
      diferencial: 40,
      gastosExportPerSaco: 34.5,
      tipoCambio: 7.65,
    });
    const c2 = calculateContract({
      sacos69kg: 275,
      puntaje: 82,
      precioBolsa: 350,
      diferencial: 15,
      gastosExportPerSaco: 34.5,
      tipoCambio: 7.65,
    });

    const agg = aggregateContracts([c1, c2]);

    expect(agg.totalSacos46.toNumber()).toBe(825);
    expect(agg.totalFactLbs.toNumber()).toBe(
      c1.facturacionLbs.toNumber() + c2.facturacionLbs.toNumber()
    );
    expect(agg.totalPagoQTZ.toNumber()).toBeCloseTo(
      c1.totalPagoQTZ.toNumber() + c2.totalPagoQTZ.toNumber(),
      2
    );
  });

  it("returns zeros for empty array", () => {
    const agg = aggregateContracts([]);
    expect(agg.totalSacos46.toNumber()).toBe(0);
    expect(agg.totalPagoQTZ.toNumber()).toBe(0);
  });
});
