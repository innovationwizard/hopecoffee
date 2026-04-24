import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { UserRolesEditForm } from "../../_components/user-roles-edit-form";
import { getUser } from "../../../actions";

export default async function EditUserRolesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUser(id);

  if (!user) notFound();

  const roles = user.roleAssignments.map((ra) => ra.role);

  return (
    <>
      <PageHeader
        title={`Editar roles — ${user.name}`}
        breadcrumbs={[
          { label: "Configuracion" },
          { label: "Usuarios", href: "/settings/users" },
          { label: "Editar roles" },
        ]}
      />
      <div className="max-w-md">
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {user.email}
            </h3>
          </CardHeader>
          <CardContent>
            <UserRolesEditForm userId={user.id} currentRoles={roles} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
