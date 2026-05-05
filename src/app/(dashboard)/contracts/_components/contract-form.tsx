"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { ContractCreateSchema } from "@/lib/validations/schemas";
import type { z } from "zod";

type ContractFormValues = z.input<typeof ContractCreateSchema>;
import { calculateContract } from "@/lib/services/calculations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CalculationPreview } from "./calculation-preview";
import { MonthlyContext } from "./monthly-context";
import { OctavioResumen } from "./octavio-resumen";
import { createContract, updateContract } from "../actions";
import type { MonthlyContextStats } from "../actions";

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

// Octavio's status vocabulary (his silo's language)
const OCTAVIO_STATUS_OPTIONS = [
  { value: "NEGOCIACION", label: "Negociación" },
  { value: "NO_FIJADO", label: "Confirmado No Fijado" },
  { value: "FIJADO", label: "Confirmado Fijado" },
];

const POSICION_BOLSA_OPTIONS = [
  { value: "", label: "Sin posición" },
  { value: "MAR", label: "Marzo" },
  { value: "MAY", label: "Mayo" },
  { value: "JUL", label: "Julio" },
  { value: "SEP", label: "Septiembre" },
  { value: "DEC", label: "Diciembre" },
];

const CONDICIONES_PAGO_OPTIONS = [
  { value: "", label: "—" },
  { value: "CAD", label: "CAD" },
  { value: "CREDITO", label: "Crédito" },
];

const ESTATUS_PAGO_OPTIONS = [
  { value: "", label: "—" },
  { value: "PAGADO", label: "Pagado" },
  { value: "NO_PAGADO", label: "No Pagado" },
];

// Hector's export cost breakdown — preserved in state, not shown to Octavio
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

const inputCls =
  "w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50";
