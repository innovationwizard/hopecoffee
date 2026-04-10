"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatGTQ, formatPercent, formatNumber } from "@/lib/utils/format";
import type { MonthlyContextStats } from "../actions";

const MONTH_NAMES: Record<string, string> = {
  "01": "Enero",
  "02": "Febrero",
  "03": "Marzo",
  "04": "Abril",
  "05": "Mayo",
  "06": "Junio",
  "07": "Julio",
  "08": "Agosto",
  "09": "Septiembre",
  "10": "Octubre",
  "11": "Noviembre",
  "12": "Diciembre",
};

function formatMonthLabel(month: string): string {
  const [year, m] = month.split("-");
  return `${MONTH_NAMES[m] ?? m} ${year}`;
}

interface MonthlyContextProps {
  stats: MonthlyContextStats;
}

export function MonthlyContext({ stats }: MonthlyContextProps) {
  const marginColor =
    stats.avgMargin >= 0.12
      ? "text-emerald-600 dark:text-emerald-400"
      : stats.avgMargin >= 0.08
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Contexto del Mes
          </h3>
          <span className="text-xs text-gray-400">
            {formatMonthLabel(stats.month)}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* KPI row */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gray-400">
              Contratos
            </p>
            <p className="text-lg font-bold font-mono text-gray-900 dark:text-white">
              {stats.contractCount}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gray-400">
              Margen Pond.
            </p>
            <p className={`text-lg font-bold font-mono ${marginColor}`}>
              {formatPercent(stats.avgMargin)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gray-400">
              Revenue
            </p>
            <p className="text-sm font-bold font-mono text-gray-900 dark:text-white">
              {formatGTQ(stats.totalRevenue)}
            </p>
          </div>
        </div>

        {/* Peer contracts */}
        {stats.contracts.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1.5">
              Otros contratos este mes
            </p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {stats.contracts.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between py-1 px-2 rounded bg-gray-50 dark:bg-gray-800/50 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono font-medium text-gray-700 dark:text-gray-300 truncate">
                      {c.contractNumber}
                    </span>
                    <span className="text-gray-400 truncate hidden sm:inline">
                      {c.clientName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-mono text-gray-600 dark:text-gray-400">
                      {formatNumber(c.sacos69kg, 0)}s
                    </span>
                    <span
                      className={`font-mono font-medium ${
                        c.margin >= 0.12
                          ? "text-emerald-600"
                          : c.margin >= 0.08
                          ? "text-amber-600"
                          : "text-red-600"
                      }`}
                    >
                      {formatPercent(c.margin)}
                    </span>
                    <StatusBadge status={c.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {stats.contracts.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-2">
            No hay otros contratos este mes.
          </p>
        )}

        {/* Total sacos */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Total sacos 69kg del mes</span>
            <span className="font-mono font-medium text-gray-900 dark:text-white">
              {formatNumber(stats.totalSacos69kg, 0)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
