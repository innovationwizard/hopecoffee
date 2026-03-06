"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNumber, formatDate } from "@/lib/utils/format";
import { createContainer, deleteContainer } from "../container-actions";
import type { Container } from "@prisma/client";

export function ContainersSection({
  shipmentId,
  containers,
}: {
  shipmentId: string;
  containers: Container[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este contenedor?")) return;
    setLoading(true);
    try {
      await deleteContainer(id);
      toast.success("Eliminado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {containers.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="dense-table w-full">
            <thead>
              <tr>
                <th>Contenedor</th>
                <th>B/L</th>
                <th>Sello</th>
                <th className="text-right">Peso (kg)</th>
                <th>Naviera</th>
                <th>Puerto</th>
                <th>ETA</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {containers.map((c) => (
                <tr key={c.id}>
                  <td className="font-mono">{c.containerNum ?? "—"}</td>
                  <td className="font-mono">{c.blNumber ?? "—"}</td>
                  <td className="font-mono">{c.sealNumber ?? "—"}</td>
                  <td className="text-right font-mono">
                    {c.weightKg ? formatNumber(Number(c.weightKg), 0) : "—"}
                  </td>
                  <td>{c.vessel ?? "—"}</td>
                  <td>{c.port ?? "—"}</td>
                  <td>{c.eta ? formatDate(c.eta) : "—"}</td>
                  <td>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(c.id)}
                      loading={loading}
                    >
                      x
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-400">No hay contenedores registrados.</p>
      )}

      {!showForm ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowForm(true)}
        >
          + Agregar Contenedor
        </Button>
      ) : (
        <ContainerInlineForm
          shipmentId={shipmentId}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

function ContainerInlineForm({
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
      await createContainer({
        shipmentId,
        containerNum: (fd.get("containerNum") as string) || null,
        blNumber: (fd.get("blNumber") as string) || null,
        sealNumber: (fd.get("sealNumber") as string) || null,
        weightKg: fd.get("weightKg") ? Number(fd.get("weightKg")) : null,
        vessel: (fd.get("vessel") as string) || null,
        port: (fd.get("port") as string) || null,
        eta: fd.get("eta") ? new Date(fd.get("eta") as string) : null,
      });
      toast.success("Contenedor agregado");
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
      <div className="grid grid-cols-4 gap-3">
        <Input label="Contenedor #" name="containerNum" placeholder="TRIU1234567" />
        <Input label="B/L" name="blNumber" placeholder="BL-001" />
        <Input label="Sello" name="sealNumber" placeholder="SEAL123" />
        <Input label="Peso (kg)" name="weightKg" type="number" step="0.01" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Input label="Naviera" name="vessel" placeholder="MSC" />
        <Input label="Puerto" name="port" placeholder="Puerto Barrios" />
        <Input label="ETA" name="eta" type="date" />
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
