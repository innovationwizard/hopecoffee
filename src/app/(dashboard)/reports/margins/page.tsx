import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getMarginByClient } from "../actions";
import {
  formatGTQ,
  formatPercent,
  formatNumber,
  marginColorClass,
} from "@/lib/utils/format";
import { MarginChart } from "../_components/margin-chart";

export default async function MarginByClientPage() {
  const data = await getMarginByClient();

  const totals = data.reduce(
    (acc, d) => ({
      contracts: acc.contracts + d.numContracts,
      sacos46: acc.sacos46 + d.totalSacos46,
      revenue: acc.revenue + d.totalPagoQTZ,
      gastos: acc.gastos + d.totalGastosExport,
      utilidad: acc.utilidad + d.totalUtilidadSinCF,
    }),
    { contracts: 0, sacos46: 0, revenue: 0, gastos: 0, utilidad: 0 }
  );

  const totalMargin = totals.revenue > 0 ? totals.utilidad / totals.revenue : 0;

  // Top client by margin
  const topMargin = data.length > 0
    ? data.reduce((best, d) => (d.avgMargin > best.avgMargin ? d : best))
    : null;

  // Top client by revenue
  const topRevenue = data.length > 0
    ? data.reduce((best, d) => (d.totalPagoQTZ > best.totalPagoQTZ ? d : best))
    : null;

  return (
    <>
      <PageHeader
        title="Margen por Cliente"
        breadcrumbs={[
          { label: "Reportes", href: "/reports" },
          { label: "Margen por Cliente" },
        ]}
      />

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Clientes Activos
            </p>
            <p className="text-xl font-bold font-mono text-gray-900 dark:text-white mt-1">
              {data.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Margen Ponderado
            </p>
            <p className={`text-xl font-bold font-mono mt-1 ${marginColorClass(totalMargin)}`}>
              {formatPercent(totalMargin)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Mayor Margen
            </p>
            <p className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {topMargin ? `${topMargin.clientCode} ${formatPercent(topMargin.avgMargin)}` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Mayor Revenue
            </p>
            <p className="text-lg font-bold font-mono text-orion-600 dark:text-orion-400 mt-1">
              {topRevenue ? topRevenue.clientCode : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="mb-6">
        <CardHeader>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Margen por Cliente
          </h3>
        </CardHeader>
        <CardContent>
          <MarginChart data={data} />
        </CardContent>
      </Card>

      {/* Detail Table */}
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Detalle por Cliente
          </h3>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="dense-table w-full">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th className="text-right">Contratos</th>
                  <th className="text-right">Sacos 46kg</th>
                  <th className="text-right">Facturación (Q)</th>
                  <th className="text-right">Revenue (Q)</th>
                  <th className="text-right">Gastos Exp. (Q)</th>
                  <th className="text-right">Utilidad (Q)</th>
                  <th className="text-right">Margen</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.clientId}>
                    <td>
                      <span className="font-medium">{d.clientName}</span>
                      <span className="text-xs text-slate-400 ml-1">
                        ({d.clientCode})
                      </span>
                    </td>
                    <td className="text-right font-mono">{d.numContracts}</td>
                    <td className="text-right font-mono">
                      {formatNumber(d.totalSacos46, 0)}
                    </td>
                    <td className="text-right font-mono">
                      {formatGTQ(d.totalFacturacionKgs)}
                    </td>
                    <td className="text-right font-mono">
                      {formatGTQ(d.totalPagoQTZ)}
                    </td>
                    <td className="text-right font-mono">
                      {formatGTQ(d.totalGastosExport)}
                    </td>
                    <td className="text-right font-mono">
                      {formatGTQ(d.totalUtilidadSinCF)}
                    </td>
                    <td className={`text-right font-mono ${marginColorClass(d.avgMargin)}`}>
                      {formatPercent(d.avgMargin)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold border-t-2 border-slate-300 dark:border-orion-700">
                  <td>Total</td>
                  <td className="text-right font-mono">{totals.contracts}</td>
                  <td className="text-right font-mono">
                    {formatNumber(totals.sacos46, 0)}
                  </td>
                  <td className="text-right font-mono">—</td>
                  <td className="text-right font-mono">
                    {formatGTQ(totals.revenue)}
                  </td>
                  <td className="text-right font-mono">
                    {formatGTQ(totals.gastos)}
                  </td>
                  <td className="text-right font-mono">
                    {formatGTQ(totals.utilidad)}
                  </td>
                  <td className={`text-right font-mono ${marginColorClass(totalMargin)}`}>
                    {formatPercent(totalMargin)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
