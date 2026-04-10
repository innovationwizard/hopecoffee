import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getDashboardStats } from "./actions";
import { requireAuth } from "@/lib/services/auth";
import {
  formatGTQ,
  formatPercent,
  formatDate,
  formatNumber,
  toNum,
} from "@/lib/utils/format";
import { StatusBadge } from "@/components/ui/status-badge";
import Link from "next/link";

function ShipmentsTable({ shipments }: { shipments: { id: string; name: string; numContainers: number; totalPagoQTZ: unknown; margenBruto: unknown }[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Embarques Recientes
          </h3>
          <Link
            href="/shipments"
            className="text-xs text-orion-600 dark:text-orion-400 hover:underline"
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
                        className="text-orion-600 dark:text-orion-400 hover:underline"
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
            Sin embarques aun.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ContractsTable({ recentContracts }: { recentContracts: { id: string; contractNumber: string; status: string; createdAt: Date; client: { name: string } }[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Contratos Recientes
          </h3>
          <Link
            href="/contracts"
            className="text-xs text-orion-600 dark:text-orion-400 hover:underline"
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
                        className="text-orion-600 dark:text-orion-400 hover:underline"
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
            Sin contratos aun.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const session = await requireAuth();
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
    inventoryMap,
    avgCuppingScore,
    lotsWithoutCupping,
    yieldIndex,
    pendingAdjustments,
    completedMillingOrders,
  } = await getDashboardStats();

  const totalContainers = shipments.reduce((s, sh) => s + sh.numContainers, 0);

  const marginColor =
    weightedMargin >= 0.12
      ? "text-emerald-600 dark:text-emerald-400"
      : weightedMargin >= 0.10
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400";

  // Role-prioritized section ordering:
  // Financial operator sees shipments (P&L) first, then contracts
  // Field operator sees contracts first, then shipments
  const isFinancial = session.role === "FINANCIAL_OPERATOR";

  return (
    <>
      <PageHeader title="Dashboard" />

      {/* Margin Alert */}
      {marginAlert && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/40 rounded-lg text-sm text-red-700 dark:text-red-400">
          Margen ponderado por debajo del 12% ({formatPercent(weightedMargin)}). Hay que recuperar en los siguientes contratos.
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Revenue Total
            </p>
            <p className="text-2xl font-bold font-mono text-orion-600 dark:text-orion-400 mt-1">
              {formatGTQ(totalRevenue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Margen Ponderado
            </p>
            <p className={`text-2xl font-bold font-mono mt-1 ${marginColor}`}>
              {formatPercent(weightedMargin)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Contenedores
            </p>
            <p className="text-2xl font-bold font-mono text-gray-900 dark:text-white mt-1">
              {totalContainers}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Contratos Activos
            </p>
            <p className="text-2xl font-bold font-mono text-gray-900 dark:text-white mt-1">
              {activeContracts} / {contractCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Break-even
            </p>
            <p className="text-lg font-bold font-mono text-gray-900 dark:text-white mt-1">
              {formatPercent(Math.min(breakEvenProgress, 1))}
            </p>
            <div className="mt-2 h-2 bg-slate-200 dark:bg-orion-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-orion-500 rounded-full transition-all"
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
        {isFinancial ? (
          <>
            <ShipmentsTable shipments={shipments} />
            <ContractsTable recentContracts={recentContracts} />
          </>
        ) : (
          <>
            <ContractsTable recentContracts={recentContracts} />
            <ShipmentsTable shipments={shipments} />
          </>
        )}
      </div>

      {/* Operational KPIs */}
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-8 mb-4">
        Operaciones
      </h2>

      {/* Inventory by Stage */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] font-mono text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Pergamino
            </p>
            <p className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-300 mt-1">
              {formatNumber(inventoryMap["PERGAMINO_BODEGA"]?.qq ?? 0, 1)}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {inventoryMap["PERGAMINO_BODEGA"]?.count ?? 0} lotes / QQ
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] font-mono text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              En Proceso
            </p>
            <p className="text-2xl font-bold font-mono text-blue-700 dark:text-blue-300 mt-1">
              {formatNumber(inventoryMap["EN_PROCESO"]?.qq ?? 0, 1)}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {inventoryMap["EN_PROCESO"]?.count ?? 0} lotes / QQ
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Oro Exportable
            </p>
            <p className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-300 mt-1">
              {formatNumber(inventoryMap["ORO_EXPORTABLE"]?.qq ?? 0, 1)}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {inventoryMap["ORO_EXPORTABLE"]?.count ?? 0} lotes / QQ
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Calidad SCA
            </p>
            <p className="text-2xl font-bold font-mono text-gray-900 dark:text-white mt-1">
              {avgCuppingScore > 0 ? formatNumber(avgCuppingScore, 1) : "--"}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {lotsWithoutCupping > 0 ? (
                <span className="text-amber-600 dark:text-amber-400">
                  {lotsWithoutCupping} lotes sin catacion
                </span>
              ) : (
                "Todos catados"
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Rendimiento
            </p>
            <p className="text-2xl font-bold font-mono text-gray-900 dark:text-white mt-1">
              {yieldIndex > 0 ? formatPercent(yieldIndex) : "--"}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Contratado / Real
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pendingAdjustments > 0 && (
          <Card className="border-amber-300 dark:border-amber-700">
            <CardContent className="py-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <span className="text-amber-600 dark:text-amber-400 text-lg font-bold">!</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                    {pendingAdjustments} ajuste{pendingAdjustments > 1 ? "s" : ""} de rendimiento pendiente{pendingAdjustments > 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Requieren revision y aprobacion
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="py-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-50 dark:bg-orion-800/30 rounded-lg">
                <span className="text-slate-600 dark:text-slate-400 text-lg font-bold font-mono">T</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {completedMillingOrders} orden{completedMillingOrders !== 1 ? "es" : ""} de trilla completada{completedMillingOrders !== 1 ? "s" : ""}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ordenes con estado COMPLETADO
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
