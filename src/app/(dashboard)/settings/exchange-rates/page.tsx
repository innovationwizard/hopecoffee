import { getExchangeRates } from "../actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatNumber, formatDate, toNum } from "@/lib/utils/format";
import { ExchangeRateForm } from "./_components/exchange-rate-form";

export default async function ExchangeRatesPage() {
  const rates = await getExchangeRates();

  const activeRate = rates.find((r) => r.isActive);

  return (
    <>
      <PageHeader
        title="Tipos de Cambio"
        breadcrumbs={[
          { label: "Configuración" },
          { label: "Tipos de Cambio" },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {/* History table */}
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Historial
              </h3>
            </CardHeader>
            <CardContent>
              {rates.length > 0 ? (
                <table className="dense-table w-full">
                  <thead>
                    <tr>
                      <th className="text-right">Tasa</th>
                      <th>Válido Desde</th>
                      <th>Válido Hasta</th>
                      <th>Estado</th>
                      <th>Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rates.map((r) => (
                      <tr key={r.id}>
                        <td className="text-right font-mono font-semibold">
                          {formatNumber(toNum(r.rate), 2)}
                        </td>
                        <td>{formatDate(r.validFrom)}</td>
                        <td>{r.validTo ? formatDate(r.validTo) : "—"}</td>
                        <td>
                          {r.isActive ? (
                            <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                              Activo
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">
                              Inactivo
                            </span>
                          )}
                        </td>
                        <td className="text-xs text-gray-500">
                          {r.notes || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">
                  Sin tipos de cambio registrados.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {/* Current rate */}
          <Card>
            <CardContent className="py-6 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                Tasa Actual
              </p>
              <p className="text-3xl font-bold font-mono text-gray-900 dark:text-white mt-1">
                Q {activeRate ? formatNumber(toNum(activeRate.rate), 2) : "—"}
              </p>
            </CardContent>
          </Card>

          {/* Add new rate */}
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Nuevo Tipo de Cambio
              </h3>
            </CardHeader>
            <CardContent>
              <ExchangeRateForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
