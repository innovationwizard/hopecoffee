import { getAuditLogs } from "../settings/actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatDate } from "@/lib/utils/format";
import { Badge } from "@/components/ui/badge";

export default async function AuditLogPage() {
  const { entries, total } = await getAuditLogs();

  return (
    <>
      <PageHeader
        title="Registro de Auditoria"
        breadcrumbs={[{ label: "Auditoria" }]}
      />

      <Card>
        <CardHeader>
          <p className="text-xs text-gray-500">
            {total} entradas totales
          </p>
        </CardHeader>
        <CardContent>
          {entries.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="dense-table w-full">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Usuario</th>
                    <th>Accion</th>
                    <th>Entidad</th>
                    <th>ID Entidad</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td className="text-xs text-gray-500">
                        {formatDate(e.createdAt)}
                      </td>
                      <td className="text-sm">{e.user.name}</td>
                      <td>
                        <Badge
                          variant={
                            e.action === "CREATE"
                              ? "emerald"
                              : e.action === "UPDATE"
                              ? "blue"
                              : e.action === "DELETE"
                              ? "red"
                              : "gray"
                          }
                        >
                          {e.action}
                        </Badge>
                      </td>
                      <td className="text-sm">{e.entity}</td>
                      <td className="text-xs font-mono text-gray-500 truncate max-w-[120px]">
                        {e.entityId}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">
              Sin entradas de auditoria.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
