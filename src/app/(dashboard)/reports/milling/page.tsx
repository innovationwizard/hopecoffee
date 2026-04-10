import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getMillingEfficiencyReport } from "../actions";
import { formatNumber, formatPercent } from "@/lib/utils/format";

export default async function MillingReportPage() {
  const data = await getMillingEfficiencyReport();

  const totals = data.reduce(
    (acc, d) => ({
      inputQQ: acc.inputQQ + d.inputQQ,
      oroQQ: acc.oroQQ + d.oroOutputQQ,
      segundaQQ: acc.segundaQQ + d.segundaQQ,
      mermaQQ: acc.mermaQQ + d.mermaQQ,
    }),
    { inputQQ: 0, oroQQ: 0, segundaQQ: 0, mermaQQ: 0 }
  );

  const avgYield = totals.inputQQ > 0 ? totals.oroQQ / totals.inputQQ : 0;

  return (
    <>
      <PageHeader
        title="Eficiencia de Trilla"
        breadcrumbs={[
          { label: "Reportes", href: "/reports" },
          { label: "Eficiencia de Trilla" },
        ]}
      />

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Ordenes Completadas
            </p>
            <p className="text-xl font-bold font-mono text-gray-900 dark:text-white mt-1">
              {data.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Input Total (QQ)
            </p>
            <p className="text-xl font-bold font-mono text-gray-900 dark:text-white mt-1">
              {formatNumber(totals.inputQQ, 1)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Oro Output (QQ)
            </p>
            <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {formatNumber(totals.oroQQ, 1)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Rendimiento Promedio
            </p>
            <p className="text-xl font-bold font-mono text-orion-600 dark:text-orion-400 mt-1">
              {formatPercent(avgYield)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Detalle por Orden
          </h3>
        </CardHeader>
        <CardContent>
          {data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="dense-table w-full">
                <thead>
                  <tr>
                    <th>Orden</th>
                    <th>Fecha</th>
                    <th className="text-right">Input (QQ)</th>
                    <th className="text-right">Oro (QQ)</th>
                    <th className="text-right">Segunda (QQ)</th>
                    <th className="text-right">Merma (QQ)</th>
                    <th className="text-right">Rendimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((d) => (
                    <tr key={d.orderNumber}>
                      <td className="font-medium font-mono">{d.orderNumber}</td>
                      <td className="text-xs text-slate-500">{d.date}</td>
                      <td className="text-right font-mono">
                        {formatNumber(d.inputQQ, 2)}
                      </td>
                      <td className="text-right font-mono">
                        {formatNumber(d.oroOutputQQ, 2)}
                      </td>
                      <td className="text-right font-mono">
                        {formatNumber(d.segundaQQ, 2)}
                      </td>
                      <td className="text-right font-mono">
                        {formatNumber(d.mermaQQ, 2)}
                      </td>
                      <td className={`text-right font-mono font-semibold ${
                        d.yield >= 0.80
                          ? "text-emerald-600 dark:text-emerald-400"
                          : d.yield >= 0.70
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-red-600 dark:text-red-400"
                      }`}>
                        {formatPercent(d.yield)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold border-t-2 border-slate-300 dark:border-orion-700">
                    <td>Total</td>
                    <td></td>
                    <td className="text-right font-mono">
                      {formatNumber(totals.inputQQ, 2)}
                    </td>
                    <td className="text-right font-mono">
                      {formatNumber(totals.oroQQ, 2)}
                    </td>
                    <td className="text-right font-mono">
                      {formatNumber(totals.segundaQQ, 2)}
                    </td>
                    <td className="text-right font-mono">
                      {formatNumber(totals.mermaQQ, 2)}
                    </td>
                    <td className="text-right font-mono">
                      {formatPercent(avgYield)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">
              No hay ordenes de trilla completadas.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
