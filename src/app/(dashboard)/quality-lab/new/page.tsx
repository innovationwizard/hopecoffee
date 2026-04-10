import { PageHeader } from "@/components/ui/page-header";
import { CuppingForm } from "../_components/cupping-form";
import { getLotsForCupping } from "../actions";

export default async function NewCuppingPage() {
  const lots = await getLotsForCupping();

  const lotOptions = lots.map((l) => ({
    id: l.id,
    lotNumber: l.lotNumber,
    supplier: l.supplier,
  }));

  return (
    <div>
      <PageHeader
        title="Nueva Catacion"
        breadcrumbs={[
          { label: "Laboratorio de Calidad", href: "/quality-lab" },
          { label: "Nueva Catacion" },
        ]}
      />
      <CuppingForm lots={lotOptions} />
    </div>
  );
}
