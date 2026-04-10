import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { ContractForm } from "../../_components/contract-form";
import { getContract, getClients, getActiveExchangeRate, getMonthlyContext } from "../../actions";
import { getShipments } from "../../../shipments/actions";
import { toNum } from "@/lib/utils/format";

export default async function EditContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [contract, clients, rate, shipments] = await Promise.all([
    getContract(id),
    getClients(),
    getActiveExchangeRate(),
    getShipments(),
  ]);

  if (!contract) notFound();

  const monthlyContext = await getMonthlyContext(contract.createdAt, id);

  return (
    <>
      <PageHeader
        title={`Editar ${contract.contractNumber}`}
        breadcrumbs={[
          { label: "Contratos", href: "/contracts" },
          { label: contract.contractNumber, href: `/contracts/${id}` },
          { label: "Editar" },
        ]}
      />
      <ContractForm
        mode="edit"
        clients={clients}
        shipments={shipments.map((s) => ({ id: s.id, name: s.name, month: s.month, year: s.year }))}
        defaultExchangeRate={toNum(rate?.rate) || 7.65}
        monthlyContext={monthlyContext}
        initialData={{
          id: contract.id,
          contractNumber: contract.contractNumber,
          clientId: contract.clientId,
          shipmentId: contract.shipmentId ?? undefined,
          status: contract.status,
          regions: contract.regions,
          puntaje: contract.puntaje,
          sacos69kg: toNum(contract.sacos69kg),
          rendimiento: toNum(contract.rendimiento),
          precioBolsa: toNum(contract.precioBolsa),
          diferencial: toNum(contract.diferencial),
          tipoCambio: toNum(contract.tipoCambio),
          lote: contract.lote,
          notes: contract.notes,
        }}
      />
    </>
  );
}
