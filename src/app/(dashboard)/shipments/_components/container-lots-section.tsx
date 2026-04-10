"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils/format";
import {
  assignLotToContainer,
  unassignLotFromContainer,
  shipContainer,
} from "../container-lot-actions";

interface ContainerLotEntry {
  id: string;
  quantityQQ: number | { toNumber?: () => number };
  lot: {
    id: string;
    lotNumber: string;
    stage: string;
    quantityQQ: number | { toNumber?: () => number };
    supplier: { id: string; name: string } | null;
  };
}

interface AvailableLot {
  id: string;
  lotNumber: string;
  quantityQQ: number | { toNumber?: () => number };
  qualityGrade: string | null;
  supplier: { id: string; name: string } | null;
}

function num(v: number | { toNumber?: () => number }): number {
  if (typeof v === "number") return v;
  if (v && typeof v.toNumber === "function") return v.toNumber();
  return Number(v);
}

export function ContainerLotsSection({
  containerId,
  containerNum,
  initialLots,
  availableLots,
}: {
  containerId: string;
  containerNum: string;
  initialLots: ContainerLotEntry[];
  availableLots: AvailableLot[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  const allExported = initialLots.length > 0 && initialLots.every(
    (cl) => cl.lot.stage === "EXPORTADO"
  );

  async function handleUnassign(id: string) {
    if (!confirm("Desasignar este lote del contenedor?")) return;
    setLoading(true);
    try {
      await unassignLotFromContainer(id);
      toast.success("Lote desasignado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function handleShip() {
    if (!confirm(`Despachar contenedor ${containerNum}? Todos los lotes pasaran a estado EXPORTADO.`)) return;
    setDispatching(true);
    try {
      await shipContainer(containerId);
      toast.success(`Contenedor ${containerNum} despachado`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setDispatching(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? "Ocultar" : "Ver"} lotes ({initialLots.length})
        {allExported && (
          <Badge variant="emerald" className="ml-1">Despachado</Badge>
        )}
      </button>

      {expanded && (
        <div className="mt-2 ml-2 pl-3 border-l-2 border-gray-200 dark:border-gray-700 space-y-2">
          {initialLots.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="dense-table w-full text-xs">
                <thead>
                  <tr>
                    <th>Lote</th>
                    <th>Proveedor</th>
                    <th>Etapa</th>
                    <th className="text-right">QQ</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {initialLots.map((cl) => (
                    <tr key={cl.id}>
                      <td className="font-mono">{cl.lot.lotNumber}</td>
                      <td>{cl.lot.supplier?.name ?? "—"}</td>
                      <td>
                        <Badge
                          variant={cl.lot.stage === "EXPORTADO" ? "emerald" : "gray"}
                        >
                          {cl.lot.stage}
                        </Badge>
                      </td>
                      <td className="text-right font-mono">
                        {formatNumber(num(cl.quantityQQ), 2)}
                      </td>
                      <td>
                        {cl.lot.stage !== "EXPORTADO" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUnassign(cl.id)}
                            loading={loading}
                          >
                            x
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-gray-400">Sin lotes asignados.</p>
          )}

          <div className="flex gap-2">
            {!allExported && (
              <>
                {!showForm ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowForm(true)}
                  >
                    + Agregar Lote
                  </Button>
                ) : (
                  <AssignLotForm
                    containerId={containerId}
                    availableLots={availableLots}
                    onClose={() => setShowForm(false)}
                  />
                )}

                {initialLots.length > 0 && (
                  <Button
                    variant="primary"
                    size="sm"
                    loading={dispatching}
                    onClick={handleShip}
                  >
                    Despachar
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AssignLotForm({
  containerId,
  availableLots,
  onClose,
}: {
  containerId: string;
  availableLots: AvailableLot[];
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const lotOptions = availableLots.map((lot) => ({
    value: lot.id,
    label: `${lot.lotNumber} — ${lot.supplier?.name ?? "Sin proveedor"} (${formatNumber(num(lot.quantityQQ), 2)} QQ)`,
  }));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const lotId = fd.get("lotId") as string;
    const quantityQQ = Number(fd.get("quantityQQ"));

    if (!lotId) {
      toast.error("Seleccione un lote");
      setLoading(false);
      return;
    }
    if (!quantityQQ || quantityQQ <= 0) {
      toast.error("Ingrese una cantidad valida");
      setLoading(false);
      return;
    }

    try {
      await assignLotToContainer({ containerId, lotId, quantityQQ });
      toast.success("Lote asignado al contenedor");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2 w-full"
    >
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Select
            label="Lote Oro Exportable"
            name="lotId"
            options={lotOptions}
            placeholder="Seleccionar lote..."
          />
        </div>
        <Input
          label="Cantidad QQ"
          name="quantityQQ"
          type="number"
          step="0.01"
          min="0.01"
          required
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={loading}>
          Asignar
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
