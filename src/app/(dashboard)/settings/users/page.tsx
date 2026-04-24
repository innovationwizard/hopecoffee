import Link from "next/link";
import { getUsers } from "../actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils/format";
import { Badge } from "@/components/ui/badge";
import { UserCreateForm } from "./_components/user-create-form";
import { UserToggle } from "./_components/user-toggle";
import type { UserRole } from "@prisma/client";

const ROLE_LABELS: Record<UserRole, string> = {
  MASTER: "Master",
  GERENCIA: "Gerencia",
  FINANCIERO: "Finanzas",
  COMPRAS: "Compras",
  VENTAS: "Ventas",
  LAB: "Laboratorio",
  ANALISIS: "Analisis",
  CONTABILIDAD: "Contabilidad",
  LOGISTICA: "Logistica",
  LAB_ASISTENTE: "Lab Asistente",
};

const ROLE_BADGE_VARIANT: Record<UserRole, "purple" | "blue" | "emerald" | "gray"> = {
  MASTER: "purple",
  GERENCIA: "blue",
  FINANCIERO: "blue",
  COMPRAS: "emerald",
  VENTAS: "emerald",
  LAB: "emerald",
  ANALISIS: "gray",
  CONTABILIDAD: "gray",
  LOGISTICA: "gray",
  LAB_ASISTENTE: "gray",
};

export default async function UsersPage() {
  const users = await getUsers();

  return (
    <>
      <PageHeader
        title="Usuarios"
        breadcrumbs={[
          { label: "Configuracion" },
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
                    <th>Roles</th>
                    <th>Estado</th>
                    <th>Ultimo Login</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="font-medium">{u.name}</td>
                      <td className="text-gray-500">{u.email}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {u.roleAssignments.map((ra) => (
                            <Badge
                              key={ra.role}
                              variant={ROLE_BADGE_VARIANT[ra.role]}
                            >
                              {ROLE_LABELS[ra.role]}
                            </Badge>
                          ))}
                          {u.roleAssignments.length === 0 && (
                            <span className="text-xs text-gray-400">Sin rol</span>
                          )}
                        </div>
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
                        <div className="flex gap-2">
                          <Link href={`/settings/users/${u.id}/edit`}>
                            <Button variant="outline" size="sm">
                              Editar
                            </Button>
                          </Link>
                          <UserToggle userId={u.id} isActive={u.isActive} />
                        </div>
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
