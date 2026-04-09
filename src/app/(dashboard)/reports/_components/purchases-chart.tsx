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
import type { PurchasesBySupplierRow } from "../actions";

const formatQ = (value: number) =>
  `Q${(value / 1000).toFixed(0)}k`;

const tooltipFormatter = (value: number) =>
  `Q${value.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function PurchasesChart({ data }: { data: PurchasesBySupplierRow[] }) {
  const chartData = data.map((d) => ({
    name: d.supplierCode,
    fullName: d.supplierName,
    cafe: d.totalCostQTZ,
    flete: d.totalFlete,
    total: d.costoTotalAccum,
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
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar
          dataKey="cafe"
          name="Costo Café (Q)"
          fill="#2656d6"
          stackId="cost"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="flete"
          name="Flete (Q)"
          fill="#7da3ff"
          stackId="cost"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
