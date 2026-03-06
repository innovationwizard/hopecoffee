"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatGTQ, formatNumber, formatDate, toNum } from "@/lib/utils/format";
import { createAccountEntry, deleteAccountEntry } from "../actions";
import type { SupplierAccountEntry } from "@prisma/client";

export function AccountStatement({
  supplierId,
  entries,
}: {
  supplierId: string;
  entries: SupplierAccountEntry[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filterCode, setFilterCode] = useState("");

  const filtered = filterCode
    ? entries.filter((e) =>
        e.orderCode.toLowerCase().includes(filterCode.toLowerCase())
      )
    : entries;

  const total = filtered.reduce((s, e) => s + toNum(e.total), 0);

  const orderCodes = [...new Set(entries.map((e) => e.orderCode))].sort();

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta entrada?")) return;
    setLoading(true);
    try {
      await deleteAccountEntry(id);
      toast.success("Eliminado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      {orderCodes.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            className={`text-xs px-2 py-1 rounded ${
              !filterCode
                ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
            }`}
            onClick={() => setFilterCode("")}
          >
            Todos
          </button>
          {orderCodes.map((code) => (
            <button
              key={code}
              className={`text-xs px-2 py-1 rounded ${
                filterCode === code
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
              }`}
              onClick={() => setFilterCode(code)}
            >
              {code}
            </button>
          ))}
        </div>
      )}

      {filtered.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="dense-table w-full">
            <thead>
              <tr>
                <th>OC</th>
                <th>Ingreso</th>
                <th>Fecha</th>
                <th className="text-right">Pergamino</th>
                <th className="text-right">Precio</th>
                <th className="text-right">Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td>{e.orderCode}</td>
                  <td className="font-mono">{e.ingresoNum}</td>
                  <td>{formatDate(e.date)}</td>
                  <td className="text-right font-mono">
                    {formatNumber(toNum(e.pergamino), 2)}
                  </td>
                  <td className="text-right font-mono">
                    {formatGTQ(toNum(e.precio))}
                  </td>
                  <td className="text-right font-mono">
                    {formatGTQ(toNum(e.total))}
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
                <td colSpan={5} className="text-right font-semibold">
                  Total {filterCode || "General"}
                </td>
                <td className="text-right font-mono font-semibold">
                  {formatGTQ(total)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-400">Sin entradas.</p>
      )}

      {!showForm ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowForm(true)}
        >
          + Agregar Entrada
        </Button>
      ) : (
        <EntryInlineForm
          supplierId={supplierId}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

function EntryInlineForm({
  supplierId,
  onClose,
}: {
  supplierId: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);

    try {
      await createAccountEntry({
        supplierId,
        orderCode: fd.get("orderCode") as string,
        ingresoNum: Number(fd.get("ingresoNum")),
        date: new Date(fd.get("date") as string),
        pergamino: Number(fd.get("pergamino")),
        precio: Number(fd.get("precio")),
      });
      toast.success("Entrada agregada");
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
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Input label="Código OC" name="orderCode" placeholder="OC4" />
        <Input
          label="Ingreso #"
          name="ingresoNum"
          type="number"
          min={1}
        />
        <Input
          label="Fecha"
          name="date"
          type="date"
          defaultValue={new Date().toISOString().split("T")[0]}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Pergamino (QQ)"
          name="pergamino"
          type="number"
          step="0.01"
          min={0}
        />
        <Input
          label="Precio/QQ"
          name="precio"
          type="number"
          step="0.01"
          min={0}
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
