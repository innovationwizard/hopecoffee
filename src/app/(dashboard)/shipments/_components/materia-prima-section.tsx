"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNumber, formatGTQ, toNum } from "@/lib/utils/format";
import { createMateriaPrima, deleteMateriaPrima } from "../mp-actions";
import type { MateriaPrima } from "@prisma/client";

export function MateriaPrimaSection({
  shipmentId,
  entries,
}: {
  shipmentId: string;
  entries: MateriaPrima[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const totalMP = entries.reduce((s, e) => s + toNum(e.totalMP), 0);

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta entrada de materia prima?")) return;
    setLoading(true);
    try {
      await deleteMateriaPrima(id);
      toast.success("Eliminado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {entries.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="dense-table w-full">
            <thead>
              <tr>
                <th>Nota</th>
                <th className="text-right">Punteo</th>
                <th className="text-right">Oro</th>
                <th className="text-right">Rend.</th>
                <th className="text-right">Pergamino</th>
                <th className="text-right">Precio Q</th>
                <th className="text-right">Total MP</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>{e.supplierNote || "—"}</td>
                  <td className="text-right font-mono">{e.punteo}</td>
                  <td className="text-right font-mono">
                    {formatNumber(toNum(e.oro), 2)}
                  </td>
                  <td className="text-right font-mono">
                    {formatNumber(toNum(e.rendimiento), 4)}
                  </td>
                  <td className="text-right font-mono">
                    {formatNumber(toNum(e.pergamino), 2)}
                  </td>
                  <td className="text-right font-mono">
                    {formatGTQ(toNum(e.precioPromQ))}
                  </td>
                  <td className="text-right font-mono">
                    {formatGTQ(toNum(e.totalMP))}
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(e.id)}
                      loading={loading}
                    >
                      ×
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6} className="text-right font-semibold">
                  Total
                </td>
                <td className="text-right font-mono font-semibold">
                  {formatGTQ(totalMP)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-400">
          No hay entradas de materia prima.
        </p>
      )}

      {!showForm ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowForm(true)}
        >
          + Agregar MP
        </Button>
      ) : (
        <MPInlineForm
          shipmentId={shipmentId}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

function MPInlineForm({
  shipmentId,
  onClose,
}: {
  shipmentId: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);

    try {
      await createMateriaPrima({
        shipmentId,
        supplierNote: fd.get("supplierNote") as string,
        isPurchased: fd.get("isPurchased") === "on",
        punteo: Number(fd.get("punteo")),
        oro: Number(fd.get("oro")),
        rendimiento: Number(fd.get("rendimiento")),
        precioPromQ: Number(fd.get("precioPromQ")),
      });
      toast.success("Materia prima agregada");
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Input label="Nota Proveedor" name="supplierNote" />
        <Input
          label="Punteo"
          name="punteo"
          type="number"
          min={60}
          max={100}
          defaultValue={82}
        />
        <Input
          label="Oro (sacos 46kg)"
          name="oro"
          type="number"
          step="0.01"
          min={0}
        />
        <Input
          label="Rendimiento"
          name="rendimiento"
          type="number"
          step="0.0001"
          defaultValue={1.32}
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Input
          label="Precio Prom Q"
          name="precioPromQ"
          type="number"
          step="0.01"
          min={0}
        />
        <label className="flex items-center gap-2 text-sm pt-6">
          <input type="checkbox" name="isPurchased" className="rounded" />
          Comprado
        </label>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={loading}>
          Guardar
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
