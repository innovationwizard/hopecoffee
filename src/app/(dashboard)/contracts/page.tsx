import Link from "next/link";
import { FileText } from "lucide-react";
import { getContracts, getClients } from "./actions";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ContractTable } from "./_components/contract-table";
import { ContractFilters } from "./_components/contract-filters";

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; status?: string; search?: string; cosecha?: string; month?: string }>;
}) {
  const params = await searchParams;
  const [{ data: contracts }, clients] = await Promise.all([
    getContracts({
      clientId: params.clientId,
      status: params.status,
      search: params.search,
      cosecha: params.cosecha,
      month: params.month,
    }),
    getClients(),
  ]);

  return (
    <>
      <PageHeader
        title="Contratos"
        action={
          <Link href="/contracts/new">
            <Button>+ Nuevo Contrato</Button>
          </Link>
        }
      />

      <ContractFilters clients={clients} />

      {contracts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Sin contratos"
          description="Crea tu primer contrato para comenzar a rastrear ventas y márgenes."
          action={
            <Link href="/contracts/new">
              <Button>+ Nuevo Contrato</Button>
            </Link>
          }
        />
      ) : (
        <ContractTable contracts={contracts} />
      )}
    </>
  );
}
