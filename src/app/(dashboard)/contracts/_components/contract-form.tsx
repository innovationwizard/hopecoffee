"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { ContractCreateSchema } from "@/lib/validations/schemas";
import type { z } from "zod";

type ContractFormValues = z.input<typeof ContractCreateSchema>;
import { calculateContract, type ContractCalculation } from "@/lib/services/calculations";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CalculationPreview } from "./calculation-preview";
import { MonthlyContext } from "./monthly-context";
import { createContract, updateContract } from "../actions";
import type { MonthlyContextStats } from "../actions";
import { formatUSD } from "@/lib/utils/format";

interface Client {
  id: string;
  name: string;
}

interface ShipmentOption {
  id: string;
  name: string;
  month: number;
  year: number;
}

const STATUS_OPTIONS = [
  { value: "NEGOCIACION", label: "Negociación" },
  { value: "CONFIRMADO", label: "Confirmado" },
  { value: "FIJADO", label: "Fijado" },
  { value: "NO_FIJADO", label: "No Fijado" },
  { value: "EMBARCADO", label: "Embarcado" },
];

const REGION_OPTIONS = [
  { value: "SANTA_ROSA", label: "Santa Rosa" },
  { value: "HUEHUETENANGO", label: "Huehuetenango" },
  { value: "ORGANICO", label: "Orgánico" },
  { value: "DANILANDIA", label: "Danilandia" },
  { value: "SANTA_ISABEL", label: "Santa Isabel" },
  { value: "OTHER", label: "Otra" },
];

const TIPO_FACTURACION_OPTIONS = [
  { value: "LIBRAS_GUATEMALTECAS", label: "Libras" },
  { value: "LIBRAS_ESPANOLAS", label: "Kilos" },
];

const POSICION_BOLSA_OPTIONS = [
  { value: "", label: "Sin posición" },
  { value: "MAR", label: "Marzo" },
  { value: "MAY", label: "Mayo" },
  { value: "JUL", label: "Julio" },
  { value: "SEP", label: "Septiembre" },
  { value: "DEC", label: "Diciembre" },
];

// Export cost line items with DB defaults
const EXPORT_COST_FIELDS = [
  { key: "trillaPerQQ", label: "Trilla / QQ", default: 7.0 },
  { key: "sacoYute", label: "Saco Yute", default: 1300.0 },
  { key: "estampado", label: "Estampado", default: 500.0 },
  { key: "bolsaGrainPro", label: "Bolsa GrainPro", default: 5000.0 },
  { key: "fitoSanitario", label: "Fito Sanitario", default: 50.0 },
  { key: "impuestoAnacafe1", label: "Impuesto Anacafé 1", default: 600.0 },
  { key: "impuestoAnacafe2", label: "Impuesto Anacafé 2", default: 500.0 },
  { key: "inspeccionOirsa", label: "Inspección OIRSA", default: 300.0 },
  { key: "fumigacion", label: "Fumigación", default: 400.0 },
  { key: "emisionDocumento", label: "Emisión Documento", default: 1200.0 },
  { key: "fletePuerto", label: "Flete a Puerto", default: 2000.0 },
  { key: "seguro", label: "Seguro", default: 230.0 },
  { key: "custodio", label: "Custodio", default: 450.0 },
  { key: "agenteAduanal", label: "Agente Aduanal", default: 34619.0 },
  { key: "comisionExportadorOrganico", label: "Comisión Export. Orgánico", default: 0 },
] as const;

interface ContractFormProps {
  mode: "create" | "edit";
  clients: Client[];
  shipments?: ShipmentOption[];
  defaultExchangeRate: number;
  initialData?: Partial<ContractFormValues> & { id?: string; status?: string };
  monthlyContext?: MonthlyContextStats;
}

