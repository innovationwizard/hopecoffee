import { getFacilities } from "./actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { FacilityForm } from "./_components/facility-form";
import { FacilityDeleteButton } from "./_components/facility-delete-button";
import { toNum, formatNumber } from "@/lib/utils/format";

const TYPE_BADGE: Record<string, string> = {
  BENEFICIO: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  BODEGA: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  PATIO: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
};

export default async function FacilitiesPage() {
  const facilities = await getFacilities();

  return (
    <>
      <PageHeader title="Instalaciones" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-0">
              <table className="dense-table w-full">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Codigo</th>
                    <th>Tipo</th>
                    <th className="text-right">Capacidad (QQ)</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {facilities.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-gray-400 py-8">
                        Sin instalaciones registradas
                      </td>
                    </tr>
                  ) : (
                    facilities.map((f) => (
                      <tr key={f.id}>
                        <td className="font-medium">{f.name}</td>
                        <td className="font-mono text-xs">{f.code}</td>
                        <td>
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_BADGE[f.type] ?? "bg-gray-100 text-gray-800"}`}
                          >
                            {f.type}
                          </span>
                        </td>
                        <td className="text-right font-mono">
                          {f.capacity ? formatNumber(toNum(f.capacity), 0) : "--"}
                        </td>
                        <td>
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              f.isActive
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                            }`}
                          >
                            {f.isActive ? "Activa" : "Inactiva"}
                          </span>
                        </td>
                        <td>
                          <FacilityDeleteButton id={f.id} name={f.name} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardContent className="pt-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                Nueva Instalacion
              </h3>
              <FacilityForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
