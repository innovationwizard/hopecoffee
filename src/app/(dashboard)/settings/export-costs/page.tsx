import { getExportCostConfigs } from "../actions";
import { PageHeader } from "@/components/ui/page-header";
import { ExportCostsClient } from "./_components/export-costs-client";

export default async function ExportCostsPage() {
  const configs = await getExportCostConfigs();

  return (
    <>
      <PageHeader
        title="Costos de Exportación"
        breadcrumbs={[
          { label: "Configuración" },
          { label: "Costos de Exportación" },
        ]}
      />
      <ExportCostsClient configs={configs} />
    </>
  );
}
