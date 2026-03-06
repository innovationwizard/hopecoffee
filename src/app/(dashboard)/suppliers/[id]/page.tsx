import { notFound } from "next/navigation";
import { getSupplier } from "../actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { AccountStatement } from "../_components/account-statement";
import { formatGTQ, formatDate, toNum } from "@/lib/utils/format";
import Link from "next/link";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supplier = await getSupplier(id);

  if (!supplier) notFound();

  return (
    <>
      <PageHeader
        title={supplier.name}
        breadcrumbs={[
          { label: "Proveedores", href: "/suppliers" },
          { label: supplier.name },
        ]}
      />

      <div className="space-y-4">
        {/* Info card */}
        <Card>
          <CardContent className="py-4">
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <dt className="text-xs text-gray-500">Código</dt>
                <dd className="font-medium text-gray-900 dark:text-white">
                  {supplier.code}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Contacto</dt>
                <dd className="font-medium text-gray-900 dark:text-white">
                  {supplier.contact || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Email</dt>
                <dd className="font-medium text-gray-900 dark:text-white">
                  {supplier.email || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Teléfono</dt>
                <dd className="font-medium text-gray-900 dark:text-white">
                  {supplier.phone || "—"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Purchase Orders */}
        <CollapsibleSection
          title="Órdenes de Compra"
          badge={supplier.purchaseOrders.length}
        >
          {supplier.purchaseOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="dense-table w-full">
                <thead>
                  <tr>
                    <th>OC</th>
                    <th>Fecha</th>
                    <th>Estado</th>
                    <th className="text-right">Costo Total</th>
                  </tr>
                </thead>
                <tbody>
                  {supplier.purchaseOrders.map((po) => (
                    <tr key={po.id}>
                      <td>
                        <Link
                          href={`/inventory/${po.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {po.orderNumber}
                        </Link>
                      </td>
                      <td>{formatDate(po.date)}</td>
                      <td>{po.status}</td>
                      <td className="text-right font-mono">
                        {formatGTQ(toNum(po.costoTotalAccum))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Sin órdenes de compra.</p>
          )}
        </CollapsibleSection>

        {/* Account Statement */}
        <CollapsibleSection
          title="Estado de Cuenta"
          badge={supplier.accountEntries.length}
        >
          <AccountStatement
            supplierId={id}
            entries={supplier.accountEntries}
          />
        </CollapsibleSection>
      </div>
    </>
  );
}
