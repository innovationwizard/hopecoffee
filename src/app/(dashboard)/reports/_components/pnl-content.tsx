"use client";

import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  formatGTQ,
  formatPercent,
  formatMonth,
  marginColorClass,
} from "@/lib/utils/format";
import type { PnlRow } from "../actions";

type ViewMode = "shipment" | "month";

const formatQ = (value: number) => `Q${(value / 1000).toFixed(0)}k`;

const tooltipFormatter = (value: number) =>
  `Q${value.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function aggregateByMonth(rows: PnlRow[]): PnlRow[] {
  const map = new Map<string, PnlRow>();

  for (const r of rows) {
    const key = `${r.year}-${String(r.month).padStart(2, "0")}`;
    const existing = map.get(key);
    if (existing) {
      existing.totalPagoQTZ += r.totalPagoQTZ;
      existing.totalSubproducto += r.totalSubproducto;
      existing.ingresoTotal += r.ingresoTotal;
      existing.totalMateriaPrima += r.totalMateriaPrima;
      existing.totalGastosExport += r.totalGastosExport;
      existing.totalCostoFinanc += r.totalCostoFinanc;
      existing.totalComision += r.totalComision;
      existing.costoTotal += r.costoTotal;
      existing.utilidadBruta += r.utilidadBruta;
      existing.margenBruto =
        existing.ingresoTotal > 0
          ? existing.utilidadBruta / existing.ingresoTotal
          : 0;
    } else {
      map.set(key, {
        ...r,
        key,
        label: formatMonth(r.month, r.year),
      });
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => a.year - b.year || a.month - b.month
  );
}

export function PnlContent({ data }: { data: PnlRow[] }) {
  const [view, setView] = useState<ViewMode>("shipment");

  const rows = useMemo(
    () => (view === "month" ? aggregateByMonth(data) : data),
    [data, view]
  );

  const chartData = useMemo(
    () =>
      [...(view === "month" ? rows : [...data].reverse())].map((d) => ({
        name: d.label,
        ingreso: d.ingresoTotal,
        costo: d.costoTotal,
        utilidad: d.utilidadBruta,
      })),
    [data, rows, view]
  );

  return (
    <>
      {/* Toggle */}
      <div className="flex gap-1 mb-6 bg-slate-100 dark:bg-orion-800 rounded-lg p-1 w-fit">
        <button
          onClick={() => setView("shipment")}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            view === "shipment"
              ? "bg-white dark:bg-orion-700 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          Por Embarque
        </button>
        <button
          onClick={() => setView("month")}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            view === "month"
              ? "bg-white dark:bg-orion-700 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          Por Mes
        </button>
      </div>

      {/* Chart */}
      <Card className="mb-6">
        <CardHeader>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Ingresos vs Costos vs Utilidad
          </h3>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={{ stroke: "#e2e8f0" }}
              />
              <YAxis
                tickFormatter={formatQ}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={tooltipFormatter}
                contentStyle={{
                  backgroundColor: "#0a1628",
                  border: "1px solid #1a3fa8",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "#e2e8f0",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar
                dataKey="ingreso"
                name="Ingreso Total (Q)"
                fill="#2656d6"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="costo"
                name="Costo Total (Q)"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="utilidad"
                name="Utilidad Bruta (Q)"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {view === "shipment"
              ? "Estado de Resultados por Embarque"
              : "Estado de Resultados por Mes"}
          </h3>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="dense-table w-full">
              <thead>
                <tr>
                  <th>{view === "shipment" ? "Embarque" : "Mes"}</th>
                  <th className="text-right">Facturación (Q)</th>
                  <th className="text-right">+ Subproductos</th>
                  <th className="text-right font-bold">= Ingreso Total</th>
                  <th className="text-right">Materia Prima</th>
                  <th className="text-right">Gastos Export</th>
                  <th className="text-right">Costo Financiero</th>
                  <th className="text-right">Comisiones</th>
                  <th className="text-right font-bold">= Costo Total</th>
                  <th className="text-right font-bold">Utilidad Bruta</th>
                  <th className="text-right font-bold">Margen</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td className="font-medium">{r.label}</td>
                    <td className="text-right font-mono">
                      {formatGTQ(r.totalPagoQTZ)}
                    </td>
                    <td className="text-right font-mono">
                      {formatGTQ(r.totalSubproducto)}
                    </td>
                    <td className="text-right font-mono font-semibold">
                      {formatGTQ(r.ingresoTotal)}
                    </td>
                    <td className="text-right font-mono text-red-600">
                      {formatGTQ(r.totalMateriaPrima)}
                    </td>
                    <td className="text-right font-mono text-red-600">
                      {formatGTQ(r.totalGastosExport)}
                    </td>
                    <td className="text-right font-mono text-red-600">
                      {formatGTQ(r.totalCostoFinanc)}
                    </td>
                    <td className="text-right font-mono text-red-600">
                      {formatGTQ(r.totalComision)}
                    </td>
                    <td className="text-right font-mono font-semibold text-red-600">
                      {formatGTQ(r.costoTotal)}
                    </td>
                    <td className="text-right font-mono font-semibold">
                      {formatGTQ(r.utilidadBruta)}
                    </td>
                    <td
                      className={`text-right font-mono ${marginColorClass(r.margenBruto)}`}
                    >
                      {formatPercent(r.margenBruto)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold border-t-2 border-slate-300 dark:border-orion-700">
                  <td>Total</td>
                  <td className="text-right font-mono">
                    {formatGTQ(rows.reduce((s, r) => s + r.totalPagoQTZ, 0))}
                  </td>
                  <td className="text-right font-mono">
                    {formatGTQ(
                      rows.reduce((s, r) => s + r.totalSubproducto, 0)
                    )}
                  </td>
                  <td className="text-right font-mono">
                    {formatGTQ(rows.reduce((s, r) => s + r.ingresoTotal, 0))}
                  </td>
                  <td className="text-right font-mono text-red-600">
                    {formatGTQ(
                      rows.reduce((s, r) => s + r.totalMateriaPrima, 0)
                    )}
                  </td>
                  <td className="text-right font-mono text-red-600">
                    {formatGTQ(
                      rows.reduce((s, r) => s + r.totalGastosExport, 0)
                    )}
                  </td>
                  <td className="text-right font-mono text-red-600">
                    {formatGTQ(
                      rows.reduce((s, r) => s + r.totalCostoFinanc, 0)
                    )}
                  </td>
                  <td className="text-right font-mono text-red-600">
                    {formatGTQ(rows.reduce((s, r) => s + r.totalComision, 0))}
                  </td>
                  <td className="text-right font-mono text-red-600">
                    {formatGTQ(rows.reduce((s, r) => s + r.costoTotal, 0))}
                  </td>
                  {(() => {
                    const totalUtilidad = rows.reduce(
                      (s, r) => s + r.utilidadBruta,
                      0
                    );
                    const totalIngreso = rows.reduce(
                      (s, r) => s + r.ingresoTotal,
                      0
                    );
                    const totalMargen =
                      totalIngreso > 0 ? totalUtilidad / totalIngreso : 0;
                    return (
                      <>
                        <td className="text-right font-mono">
                          {formatGTQ(totalUtilidad)}
                        </td>
                        <td
                          className={`text-right font-mono ${marginColorClass(totalMargen)}`}
                        >
                          {formatPercent(totalMargen)}
                        </td>
                      </>
                    );
                  })()}
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
