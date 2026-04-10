"use client";

import { useRouter } from "next/navigation";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  formatUSD,
  formatGTQ,
  formatNumber,
  toNum,
} from "@/lib/utils/format";
import type { Contract, Client, Shipment } from "@prisma/client";

type ContractWithRelations = Contract & {
  client: Client;
  shipment: { id: string; name: string } | null;
};

const col = createColumnHelper<ContractWithRelations>();

const columns = [
  col.accessor((r) => r.client.name, {
    id: "client",
    header: "Cliente",
    size: 120,
  }),
  col.accessor("officialCorrelative", {
    header: "Correlativo",
    size: 100,
    cell: (info) => (
      <span className="font-bold">{info.getValue() ?? "—"}</span>
    ),
  }),
  col.accessor("contractNumber", {
    header: "Contrato",
    size: 100,
  }),
  col.accessor("status", {
    header: "Estado",
    size: 110,
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
  col.accessor("tipoFacturacion", {
    header: "Tipo Fact.",
    size: 90,
    cell: (info) => info.getValue() === "LIBRAS_ESPANOLAS" ? "Kilos" : "Libras",
  }),
  col.accessor("posicionBolsa", {
    header: "Posición",
    size: 70,
    cell: (info) => info.getValue() ?? "—",
  }),
  col.accessor("cosecha", {
    header: "Cosecha",
    size: 70,
    cell: (info) => info.getValue() ?? "—",
  }),
  col.accessor("puntaje", {
    header: "Puntaje",
    size: 70,
    meta: { numeric: true },
  }),
  col.accessor("sacos69kg", {
    header: "Sacos 69kg",
    size: 90,
    meta: { numeric: true },
    cell: (info) => formatNumber(toNum(info.getValue()), 0),
  }),
  col.accessor("sacos46kg", {
    header: "Quintales",
    size: 90,
    meta: { numeric: true },
    cell: (info) => formatNumber(toNum(info.getValue()), 1),
  }),
  col.accessor("precioBolsa", {
    header: "Bolsa",
    size: 80,
    meta: { numeric: true },
    cell: (info) => formatNumber(toNum(info.getValue()), 2),
  }),
  col.accessor("diferencial", {
    header: "Dif",
    size: 60,
    meta: { numeric: true },
    cell: (info) => formatNumber(toNum(info.getValue()), 2),
  }),
  col.accessor("precioBolsaDif", {
    header: "Bolsa+Dif",
    size: 90,
    meta: { numeric: true },
    cell: (info) => formatNumber(toNum(info.getValue()), 2),
  }),
  col.accessor("facturacionLbs", {
    header: "Fact. Lbs",
    size: 110,
    meta: { numeric: true },
    cell: (info) => formatUSD(toNum(info.getValue())),
  }),
  col.accessor("facturacionKgs", {
    header: "Fact. Kgs",
    size: 110,
    meta: { numeric: true },
    cell: (info) => formatUSD(toNum(info.getValue())),
  }),
  col.accessor("gastosExport", {
    header: "Gastos Exp",
    size: 100,
    meta: { numeric: true },
    cell: (info) => (
      <span className="text-red-600">{formatUSD(toNum(info.getValue()))}</span>
    ),
  }),
  col.accessor("utilidadSinCF", {
    header: "Util s/CF",
    size: 110,
    meta: { numeric: true },
    cell: (info) => formatUSD(toNum(info.getValue())),
  }),
  col.accessor("tipoCambio", {
    header: "T.C.",
    size: 60,
    meta: { numeric: true },
    cell: (info) => formatNumber(toNum(info.getValue()), 2),
  }),
  col.accessor("totalPagoQTZ", {
    header: "Total Pago Q",
    size: 130,
    meta: { numeric: true },
    cell: (info) => (
      <span className="font-semibold">{formatGTQ(toNum(info.getValue()))}</span>
    ),
  }),
];

export function ContractTable({
  contracts,
}: {
  contracts: ContractWithRelations[];
}) {
  const router = useRouter();

  const footerRow: Record<string, React.ReactNode> = {
    client: `${contracts.length} contratos`,
    sacos69kg: formatNumber(
      contracts.reduce((s, c) => s + toNum(c.sacos69kg), 0),
      0
    ),
    sacos46kg: formatNumber(
      contracts.reduce((s, c) => s + toNum(c.sacos46kg), 0),
      1
    ),
    facturacionLbs: formatUSD(
      contracts.reduce((s, c) => s + toNum(c.facturacionLbs), 0)
    ),
    facturacionKgs: formatUSD(
      contracts.reduce((s, c) => s + toNum(c.facturacionKgs), 0)
    ),
    gastosExport: formatUSD(
      contracts.reduce((s, c) => s + toNum(c.gastosExport), 0)
    ),
    totalPagoQTZ: formatGTQ(
      contracts.reduce((s, c) => s + toNum(c.totalPagoQTZ), 0)
    ),
  };

  return (
    <DataTable
      columns={columns as ColumnDef<ContractWithRelations, unknown>[]}
      data={contracts}
      onRowClick={(row) => router.push(`/contracts/${row.id}`)}
      footerRow={footerRow}
    />
  );
}
