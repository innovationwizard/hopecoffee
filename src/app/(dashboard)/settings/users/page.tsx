import { getUsers } from "../actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatDate } from "@/lib/utils/format";
import { Badge } from "@/components/ui/badge";
import { UserCreateForm } from "./_components/user-create-form";
import { UserToggle } from "./_components/user-toggle";

export default async function UsersPage() {
  const users = await getUsers();

  return (
    <>
      <PageHeader
        title="Usuarios"
        breadcrumbs={[
          { label: "Configuración" },
          { label: "Usuarios" },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Usuarios del Sistema
              </h3>
            </CardHeader>
            <CardContent>
              <table className="dense-table w-full">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Último Login</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="font-medium">{u.name}</td>
                      <td className="text-gray-500">{u.email}</td>
                      <td>
                        <Badge
                          variant={
                            u.role === "ADMIN"
                              ? "purple"
                              : u.role === "FINANCIAL_OPERATOR"
                              ? "blue"
                              : u.role === "FIELD_OPERATOR"
                              ? "emerald"
                              : "gray"
                          }
                        >
                          {u.role === "FIELD_OPERATOR"
                            ? "Operaciones"
                            : u.role === "FINANCIAL_OPERATOR"
                            ? "Finanzas"
                            : u.role === "ADMIN"
                            ? "Administrador"
                            : "Consulta"}
                        </Badge>
                      </td>
                      <td>
                        {u.isActive ? (
                          <span className="text-xs text-emerald-600">
                            Activo
                          </span>
                        ) : (
                          <span className="text-xs text-red-500">
                            Inactivo
                          </span>
                        )}
                      </td>
                      <td className="text-xs text-gray-500">
                        {u.lastLoginAt ? formatDate(u.lastLoginAt) : "Nunca"}
                      </td>
                      <td>
                        <UserToggle userId={u.id} isActive={u.isActive} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Crear Usuario
              </h3>
            </CardHeader>
            <CardContent>
              <UserCreateForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