export function ContractForm({
  mode,
  clients,
  shipments = [],
  defaultExchangeRate,
  initialData,
  monthlyContext,
}: ContractFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const isFijado = initialData?.status === "FIJADO";

  // Export cost line items (local state, not persisted per-contract)
  const [exportCosts, setExportCosts] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const f of EXPORT_COST_FIELDS) {
      initial[f.key] = f.default;
    }
    return initial;
  });

  // Costo Financiero components (local state for inline editing)
  const [cfInputMode, setCfInputMode] = useState<"monto" | "pct">("monto");
  const [cfMontoCredito, setCfMontoCredito] = useState(initialData?.montoCredito ?? 0);
  const [cfPct, setCfPct] = useState(0);
  const [cfTasa, setCfTasa] = useState(0.08);
  const [cfMeses, setCfMeses] = useState(2);

  // ISR — percentage or fixed amount (local state)
  const [isrInputMode, setIsrInputMode] = useState<"pct" | "monto">(
    initialData?.isrAmount ? "monto" : "pct"
  );
  const [isrPct, setIsrPct] = useState((initialData?.isrRate ?? 0) * 100);
  const [isrMonto, setIsrMonto] = useState(initialData?.isrAmount ?? 0);

  const gastosPerSaco = useMemo(() => {
    return Object.values(exportCosts).reduce((sum, v) => sum + (v || 0), 0);
  }, [exportCosts]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ContractFormValues>({
    resolver: zodResolver(ContractCreateSchema),
    defaultValues: {
      contractNumber: initialData?.contractNumber ?? "",
      clientId: initialData?.clientId ?? "",
      shipmentId: initialData?.shipmentId ?? undefined,
      status: initialData?.status ?? "NEGOCIACION",
      regions: initialData?.regions ?? ["SANTA_ROSA"],
      puntaje: initialData?.puntaje ?? 82,
      sacos69kg: initialData?.sacos69kg ?? 275,
      rendimiento: initialData?.rendimiento ?? 1.32,
      precioBolsa: initialData?.precioBolsa ?? undefined,
      diferencial: initialData?.diferencial ?? undefined,
      tipoCambio: initialData?.tipoCambio ?? defaultExchangeRate,
      tipoFacturacion: initialData?.tipoFacturacion ?? "LIBRAS_GUATEMALTECAS",
      posicionBolsa: initialData?.posicionBolsa ?? undefined,
      montoCredito: initialData?.montoCredito ?? undefined,
      cosecha: initialData?.cosecha ?? "",
      lote: initialData?.lote ?? "",
      notes: initialData?.notes ?? "",
    },
  });

  const watchedValues = watch();

  // Compute costo financiero from components
  const tipoCambio = watchedValues.tipoCambio ?? defaultExchangeRate;

  // Resolve effective montoCredito: either direct input or derived from % of totalPagoQTZ
  const effectiveMontoCredito = useMemo(() => {
    if (cfInputMode === "monto") return cfMontoCredito;
    // In pct mode, we need totalPagoQTZ which depends on calc — use a simple estimate
    // totalPagoQTZ = utilidadSinCF * tipoCambio, but that's circular with costoFinanciero
    // Use facturacionKgs * tipoCambio as the contract gross value base
    const sacos = watchedValues.sacos69kg ?? 0;
    const bolsa = watchedValues.precioBolsa ?? 0;
    const dif = watchedValues.diferencial ?? 0;
    const sacos46 = sacos * 1.5;
    const grossValue = sacos46 * (bolsa + dif) * tipoCambio;
    return grossValue > 0 ? (cfPct / 100) * grossValue : 0;
  }, [cfInputMode, cfMontoCredito, cfPct, watchedValues.sacos69kg, watchedValues.precioBolsa, watchedValues.diferencial, tipoCambio]);

  const costoFinancieroComputed = useMemo(() => {
    if (!effectiveMontoCredito || effectiveMontoCredito <= 0 || !tipoCambio) return 0;
    return (effectiveMontoCredito * (cfTasa / 12) * cfMeses) / tipoCambio;
  }, [effectiveMontoCredito, cfTasa, cfMeses, tipoCambio]);

  const calc: ContractCalculation | null = useMemo(() => {
    const sacos = watchedValues.sacos69kg;
    const bolsa = watchedValues.precioBolsa;
    if (!sacos || sacos <= 0) return null;

    return calculateContract({
      sacos69kg: sacos,
      puntaje: watchedValues.puntaje || 82,
      precioBolsa: bolsa ?? 0,
      diferencial: watchedValues.diferencial ?? 0,
      gastosExportPerSaco: gastosPerSaco,
      tipoCambio: tipoCambio,
      tipoFacturacion: watchedValues.tipoFacturacion ?? "LIBRAS_GUATEMALTECAS",
      costoFinanciero: costoFinancieroComputed || undefined,
    });
  }, [
    watchedValues.sacos69kg,
    watchedValues.puntaje,
    watchedValues.precioBolsa,
    watchedValues.diferencial,
    watchedValues.tipoFacturacion,
    tipoCambio,
    gastosPerSaco,
    costoFinancieroComputed,
    effectiveMontoCredito,
  ]);

  function updateExportCost(key: string, value: number) {
    setExportCosts((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(data: ContractFormValues) {
    setSubmitting(true);
    try {
      const parsed = ContractCreateSchema.parse({
        ...data,
        shipmentId: data.shipmentId || null,
        montoCredito: effectiveMontoCredito || undefined,
        cfTasaAnual: cfTasa || undefined,
        cfMeses: cfMeses || undefined,
        isrRate: isrInputMode === "pct" && isrPct > 0 ? isrPct / 100 : null,
        isrAmount: isrInputMode === "monto" && isrMonto > 0 ? isrMonto : null,
        gastosPerSaco: gastosPerSaco,
        exportTrillaPerQQ: exportCosts.trillaPerQQ || null,
        exportSacoYute: exportCosts.sacoYute || null,
        exportEstampado: exportCosts.estampado || null,
        exportBolsaGrainPro: exportCosts.bolsaGrainPro || null,
        exportFitoSanitario: exportCosts.fitoSanitario || null,
        exportImpuestoAnacafe1: exportCosts.impuestoAnacafe1 || null,
        exportImpuestoAnacafe2: exportCosts.impuestoAnacafe2 || null,
        exportInspeccionOirsa: exportCosts.inspeccionOirsa || null,
        exportFumigacion: exportCosts.fumigacion || null,
        exportEmisionDocumento: exportCosts.emisionDocumento || null,
        exportFletePuerto: exportCosts.fletePuerto || null,
        exportSeguro: exportCosts.seguro || null,
        exportCustodio: exportCosts.custodio || null,
        exportAgenteAduanal: exportCosts.agenteAduanal || null,
        exportComisionOrganico: exportCosts.comisionExportadorOrganico || null,
      });
      if (mode === "edit" && initialData?.id) {
        await updateContract({ ...parsed, id: initialData.id });
        toast.success("Contrato actualizado");
      } else {
        await createContract(parsed);
        toast.success("Contrato creado");
      }
      router.push("/contracts");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error guardando contrato"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Form fields */}
        <div className="lg:col-span-2 space-y-6">

          {/* ── Section 1: Datos del Contrato ── */}
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Datos del Contrato
              </h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Cliente"
                  options={clients.map((c) => ({ value: c.id, label: c.name }))}
                  placeholder="Seleccionar cliente"
                  error={errors.clientId?.message}
                  {...register("clientId")}
                />
                <Input
                  label="Número de Contrato"
                  placeholder="P40129"
                  error={errors.contractNumber?.message}
                  {...register("contractNumber")}
                />
              </div>

              <div className="grid grid-cols-4 gap-4">
                <Select
                  label="Embarque"
                  options={[
                    { value: "", label: "Sin asignar" },
                    ...shipments.map((s) => ({ value: s.id, label: s.name })),
                  ]}
                  error={errors.shipmentId?.message}
                  {...register("shipmentId")}
                />
                <Select
                  label="Estado"
                  options={STATUS_OPTIONS}
                  error={errors.status?.message}
                  {...register("status")}
                />
                <Select
                  label="Tipo Facturación"
                  options={TIPO_FACTURACION_OPTIONS}
                  error={errors.tipoFacturacion?.message}
                  {...register("tipoFacturacion")}
                />
                <Select
                  label="Posición Bolsa"
                  options={POSICION_BOLSA_OPTIONS}
                  error={errors.posicionBolsa?.message}
                  disabled={isFijado}
                  {...register("posicionBolsa")}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="Puntaje"
                  type="number"
                  min={60}
                  max={100}
                  error={errors.puntaje?.message}
                  {...register("puntaje", { valueAsNumber: true })}
                />
                <Input
                  label="Rendimiento"
                  type="number"
                  step="0.000001"
                  error={errors.rendimiento?.message}
                  {...register("rendimiento", { valueAsNumber: true })}
                />
                <Input
                  label="Sacos 69kg"
                  type="number"
                  min={1}
                  error={errors.sacos69kg?.message}
                  {...register("sacos69kg", { valueAsNumber: true })}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="Precio Bolsa (USD)"
                  type="number"
                  step="0.01"
                  disabled={isFijado}
                  error={errors.precioBolsa?.message}
                  {...register("precioBolsa", { valueAsNumber: true })}
                />
                <Input
                  label="Diferencial (USD)"
                  type="number"
                  step="0.01"
                  disabled={isFijado}
                  error={errors.diferencial?.message}
                  {...register("diferencial", { valueAsNumber: true })}
                />
                <Input
                  label="Tipo de Cambio"
                  type="number"
                  step="0.01"
                  error={errors.tipoCambio?.message}
                  {...register("tipoCambio", { valueAsNumber: true })}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="Cosecha"
                  placeholder="25/26"
                  error={errors.cosecha?.message}
                  {...register("cosecha")}
                />
                <Input
                  label="Lote"
                  placeholder="Orgánico, Santa Rosa..."
                  error={errors.lote?.message}
                  {...register("lote")}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Regiones
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {REGION_OPTIONS.map((region) => (
                      <label key={region.value} className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          value={region.value}
                          {...register("regions")}
                          className="rounded"
                        />
                        {region.label}
                      </label>
                    ))}
                  </div>
                  {errors.regions && (
                    <p className="mt-1 text-xs text-red-600">
                      {errors.regions.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="Precio Prom. Inventario"
                  type="number"
                  step="0.01"
                  placeholder="0"
                  error={errors.precioPromedioInv?.message}
                  {...register("precioPromedioInv", { valueAsNumber: true })}
                />
                <Input
                  label="Subproductos (Oro)"
                  type="number"
                  step="0.01"
                  placeholder="0"
                  error={errors.subproductosQty?.message}
                  {...register("subproductosQty", { valueAsNumber: true })}
                />
                <Input
                  label="Precio Subproducto"
                  type="number"
                  step="0.01"
                  placeholder="0"
                  error={errors.precioSubproducto?.message}
                  {...register("precioSubproducto", { valueAsNumber: true })}
                />
              </div>

              {isFijado && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md text-xs text-amber-700 dark:text-amber-400">
                  Precio congelado — el contrato ya fue fijado. Los campos de precio y posición están deshabilitados.
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notas
                </label>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  {...register("notes")}
                />
              </div>
            </CardContent>
          </Card>

          {/* ── Section 2: Costos de Exportación ── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Costos de Exportación
                </h3>
                <span className="text-xs font-mono text-slate-500">
                  Total por saco: {formatUSD(gastosPerSaco)}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                {EXPORT_COST_FIELDS.map((field) => (
                  <div key={field.key}>
                    <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1 truncate" title={field.label}>
                      {field.label}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={exportCosts[field.key] ?? 0}
                      onChange={(e) => updateExportCost(field.key, parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 text-xs font-mono border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Gastos Exportación = {formatUSD(gastosPerSaco)} × {watchedValues.sacos69kg || 0} sacos
                </span>
                <span className="text-sm font-mono font-semibold text-red-600">
                  {formatUSD(gastosPerSaco * (watchedValues.sacos69kg || 0))}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* ── Section 3: Costo Financiero ── */}
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Costo Financiero
              </h3>
            </CardHeader>
            <CardContent>
              {/* Input mode toggle */}
              <div className="flex gap-1 mb-4 bg-slate-100 dark:bg-orion-800 rounded-lg p-1 w-fit">
                <button
                  type="button"
                  onClick={() => setCfInputMode("monto")}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    cfInputMode === "monto"
                      ? "bg-white dark:bg-orion-700 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  Monto (Q)
                </button>
                <button
                  type="button"
                  onClick={() => setCfInputMode("pct")}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    cfInputMode === "pct"
                      ? "bg-white dark:bg-orion-700 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  % del Contrato
                </button>
              </div>

              <div className="grid grid-cols-5 gap-4">
                {cfInputMode === "monto" ? (
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                      Monto Crédito (Q)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={cfMontoCredito || ""}
                      onChange={(e) => setCfMontoCredito(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-2 py-1.5 text-xs font-mono border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                      % del Valor
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={cfPct || ""}
                      onChange={(e) => setCfPct(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-2 py-1.5 text-xs font-mono border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Tasa Anual
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={cfTasa}
                    onChange={(e) => setCfTasa(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 text-xs font-mono border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Meses
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={cfMeses}
                    onChange={(e) => setCfMeses(parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 text-xs font-mono border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Tipo de Cambio
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={tipoCambio}
                    disabled
                    className="w-full px-2 py-1.5 text-xs font-mono border border-gray-300 dark:border-gray-600 rounded bg-slate-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                  />
                </div>
                {cfInputMode === "pct" && (
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                      = Monto (Q)
                    </label>
                    <div className="px-2 py-1.5 text-xs font-mono bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-slate-300 rounded border border-gray-300 dark:border-gray-600">
                      Q{effectiveMontoCredito.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-mono">
                    {effectiveMontoCredito > 0
                      ? `Q${effectiveMontoCredito.toLocaleString("es-GT", { maximumFractionDigits: 0 })} × (${cfTasa} / 12) × ${cfMeses} / ${tipoCambio}`
                      : "Sin crédito — costo financiero = $0"}
                  </span>
                  <span className="text-sm font-mono font-semibold text-red-600">
                    {formatUSD(costoFinancieroComputed)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Section 4: ISR ── */}
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                ISR (Impuesto Sobre la Renta)
              </h3>
            </CardHeader>
            <CardContent>
              <div className="flex gap-1 mb-4 bg-slate-100 dark:bg-orion-800 rounded-lg p-1 w-fit">
                <button
                  type="button"
                  onClick={() => setIsrInputMode("pct")}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    isrInputMode === "pct"
                      ? "bg-white dark:bg-orion-700 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  Porcentaje (%)
                </button>
                <button
                  type="button"
                  onClick={() => setIsrInputMode("monto")}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    isrInputMode === "monto"
                      ? "bg-white dark:bg-orion-700 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  Monto Fijo (Q)
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {isrInputMode === "pct" ? (
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                      Tasa ISR (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={isrPct || ""}
                      onChange={(e) => setIsrPct(parseFloat(e.target.value) || 0)}
                      placeholder="6"
                      className="w-full px-2 py-1.5 text-xs font-mono border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                      Monto ISR (Q)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={isrMonto || ""}
                      onChange={(e) => setIsrMonto(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-2 py-1.5 text-xs font-mono border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>
                )}
              </div>

              <p className="mt-3 text-[10px] text-slate-400">
                Sujeto a incentivos fiscales. Use porcentaje sobre materia prima o monto fijo según régimen fiscal del contrato.
              </p>
            </CardContent>
          </Card>

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={submitting}>
              {mode === "edit" ? "Guardar Cambios" : "Crear Contrato"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancelar
            </Button>
          </div>
        </div>

        {/* Right: Calculation preview + Monthly context */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-4">
            <CalculationPreview
              calc={calc}
              tipoFacturacion={watchedValues.tipoFacturacion}
              gastosPerSaco={gastosPerSaco}
              costoFinanciero={costoFinancieroComputed}
              precioPromedioInv={watchedValues.precioPromedioInv ?? 0}
              subproductosQty={watchedValues.subproductosQty ?? 0}
              precioSubproducto={watchedValues.precioSubproducto ?? 0}
              rendimiento={watchedValues.rendimiento ?? 1.32}
            />
            {monthlyContext && (
              <MonthlyContext
                stats={monthlyContext}
                currentMargin={
                  calc && !calc.facturacionKgs.isZero() && !calc.facturacionKgs.isNaN()
                    ? calc.utilidadSinCostoFinanciero.div(calc.facturacionKgs).toNumber() || 0
                    : undefined
                }
                currentRevenue={calc ? (calc.totalPagoQTZ.toNumber() || 0) : undefined}
              />
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
