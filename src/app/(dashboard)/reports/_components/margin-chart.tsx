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
  ReferenceLine,
} from "recharts";
import type { MarginByClientRow } from "../actions";

const MARGIN_TARGET = 0.12;

const COLORS = {
  above: "#10b981",
  warning: "#f59e0b",
  below: "#ef4444",
};

function getColor(margin: number) {
  if (margin >= MARGIN_TARGET) return COLORS.above;
  if (margin >= 0.05) return COLORS.warning;
  return COLORS.below;
}

export function MarginChart({ data }: { data: MarginByClientRow[] }) {
  const chartData = data.map((d) => ({
    name: d.clientCode,
    fullName: d.clientName,
    margin: +(d.avgMargin * 100).toFixed(2),
    revenue: d.totalPagoQTZ,
  }));

  return (
    <ResponsiveContainer width="100%" height={360}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, "auto"]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={60}
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          formatter={(value: number) => `${value.toFixed(2)}%`}
          labelFormatter={(label: string) => {
            const item = chartData.find((d) => d.name === label);
            return item ? item.fullName : label;
          }}
          contentStyle={{
            backgroundColor: "#0a1628",
            border: "1px solid #1a3fa8",
            borderRadius: 8,
            fontSize: 12,
            color: "#e2e8f0",
          }}
        />
        <ReferenceLine
          x={MARGIN_TARGET * 100}
          stroke="#94a3b8"
          strokeDasharray="4 4"
          label={{
            value: "Meta 12%",
            position: "top",
            fill: "#94a3b8",
            fontSize: 10,
          }}
        />
        <Bar dataKey="margin" name="Margen %" radius={[0, 4, 4, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={index} fill={getColor(entry.margin / 100)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
