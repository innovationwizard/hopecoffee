import { notFound } from "next/navigation";
import Link from "next/link";
import { getContract, getMonthlyContext } from "../actions";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  formatUSD,
  formatGTQ,
  formatNumber,
  formatDate,
  formatRegion,
  toNum,
} from "@/lib/utils/format";
import { ContractStatusChanger } from "../_components/contract-status-changer";
import { ContractProgress } from "../_components/contract-progress";
import { ContractSummaryCard } from "../_components/contract-summary-card";
import { MonthlyContext } from "../_components/monthly-context";
import { PriceHistory } from "../_components/price-history";
import { LotAllocationsSection } from "../_components/lot-allocations-section";
import { getContractLotAllocations, getAvailableOroLots } from "../lot-actions";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contract = await getContract(id);
  if (!contract) notFound();

  const [monthlyContext, lotAllocations, availableOroLots] = await Promise.all([
    getMonthlyContext(contract.createdAt, id),
    getContractLotAllocations(id),
    getAvailableOroLots(),
  ]);

  const contractMargin =
    toNum(contract.facturacionKgs) > 0
      ? toNum(contract.utilidadSinCF) / toNum(contract.facturacionKgs)
      : 0;

  const tipoFactLabel = contract.tipoFacturacion === "LIBRAS_ESPANOLAS"
    ? "Kilos"
    : "Libras";

  // source: "external" = typed by user from outside app
  //         "app"      = computed from other app modules/formulas
  //         undefined  = locally computed from other contract fields
  const fields: { label: string; value: string | number; source?: "external" | "app" }[] = [
    { label: "Cliente", value: contract.client.name, source: "external" },
    { label: "Correlativo", value: contract.officialCorrelative ?? "—", source: "app" },
    { label: "Contrato", value: contract.contractNumber, source: "external" },
    { label: "Nombre COO", value: contract.cooContractName ?? "—", source: "external" },
    { label: "Tipo Facturación", value: tipoFactLabel, source: "external" },
    { label: "Posición Bolsa", value: contract.posicionBolsa ?? "—", source: "external" },
    { label: "Cosecha", value: contract.cosecha ?? "—", source: "external" },
    { label: "Puntaje", value: contract.puntaje, source: "external" },
    { label: "Sacos 69kg", value: formatNumber(toNum(contract.sacos69kg), 0), source: "external" },
    { label: "Quintales", value: formatNumber(toNum(contract.sacos46kg), 1) },
    { label: "Rendimiento", value: formatNumber(toNum(contract.rendimiento), 4), source: "external" },
    { label: "Bolsa", value: formatUSD(toNum(contract.precioBolsa)), source: "external" },
    { label: "Diferencial", value: formatUSD(toNum(contract.diferencial)), source: "external" },
    { label: "Bolsa+Dif", value: formatUSD(toNum(contract.precioBolsaDif)) },
    { label: "Fact. Lbs", value: formatUSD(toNum(contract.facturacionLbs)) },
    { label: "Fact. Kgs", value: formatUSD(toNum(contract.facturacionKgs)) },
    { label: "Gastos Exportación", value: formatUSD(toNum(contract.gastosExport)), source: "app" },
    { label: "Utilidad s/GE", value: formatUSD(toNum(contract.utilidadSinGE)) },
    { label: "Costo Financiero", value: formatUSD(toNum(contract.costoFinanciero)), source: "app" },
    { label: "Utilidad s/CF", value: formatUSD(toNum(contract.utilidadSinCF)) },
    { label: "Com. Compra", value: formatUSD(toNum(contract.comisionCompra)), source: "app" },
    { label: "Com. Venta", value: formatUSD(toNum(contract.comisionVenta)), source: "app" },
    { label: "Tipo de Cambio", value: formatNumber(toNum(contract.tipoCambio), 2), source: "external" },
    { label: "Lote", value: contract.lote ?? "—", source: "external" },
    { label: "Fecha Embarque", value: formatDate(contract.fechaEmbarque), source: "external" },
    { label: "Regiones", value: contract.regions.map(formatRegion).join(", ") || "—", source: "external" },
    { label: "Embarque", value: contract.shipment?.name ?? "Sin asignar", source: "app" },
  ];

  return (
    <>
      <PageHeader
        title={contract.officialCorrelative ?? contract.contractNumber}
        breadcrumbs={[
          { label: "Contratos", href: "/contracts" },
          { label: contract.officialCorrelative ?? contract.contractNumber },
        ]}
        action={
          <div className="flex gap-2">
            <Link href={`/contracts/${id}/edit`}>
              <Button variant="outline">Editar</Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: details */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                  {contract.client.name} — {contract.contractNumber}
                </span>
                <StatusBadge status={contract.status} />
              </div>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
                {fields.map((f) => (
                  <div
                    key={f.label}
                    className={
                      f.source === "external"
                        ? "border-l-2 border-amber-400 dark:border-amber-500 pl-2"
                        : f.source === "app"
                        ? "border-l-2 border-blue-400 dark:border-blue-500 pl-2"
                        : ""
                    }
                  >
                    <dt className="text-xs text-gray-500 dark:text-gray-400">
                      {f.label}
                    </dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white font-mono">
                      {f.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="mt-4 pt-2 border-t border-gray-100 dark:border-gray-800 flex gap-4 text-[10px] text-gray-400">
                <span className="flex items-center gap-1">
                  <span className="w-1 h-3 bg-amber-400 rounded-sm" /> Input externo
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1 h-3 bg-blue-400 rounded-sm" /> Dato del sistema
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1 h-3 bg-gray-200 dark:bg-gray-700 rounded-sm" /> Calculado
                </span>
              </div>

              {contract.status === "NEGOCIACION" && contract.posicionBolsa && (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md text-sm text-blue-600 dark:text-blue-400">
                  Precio de bolsa en vivo para posición {contract.posicionBolsa} estará disponible en Fase 3 (integración ICE).
                </div>
              )}

              {contract.notes && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Notas
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {contract.notes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Price History */}
          {contract.priceSnapshots.length > 0 && (
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Historial de Precios
                </h3>
              </CardHeader>
              <CardContent>
                <PriceHistory snapshots={contract.priceSnapshots} />
              </CardContent>
            </Card>
          )}

          {/* Lot Allocations */}
          <CollapsibleSection
            title="Lotes Asignados"
            badge={lotAllocations.length}
          >
            <LotAllocationsSection
              contractId={id}
              initialAllocations={lotAllocations.map((a) => ({
                id: a.id,
                quantityQQ: Number(a.quantityQQ),
                lot: {
                  id: a.lot.id,
                  lotNumber: a.lot.lotNumber,
                  stage: a.lot.stage,
                  quantityQQ: Number(a.lot.quantityQQ),
                  supplier: a.lot.supplier,
                },
              }))}
              availableLots={availableOroLots.map((l) => ({
                id: l.id,
                lotNumber: l.lotNumber,
                quantityQQ: Number(l.quantityQQ),
                qualityGrade: l.qualityGrade,
                supplier: l.supplier,
              }))}
            />
          </CollapsibleSection>
        </div>

        {/* Right panel: 1) This Contract  2) Monthly Context  3) Progress  4) Actions */}
        <div className="space-y-4">
          {/* 1 — Este Contrato */}
          <ContractSummaryCard
            totalPagoQTZ={toNum(contract.totalPagoQTZ)}
            precioBolsaDif={toNum(contract.precioBolsaDif)}
            facturacionKgs={toNum(contract.facturacionKgs)}
            gastosExport={toNum(contract.gastosExport)}
            costoFinanciero={toNum(contract.costoFinanciero)}
            totalQQPergamino={contract.materiaPrimaAllocations.reduce(
              (sum, a) => sum + toNum(a.materiaPrima.pergamino), 0
            )}
            totalCompraPergamino={contract.materiaPrimaAllocations.reduce(
              (sum, a) => sum + toNum(a.materiaPrima.totalMP), 0
            )}
            totalQQSubproducto={toNum(contract.subproductos)}
            totalVentSubproducto={
              toNum(contract.subproductos) * toNum(contract.precioSubproducto)
            }
            margenBrutoContrato={contractMargin}
            margenBrutoPonderado={
              contract.shipment ? toNum(contract.shipment.margenBruto) : null
            }
            facturacionAcumulada={
              contract.shipment ? toNum(contract.shipment.totalFacturacionKgs) : null
            }
            contenedoresVendidos={
              contract.shipment ? contract.shipment._count.containers : null
            }
          />

          {/* 2 — Contexto del Mes */}
          <MonthlyContext stats={monthlyContext} />

          {/* 3 — Progreso */}
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Progreso
              </h3>
            </CardHeader>
            <CardContent>
              <ContractProgress
                status={contract.status}
                hasPrecioBolsa={toNum(contract.precioBolsa) > 0}
                hasDiferencial={contract.diferencial != null}
                hasEmbarque={contract.shipment != null}
                hasMateriaPrima={contract.materiaPrimaAllocations.length > 0}
                hasFechaEmbarque={contract.fechaEmbarque != null}
              />
            </CardContent>
          </Card>

          {/* 4 — Acciones */}
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Acciones
              </h3>
            </CardHeader>
            <CardContent className="space-y-2">
              <ContractStatusChanger
                contractId={contract.id}
                currentStatus={contract.status}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
