import { PageHeader } from "@/components/ui/page-header";
import { POForm } from "../_components/po-form";
import { getSuppliers } from "../actions";

export default async function NewPurchaseOrderPage() {
  const suppliers = await getSuppliers();

  return (
    <>
      <PageHeader
        title="Nueva Orden de Compra"
        breadcrumbs={[
          { label: "Órdenes de Compra", href: "/inventory" },
          { label: "Nueva" },
        ]}
      />
      <POForm mode="create" suppliers={suppliers} />
    </>
  );
}
