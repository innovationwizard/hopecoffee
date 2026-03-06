import Link from "next/link";
import { getShipments } from "./actions";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  formatGTQ,
  formatPercent,
  formatMonth,
  toNum,
} from "@/lib/utils/format";
import { Ship } from "lucide-react";

export default async function ShipmentsPage() {
  const shipments = await getShipments();

  return (
    <>
      <PageHeader
        title="Embarques"
        action={
          <Link href="/shipments/new">
            <Button>+ Nuevo Embarque</Button>
          </Link>
        }
      />

      {shipments.length === 0 ? (
        <EmptyState
          icon={Ship}
          title="Sin embarques"
          description="Crea tu primer embarque para empezar a rastrear envíos."
          action={
            <Link href="/shipments/new">
              <Button>Nuevo Embarque</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shipments.map((s) => (
            <Link key={s.id} href={`/shipments/${s.id}`}>
              <Card className="hover:ring-2 hover:ring-blue-500 transition-shadow cursor-pointer">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {s.name}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {formatMonth(s.month, s.year)}
                      </p>
                    </div>
                    <StatusBadge status={s.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">Contenedores</p>
                      <p className="font-mono font-medium text-gray-900 dark:text-white">
                        {s.numContainers}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Contratos</p>
                      <p className="font-mono font-medium text-gray-900 dark:text-white">
                        {s._count.contracts}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Total Pago Q</p>
                      <p className="font-mono font-medium text-emerald-700 dark:text-emerald-400">
                        {formatGTQ(toNum(s.totalPagoQTZ))}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Margen</p>
                      <p className="font-mono font-medium text-gray-900 dark:text-white">
                        {formatPercent(toNum(s.margenBruto))}
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
