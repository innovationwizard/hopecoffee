"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { ContractPipelineRow } from "../actions";

const STATUS_COLORS: Record<string, string> = {
  NEGOCIACION: "#f59e0b",
  CONFIRMADO: "#3b82f6",
  NO_FIJADO: "#f97316",
  FIJADO: "#10b981",
  EMBARCADO: "#8b5cf6",
  LIQUIDADO: "#94a3b8",
  CANCELADO: "#ef4444",
};

const STATUS_LABELS: Record<string, string> = {
  NEGOCIACION: "Negociación",
  CONFIRMADO: "Confirmado",
  NO_FIJADO: "No Fijado",
  FIJADO: "Fijado",
  EMBARCADO: "Embarcado",
  LIQUIDADO: "Liquidado",
  CANCELADO: "Cancelado",
};

export function PipelineChart({ data }: { data: ContractPipelineRow[] }) {
  const chartData = data.map((d) => ({
    name: STATUS_LABELS[d.status] ?? d.status,
    status: d.status,
    count: d.count,
    sacos: d.totalSacos46,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={{ stroke: "#e2e8f0" }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          formatter={(value: number, name: string) =>
            name === "count" ? `${value} contratos` : `${value.toFixed(0)} sacos`
          }
          contentStyle={{
            backgroundColor: "#0a1628",
            border: "1px solid #1a3fa8",
            borderRadius: 8,
            fontSize: 12,
            color: "#e2e8f0",
          }}
        />
        <Bar dataKey="count" name="count" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={index} fill={STATUS_COLORS[entry.status] ?? "#94a3b8"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
