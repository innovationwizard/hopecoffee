import { PageHeader } from "@/components/ui/page-header";
import { POForm } from "../../inventory/_components/po-form";
import { getSuppliers } from "../../inventory/actions";

export default async function NewPurchaseOrderPage() {
  const suppliers = await getSuppliers();

  return (
    <>
      <PageHeader
        title="Nueva Orden de Compra"
        breadcrumbs={[
          { label: "Ordenes de Compra", href: "/purchase-orders" },
          { label: "Nueva" },
        ]}
      />
      <POForm mode="create" suppliers={suppliers} />
    </>
  );
}
