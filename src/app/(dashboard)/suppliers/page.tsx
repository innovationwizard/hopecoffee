import Link from "next/link";
import { getSuppliers } from "./actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Truck } from "lucide-react";

export default async function SuppliersPage() {
  const suppliers = await getSuppliers();

  return (
    <>
      <PageHeader title="Proveedores" />

      {suppliers.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="Sin proveedores"
          description="Los proveedores se crean al ejecutar el seed."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((s) => (
            <Link key={s.id} href={`/suppliers/${s.id}`}>
              <Card className="hover:ring-2 hover:ring-blue-500 transition-shadow cursor-pointer">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {s.name}
                      </h3>
                      <p className="text-xs text-gray-500">{s.code}</p>
                    </div>
                    {!s.isActive && (
                      <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                        Inactivo
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">Órdenes</p>
                      <p className="font-mono font-medium text-gray-900 dark:text-white">
                        {s._count.purchaseOrders}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Entradas</p>
                      <p className="font-mono font-medium text-gray-900 dark:text-white">
                        {s._count.accountEntries}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
