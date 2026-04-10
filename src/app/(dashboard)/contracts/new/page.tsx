import { PageHeader } from "@/components/ui/page-header";
import { ContractForm } from "../_components/contract-form";
import { getClients, getActiveExchangeRate, getMonthlyContext } from "../actions";
import { getShipments } from "../../shipments/actions";
import { toNum } from "@/lib/utils/format";

export default async function NewContractPage() {
  const [clients, rate, monthlyContext, shipments] = await Promise.all([
    getClients(),
    getActiveExchangeRate(),
    getMonthlyContext(),
    getShipments(),
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
        shipments={shipments.map((s) => ({ id: s.id, name: s.name, month: s.month, year: s.year }))}
        defaultExchangeRate={toNum(rate?.rate) || 7.65}
        monthlyContext={monthlyContext}
      />
    </>
  );
}
