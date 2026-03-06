"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNumber, formatGTQ, toNum } from "@/lib/utils/format";
import { createSubproducto, deleteSubproducto } from "../sub-actions";
import type { Subproducto } from "@prisma/client";

export function SubproductoSection({
  shipmentId,
  entries,
}: {
  shipmentId: string;
  entries: Subproducto[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const totalPerga = entries.reduce((s, e) => s + toNum(e.totalPerga), 0);

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este subproducto?")) return;
    setLoading(true);
    try {
      await deleteSubproducto(id);
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
                <th className="text-right">Contenedores</th>
                <th className="text-right">Oro/Cont</th>
                <th className="text-right">Total Oro</th>
                <th className="text-right">Precio s/IVA</th>
                <th className="text-right">Total Perga</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="text-right font-mono">
                    {formatNumber(toNum(e.contenedores), 4)}
                  </td>
                  <td className="text-right font-mono">
                    {formatNumber(toNum(e.oroPerCont), 2)}
                  </td>
                  <td className="text-right font-mono">
                    {formatNumber(toNum(e.totalOro), 2)}
                  </td>
                  <td className="text-right font-mono">
                    {formatGTQ(toNum(e.precioSinIVA))}
                  </td>
                  <td className="text-right font-mono">
                    {formatGTQ(toNum(e.totalPerga))}
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
                <td colSpan={4} className="text-right font-semibold">
                  Total
                </td>
                <td className="text-right font-mono font-semibold">
                  {formatGTQ(totalPerga)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-400">No hay subproductos.</p>
      )}

      {!showForm ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowForm(true)}
        >
          + Agregar Subproducto
        </Button>
      ) : (
        <SubInlineForm
          shipmentId={shipmentId}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

function SubInlineForm({
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
      await createSubproducto({
        shipmentId,
        contenedores: Number(fd.get("contenedores")),
        oroPerCont: Number(fd.get("oroPerCont")),
        precioSinIVA: Number(fd.get("precioSinIVA")),
      });
      toast.success("Subproducto agregado");
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
        <Input
          label="Contenedores"
          name="contenedores"
          type="number"
          step="0.0001"
          min={0}
        />
        <Input
          label="Oro por Contenedor"
          name="oroPerCont"
          type="number"
          step="0.01"
          defaultValue={25}
        />
        <Input
          label="Precio sin IVA"
          name="precioSinIVA"
          type="number"
          step="0.01"
          defaultValue={2000}
        />
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
