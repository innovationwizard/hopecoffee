"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils/format";
import { createMillingOrder } from "../actions";
import { Trash2 } from "lucide-react";

interface AvailableLot {
  id: string;
  lotNumber: string;
  quantityQQ: unknown; // Prisma Decimal
  supplier: { id: string; name: string } | null;
}

interface FacilityOption {
  id: string;
  name: string;
}

interface InputRow {
  key: number;
  lotId: string;
  quantityQQ: number;
}

interface OutputRow {
  key: number;
  outputType: "ORO_EXPORTABLE" | "SEGUNDA" | "CASCARILLA" | "MERMA";
  quantityQQ: number;
  qualityGrade: string;
}

const OUTPUT_TYPE_LABELS: Record<string, string> = {
  ORO_EXPORTABLE: "Oro Exportable",
  SEGUNDA: "Segunda",
  CASCARILLA: "Cascarilla",
  MERMA: "Merma",
};

let rowKey = 0;

export function MillingForm({
  lots,
  facilities,
}: {
  lots: AvailableLot[];
  facilities: FacilityOption[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  // Order fields
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [facilityId, setFacilityId] = useState("");
  const [notes, setNotes] = useState("");

  // Inputs
  const [inputs, setInputs] = useState<InputRow[]>([]);
  // Outputs
  const [outputs, setOutputs] = useState<OutputRow[]>([]);

  function addInput() {
    setInputs((prev) => [...prev, { key: ++rowKey, lotId: "", quantityQQ: 0 }]);
  }

  function removeInput(key: number) {
    setInputs((prev) => prev.filter((r) => r.key !== key));
  }

  function updateInput(key: number, field: keyof InputRow, value: string | number) {
    setInputs((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r))
    );
  }

  function addOutput() {
    setOutputs((prev) => [
      ...prev,
      { key: ++rowKey, outputType: "ORO_EXPORTABLE", quantityQQ: 0, qualityGrade: "" },
    ]);
  }

  function removeOutput(key: number) {
    setOutputs((prev) => prev.filter((r) => r.key !== key));
  }

  function updateOutput(key: number, field: keyof OutputRow, value: string | number) {
    setOutputs((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r))
    );
  }

  // Selected lot IDs to prevent duplicates
  const selectedLotIds = new Set(inputs.map((i) => i.lotId).filter(Boolean));

  // Balance calculation
  const totalInputQQ = useMemo(
    () => inputs.reduce((sum, i) => sum + (i.quantityQQ || 0), 0),
    [inputs]
  );
  const totalOutputQQ = useMemo(
    () => outputs.reduce((sum, o) => sum + (o.quantityQQ || 0), 0),
    [outputs]
  );
  const diff = totalOutputQQ - totalInputQQ;
  const diffPct = totalInputQQ > 0 ? Math.abs(diff / totalInputQQ) * 100 : 0;
  const balanceOk = totalInputQQ === 0 || diffPct <= 1;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inputs.length === 0) {
      toast.error("Agrega al menos un lote de entrada.");
      return;
    }
    if (outputs.length === 0) {
      toast.error("Agrega al menos una salida.");
      return;
    }
    if (!balanceOk) {
      toast.error("El balance de entrada/salida excede la tolerancia de 1%.");
      return;
    }

    setSubmitting(true);
    try {
      await createMillingOrder(
        {
          date: new Date(date),
          facilityId: facilityId || null,
          notes: notes || null,
          status: "PENDIENTE",
        },
        inputs.map((i) => ({ lotId: i.lotId, quantityQQ: i.quantityQQ })),
        outputs.map((o) => ({
          outputType: o.outputType,
          quantityQQ: o.quantityQQ,
          qualityGrade: o.qualityGrade || null,
        }))
      );
      toast.success("Orden de tria creada");
      router.push("/milling");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error creando orden");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order details */}
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Datos de la Orden
              </h3>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="Fecha"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
                <Select
                  label="Beneficio"
                  options={facilities.map((f) => ({ value: f.id, label: f.name }))}
                  placeholder="Seleccionar"
                  value={facilityId}
                  onChange={(e) => setFacilityId(e.target.value)}
                />
                <Input
                  label="Notas"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
            </CardContent>
          </Card>

          {/* Inputs section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Entradas (Pergamino)
                </h3>
                <Button type="button" size="sm" variant="outline" onClick={addInput}>
                  + Agregar Lote
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {inputs.length === 0 ? (
                <p className="text-sm text-gray-400">
                  Agrega lotes de pergamino para procesar.
                </p>
              ) : (
                <div className="space-y-3">
                  {inputs.map((row) => {
                    const availableForRow = lots.filter(
                      (l) => l.id === row.lotId || !selectedLotIds.has(l.id)
                    );
                    const selectedLot = lots.find((l) => l.id === row.lotId);
                    const maxQQ = selectedLot ? Number(selectedLot.quantityQQ) : 0;

                    return (
                      <div key={row.key} className="flex items-end gap-3">
                        <div className="flex-1">
                          <Select
                            label="Lote"
                            options={availableForRow.map((l) => ({
                              value: l.id,
                              label: `${l.lotNumber} — ${l.supplier?.name ?? "Sin proveedor"} (${formatNumber(Number(l.quantityQQ), 2)} QQ)`,
                            }))}
                            placeholder="Seleccionar lote"
                            value={row.lotId}
                            onChange={(e) => {
                              updateInput(row.key, "lotId", e.target.value);
                              const lot = lots.find((l) => l.id === e.target.value);
                              if (lot) {
                                updateInput(row.key, "quantityQQ", Number(lot.quantityQQ));
                              }
                            }}
                          />
                        </div>
                        <div className="w-36">
                          <Input
                            label="QQ"
                            type="number"
                            step="0.01"
                            min={0}
                            max={maxQQ || undefined}
                            value={row.quantityQQ || ""}
                            onChange={(e) =>
                              updateInput(row.key, "quantityQQ", parseFloat(e.target.value) || 0)
                            }
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeInput(row.key)}
                          className="p-2 text-red-500 hover:text-red-700 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Outputs section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Salidas
                </h3>
                <Button type="button" size="sm" variant="outline" onClick={addOutput}>
                  + Agregar Salida
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {outputs.length === 0 ? (
                <p className="text-sm text-gray-400">
                  Agrega las salidas del proceso de tria.
                </p>
              ) : (
                <div className="space-y-3">
                  {outputs.map((row) => (
                    <div key={row.key} className="flex items-end gap-3">
                      <div className="w-48">
                        <Select
                          label="Tipo"
                          options={Object.entries(OUTPUT_TYPE_LABELS).map(([value, label]) => ({
                            value,
                            label,
                          }))}
                          value={row.outputType}
                          onChange={(e) =>
                            updateOutput(
                              row.key,
                              "outputType",
                              e.target.value as OutputRow["outputType"]
                            )
                          }
                        />
                      </div>
                      <div className="w-36">
                        <Input
                          label="QQ"
                          type="number"
                          step="0.01"
                          min={0}
                          value={row.quantityQQ || ""}
                          onChange={(e) =>
                            updateOutput(row.key, "quantityQQ", parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>
                      <div className="flex-1">
                        <Input
                          label="Grado Calidad"
                          value={row.qualityGrade}
                          onChange={(e) =>
                            updateOutput(row.key, "qualityGrade", e.target.value)
                          }
                          placeholder="Opcional"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeOutput(row.key)}
                        className="p-2 text-red-500 hover:text-red-700 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" loading={submitting} disabled={!balanceOk && totalInputQQ > 0}>
              Crear Orden
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancelar
            </Button>
          </div>
        </div>

        {/* Balance sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Balance
                </h3>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Entrada Total</dt>
                    <dd className="font-mono font-medium">
                      {formatNumber(totalInputQQ, 2)} QQ
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Salida Total</dt>
                    <dd className="font-mono font-medium">
                      {formatNumber(totalOutputQQ, 2)} QQ
                    </dd>
                  </div>
                  <div
                    className={`flex justify-between border-t pt-2 ${
                      !balanceOk && totalInputQQ > 0
                        ? "text-red-600"
                        : totalInputQQ > 0
                          ? "text-emerald-600"
                          : "text-gray-500"
                    }`}
                  >
                    <dt className="font-medium">Diferencia</dt>
                    <dd className="font-mono font-bold">
                      {diff >= 0 ? "+" : ""}
                      {formatNumber(diff, 2)} QQ ({diffPct.toFixed(1)}%)
                    </dd>
                  </div>
                  {!balanceOk && totalInputQQ > 0 && (
                    <p className="text-xs text-red-600">
                      La diferencia excede la tolerancia de 1%.
                    </p>
                  )}
                </dl>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </form>
  );
}
