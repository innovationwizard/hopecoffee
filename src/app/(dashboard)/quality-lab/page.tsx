import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCuppingRecords, getCuppingStats } from "./actions";
import { formatDate, formatNumber, toNum } from "@/lib/utils/format";

function scoreVariant(score: number): "emerald" | "blue" | "amber" {
  if (score >= 85) return "emerald";
  if (score >= 80) return "blue";
  return "amber";
}

export default async function QualityLabPage() {
  const [records, stats] = await Promise.all([
    getCuppingRecords(),
    getCuppingStats(),
  ]);

  return (
    <div>
      <PageHeader
        title="Laboratorio de Calidad"
        breadcrumbs={[{ label: "Laboratorio de Calidad" }]}
        action={
          <div className="flex gap-2">
            <Link href="/quality-lab/adjustments">
              <Button variant="outline" size="sm">
                Ajustes de Rendimiento
              </Button>
            </Link>
            <Link href="/quality-lab/new">
              <Button size="sm">Nueva Catacion</Button>
            </Link>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Total Cataciones
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats.totalRecords}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Promedio SCA
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats.avgScore != null ? formatNumber(stats.avgScore, 2) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Lotes Pendientes
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats.lotsWithoutCupping}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Records Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-orion-800 text-left">
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">
                  Fecha
                </th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">
                  Lote
                </th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">
                  Proveedor
                </th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-right">
                  Puntaje SCA
                </th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-right">
                  Rendimiento
                </th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">
                  Notas
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-orion-800">
              {records.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-slate-400"
                  >
                    No hay cataciones registradas.
                  </td>
                </tr>
              )}
              {records.map((r) => {
                const score = toNum(r.totalScore);
                return (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <td className="px-4 py-3 text-slate-900 dark:text-white whitespace-nowrap">
                      {formatDate(r.date)}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-900 dark:text-white">
                      {r.lot.lotNumber}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {r.lot.supplier?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Badge variant={scoreVariant(score)}>
                        {formatNumber(score, 2)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900 dark:text-white">
                      {r.yieldMeasured
                        ? formatNumber(toNum(r.yieldMeasured), 4)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-[200px] truncate">
                      {r.notes ?? "—"}
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
