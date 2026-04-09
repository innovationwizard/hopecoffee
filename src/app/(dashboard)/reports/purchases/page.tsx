import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getPurchasesBySupplier } from "../actions";
import { formatGTQ, formatNumber } from "@/lib/utils/format";
import { PurchasesChart } from "../_components/purchases-chart";

export default async function PurchasesBySupplierPage() {
  const data = await getPurchasesBySupplier();

  const totals = data.reduce(
    (acc, d) => ({
      pos: acc.pos + d.numPOs,
      qqPerg: acc.qqPerg + d.totalQQPergamino,
      costCafe: acc.costCafe + d.totalCostQTZ,
      flete: acc.flete + d.totalFlete,
      costoTotal: acc.costoTotal + d.costoTotalAccum,
      accountEntries: acc.accountEntries + d.numAccountEntries,
      accountQQ: acc.accountQQ + d.accountTotalQQ,
      accountQTZ: acc.accountQTZ + d.accountTotalQTZ,
    }),
    {
      pos: 0,
      qqPerg: 0,
      costCafe: 0,
      flete: 0,
      costoTotal: 0,
      accountEntries: 0,
      accountQQ: 0,
      accountQTZ: 0,
    }
  );

  const avgPrice = totals.qqPerg > 0 ? totals.costCafe / totals.qqPerg : 0;

  return (
    <>
      <PageHeader
        title="Compras por Proveedor"
        breadcrumbs={[
          { label: "Reportes", href: "/reports" },
          { label: "Compras por Proveedor" },
        ]}
      />

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Proveedores
            </p>
            <p className="text-xl font-bold font-mono text-gray-900 dark:text-white mt-1">
              {data.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              QQ Pergamino Total
            </p>
            <p className="text-xl font-bold font-mono text-gray-900 dark:text-white mt-1">
              {formatNumber(totals.qqPerg, 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Costo Total
            </p>
            <p className="text-xl font-bold font-mono text-orion-600 dark:text-orion-400 mt-1">
              {formatGTQ(totals.costoTotal)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Precio Prom. / QQ
            </p>
            <p className="text-xl font-bold font-mono text-gray-900 dark:text-white mt-1">
              {formatGTQ(avgPrice)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="mb-6">
        <CardHeader>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Costo por Proveedor (Café + Flete)
          </h3>
        </CardHeader>
        <CardContent>
          <PurchasesChart data={data} />
        </CardContent>
      </Card>

      {/* Purchase Orders Table */}
      <Card className="mb-6">
        <CardHeader>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Órdenes de Compra por Proveedor
          </h3>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="dense-table w-full">
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th className="text-right">OCs</th>
                  <th className="text-right">QQ Perg.</th>
                  <th className="text-right">Costo Café (Q)</th>
                  <th className="text-right">Flete (Q)</th>
                  <th className="text-right">Costo Total (Q)</th>
                  <th className="text-right">Precio Prom. / QQ</th>
                </tr>
              </thead>
              <tbody>
                {data
                  .filter((d) => d.numPOs > 0)
                  .map((d) => (
                    <tr key={d.supplierId}>
                      <td>
                        <span className="font-medium">{d.supplierName}</span>
                        <span className="text-xs text-slate-400 ml-1">
                          ({d.supplierCode})
                        </span>
                      </td>
                      <td className="text-right font-mono">{d.numPOs}</td>
                      <td className="text-right font-mono">
                        {formatNumber(d.totalQQPergamino, 2)}
                      </td>
                      <td className="text-right font-mono">
                        {formatGTQ(d.totalCostQTZ)}
                      </td>
                      <td className="text-right font-mono">
                        {formatGTQ(d.totalFlete)}
                      </td>
                      <td className="text-right font-mono">
                        {formatGTQ(d.costoTotalAccum)}
                      </td>
                      <td className="text-right font-mono">
                        {formatGTQ(d.precioPromedio)}
                      </td>
                    </tr>
                  ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold border-t-2 border-slate-300 dark:border-orion-700">
                  <td>Total</td>
                  <td className="text-right font-mono">{totals.pos}</td>
                  <td className="text-right font-mono">
                    {formatNumber(totals.qqPerg, 2)}
                  </td>
                  <td className="text-right font-mono">
                    {formatGTQ(totals.costCafe)}
                  </td>
                  <td className="text-right font-mono">
                    {formatGTQ(totals.flete)}
                  </td>
                  <td className="text-right font-mono">
                    {formatGTQ(totals.costoTotal)}
                  </td>
                  <td className="text-right font-mono">
                    {formatGTQ(avgPrice)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Account Entries Summary */}
      {totals.accountEntries > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Estado de Cuenta por Proveedor
            </h3>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="dense-table w-full">
                <thead>
                  <tr>
                    <th>Proveedor</th>
                    <th className="text-right">Entradas</th>
                    <th className="text-right">QQ Pergamino</th>
                    <th className="text-right">Total (Q)</th>
                    <th className="text-right">Precio Prom. / QQ</th>
                  </tr>
                </thead>
                <tbody>
                  {data
                    .filter((d) => d.numAccountEntries > 0)
                    .map((d) => {
                      const acctAvg =
                        d.accountTotalQQ > 0
                          ? d.accountTotalQTZ / d.accountTotalQQ
                          : 0;
                      return (
                        <tr key={`acct-${d.supplierId}`}>
                          <td>
                            <span className="font-medium">{d.supplierName}</span>
                          </td>
                          <td className="text-right font-mono">
                            {d.numAccountEntries}
                          </td>
                          <td className="text-right font-mono">
                            {formatNumber(d.accountTotalQQ, 2)}
                          </td>
                          <td className="text-right font-mono">
                            {formatGTQ(d.accountTotalQTZ)}
                          </td>
                          <td className="text-right font-mono">
                            {formatGTQ(acctAvg)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
                <tfoot>
                  <tr className="font-semibold border-t-2 border-slate-300 dark:border-orion-700">
                    <td>Total</td>
                    <td className="text-right font-mono">
                      {totals.accountEntries}
                    </td>
                    <td className="text-right font-mono">
                      {formatNumber(totals.accountQQ, 2)}
                    </td>
                    <td className="text-right font-mono">
                      {formatGTQ(totals.accountQTZ)}
                    </td>
                    <td className="text-right font-mono">
                      {totals.accountQQ > 0
                        ? formatGTQ(totals.accountQTZ / totals.accountQQ)
                        : "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
