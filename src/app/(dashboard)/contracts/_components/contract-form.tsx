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
import { CalculationPreview } from "./calculation-preview";
import { MonthlyContext } from "./monthly-context";
import { createContract, updateContract } from "../actions";
import type { MonthlyContextStats } from "../actions";

interface Client {
  id: string;
  name: string;
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
  { value: "LIBRAS_GUATEMALTECAS", label: "Lbs Guatemaltecas" },
  { value: "LIBRAS_ESPANOLAS", label: "Lbs Españolas" },
];

const POSICION_BOLSA_OPTIONS = [
  { value: "", label: "Sin posición" },
  { value: "MAR", label: "Marzo" },
  { value: "MAY", label: "Mayo" },
  { value: "JUL", label: "Julio" },
  { value: "SEP", label: "Septiembre" },
  { value: "DEC", label: "Diciembre" },
];

interface ContractFormProps {
  mode: "create" | "edit";
  clients: Client[];
  defaultExchangeRate: number;
  initialData?: Partial<ContractFormValues> & { id?: string; status?: string };
  monthlyContext?: MonthlyContextStats;
}

export function ContractForm({
  mode,
  clients,
  defaultExchangeRate,
  initialData,
  monthlyContext,
}: ContractFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const isFijado = initialData?.status === "FIJADO";

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

  const calc: ContractCalculation | null = useMemo(() => {
    const sacos = watchedValues.sacos69kg;
    const bolsa = watchedValues.precioBolsa;
    if (!sacos || sacos <= 0) return null;

    return calculateContract({
      sacos69kg: sacos,
      puntaje: watchedValues.puntaje || 82,
      precioBolsa: bolsa ?? 0,
      diferencial: watchedValues.diferencial ?? 0,
      gastosExportPerSaco: 23,
      tipoCambio: watchedValues.tipoCambio ?? defaultExchangeRate,
      tipoFacturacion: watchedValues.tipoFacturacion ?? "LIBRAS_GUATEMALTECAS",
      montoCredito: watchedValues.montoCredito ?? undefined,
    });
  }, [
    watchedValues.sacos69kg,
    watchedValues.puntaje,
    watchedValues.precioBolsa,
    watchedValues.diferencial,
    watchedValues.tipoCambio,
    watchedValues.tipoFacturacion,
    watchedValues.montoCredito,
    defaultExchangeRate,
  ]);

  async function onSubmit(data: ContractFormValues) {
    setSubmitting(true);
    try {
      const parsed = ContractCreateSchema.parse(data);
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
        <div className="lg:col-span-2 space-y-4">
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

          <div className="grid grid-cols-3 gap-4">
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
              step="0.01"
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
              label="Monto Crédito (Q)"
              type="number"
              step="0.01"
              placeholder="Opcional"
              error={errors.montoCredito?.message}
              {...register("montoCredito", { valueAsNumber: true })}
            />
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

          <div className="flex gap-3 pt-4">
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
            <CalculationPreview calc={calc} tipoFacturacion={watchedValues.tipoFacturacion} />
            {monthlyContext && (
              <MonthlyContext
                stats={monthlyContext}
                currentMargin={
                  calc && !calc.facturacionKgs.isZero()
                    ? calc.utilidadSinCostoFinanciero.div(calc.facturacionKgs).toNumber()
                    : undefined
                }
                currentRevenue={calc ? calc.totalPagoQTZ.toNumber() : undefined}
              />
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
