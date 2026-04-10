import Link from "next/link";
import { getMillingOrders } from "./actions";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatNumber, formatDate, toNum } from "@/lib/utils/format";
import { Factory } from "lucide-react";

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    PENDIENTE: { label: "Pendiente", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
    EN_PROCESO: { label: "En Proceso", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
    COMPLETADO: { label: "Completado", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  };
  const s = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-800" };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.cls}`}>
      {s.label}
    </span>
  );
}

export default async function MillingPage() {
  const orders = await getMillingOrders();

  const totalOrders = orders.length;
  const pendientes = orders.filter((o) => o.status === "PENDIENTE").length;
  const completadas = orders.filter((o) => o.status === "COMPLETADO").length;

  return (
    <>
      <PageHeader
        title="Ordenes de Tria"
        action={
          <Link href="/milling/new">
            <Button>+ Nueva Orden</Button>
          </Link>
        }
      />

      {totalOrders > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="py-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Ordenes</p>
              <p className="text-lg font-bold font-mono">{totalOrders}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Pendientes</p>
              <p className="text-lg font-bold font-mono text-amber-600">{pendientes}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Completadas</p>
              <p className="text-lg font-bold font-mono text-emerald-600">{completadas}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {orders.length === 0 ? (
        <EmptyState
          icon={Factory}
          title="Sin ordenes de tria"
          description="Crea tu primera orden de tria para procesar lotes de pergamino."
          action={
            <Link href="/milling/new">
              <Button>Nueva Orden</Button>
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="dense-table w-full">
            <thead>
              <tr>
                <th>Orden</th>
                <th>Fecha</th>
                <th>Beneficio</th>
                <th>Estado</th>
                <th className="text-right">Entrada QQ</th>
                <th className="text-right">Salida QQ</th>
                <th className="text-right">Rendimiento</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const inputQQ = o.inputs.reduce(
                  (sum, i) => sum + toNum(i.quantityQQ),
                  0
                );
                const outputQQ = o.outputs.reduce(
                  (sum, out) => sum + toNum(out.quantityQQ),
                  0
                );
                const oroQQ = o.outputs
                  .filter((out) => out.outputType === "ORO_EXPORTABLE")
                  .reduce((sum, out) => sum + toNum(out.quantityQQ), 0);
                const yieldPct = inputQQ > 0 ? (oroQQ / inputQQ) * 100 : 0;

                return (
                  <tr key={o.id}>
                    <td>
                      <Link
                        href={`/milling/${o.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td>{formatDate(o.date)}</td>
                    <td>{o.facility?.name ?? "—"}</td>
                    <td>{statusBadge(o.status)}</td>
                    <td className="text-right font-mono">
                      {formatNumber(inputQQ, 2)}
                    </td>
                    <td className="text-right font-mono">
                      {formatNumber(outputQQ, 2)}
                    </td>
                    <td className="text-right font-mono">
                      {inputQQ > 0 ? `${yieldPct.toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
