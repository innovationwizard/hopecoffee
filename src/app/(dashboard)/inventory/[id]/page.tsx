import { notFound } from "next/navigation";
import Link from "next/link";
import { getPurchaseOrder } from "../actions";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatGTQ, formatNumber, formatDate, toNum } from "@/lib/utils/format";

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const po = await getPurchaseOrder(id);

  if (!po) notFound();

  const fields = [
    { label: "Proveedor", value: po.supplier.name },
    { label: "Fecha", value: formatDate(po.date) },
    { label: "Estado", value: po.status },
    { label: "QQ Pergamino", value: formatNumber(toNum(po.quintalesPerg), 2) },
    { label: "Precio/QQ", value: formatGTQ(toNum(po.precioPerg)) },
    { label: "Total Café", value: formatGTQ(toNum(po.totalCafe)) },
    { label: "Flete/QQ", value: formatGTQ(toNum(po.fletePorQQ)) },
    { label: "Total Flete", value: formatGTQ(toNum(po.totalFlete)) },
    { label: "Seguridad", value: formatGTQ(toNum(po.seguridad)) },
    { label: "Seguro", value: formatGTQ(toNum(po.seguro)) },
    { label: "Cadena", value: formatGTQ(toNum(po.cadena)) },
    { label: "Cargas", value: formatGTQ(toNum(po.cargas)) },
    { label: "Descargas", value: formatGTQ(toNum(po.descargas)) },
  ];

  return (
    <>
      <PageHeader
        title={po.orderNumber}
        breadcrumbs={[
          { label: "Órdenes de Compra", href: "/inventory" },
          { label: po.orderNumber },
        ]}
        action={
          <Link href={`/inventory/${id}/edit`}>
            <Button variant="outline">Editar</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <span className="text-lg font-semibold text-gray-900 dark:text-white">
                {po.supplier.name} — {po.orderNumber}
              </span>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
                {fields.map((f) => (
                  <div key={f.label}>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">
                      {f.label}
                    </dt>
                    <dd className="text-sm font-medium font-mono text-gray-900 dark:text-white">
                      {f.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="py-6 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                Costo Total Acumulado
              </p>
              <p className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1">
                {formatGTQ(toNum(po.costoTotalAccum))}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-6 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                Precio Promedio
              </p>
              <p className="text-2xl font-bold font-mono text-gray-900 dark:text-white mt-1">
                {formatGTQ(toNum(po.precioPromedio))}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
