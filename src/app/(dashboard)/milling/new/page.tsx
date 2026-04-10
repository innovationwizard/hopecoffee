import { PageHeader } from "@/components/ui/page-header";
import { MillingForm } from "../_components/milling-form";
import { getAvailableLots, getFacilities } from "../actions";

export default async function NewMillingOrderPage() {
  const [lots, facilities] = await Promise.all([
    getAvailableLots(),
    getFacilities(),
  ]);

  const serializedLots = lots.map((l) => ({
    id: l.id,
    lotNumber: l.lotNumber,
    quantityQQ: Number(l.quantityQQ),
    supplier: l.supplier,
  }));

  const serializedFacilities = facilities.map((f) => ({
    id: f.id,
    name: f.name,
  }));

  return (
    <>
      <PageHeader
        title="Nueva Orden de Tria"
        breadcrumbs={[
          { label: "Ordenes de Tria", href: "/milling" },
          { label: "Nueva" },
        ]}
      />
      <MillingForm lots={serializedLots} facilities={serializedFacilities} />
    </>
  );
}
