"use client";

import { formatUSD, formatNumber, formatPercent, marginColorClass } from "@/lib/utils/format";
import type { ContractCalculation } from "@/lib/services/calculations";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const RENDIMIENTO_ESTIMATE = 1.32;

const STATUS_LABELS: Record<string, string> = {
  NEGOCIACION: "Negociación",
  NO_FIJADO: "Confirmado No Fijado",
  FIJADO: "Confirmado Fijado",
  CONFIRMADO: "Confirmado",
  EMBARCADO: "Embarcado",
};

interface OctavioResumenProps {
  embarque: string;
  posicion: string;
  anio: number | undefined;
  cliente: string;
  contrato: string;
  estatus: string;
  lote: string;
  puntuacion: number;
  sacos69kg: number;
  precioBolsaNY: number;
  diferencial: number;
  condicionesPago: string;
  estatusPago: string;
  calc: ContractCalculation | null;
  gastosPerSaco: number;
  costoFinanciero: number;
  qqRechazos: number;
  precioRechazos: number;
  precioPromedioInv: number;
}

function Row({
  tipo,
  label,
  value,
  className,
  bold,
}: {
  tipo: "D" | "F";
  label: string;
  value: string;
  className?: string;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0 ${
        bold ? "border-t-2 border-slate-300 dark:border-slate-600 mt-1 pt-2" : ""
      }`}
    >
      <span
        className={`text-[9px] font-mono w-3 shrink-0 ${
          tipo === "D" ? "text-blue-400" : "text-amber-400"
        }`}
      >
        {tipo}
      </span>
      <span
        className={`text-xs flex-1 ${
          bold
            ? "font-semibold text-slate-700 dark:text-slate-200"
            : "text-slate-500 dark:text-slate-400"
        }`}
      >
        {label}
      </span>
      <span
        className={`text-xs font-mono text-right ${bold ? "font-semibold text-sm" : ""} ${
          className ?? "text-slate-900 dark:text-white"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export function OctavioResumen({
  embarque,
  posicion,
  anio,
  cliente,
  contrato,
  estatus,
  lote,
  puntuacion,
  sacos69kg,
  precioBolsaNY,
  diferencial,
  condicionesPago,
  estatusPago,
  calc,
  gastosPerSaco,
  costoFinanciero,
  qqRechazos,
  precioRechazos,
  precioPromedioInv,
}: OctavioResumenProps) {
  const n = (v: number) => (isNaN(v) || v == null ? 0 : v);

  const sacos46 = n(sacos69kg) * 1.5;
  const totalPrecio = n(precioBolsaNY) + n(diferencial);

  const facturacionLbs = calc ? n(calc.facturacionLbs.toNumber()) : 0;
  const facturacionKgs = calc ? n(calc.facturacionKgs.toNumber()) : 0;
  const totalGastosExport = n(gastosPerSaco) * sacos46;
  const totalCostosFinancieros = n(costoFinanciero);
  const totalVentaRechazos = n(qqRechazos) * n(precioRechazos);
  const quintalesPergamino = sacos46 * RENDIMIENTO_ESTIMATE;
  const totalMateriaPrima = quintalesPergamino * n(precioPromedioInv);
  const comisionVenta = calc ? n(calc.comisionVenta.toNumber()) : 0;
  const comisionCompra = calc ? n(calc.comisionCompra.toNumber()) : 0;

  const utilidadBruta =
    facturacionKgs -
    totalGastosExport -
    totalCostosFinancieros +
    totalVentaRechazos -
    totalMateriaPrima -
    comisionVenta -
    comisionCompra;

  const margenBruto = facturacionKgs > 0 ? utilidadBruta / facturacionKgs : 0;

  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
          Resumen
        </h3>
      </CardHeader>
      <CardContent className="space-y-0 px-4">
        <Row tipo="D" label="Embarque" value={embarque || "—"} />
        <Row tipo="D" label="Posición" value={posicion || "—"} />
        <Row tipo="D" label="Año" value={anio ? String(anio) : "—"} />
        <Row tipo="D" label="Cliente" value={cliente || "—"} />
        <Row tipo="D" label="Contrato" value={contrato || "—"} />
        <Row tipo="D" label="Estatus" value={STATUS_LABELS[estatus] ?? estatus ?? "—"} />
        <Row tipo="D" label="Lote" value={lote || "—"} />
        <Row tipo="D" label="Puntuación" value={puntuacion ? String(puntuacion) : "—"} />
        <Row tipo="D" label="Sacos 46 kg" value={formatNumber(sacos46, 1)} />
        <Row tipo="D" label="Sacos 69 Kg" value={formatNumber(n(sacos69kg), 0)} />
        <Row tipo="D" label="Precio Bolsa NY" value={formatUSD(precioBolsaNY)} />
        <Row tipo="D" label="Total Precio" value={formatUSD(totalPrecio)} />
        <Row tipo="F" label="Facturación Libras" value={formatUSD(facturacionLbs)} />
        <Row tipo="F" label="Facturación Kilos" value={formatUSD(facturacionKgs)} />
        <Row
          tipo="F"
          label="Total Gastos Exportación"
          value={formatUSD(totalGastosExport)}
          className="text-red-600"
        />
        <Row
          tipo="F"
          label="Total Costos Financieros"
          value={formatUSD(totalCostosFinancieros)}
          className="text-red-600"
        />
        <Row
          tipo="F"
          label="Total Venta Rechazos"
          value={formatUSD(totalVentaRechazos)}
          className="text-emerald-600 dark:text-emerald-400"
        />
        <Row
          tipo="F"
          label="Total Materia Prima"
          value={formatUSD(totalMateriaPrima)}
          className="text-red-600"
        />
        <Row
          tipo="F"
          label="Total Comisión Venta"
          value={formatUSD(comisionVenta)}
          className="text-red-600"
        />
        <Row
          tipo="F"
          label="Total Comisión Compras"
          value={formatUSD(comisionCompra)}
          className="text-red-600"
        />
        <Row
          tipo="F"
          label="Utilidad Bruta"
          value={formatUSD(utilidadBruta)}
          className={
            utilidadBruta >= 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600"
          }
          bold
        />
        <Row
          tipo="F"
          label="Margen Bruto"
          value={formatPercent(margenBruto)}
          className={marginColorClass(margenBruto)}
          bold
        />
        <Row tipo="D" label="Condiciones Pago" value={condicionesPago || "—"} />
        <Row tipo="D" label="Estatus Pago" value={estatusPago || "—"} />
      </CardContent>
    </Card>
  );
}
