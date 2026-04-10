import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getInventoryReport } from "../actions";
import { formatNumber } from "@/lib/utils/format";

const STAGE_LABELS: Record<string, string> = {
  PERGAMINO_BODEGA: "Pergamino",
  EN_PROCESO: "En Proceso",
  ORO_EXPORTABLE: "Oro Exportable",
  EXPORTADO: "Exportado",
  SUBPRODUCTO: "Subproducto",
};

function stageLabel(stage: string) {
  return STAGE_LABELS[stage] ?? stage;
}

export default async function InventoryReportPage() {
  const { byFacility, bySupplier, byStage } = await getInventoryReport();

  const totalQQ = byStage.reduce((sum, s) => sum + s.qq, 0);
  const totalLots = byStage.reduce((sum, s) => sum + s.count, 0);

  return (
    <>
      <PageHeader
        title="Inventario"
        breadcrumbs={[
          { label: "Reportes", href: "/reports" },
          { label: "Inventario" },
        ]}
      />

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Total QQ
            </p>
            <p className="text-xl font-bold font-mono text-gray-900 dark:text-white mt-1">
              {formatNumber(totalQQ, 1)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Total Lotes
            </p>
            <p className="text-xl font-bold font-mono text-gray-900 dark:text-white mt-1">
              {totalLots}
            </p>
          </CardContent>
        </Card>
        {byStage
          .filter((s) => ["PERGAMINO_BODEGA", "ORO_EXPORTABLE"].includes(s.stage))
          .map((s) => (
            <Card key={s.stage}>
              <CardContent className="py-5 text-center">
                <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                  {stageLabel(s.stage)}
                </p>
                <p className="text-xl font-bold font-mono text-gray-900 dark:text-white mt-1">
                  {formatNumber(s.qq, 1)} QQ
                </p>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* By Stage */}
      <Card className="mb-6">
        <CardHeader>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Por Estado
          </h3>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="dense-table w-full">
              <thead>
                <tr>
                  <th>Estado</th>
                  <th className="text-right">Lotes</th>
                  <th className="text-right">QQ</th>
                </tr>
              </thead>
              <tbody>
                {byStage.map((s) => (
                  <tr key={s.stage}>
                    <td className="font-medium">{stageLabel(s.stage)}</td>
                    <td className="text-right font-mono">{s.count}</td>
                    <td className="text-right font-mono">{formatNumber(s.qq, 2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold border-t-2 border-slate-300 dark:border-orion-700">
                  <td>Total</td>
                  <td className="text-right font-mono">{totalLots}</td>
                  <td className="text-right font-mono">{formatNumber(totalQQ, 2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* By Facility */}
      <Card className="mb-6">
        <CardHeader>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Por Beneficio
          </h3>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="dense-table w-full">
              <thead>
                <tr>
                  <th>Beneficio</th>
                  <th>Estado</th>
                  <th className="text-right">Lotes</th>
                  <th className="text-right">QQ</th>
                </tr>
              </thead>
              <tbody>
                {byFacility.map((f) =>
                  f.stages.map((s, i) => (
                    <tr key={`${f.name}-${s.stage}`}>
                      {i === 0 && (
                        <td className="font-medium" rowSpan={f.stages.length}>
                          {f.name}
                        </td>
                      )}
                      <td>{stageLabel(s.stage)}</td>
                      <td className="text-right font-mono">{s.count}</td>
                      <td className="text-right font-mono">{formatNumber(s.qq, 2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* By Supplier */}
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Por Proveedor
          </h3>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="dense-table w-full">
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>Estado</th>
                  <th className="text-right">Lotes</th>
                  <th className="text-right">QQ</th>
                </tr>
              </thead>
              <tbody>
                {bySupplier.map((sup) =>
                  sup.stages.map((s, i) => (
                    <tr key={`${sup.name}-${s.stage}`}>
                      {i === 0 && (
                        <td className="font-medium" rowSpan={sup.stages.length}>
                          {sup.name}
                        </td>
                      )}
                      <td>{stageLabel(s.stage)}</td>
                      <td className="text-right font-mono">{s.count}</td>
                      <td className="text-right font-mono">{formatNumber(s.qq, 2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {bySupplier.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              Sin datos de inventario.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
