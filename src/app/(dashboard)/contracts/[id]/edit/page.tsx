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

  const shipmentRef = contract.shipment
    ? new Date(contract.shipment.year, contract.shipment.month - 1, 1)
    : null;
  const monthlyContext = await getMonthlyContext(shipmentRef);

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
          precioBolsa: toNum(contract.precioBolsa),
          diferencial: toNum(contract.diferencial),
          tipoCambio: toNum(contract.tipoCambio),
          lote: contract.lote,
          notes: contract.notes,
          gastosPerSaco: contract.gastosPerSaco != null ? toNum(contract.gastosPerSaco) : undefined,
          exportTrillaPerQQ: contract.exportTrillaPerQQ != null ? toNum(contract.exportTrillaPerQQ) : undefined,
          exportSacoYute: contract.exportSacoYute != null ? toNum(contract.exportSacoYute) : undefined,
          exportEstampado: contract.exportEstampado != null ? toNum(contract.exportEstampado) : undefined,
          exportBolsaGrainPro: contract.exportBolsaGrainPro != null ? toNum(contract.exportBolsaGrainPro) : undefined,
          exportFitoSanitario: contract.exportFitoSanitario != null ? toNum(contract.exportFitoSanitario) : undefined,
          exportImpuestoAnacafe1: contract.exportImpuestoAnacafe1 != null ? toNum(contract.exportImpuestoAnacafe1) : undefined,
          exportImpuestoAnacafe2: contract.exportImpuestoAnacafe2 != null ? toNum(contract.exportImpuestoAnacafe2) : undefined,
          exportInspeccionOirsa: contract.exportInspeccionOirsa != null ? toNum(contract.exportInspeccionOirsa) : undefined,
          exportFumigacion: contract.exportFumigacion != null ? toNum(contract.exportFumigacion) : undefined,
          exportEmisionDocumento: contract.exportEmisionDocumento != null ? toNum(contract.exportEmisionDocumento) : undefined,
          exportFletePuerto: contract.exportFletePuerto != null ? toNum(contract.exportFletePuerto) : undefined,
          exportSeguro: contract.exportSeguro != null ? toNum(contract.exportSeguro) : undefined,
          exportCustodio: contract.exportCustodio != null ? toNum(contract.exportCustodio) : undefined,
          exportAgenteAduanal: contract.exportAgenteAduanal != null ? toNum(contract.exportAgenteAduanal) : undefined,
          exportComisionOrganico: contract.exportComisionOrganico != null ? toNum(contract.exportComisionOrganico) : undefined,
          qqRechazos: contract.qqRechazos != null ? toNum(contract.qqRechazos) : undefined,
          precioRechazos: contract.precioRechazos != null ? toNum(contract.precioRechazos) : undefined,
          mesesCredito: contract.mesesCredito ?? undefined,
          condicionesPago: contract.condicionesPago ?? undefined,
          estatusPago: contract.estatusPago ?? undefined,
        }}
      />
    </>
  );
}
