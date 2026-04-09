import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import Link from "next/link";
import {
  TrendingUp,
  Users,
  Truck,
  FileText,
  ArrowRight,
} from "lucide-react";
import {
  getReportsSummary,
  getContractPipeline,
  getRevenueByRegion,
} from "./actions";
import {
  formatGTQ,
  formatPercent,
  formatNumber,
  formatRegion,
  marginColorClass,
} from "@/lib/utils/format";
import { PipelineChart } from "./_components/pipeline-chart";

export default async function ReportsPage() {
  const [summary, pipeline, byRegion] = await Promise.all([
    getReportsSummary(),
    getContractPipeline(),
    getRevenueByRegion(),
  ]);

  const marginColor = marginColorClass(summary.weightedMargin);

  const reportLinks = [
    {
      href: "/reports/sales",
      title: "Ventas por Mes",
      description: "Revenue, contenedores y margen por embarque mensual",
      icon: TrendingUp,
    },
    {
      href: "/reports/margins",
      title: "Margen por Cliente",
      description: "Margen promedio, revenue y utilidad por cliente",
      icon: Users,
    },
    {
      href: "/reports/purchases",
      title: "Compras por Proveedor",
      description: "Volumen, costo y precio promedio por proveedor",
      icon: Truck,
    },
  ];

  return (
    <>
      <PageHeader title="Reportes" />

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Contratos
            </p>
            <p className="text-xl font-bold font-mono text-gray-900 dark:text-white mt-1">
              {summary.activeContracts}
              <span className="text-sm text-slate-400 font-normal">
                {" "}/ {summary.totalContracts}
              </span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Embarques
            </p>
            <p className="text-xl font-bold font-mono text-gray-900 dark:text-white mt-1">
              {summary.totalShipments}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Contenedores
            </p>
            <p className="text-xl font-bold font-mono text-gray-900 dark:text-white mt-1">
              {summary.totalContainers}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Revenue Total
            </p>
            <p className="text-xl font-bold font-mono text-orion-600 dark:text-orion-400 mt-1">
              {formatGTQ(summary.totalRevenueQTZ)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Margen Ponderado
            </p>
            <p className={`text-xl font-bold font-mono mt-1 ${marginColor}`}>
              {formatPercent(summary.weightedMargin)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Compras (QQ)
            </p>
            <p className="text-xl font-bold font-mono text-gray-900 dark:text-white mt-1">
              {formatNumber(summary.totalQQPurchased, 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Report links */}
        {reportLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="hover:border-orion-400 dark:hover:border-orion-600 transition-colors cursor-pointer h-full">
              <CardContent className="py-5">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-orion-50 dark:bg-orion-800/30 rounded-lg">
                    <link.icon className="w-5 h-5 text-orion-600 dark:text-orion-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {link.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {link.description}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Pipeline de Contratos
              </h3>
              <Link
                href="/contracts"
                className="text-xs text-orion-600 dark:text-orion-400 hover:underline"
              >
                Ver contratos
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <PipelineChart data={pipeline} />
            <div className="mt-3 overflow-x-auto">
              <table className="dense-table w-full">
                <thead>
                  <tr>
                    <th>Estado</th>
                    <th className="text-right">Contratos</th>
                    <th className="text-right">Sacos 46kg</th>
                    <th className="text-right">Total Q</th>
                  </tr>
                </thead>
                <tbody>
                  {pipeline.map((p) => (
                    <tr key={p.status}>
                      <td className="font-medium">
                        {
                          {
                            NEGOCIACION: "Negociación",
                            CONFIRMADO: "Confirmado",
                            NO_FIJADO: "No Fijado",
                            FIJADO: "Fijado",
                            EMBARCADO: "Embarcado",
                            LIQUIDADO: "Liquidado",
                            CANCELADO: "Cancelado",
                          }[p.status] ?? p.status
                        }
                      </td>
                      <td className="text-right font-mono">{p.count}</td>
                      <td className="text-right font-mono">
                        {formatNumber(p.totalSacos46, 0)}
                      </td>
                      <td className="text-right font-mono">
                        {formatGTQ(p.totalPagoQTZ)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Revenue by Region */}
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Revenue por Región
            </h3>
          </CardHeader>
          <CardContent>
            {byRegion.length > 0 ? (
              <>
                <div className="space-y-3 mb-4">
                  {byRegion.map((r) => {
                    const maxRevenue = byRegion[0]?.totalPagoQTZ ?? 1;
                    const pct =
                      maxRevenue > 0
                        ? (r.totalPagoQTZ / maxRevenue) * 100
                        : 0;
                    return (
                      <div key={r.region}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {formatRegion(r.region)}
                          </span>
                          <span className="font-mono text-slate-500">
                            {formatGTQ(r.totalPagoQTZ)}
                          </span>
                        </div>
                        <div className="h-2 bg-slate-100 dark:bg-orion-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orion-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="overflow-x-auto">
                  <table className="dense-table w-full">
                    <thead>
                      <tr>
                        <th>Región</th>
                        <th className="text-right">Contratos</th>
                        <th className="text-right">Sacos 46kg</th>
                        <th className="text-right">Total Q</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byRegion.map((r) => (
                        <tr key={r.region}>
                          <td className="font-medium">
                            {formatRegion(r.region)}
                          </td>
                          <td className="text-right font-mono">
                            {r.numContracts}
                          </td>
                          <td className="text-right font-mono">
                            {formatNumber(r.totalSacos46, 0)}
                          </td>
                          <td className="text-right font-mono">
                            {formatGTQ(r.totalPagoQTZ)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">
                Sin datos de región.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
