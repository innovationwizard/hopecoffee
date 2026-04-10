import Link from "next/link";
import { getPurchaseOrders, getAccumulatedPOStats } from "../inventory/actions";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatGTQ, formatNumber, formatDate, toNum } from "@/lib/utils/format";
import { Package } from "lucide-react";

export default async function PurchaseOrdersPage() {
  const [orders, stats] = await Promise.all([
    getPurchaseOrders(),
    getAccumulatedPOStats(),
  ]);

  return (
    <>
      <PageHeader
        title="Ordenes de Compra"
        action={
          <Link href="/purchase-orders/new">
            <Button>+ Nueva OC</Button>
          </Link>
        }
      />

      {stats.count > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="py-3">
              <p className="text-xs text-gray-500">Total QQ Pergamino</p>
              <p className="text-lg font-bold font-mono">{formatNumber(stats.totalQQ, 2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3">
              <p className="text-xs text-gray-500">Costo Total Acumulado</p>
              <p className="text-lg font-bold font-mono">{formatGTQ(stats.totalCost)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3">
              <p className="text-xs text-gray-500">Precio Promedio Ponderado</p>
              <p className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400">{formatGTQ(stats.weightedAvgPrice)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Sin ordenes de compra"
          description="Crea tu primera orden de compra."
          action={
            <Link href="/purchase-orders/new">
              <Button>Nueva OC</Button>
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="dense-table w-full">
            <thead>
              <tr>
                <th>OC</th>
                <th>Proveedor</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th className="text-right">QQ Perg</th>
                <th className="text-right">Precio/QQ</th>
                <th className="text-right">Total Cafe</th>
                <th className="text-right">Flete</th>
                <th className="text-right">Costo Total</th>
                <th className="text-right">Precio Prom</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link
                      href={`/purchase-orders/${o.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td>{o.supplier.name}</td>
                  <td>{formatDate(o.date)}</td>
                  <td>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        o.status === "LIQUIDADO"
                          ? "bg-emerald-100 text-emerald-800"
                          : o.status === "RECIBIDO"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="text-right font-mono">
                    {formatNumber(toNum(o.quintalesPerg), 2)}
                  </td>
                  <td className="text-right font-mono">
                    {formatGTQ(toNum(o.precioPerg))}
                  </td>
                  <td className="text-right font-mono">
                    {formatGTQ(toNum(o.totalCafe))}
                  </td>
                  <td className="text-right font-mono">
                    {formatGTQ(toNum(o.totalFlete))}
                  </td>
                  <td className="text-right font-mono font-semibold">
                    {formatGTQ(toNum(o.costoTotalAccum))}
                  </td>
                  <td className="text-right font-mono">
                    {formatGTQ(toNum(o.precioPromedio))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