const readonlyCls =
  "w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-slate-50 dark:bg-gray-900 text-slate-500 dark:text-slate-400";

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

  // ── Octavio's direct inputs (his silo) ────────────────────────────────────
  // Octavio inputs sacos46; sacos69kg is derived as sacos46 / 1.5 for DB storage.
  const [sacos46, setSacos46] = useState<number>(
    Math.round((initialData?.sacos69kg ?? 275) * 1.5 * 100) / 100
  );
  const [gastosDirectos, setGastosDirectos] = useState<number>(
    initialData?.gastosPerSaco ?? 0
  );
  const [qqRechazos, setQqRechazos] = useState<number>(initialData?.qqRechazos ?? 0);
  const [precioRechazos, setPrecioRechazos] = useState<number>(initialData?.precioRechazos ?? 0);
  const [condicionesPago, setCondicionesPago] = useState<string>(initialData?.condicionesPago ?? "");
  const [estatusPago, setEstatusPago] = useState<string>(initialData?.estatusPago ?? "");
  const [mesesCredito, setMesesCredito] = useState<number>(initialData?.mesesCredito ?? 0);

  // ── Hector's export cost breakdown (preserved, not shown to Octavio) ──────
  const [exportCosts] = useState<Record<string, number>>(() => {
    const saved: Record<string, number | null | undefined> = {
      trillaPerQQ: initialData?.exportTrillaPerQQ,
      sacoYute: initialData?.exportSacoYute,
      estampado: initialData?.exportEstampado,
      bolsaGrainPro: initialData?.exportBolsaGrainPro,
      fitoSanitario: initialData?.exportFitoSanitario,
      impuestoAnacafe1: initialData?.exportImpuestoAnacafe1,
      impuestoAnacafe2: initialData?.exportImpuestoAnacafe2,
      inspeccionOirsa: initialData?.exportInspeccionOirsa,
      fumigacion: initialData?.exportFumigacion,
      emisionDocumento: initialData?.exportEmisionDocumento,
      fletePuerto: initialData?.exportFletePuerto,
      seguro: initialData?.exportSeguro,
      custodio: initialData?.exportCustodio,
      agenteAduanal: initialData?.exportAgenteAduanal,
      comisionExportadorOrganico: initialData?.exportComisionOrganico,
    };
    const initial: Record<string, number> = {};
    for (const f of EXPORT_COST_FIELDS) {
      initial[f.key] = saved[f.key] ?? f.default;
    }
    return initial;
  });

  // ── Costo Financiero ──────────────────────────────────────────────────────
  const [cfMontoCredito, setCfMontoCredito] = useState(initialData?.montoCredito ?? 0);
  const [cfTasa, setCfTasa] = useState(0.08);
  const [cfMeses, setCfMeses] = useState(2);

  // ── ISR (preserved, not shown to Octavio) ────────────────────────────────
  const [isrInputMode] = useState<"pct" | "monto">(
    initialData?.isrAmount ? "monto" : "pct"
  );
  const [isrPct] = useState((initialData?.isrRate ?? 0) * 100);
  const [isrMonto] = useState(initialData?.isrAmount ?? 0);

  // Octavio's gastos drives all calculations in his silo
  const gastosPerSaco = gastosDirectos;

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
      sacos69kg: undefined,
      precioBolsa: initialData?.precioBolsa ?? undefined,
      diferencial: initialData?.diferencial ?? undefined,
      tipoCambio: initialData?.tipoCambio ?? defaultExchangeRate,
      posicionBolsa: initialData?.posicionBolsa ?? undefined,
      montoCredito: initialData?.montoCredito ?? undefined,
      cosecha: initialData?.cosecha ?? "",
      lote: initialData?.lote ?? "",
      notes: initialData?.notes ?? "",
      precioPromedioInv: initialData?.precioPromedioInv ?? undefined,
      subproductosQty: initialData?.subproductosQty ?? undefined,
      precioSubproducto: initialData?.precioSubproducto ?? undefined,
    },
  });

  const watchedValues = watch();
  const tipoCambio = watchedValues.tipoCambio ?? defaultExchangeRate;

  const costoFinancieroComputed = useMemo(() => {
    if (!cfMontoCredito || cfMontoCredito <= 0 || !tipoCambio) return 0;
    return (cfMontoCredito * (cfTasa / 12) * cfMeses) / tipoCambio;
  }, [cfMontoCredito, cfTasa, cfMeses, tipoCambio]);

  const sacos69kg = sacos46 > 0 ? sacos46 / 1.5 : 0;

  const calc = useMemo(() => {
    if (!sacos46 || sacos46 <= 0) return null;
    return calculateContract({
      sacos69kg: sacos46 / 1.5,
      puntaje: watchedValues.puntaje || 82,
      precioBolsa: watchedValues.precioBolsa ?? 0,
      diferencial: watchedValues.diferencial ?? 0,
      gastosExportPerSaco: gastosPerSaco,
      tipoCambio,
      costoFinanciero: costoFinancieroComputed || undefined,
    });
  }, [
    sacos46,
    watchedValues.puntaje,
    watchedValues.precioBolsa,
    watchedValues.diferencial,
    tipoCambio,
    gastosPerSaco,
    costoFinancieroComputed,
  ]);

  const selectedShipment = shipments.find((s) => s.id === watchedValues.shipmentId);
  const selectedClient = clients.find((c) => c.id === watchedValues.clientId);
  const selectedPosicion = POSICION_BOLSA_OPTIONS.find(
    (p) => p.value === watchedValues.posicionBolsa
  );

  async function onSubmit(data: ContractFormValues) {
    setSubmitting(true);
    try {
      const parsed = ContractCreateSchema.parse({
        ...data,
        sacos69kg: sacos46 / 1.5,
        shipmentId: data.shipmentId || null,
        posicionBolsa: data.posicionBolsa || null,
        montoCredito: cfMontoCredito || undefined,
        cfTasaAnual: cfTasa || undefined,
        cfMeses: cfMeses || undefined,
        isrRate: isrInputMode === "pct" && isrPct > 0 ? isrPct / 100 : null,
        isrAmount: isrInputMode === "monto" && isrMonto > 0 ? isrMonto : null,
        // Octavio's direct gastos figure (his silo)
        gastosPerSaco: gastosPerSaco,
        // Hector's breakdown preserved from DB — not shown to Octavio but not overwritten
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
        qqRechazos: qqRechazos || null,
        precioRechazos: precioRechazos || null,
        mesesCredito: mesesCredito || null,
        condicionesPago: (condicionesPago as "CAD" | "CREDITO") || null,
        estatusPago: (estatusPago as "PAGADO" | "NO_PAGADO") || null,
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
      toast.error(err instanceof Error ? err.message : "Error guardando contrato");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left: Menu Ingreso Información (Octavio's silo) ── */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                Menu Ingreso Información
              </h3>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">

                <ListRow label="Embarque">
                  <select className={inputCls} {...register("shipmentId")}>
                    <option value="">Sin asignar</option>
                    {shipments.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </ListRow>

                <ListRow label="Posición">
                  <select className={inputCls} disabled={isFijado} {...register("posicionBolsa")}>
                    {POSICION_BOLSA_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </ListRow>

                <ListRow label="Año">
                  <div className={readonlyCls}>
                    {selectedShipment ? selectedShipment.year : "—"}
                  </div>
                </ListRow>

                <ListRow label="Cliente">
                  <select className={inputCls} {...register("clientId")}>
                    <option value="">Seleccionar...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {errors.clientId && (
                    <p className="text-xs text-red-600 mt-0.5">{errors.clientId.message}</p>
                  )}
                </ListRow>

                <ListRow label="Contrato">
                  <input
                    className={inputCls}
                    placeholder="P40129"
                    {...register("contractNumber")}
                  />
                  {errors.contractNumber && (
                    <p className="text-xs text-red-600 mt-0.5">{errors.contractNumber.message}</p>
                  )}
                </ListRow>

                <ListRow label="Estatus">
                  <select className={inputCls} {...register("status")}>
                    {OCTAVIO_STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </ListRow>

                <ListRow label="Lote">
                  <input
                    className={inputCls}
                    placeholder="Orgánico, Santa Rosa..."
                    {...register("lote")}
                  />
                </ListRow>

                <ListRow label="Puntuación">
                  <input
                    type="number"
                    min={60}
                    max={100}
                    className={inputCls}
                    {...register("puntaje", { valueAsNumber: true })}
                  />
                </ListRow>

                <ListRow label="Sacos 46 Kg" badge="D">
                  <input
                    type="number"
                    min={1}
                    step="0.5"
                    value={sacos46 || ""}
                    onChange={(e) => setSacos46(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className={inputCls}
                  />
                </ListRow>

                <ListRow label="Sacos 69 Kg" badge="F">
                  <div className={readonlyCls}>
                    {sacos46 > 0 ? (sacos46 / 1.5).toFixed(2) : "—"}
                  </div>
                </ListRow>

                <ListRow label="Precio Bolsa NY">
                  <input
                    type="number"
                    step="0.01"
                    disabled={isFijado}
                    className={inputCls}
                    {...register("precioBolsa", { valueAsNumber: true })}
                  />
                </ListRow>

                <ListRow label="Diferencial">
                  <input
                    type="number"
                    step="0.01"
                    disabled={isFijado}
                    className={inputCls}
                    {...register("diferencial", { valueAsNumber: true })}
                  />
                </ListRow>

                <ListRow label="Gastos Exportación">
                  <input
                    type="number"
                    step="0.01"
                    value={gastosDirectos || ""}
                    onChange={(e) => setGastosDirectos(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className={inputCls}
                  />
                </ListRow>

                <ListRow label="Tasa Interés">
                  <input
                    type="number"
                    step="0.001"
                    value={cfTasa}
                    onChange={(e) => setCfTasa(parseFloat(e.target.value) || 0)}
                    className={inputCls}
                  />
                </ListRow>

                <ListRow label="Meses Financiamiento">
                  <input
                    type="number"
                    step="1"
                    value={cfMeses}
                    onChange={(e) => setCfMeses(parseInt(e.target.value) || 0)}
                    className={inputCls}
                  />
                </ListRow>

                <ListRow label="Tipo Cambio">
                  <input
                    type="number"
                    step="0.01"
                    className={inputCls}
                    {...register("tipoCambio", { valueAsNumber: true })}
                  />
                </ListRow>

                <ListRow label="Precio Pergamino">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    className={inputCls}
                    {...register("precioPromedioInv", { valueAsNumber: true })}
                  />
                </ListRow>

                <ListRow label="QQ Rechazos">
                  <input
                    type="number"
                    step="0.01"
                    value={qqRechazos || ""}
                    onChange={(e) => setQqRechazos(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className={inputCls}
                  />
                </ListRow>

                <ListRow label="Precio Rechazos">
                  <input
                    type="number"
                    step="0.01"
                    value={precioRechazos || ""}
                    onChange={(e) => setPrecioRechazos(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className={inputCls}
                  />
                </ListRow>

                <ListRow label="Comisiones Venta">
                  <div className={readonlyCls}>
                    {calc ? `$${calc.comisionVenta.toFixed(2)}` : "—"}
                  </div>
                </ListRow>

                <ListRow label="Comisiones Compra">
                  <div className={readonlyCls}>
                    {calc ? `$${calc.comisionCompra.toFixed(2)}` : "—"}
                  </div>
                </ListRow>

                <ListRow label="Condiciones Pago">
                  <select
                    className={inputCls}
                    value={condicionesPago}
                    onChange={(e) => setCondicionesPago(e.target.value)}
                  >
                    {CONDICIONES_PAGO_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </ListRow>

                <ListRow label="Meses de Crédito">
                  <input
                    type="number"
                    step="1"
                    value={mesesCredito || ""}
                    onChange={(e) => setMesesCredito(parseInt(e.target.value) || 0)}
                    placeholder="0"
                    className={inputCls}
                  />
                </ListRow>

                <ListRow label="Estatus Pago">
                  <select
                    className={inputCls}
                    value={estatusPago}
                    onChange={(e) => setEstatusPago(e.target.value)}
                  >
                    {ESTATUS_PAGO_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </ListRow>

              </div>
            </CardContent>
          </Card>

          {isFijado && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md text-xs text-amber-700 dark:text-amber-400">
              Precio congelado — el contrato ya fue fijado. Precio Bolsa NY, Diferencial y Posición están deshabilitados.
            </div>
          )}

          <div className="flex gap-3">
            <Button type="submit" loading={submitting}>
              {mode === "edit" ? "Guardar Cambios" : "Crear Contrato"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancelar
            </Button>
          </div>
        </div>

        {/* ── Right: Resumen + hidden legacy panels ── */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-4">

            <OctavioResumen
              embarque={selectedShipment?.name ?? ""}
              posicion={selectedPosicion?.label ?? ""}
              anio={selectedShipment?.year}
              cliente={selectedClient?.name ?? ""}
              contrato={watchedValues.contractNumber ?? ""}
              estatus={watchedValues.status ?? ""}
              lote={watchedValues.lote ?? ""}
              puntuacion={watchedValues.puntaje ?? 0}
              sacos69kg={sacos69kg}
              precioBolsaNY={watchedValues.precioBolsa ?? 0}
              diferencial={watchedValues.diferencial ?? 0}
              condicionesPago={condicionesPago}
              estatusPago={estatusPago}
              calc={calc}
              gastosPerSaco={gastosPerSaco}
              costoFinanciero={costoFinancieroComputed}
              qqRechazos={qqRechazos}
              precioRechazos={precioRechazos}
              precioPromedioInv={watchedValues.precioPromedioInv ?? 0}
            />

            {/* P&L del Contrato and Contexto del Mes — hidden from Octavio */}
            <div className="hidden">
              <CalculationPreview
                calc={calc}
                gastosPerSaco={gastosPerSaco}
                costoFinanciero={costoFinancieroComputed}
                precioPromedioInv={watchedValues.precioPromedioInv ?? 0}
                subproductosQty={watchedValues.subproductosQty ?? 0}
                precioSubproducto={watchedValues.precioSubproducto ?? 0}
              />
              {monthlyContext && <MonthlyContext stats={monthlyContext} />}
            </div>

          </div>
        </div>

      </div>
    </form>
  );
}

function ListRow({ label, badge, children }: { label: string; badge?: "D" | "F"; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-6 px-6 py-2.5">
      <span className="w-44 shrink-0 text-sm text-slate-600 dark:text-slate-400 pt-2 leading-tight flex items-center gap-1.5">
        {badge && (
          <span className={`text-[9px] font-mono ${badge === "D" ? "text-blue-400" : "text-amber-400"}`}>
            {badge}
          </span>
        )}
        {label}
      </span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
