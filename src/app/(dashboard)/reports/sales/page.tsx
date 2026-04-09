import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getSalesByMonth } from "../actions";
import {
  formatGTQ,
  formatPercent,
  formatNumber,
  marginColorClass,
} from "@/lib/utils/format";
import { SalesChart } from "../_components/sales-chart";

export default async function SalesByMonthPage() {
  const data = await getSalesByMonth();

  const totals = data.reduce(
    (acc, d) => ({
      contracts: acc.contracts + d.numContracts,
      containers: acc.containers + d.numContainers,
      sacos69: acc.sacos69 + d.totalSacos69,
      sacos46: acc.sacos46 + d.totalSacos46,
      revenue: acc.revenue + d.totalPagoQTZ,
      gastos: acc.gastos + d.totalGastosExport,
      utilidad: acc.utilidad + d.utilidadBruta,
    }),
    {
      contracts: 0,
      containers: 0,
      sacos69: 0,
      sacos46: 0,
      revenue: 0,
      gastos: 0,
      utilidad: 0,
    }
  );

  const totalMargin = totals.revenue > 0 ? totals.utilidad / totals.revenue : 0;

  return (
    <>
      <PageHeader
        title="Ventas por Mes"
        breadcrumbs={[
          { label: "Reportes", href: "/reports" },
          { label: "Ventas por Mes" },
        ]}
      />

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Total Revenue
            </p>
            <p className="text-xl font-bold font-mono text-orion-600 dark:text-orion-400 mt-1">
              {formatGTQ(totals.revenue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Utilidad Bruta
            </p>
            <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {formatGTQ(totals.utilidad)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Margen Promedio
            </p>
            <p className={`text-xl font-bold font-mono mt-1 ${marginColorClass(totalMargin)}`}>
              {formatPercent(totalMargin)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Contenedores
            </p>
            <p className="text-xl font-bold font-mono text-gray-900 dark:text-white mt-1">
              {totals.containers}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="mb-6">
        <CardHeader>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Revenue y Utilidad por Mes
          </h3>
        </CardHeader>
        <CardContent>
          <SalesChart data={data} />
        </CardContent>
      </Card>

      {/* Detail Table */}
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Detalle por Embarque
          </h3>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="dense-table w-full">
              <thead>
                <tr>
                  <th>Embarque</th>
                  <th className="text-right">Cont.</th>
                  <th className="text-right">Contratos</th>
                  <th className="text-right">Sacos 69kg</th>
                  <th className="text-right">Sacos 46kg</th>
                  <th className="text-right">Revenue (Q)</th>
                  <th className="text-right">Gastos (Q)</th>
                  <th className="text-right">Utilidad (Q)</th>
                  <th className="text-right">Margen</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr key={`${d.year}-${d.month}`}>
                    <td className="font-medium">{d.label}</td>
                    <td className="text-right font-mono">{d.numContainers}</td>
                    <td className="text-right font-mono">{d.numContracts}</td>
                    <td className="text-right font-mono">
                      {formatNumber(d.totalSacos69, 0)}
                    </td>
                    <td className="text-right font-mono">
                      {formatNumber(d.totalSacos46, 0)}
                    </td>
                    <td className="text-right font-mono">
                      {formatGTQ(d.totalPagoQTZ)}
                    </td>
                    <td className="text-right font-mono">
                      {formatGTQ(d.totalGastosExport)}
                    </td>
                    <td className="text-right font-mono">
                      {formatGTQ(d.utilidadBruta)}
                    </td>
                    <td className={`text-right font-mono ${marginColorClass(d.margenBruto)}`}>
                      {formatPercent(d.margenBruto)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold border-t-2 border-slate-300 dark:border-orion-700">
                  <td>Total</td>
                  <td className="text-right font-mono">{totals.containers}</td>
                  <td className="text-right font-mono">{totals.contracts}</td>
                  <td className="text-right font-mono">
                    {formatNumber(totals.sacos69, 0)}
                  </td>
                  <td className="text-right font-mono">
                    {formatNumber(totals.sacos46, 0)}
                  </td>
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
