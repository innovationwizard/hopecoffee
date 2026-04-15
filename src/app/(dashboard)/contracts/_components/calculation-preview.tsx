"use client";

import { formatUSD, formatGTQ, formatNumber, formatPercent, marginColorClass } from "@/lib/utils/format";
import type { ContractCalculation } from "@/lib/services/calculations";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface CalcPreviewProps {
  calc: ContractCalculation | null;
  gastosPerSaco?: number;
  costoFinanciero?: number;
  precioPromedioInv?: number;
  subproductosQty?: number;
  precioSubproducto?: number;
}

// Inventory section uses a fixed rendimiento estimate at contract creation
// time because the real per-batch value lives on MateriaPrima and is not
// known until purchasing happens. 1.32 is the historical average.
const RENDIMIENTO_ESTIMATE = 1.32;

function Row({
  label,
  value,
  className,
  bold,
}: {
  label: string;
  value: string;
  className?: string;
  bold?: boolean;
}) {
  return (
    <div className={`flex justify-between items-center py-0.5 ${bold ? "border-t border-slate-300 dark:border-slate-600 pt-1.5 mt-1" : ""}`}>
      <span className={`text-xs ${bold ? "font-semibold text-slate-700 dark:text-slate-200" : "text-slate-500 dark:text-slate-400"}`}>
        {label}
      </span>
      <span className={`text-xs font-mono ${className ?? ""} ${bold ? "font-semibold" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
        {title}
      </div>
      {children}
    </div>
  );
}

export function CalculationPreview({
  calc,
  gastosPerSaco: _gastosPerSaco = 0,
  costoFinanciero: _costoFinanciero = 0,
  precioPromedioInv: _precioPromedioInv = 0,
  subproductosQty: _subproductosQty = 0,
  precioSubproducto: _precioSubproducto = 0,
}: CalcPreviewProps) {
  // Sanitize NaN from empty number inputs
  const n = (v: number) => (isNaN(v) || v == null ? 0 : v);
  const gastosPerSaco = n(_gastosPerSaco);
  const costoFinanciero = n(_costoFinanciero);
  const precioPromedioInv = n(_precioPromedioInv);
  const subproductosQty = n(_subproductosQty);
  const precioSubproducto = n(_precioSubproducto);
  if (!calc) {
    return (
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            P&L del Contrato
          </h3>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-slate-400">
            Ingresa sacos y precios para ver el cálculo.
          </p>
        </CardContent>
      </Card>
    );
  }

  const sacos46 = n(calc.sacos46kg.toNumber());
  const precioBolsaDif = n(calc.precioBolsaDif.toNumber());
  // Always display the kg facturación per business_rules §1.5/§1.6.
  const facturacionTotal = n(calc.facturacionKgs.toNumber());
  const totalGastosExport = n(calc.gastosExportacion.toNumber());
  const totalGastosFinancieros = n(costoFinanciero);

  // Inventory: quintales pergamino = sacos46 * rendimiento (estimate)
  const quintalesPergamino = sacos46 * RENDIMIENTO_ESTIMATE;
  const totalCostoInventario = quintalesPergamino * precioPromedioInv;

  // Subproducto
  const totalVentaSubproducto = subproductosQty * precioSubproducto;

  // P&L
  const ingresoVenta = facturacionTotal;
  const costoTotal = totalGastosExport + totalGastosFinancieros + totalCostoInventario;
  const utilidadBruta = ingresoVenta + totalVentaSubproducto - costoTotal;
  const margenBruto = ingresoVenta > 0 ? utilidadBruta / ingresoVenta : 0;

  // Total pago QTZ
  const totalPagoQTZ = n(calc.totalPagoQTZ.toNumber());

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            P&L del Contrato
          </h3>
          <span className="text-[10px] font-mono text-slate-400">Kilos</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-0">

        {/* Pricing */}
        <Section title="Precio">
          <Row label="Precio por Saco 46kg" value={formatUSD(precioBolsaDif)} />
          <Row label="Quintales (46kg)" value={formatNumber(sacos46, 1)} />
        </Section>

        {/* Revenue */}
        <Section title="Facturación">
          <Row label="Total Facturación" value={formatUSD(facturacionTotal)} bold />
          <Row label="Total Pago (Q)" value={formatGTQ(totalPagoQTZ)} className="text-emerald-600 dark:text-emerald-400" bold />
        </Section>

        {/* Costs */}
        <Section title="Costos">
          <Row label="Gastos Exportación" value={formatUSD(totalGastosExport)} className="text-red-600" />
          <Row label="Gastos Financieros" value={formatUSD(totalGastosFinancieros)} className="text-red-600" />
        </Section>

        {/* Inventory */}
        <Section title="Inventario">
          <Row label="QQ Pergamino" value={formatNumber(quintalesPergamino, 1)} />
          <Row label="Precio Prom. Inv." value={formatGTQ(precioPromedioInv)} />
          <Row label="Costo Inventario" value={formatUSD(totalCostoInventario)} className="text-red-600" bold />
        </Section>

        {/* Subproducto */}
        <Section title="Subproducto">
          <Row label="QQ Subproducto" value={formatNumber(subproductosQty, 1)} />
          <Row label="Venta Subproducto" value={formatUSD(totalVentaSubproducto)} className="text-emerald-600" bold />
        </Section>

        {/* Bottom line */}
        <div className="border-t-2 border-slate-300 dark:border-slate-600 mt-2 pt-2 space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              Margen Bruto
            </span>
            <span className={`text-sm font-bold font-mono ${marginColorClass(margenBruto)}`}>
              {formatPercent(margenBruto)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              Utilidad Bruta
            </span>
            <span className={`text-sm font-bold font-mono ${utilidadBruta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600"}`}>
              {formatUSD(utilidadBruta)}
            </span>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
