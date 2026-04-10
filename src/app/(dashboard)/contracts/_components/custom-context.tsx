"use client";

import { useState, useMemo } from "react";
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

interface CustomContextProps {
  stats: MonthlyContextStats;
}

export function CustomContext({ stats }: CustomContextProps) {
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const c of stats.contracts) {
      init[c.id] = true;
    }
    return init;
  });

  function toggle(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const agg = useMemo(() => {
    const selected = stats.contracts.filter((c) => checked[c.id]);
    const count = selected.length;
    const totalRevenue = selected.reduce((s, c) => s + c.totalPagoQTZ, 0);
    const totalFactKgs = selected.reduce(
      (s, c) => s + (c.facturacionKgs ?? 0),
      0
    );
    const totalUtilidad = selected.reduce(
      (s, c) => s + (c.utilidadSinCF ?? 0),
      0
    );
    const totalSacos = selected.reduce((s, c) => s + c.sacos69kg, 0);
    const margin = totalFactKgs > 0 ? totalUtilidad / totalFactKgs : 0;
    return { count, totalRevenue, totalSacos, margin };
  }, [stats.contracts, checked]);

  const marginColor =
    agg.margin >= 0.12
      ? "text-emerald-600 dark:text-emerald-400"
      : agg.margin >= 0.08
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Contexto Personalizado
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
              {agg.count}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gray-400">
              Margen Pond.
            </p>
            <p className={`text-lg font-bold font-mono ${marginColor}`}>
              {formatPercent(agg.margin)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gray-400">
              Revenue
            </p>
            <p className="text-sm font-bold font-mono text-gray-900 dark:text-white">
              {formatGTQ(agg.totalRevenue)}
            </p>
          </div>
        </div>

        {/* Contract rows with checkboxes */}
        {stats.contracts.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1.5">
              Seleccionar contratos
            </p>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {stats.contracts.map((c) => (
                <label
                  key={c.id}
                  className={`flex items-center justify-between py-1 px-2 rounded text-xs cursor-pointer transition-colors ${
                    checked[c.id]
                      ? "bg-gray-50 dark:bg-gray-800/50"
                      : "bg-gray-50/40 dark:bg-gray-800/20 opacity-50"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={checked[c.id] ?? true}
                      onChange={() => toggle(c.id)}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                    />
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
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Total sacos */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Total sacos 69kg seleccionados</span>
            <span className="font-mono font-medium text-gray-900 dark:text-white">
              {formatNumber(agg.totalSacos, 0)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
