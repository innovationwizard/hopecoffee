"use client";

import { formatUSD, formatGTQ, formatNumber } from "@/lib/utils/format";
import type { ContractCalculation } from "@/lib/services/calculations";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CalcPreviewProps {
  calc: ContractCalculation | null;
  tipoFacturacion?: string;
  posicionBolsa?: string | null;
  status?: string;
}

/**
 * source — where this number ultimately comes from:
 *   "external"  → typed by user; derivation/source lives outside the app
 *   "app"       → computed from data managed in another app module
 *   undefined   → locally computed from other values on this same form
 */
function Row({
  label,
  value,
  className,
  source,
}: {
  label: string;
  value: string;
  className?: string;
  source?: "external" | "app";
}) {
  const borderClass =
    source === "external"
      ? "border-l-2 border-amber-400 dark:border-amber-500 pl-2"
      : source === "app"
      ? "border-l-2 border-blue-400 dark:border-blue-500 pl-2"
      : "";

  return (
    <div className={`flex justify-between items-center py-1 ${borderClass}`}>
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`text-sm font-mono ${className ?? ""}`}>{value}</span>
    </div>
  );
}

export function CalculationPreview({ calc, tipoFacturacion, posicionBolsa, status }: CalcPreviewProps) {
  if (!calc) {
    return (
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Vista Previa
          </h3>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400">
            Ingresa sacos y precios para ver el cálculo.
          </p>
        </CardContent>
      </Card>
    );
  }

  const margin = calc.totalPagoQTZ.isZero()
    ? 0
    : calc.utilidadSinCostoFinanciero
        .div(calc.facturacionKgs)
        .toNumber();

  const marginWarning = margin < 0 || margin > 0.25;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Vista Previa
          </h3>
          {tipoFacturacion && (
            <Badge variant={tipoFacturacion === "LIBRAS_ESPANOLAS" ? "blue" : "gray"}>
              {tipoFacturacion === "LIBRAS_ESPANOLAS" ? "Lbs Esp." : "Lbs Guat."}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-0.5">
        <Row
          label="Quintales"
          value={formatNumber(calc.sacos46kg.toNumber(), 1)}
          source="external"
        />
        <Row
          label="Bolsa+Dif"
          value={formatUSD(calc.precioBolsaDif.toNumber())}
          source="external"
        />

        <div className="border-t border-gray-200 dark:border-gray-700 my-2" />

        <Row
          label="Fact. Lbs"
          value={formatUSD(calc.facturacionLbs.toNumber())}
        />
        <Row
          label="Fact. Kgs"
          value={formatUSD(calc.facturacionKgs.toNumber())}
        />
        <Row
          label="Gastos Export."
          value={formatUSD(calc.gastosExportacion.toNumber())}
          className="text-red-600"
          source="app"
        />
        <Row
          label="Utilidad s/GE"
          value={formatUSD(calc.utilidadSinGastosExport.toNumber())}
        />
        <Row
          label="Costo Financiero"
          value={formatUSD(calc.costoFinanciero.toNumber())}
          className="text-red-600"
          source="app"
        />
        <Row
          label="Utilidad s/CF"
          value={formatUSD(calc.utilidadSinCostoFinanciero.toNumber())}
        />

        <div className="border-t border-gray-200 dark:border-gray-700 my-2" />

        <Row
          label="Comisión Compra"
          value={formatUSD(calc.comisionCompra.toNumber())}
          className="text-red-600"
          source="app"
        />
        <Row
          label="Comisión Venta"
          value={formatUSD(calc.comisionVenta.toNumber())}
          className="text-red-600"
          source="app"
        />

        <div className="border-t-2 border-gray-300 dark:border-gray-600 my-2" />

        <div className="flex justify-between items-center py-1">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            Total Pago Q
          </span>
          <span className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400">
            {formatGTQ(calc.totalPagoQTZ.toNumber())}
          </span>
        </div>

        {marginWarning && (
          <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-700 dark:text-amber-400">
            {margin < 0
              ? "Margen negativo. Verifica precios."
              : `Margen (${(margin * 100).toFixed(1)}%) inusualmente alto. Verifica inputs.`}
          </div>
        )}

        {status === "NEGOCIACION" && posicionBolsa && (
          <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-xs text-blue-600 dark:text-blue-400">
            Precio ICE {posicionBolsa}: -- (integración pendiente Fase 3)
          </div>
        )}

        <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800 flex gap-4 text-[10px] text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-1 h-3 bg-amber-400 rounded-sm" /> Input externo
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1 h-3 bg-blue-400 rounded-sm" /> Dato del sistema
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
