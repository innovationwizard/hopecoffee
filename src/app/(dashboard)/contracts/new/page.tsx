import { PageHeader } from "@/components/ui/page-header";
import { ContractForm } from "../_components/contract-form";
import { getClients, getActiveExchangeRate, getMonthlyContext } from "../actions";
import { toNum } from "@/lib/utils/format";

export default async function NewContractPage() {
  const [clients, rate, monthlyContext] = await Promise.all([
    getClients(),
    getActiveExchangeRate(),
    getMonthlyContext(),
  ]);

  return (
    <>
      <PageHeader
        title="Nuevo Contrato"
        breadcrumbs={[
          { label: "Contratos", href: "/contracts" },
          { label: "Nuevo" },
        ]}
      />
      <ContractForm
        mode="create"
        clients={clients}
        defaultExchangeRate={toNum(rate?.rate) || 7.65}
        monthlyContext={monthlyContext}
      />
    </>
  );
}
