import { notFound } from "next/navigation";
import Link from "next/link";
import { getShipment, getUnassignedContracts } from "../actions";
import { getShipmentParties } from "../party-actions";
import { getClients } from "../../contracts/actions";
import { getAvailableOroLots } from "../../contracts/lot-actions";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { ContractsSection } from "../_components/contracts-section";
import { MateriaPrimaSection } from "../_components/materia-prima-section";
import { SubproductoSection } from "../_components/subproducto-section";
import { ContainersSection } from "../_components/containers-section";
import { PartiesSection } from "../_components/parties-section";
import { MarginCard } from "../_components/margin-card";
import {
  formatGTQ,
  formatMonth,
  toNum,
} from "@/lib/utils/format";

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [shipment, unassignedContracts, parties, clients, availableOroLots] = await Promise.all([
    getShipment(id),
    getUnassignedContracts(),
    getShipmentParties(id),
    getClients(),
    getAvailableOroLots(),
  ]);

  if (!shipment) notFound();

  return (
    <>
      <PageHeader
        title={shipment.name}
        breadcrumbs={[
          { label: "Embarques", href: "/shipments" },
          { label: shipment.name },
        ]}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={shipment.status} />
            <Link href={`/shipments/${id}/edit`}>
              <Button variant="outline" size="sm">
                Editar
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Summary bar */}
          <div className="grid grid-cols-4 gap-3">
            <Card>
              <CardContent className="py-3 text-center">
                <p className="text-xs text-gray-500">Mes</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {formatMonth(shipment.month, shipment.year)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 text-center">
                <p className="text-xs text-gray-500">Contenedores</p>
                <p className="text-sm font-semibold font-mono text-gray-900 dark:text-white">
                  {shipment.numContainers}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 text-center">
                <p className="text-xs text-gray-500">Contratos</p>
                <p className="text-sm font-semibold font-mono text-gray-900 dark:text-white">
                  {shipment.contracts.length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 text-center">
                <p className="text-xs text-gray-500">Total Pago Q</p>
                <p className="text-sm font-semibold font-mono text-emerald-700 dark:text-emerald-400">
                  {formatGTQ(toNum(shipment.totalPagoQTZ))}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Contracts section */}
          <CollapsibleSection
            title="Contratos"
            badge={shipment.contracts.length}
          >
            <ContractsSection
              shipmentId={id}
              contracts={shipment.contracts}
              unassignedContracts={unassignedContracts}
            />
          </CollapsibleSection>

          {/* Materia Prima section */}
          <CollapsibleSection
            title="Materia Prima"
            badge={shipment.materiaPrima.length}
          >
            <MateriaPrimaSection
              shipmentId={id}
              entries={shipment.materiaPrima}
            />
          </CollapsibleSection>

          {/* Subproductos section */}
          <CollapsibleSection
            title="Subproductos"
            badge={shipment.subproductos.length}
          >
            <SubproductoSection
              shipmentId={id}
              entries={shipment.subproductos}
            />
          </CollapsibleSection>

          {/* Containers section */}
          <CollapsibleSection
            title="Contenedores"
            badge={shipment.containers.length}
          >
            <ContainersSection
              shipmentId={id}
              containers={shipment.containers}
              availableOroLots={availableOroLots.map((l) => ({
                id: l.id,
                lotNumber: l.lotNumber,
                quantityQQ: Number(l.quantityQQ),
                qualityGrade: l.qualityGrade,
                supplier: l.supplier,
              }))}
            />
          </CollapsibleSection>

          {/* Parties section */}
          <CollapsibleSection
            title="Partes"
            badge={parties.length}
          >
            <PartiesSection
              shipmentId={id}
              parties={parties}
              clients={clients.map((c) => ({ id: c.id, name: c.name }))}
            />
          </CollapsibleSection>
        </div>

        {/* Right: Margin Card */}
        <div>
          <div className="sticky top-6">
            <MarginCard
              totalPagoQTZ={toNum(shipment.totalPagoQTZ)}
              totalMateriaPrima={toNum(shipment.totalMateriaPrima)}
              totalComision={toNum(shipment.totalComision)}
              totalSubproducto={toNum(shipment.totalSubproducto)}
              utilidadBruta={toNum(shipment.utilidadBruta)}
              margenBruto={toNum(shipment.margenBruto)}
            />
          </div>
        </div>
      </div>
    </>
  );
}
