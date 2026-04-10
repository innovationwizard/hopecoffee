import { notFound } from "next/navigation";
import Link from "next/link";
import { getMillingOrder } from "../actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatNumber, formatDate, toNum } from "@/lib/utils/format";
import { CompleteButton, DeleteButton } from "./client-actions";

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

function outputTypeBadge(type: string) {
  const map: Record<string, { label: string; cls: string }> = {
    ORO_EXPORTABLE: { label: "Oro Exportable", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
    SEGUNDA: { label: "Segunda", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
    CASCARILLA: { label: "Cascarilla", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
    MERMA: { label: "Merma", cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  };
  const s = map[type] ?? { label: type, cls: "bg-gray-100 text-gray-800" };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.cls}`}>
      {s.label}
    </span>
  );
}

export default async function MillingOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getMillingOrder(id);

  if (!order) notFound();

  const totalInputQQ = order.inputs.reduce(
    (sum, i) => sum + toNum(i.quantityQQ),
    0
  );
  const totalOutputQQ = order.outputs.reduce(
    (sum, o) => sum + toNum(o.quantityQQ),
    0
  );
  const oroQQ = order.outputs
    .filter((o) => o.outputType === "ORO_EXPORTABLE")
    .reduce((sum, o) => sum + toNum(o.quantityQQ), 0);
  const yieldPct = totalInputQQ > 0 ? (oroQQ / totalInputQQ) * 100 : 0;

  return (
    <>
      <PageHeader
        title={order.orderNumber}
        breadcrumbs={[
          { label: "Ordenes de Tria", href: "/milling" },
          { label: order.orderNumber },
        ]}
        action={
          <div className="flex gap-2">
            {order.status !== "COMPLETADO" && (
              <CompleteButton orderId={order.id} />
            )}
            {order.status === "PENDIENTE" && (
              <DeleteButton orderId={order.id} />
            )}
          </div>
        }
      />

      {/* Order info */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Fecha</p>
            <p className="text-sm font-medium">{formatDate(order.date)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Beneficio</p>
            <p className="text-sm font-medium">{order.facility?.name ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Estado</p>
            <div className="mt-0.5">{statusBadge(order.status)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Rendimiento Oro</p>
            <p className="text-lg font-bold font-mono text-emerald-600">
              {totalInputQQ > 0 ? `${yieldPct.toFixed(1)}%` : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {order.notes && (
        <Card className="mb-6">
          <CardContent className="py-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Notas</p>
            <p className="text-sm">{order.notes}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inputs table */}
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Entradas — {formatNumber(totalInputQQ, 2)} QQ
            </h3>
          </CardHeader>
          <CardContent>
            <table className="dense-table w-full">
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Proveedor</th>
                  <th className="text-right">QQ</th>
                </tr>
              </thead>
              <tbody>
                {order.inputs.map((input) => (
                  <tr key={input.id}>
                    <td>
                      <Link
                        href={`/inventory/lots/${input.lot.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {input.lot.lotNumber}
                      </Link>
                    </td>
                    <td>{input.lot.supplier?.name ?? "—"}</td>
                    <td className="text-right font-mono">
                      {formatNumber(toNum(input.quantityQQ), 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Outputs table */}
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Salidas — {formatNumber(totalOutputQQ, 2)} QQ
            </h3>
          </CardHeader>
          <CardContent>
            <table className="dense-table w-full">
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Tipo</th>
                  <th className="text-right">QQ</th>
                  <th>Calidad</th>
                </tr>
              </thead>
              <tbody>
                {order.outputs.map((output) => (
                  <tr key={output.id}>
                    <td>
                      {output.lot ? (
                        <Link
                          href={`/inventory/lots/${output.lot.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {output.lot.lotNumber}
                        </Link>
                      ) : (
                        <span className="text-gray-400">Merma</span>
                      )}
                    </td>
                    <td>{outputTypeBadge(output.outputType)}</td>
                    <td className="text-right font-mono">
                      {formatNumber(toNum(output.quantityQQ), 2)}
                    </td>
                    <td>{output.qualityGrade ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
