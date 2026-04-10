import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getYieldVarianceReport } from "../actions";
import { formatNumber, formatPercent } from "@/lib/utils/format";

const TOLERANCE = 0.01; // 1% tolerance threshold for coloring

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  APROBADO: "Aprobado",
  APLICADO: "Aplicado",
  RECHAZADO: "Rechazado",
};

export default async function YieldReportPage() {
  const data = await getYieldVarianceReport();

  const lotsWithVariance = data.filter((d) => Math.abs(d.variance) > TOLERANCE);
  const avgVariance =
    data.length > 0
      ? data.reduce((sum, d) => sum + d.variance, 0) / data.length
      : 0;

  return (
    <>
      <PageHeader
        title="Varianza de Rendimiento"
        breadcrumbs={[
          { label: "Reportes", href: "/reports" },
          { label: "Varianza de Rendimiento" },
        ]}
      />

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Lotes Analizados
            </p>
            <p className="text-xl font-bold font-mono text-gray-900 dark:text-white mt-1">
              {data.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Varianza Promedio
            </p>
            <p className={`text-xl font-bold font-mono mt-1 ${
              Math.abs(avgVariance) > TOLERANCE
                ? "text-red-600 dark:text-red-400"
                : "text-emerald-600 dark:text-emerald-400"
            }`}>
              {formatPercent(avgVariance)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Fuera de Tolerancia
            </p>
            <p className={`text-xl font-bold font-mono mt-1 ${
              lotsWithVariance.length > 0
                ? "text-amber-600 dark:text-amber-400"
                : "text-emerald-600 dark:text-emerald-400"
            }`}>
              {lotsWithVariance.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Detalle por Lote
          </h3>
        </CardHeader>
        <CardContent>
          {data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="dense-table w-full">
                <thead>
                  <tr>
                    <th>Lote</th>
                    <th>Proveedor</th>
                    <th className="text-right">Contratado</th>
                    <th className="text-right">Real</th>
                    <th className="text-right">Varianza</th>
                    <th>Ajuste</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((d) => {
                    const outOfTolerance = Math.abs(d.variance) > TOLERANCE;
                    return (
                      <tr key={d.lotNumber}>
                        <td className="font-medium font-mono">{d.lotNumber}</td>
                        <td>{d.supplier}</td>
                        <td className="text-right font-mono">
                          {formatNumber(d.contracted, 4)}
                        </td>
                        <td className="text-right font-mono">
                          {formatNumber(d.actual, 4)}
                        </td>
                        <td className={`text-right font-mono ${
                          outOfTolerance
                            ? "text-red-600 dark:text-red-400 font-semibold"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}>
                          {formatPercent(d.variance)}
                        </td>
                        <td>
                          {d.adjustmentStatus ? (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              d.adjustmentStatus === "PENDIENTE"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                                : d.adjustmentStatus === "APLICADO" || d.adjustmentStatus === "APROBADO"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                            }`}>
                              {STATUS_LABELS[d.adjustmentStatus] ?? d.adjustmentStatus}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">--</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">
              No hay lotes con rendimiento contratado y real registrado.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
