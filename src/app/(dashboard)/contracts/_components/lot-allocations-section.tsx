"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatNumber } from "@/lib/utils/format";
import {
  allocateLotToContract,
  deallocateLotFromContract,
} from "../lot-actions";

interface LotAllocation {
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

export function LotAllocationsSection({
  contractId,
  initialAllocations,
  availableLots,
}: {
  contractId: string;
  initialAllocations: LotAllocation[];
  availableLots: AvailableLot[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDeallocate(id: string) {
    if (!confirm("Desasignar este lote del contrato?")) return;
    setLoading(true);
    try {
      await deallocateLotFromContract(id);
      toast.success("Lote desasignado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  const totalAllocated = initialAllocations.reduce(
    (sum, a) => sum + num(a.quantityQQ),
    0
  );

  return (
    <div className="space-y-3">
      {initialAllocations.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="dense-table w-full">
            <thead>
              <tr>
                <th>Lote</th>
                <th>Proveedor</th>
                <th>Etapa</th>
                <th className="text-right">Disponible QQ</th>
                <th className="text-right">Asignado QQ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {initialAllocations.map((a) => (
                <tr key={a.id}>
                  <td className="font-mono">{a.lot.lotNumber}</td>
                  <td>{a.lot.supplier?.name ?? "—"}</td>
                  <td>{a.lot.stage}</td>
                  <td className="text-right font-mono">
                    {formatNumber(num(a.lot.quantityQQ), 2)}
                  </td>
                  <td className="text-right font-mono">
                    {formatNumber(num(a.quantityQQ), 2)}
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeallocate(a.id)}
                      loading={loading}
                    >
                      x
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="text-right text-xs font-semibold text-gray-500">
                  Total Asignado
                </td>
                <td className="text-right font-mono font-semibold">
                  {formatNumber(totalAllocated, 2)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-400">No hay lotes asignados.</p>
      )}

      {!showForm ? (
        <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
          + Asignar Lote
        </Button>
      ) : (
        <AllocationInlineForm
          contractId={contractId}
          availableLots={availableLots}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

function AllocationInlineForm({
  contractId,
  availableLots,
  onClose,
}: {
  contractId: string;
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
      await allocateLotToContract({ contractId, lotId, quantityQQ });
      toast.success("Lote asignado al contrato");
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
      className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-3"
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
