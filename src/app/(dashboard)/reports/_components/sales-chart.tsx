"use client";

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
import type { SalesByMonthRow } from "../actions";

const formatQ = (value: number) =>
  `Q${(value / 1000).toFixed(0)}k`;

const tooltipFormatter = (value: number) =>
  `Q${value.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function SalesChart({ data }: { data: SalesByMonthRow[] }) {
  const chartData = [...data].reverse().map((d) => ({
    name: d.label,
    revenue: d.totalPagoQTZ,
    utilidad: d.utilidadBruta,
    gastos: d.totalGastosExport,
  }));

  return (
    <ResponsiveContainer width="100%" height={360}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
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
        <Legend
          wrapperStyle={{ fontSize: 11 }}
        />
        <Bar
          dataKey="revenue"
          name="Revenue (Q)"
          fill="#2656d6"
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
  );
}
