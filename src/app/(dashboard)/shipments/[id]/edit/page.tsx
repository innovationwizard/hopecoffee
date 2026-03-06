import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { ShipmentForm } from "../../_components/shipment-form";
import { getShipment } from "../../actions";
import { toNum } from "@/lib/utils/format";

export default async function EditShipmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const shipment = await getShipment(id);

  if (!shipment) notFound();

  return (
    <>
      <PageHeader
        title={`Editar ${shipment.name}`}
        breadcrumbs={[
          { label: "Embarques", href: "/shipments" },
          { label: shipment.name, href: `/shipments/${id}` },
          { label: "Editar" },
        ]}
      />
      <ShipmentForm
        mode="edit"
        initialData={{
          id: shipment.id,
          name: shipment.name,
          month: shipment.month,
          year: shipment.year,
          numContainers: shipment.numContainers,
          regions: shipment.regions,
          notes: shipment.notes,
          gastosPerSaco: toNum(shipment.gastosPerSaco),
        }}
      />
    </>
  );
}
