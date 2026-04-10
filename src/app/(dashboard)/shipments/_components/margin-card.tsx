import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  formatGTQ,
  formatPercent,
  marginColorClass,
} from "@/lib/utils/format";

export function MarginCard({
  totalPagoQTZ,
  totalMateriaPrima,
  totalISR,
  totalComision,
  totalSubproducto,
  utilidadBruta,
  margenBruto,
}: {
  totalPagoQTZ: number;
  totalMateriaPrima: number;
  totalISR: number;
  totalComision: number;
  totalSubproducto: number;
  utilidadBruta: number;
  margenBruto: number;
}) {
  const lines = [
    { label: "Total Pago QTZ", value: totalPagoQTZ, sign: "+" },
    { label: "− Materia Prima", value: -totalMateriaPrima, sign: "−" },
    { label: "− ISR", value: -totalISR, sign: "−" },
    { label: "− Comisión", value: -totalComision, sign: "−" },
    { label: "+ Subproducto", value: totalSubproducto, sign: "+" },
  ];

  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Resumen P&L
        </h3>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="space-y-2">
          {lines.map((l) => (
            <div key={l.label} className="flex justify-between text-sm">
              <dt className="text-gray-500 dark:text-gray-400">{l.label}</dt>
              <dd className="font-mono font-medium text-gray-900 dark:text-white">
                {formatGTQ(Math.abs(l.value))}
              </dd>
            </div>
          ))}
        </dl>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2">
          <div className="flex justify-between">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Utilidad Bruta
            </span>
            <span
              className={`text-lg font-bold font-mono ${
                utilidadBruta >= 0
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {formatGTQ(utilidadBruta)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Margen Bruto</span>
            <span
              className={`text-lg font-bold font-mono ${marginColorClass(
                margenBruto
              )}`}
            >
              {formatPercent(margenBruto)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
