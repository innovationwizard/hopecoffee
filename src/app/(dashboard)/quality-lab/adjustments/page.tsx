import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getYieldAdjustments } from "../actions";
import { formatNumber, toNum } from "@/lib/utils/format";
import { AdjustmentActions } from "./_components/adjustment-actions";

const STATUS_VARIANT: Record<string, "amber" | "emerald" | "red"> = {
  PENDIENTE: "amber",
  APLICADO: "emerald",
  RECHAZADO: "red",
};

const STATUS_LABEL: Record<string, string> = {
  PENDIENTE: "Pendiente",
  APLICADO: "Aplicado",
  RECHAZADO: "Rechazado",
};

export default async function YieldAdjustmentsPage() {
  const adjustments = await getYieldAdjustments();

  return (
    <div>
      <PageHeader
        title="Ajustes de Rendimiento"
        breadcrumbs={[
          { label: "Laboratorio de Calidad", href: "/quality-lab" },
          { label: "Ajustes de Rendimiento" },
        ]}
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-orion-800 text-left">
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">
                  Lote
                </th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">
                  Proveedor
                </th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-right">
                  Rend. Contratado
                </th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-right">
                  Rend. Real
                </th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-right">
                  Variacion
                </th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-right">
                  Ajuste/QQ
                </th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-right">
                  Total Ajuste
                </th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">
                  Estado
                </th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-orion-800">
              {adjustments.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-slate-400"
                  >
                    No hay ajustes de rendimiento.
                  </td>
                </tr>
              )}
              {adjustments.map((adj) => {
                const contracted = toNum(adj.contractedYield);
                const actual = toNum(adj.actualYield);
                const variance = actual - contracted;

                return (
                  <tr
                    key={adj.id}
                    className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-slate-900 dark:text-white">
                      {adj.cuppingRecord.lot.lotNumber}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {adj.cuppingRecord.lot.supplier?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900 dark:text-white">
                      {formatNumber(contracted, 4)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900 dark:text-white">
                      {formatNumber(actual, 4)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        variance > 0
                          ? "text-emerald-600"
                          : variance < 0
                            ? "text-red-600"
                            : "text-slate-500"
                      }`}
                    >
                      {variance > 0 ? "+" : ""}
                      {formatNumber(variance, 4)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900 dark:text-white">
                      Q{formatNumber(toNum(adj.priceAdjustmentPerQQ), 2)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-white">
                      Q{formatNumber(toNum(adj.totalAdjustment), 2)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[adj.status] ?? "gray"}>
                        {STATUS_LABEL[adj.status] ?? adj.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {adj.status === "PENDIENTE" ? (
                        <AdjustmentActions id={adj.id} />
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
