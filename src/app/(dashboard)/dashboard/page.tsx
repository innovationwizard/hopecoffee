import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getDashboardStats } from "./actions";
import {
  formatGTQ,
  formatPercent,
  formatDate,
  toNum,
} from "@/lib/utils/format";
import { StatusBadge } from "@/components/ui/status-badge";
import Link from "next/link";

export default async function DashboardPage() {
  const {
    contractCount,
    activeContracts,
    shipments,
    recentContracts,
    weightedMargin,
    marginAlert,
    totalRevenue,
    breakEvenProgress,
    containersRemaining,
    breakEvenTarget,
  } = await getDashboardStats();

  const totalContainers = shipments.reduce((s, sh) => s + sh.numContainers, 0);

  const marginColor =
    weightedMargin >= 0.12
      ? "text-emerald-700 dark:text-emerald-400"
      : weightedMargin >= 0.10
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400";

  return (
    <>
      <PageHeader title="Dashboard" />

      {/* Margin Alert */}
      {marginAlert && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
          Margen ponderado por debajo del 12% ({formatPercent(weightedMargin)}). Hay que recuperar en los siguientes contratos.
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Revenue Total
            </p>
            <p className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1">
              {formatGTQ(totalRevenue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Margen Ponderado
            </p>
            <p className={`text-2xl font-bold font-mono mt-1 ${marginColor}`}>
              {formatPercent(weightedMargin)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Contenedores
            </p>
            <p className="text-2xl font-bold font-mono text-gray-900 dark:text-white mt-1">
              {totalContainers}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Contratos Activos
            </p>
            <p className="text-2xl font-bold font-mono text-gray-900 dark:text-white mt-1">
              {activeContracts} / {contractCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Break-even
            </p>
            <p className="text-lg font-bold font-mono text-gray-900 dark:text-white mt-1">
              {formatPercent(Math.min(breakEvenProgress, 1))}
            </p>
            <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${Math.min(breakEvenProgress * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {containersRemaining != null && containersRemaining > 0
                ? `~${containersRemaining} cont. restantes`
                : breakEvenProgress >= 1
                ? "Meta alcanzada"
                : `Meta: ${formatGTQ(breakEvenTarget)}`}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent shipments */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Embarques Recientes
              </h3>
              <Link
                href="/shipments"
                className="text-xs text-blue-600 hover:underline"
              >
                Ver todos
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {shipments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="dense-table w-full">
                  <thead>
                    <tr>
                      <th>Embarque</th>
                      <th className="text-right">Cont.</th>
                      <th className="text-right">Total Q</th>
                      <th className="text-right">Margen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipments.slice(0, 6).map((s) => (
                      <tr key={s.id}>
                        <td>
                          <Link
                            href={`/shipments/${s.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {s.name}
                          </Link>
                        </td>
                        <td className="text-right font-mono">
                          {s.numContainers}
                        </td>
                        <td className="text-right font-mono">
                          {formatGTQ(toNum(s.totalPagoQTZ))}
                        </td>
                        <td className="text-right font-mono">
                          {formatPercent(toNum(s.margenBruto))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">
                Sin embarques aún.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent contracts */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Contratos Recientes
              </h3>
              <Link
                href="/contracts"
                className="text-xs text-blue-600 hover:underline"
              >
                Ver todos
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentContracts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="dense-table w-full">
                  <thead>
                    <tr>
                      <th>Contrato</th>
                      <th>Cliente</th>
                      <th>Estado</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentContracts.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <Link
                            href={`/contracts/${c.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {c.contractNumber}
                          </Link>
                        </td>
                        <td>{c.client.name}</td>
                        <td>
                          <StatusBadge status={c.status} />
                        </td>
                        <td className="text-xs text-gray-500">
                          {formatDate(c.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">
                Sin contratos aún.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
