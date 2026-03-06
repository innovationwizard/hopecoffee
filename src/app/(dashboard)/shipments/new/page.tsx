import { PageHeader } from "@/components/ui/page-header";
import { ShipmentForm } from "../_components/shipment-form";

export default function NewShipmentPage() {
  return (
    <>
      <PageHeader
        title="Nuevo Embarque"
        breadcrumbs={[
          { label: "Embarques", href: "/shipments" },
          { label: "Nuevo" },
        ]}
      />
      <ShipmentForm mode="create" />
    </>
  );
}
