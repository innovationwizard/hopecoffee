import { getLots, getLotBalances } from "./lot-actions";
import { getFacilities } from "../settings/facilities/actions";
import { getSuppliers } from "../suppliers/actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatNumber, formatDate, toNum } from "@/lib/utils/format";
import { Package } from "lucide-react";
import { InventoryFilters } from "./_components/inventory-filters";

const STAGE_BADGE: Record<string, { label: string; classes: string }> = {
  PERGAMINO_BODEGA: { label: "Pergamino en Bodega", classes: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  EN_PROCESO: { label: "En Proceso", classes: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  ORO_EXPORTABLE: { label: "Oro Exportable", classes: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  EXPORTADO: { label: "Exportado", classes: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  SUBPRODUCTO: { label: "Subproducto", classes: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
};

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; facilityId?: string; supplierId?: string }>;
}) {
  const params = await searchParams;

  const [lots, balances, facilities, suppliers] = await Promise.all([
    getLots({
      stage: params.stage || undefined,
      facilityId: params.facilityId || undefined,
      supplierId: params.supplierId || undefined,
    }),
    getLotBalances(),
    getFacilities(),
    getSuppliers(),
  ]);

  const pergaminoQQ = balances["PERGAMINO_BODEGA"]?.totalQQ ?? 0;
  const enProcesoQQ = balances["EN_PROCESO"]?.totalQQ ?? 0;
  const oroQQ = balances["ORO_EXPORTABLE"]?.totalQQ ?? 0;

  return (
    <>
      <PageHeader title="Inventario" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-gray-500">Pergamino en Bodega</p>
            <p className="text-lg font-bold font-mono text-amber-700 dark:text-amber-400">
              {formatNumber(pergaminoQQ, 2)} QQ
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-gray-500">En Proceso</p>
            <p className="text-lg font-bold font-mono text-blue-700 dark:text-blue-400">
              {formatNumber(enProcesoQQ, 2)} QQ
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-gray-500">Oro Exportable</p>
            <p className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400">
              {formatNumber(oroQQ, 2)} QQ
            </p>
          </CardContent>
        </Card>
      </div>

      <InventoryFilters
        facilities={facilities.map((f) => ({ id: f.id, name: f.name }))}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        currentStage={params.stage}
        currentFacilityId={params.facilityId}
        currentSupplierId={params.supplierId}
      />

      {lots.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Sin lotes"
          description="Los lotes se crean automaticamente al registrar recepciones de proveedor."
        />
      ) : (
        <div className="overflow-x-auto mt-4">
          <table className="dense-table w-full">
            <thead>
              <tr>
                <th>Lote</th>
                <th>Proveedor</th>
                <th>Instalacion</th>
                <th>Etapa</th>
                <th className="text-right">Cantidad (QQ)</th>
                <th>Calidad</th>
                <th>Fecha Recepcion</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((lot) => {
                const badge = STAGE_BADGE[lot.stage] ?? { label: lot.stage, classes: "bg-gray-100 text-gray-800" };
                return (
                  <tr key={lot.id}>
                    <td className="font-mono text-xs font-medium">{lot.lotNumber}</td>
                    <td>{lot.supplier?.name ?? "--"}</td>
                    <td>{lot.facility?.name ?? "--"}</td>
                    <td>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.classes}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="text-right font-mono">
                      {formatNumber(toNum(lot.quantityQQ), 2)}
                    </td>
                    <td>{lot.qualityGrade ?? "--"}</td>
                    <td>{formatDate(lot.receptionDate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
