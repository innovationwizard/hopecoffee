"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNumber, formatDate } from "@/lib/utils/format";
import { createContainer, deleteContainer } from "../container-actions";
import { ContainerLotsSection } from "./container-lots-section";

interface ContainerWithLots {
  id: string;
  containerNum: string | null;
  blNumber: string | null;
  sealNumber: string | null;
  weightKg: unknown;
  vessel: string | null;
  port: string | null;
  eta: Date | string | null;
  containerLots: {
    id: string;
    quantityQQ: unknown;
    lot: {
      id: string;
      lotNumber: string;
      stage: string;
      quantityQQ: unknown;
      supplier: { id: string; name: string } | null;
    };
  }[];
}

interface AvailableLot {
  id: string;
  lotNumber: string;
  quantityQQ: number;
  qualityGrade: string | null;
  supplier: { id: string; name: string } | null;
}

export function ContainersSection({
  shipmentId,
  containers,
  availableOroLots,
}: {
  shipmentId: string;
  containers: ContainerWithLots[];
  availableOroLots: AvailableLot[];
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
        <div className="space-y-3">
          {containers.map((c) => (
            <div
              key={c.id}
              className="border border-gray-100 dark:border-gray-800 rounded-lg p-3"
            >
              <div className="flex items-start justify-between">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-sm flex-1">
                  <div>
                    <span className="text-xs text-gray-500">Contenedor</span>
                    <p className="font-mono">{c.containerNum ?? "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">B/L</span>
                    <p className="font-mono">{c.blNumber ?? "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Sello</span>
                    <p className="font-mono">{c.sealNumber ?? "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Peso (kg)</span>
                    <p className="font-mono">
                      {c.weightKg ? formatNumber(Number(c.weightKg), 0) : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Naviera</span>
                    <p>{c.vessel ?? "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Puerto</span>
                    <p>{c.port ?? "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">ETA</span>
                    <p>{c.eta ? formatDate(c.eta) : "—"}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(c.id)}
                  loading={loading}
                >
                  x
                </Button>
              </div>
              <ContainerLotsSection
                containerId={c.id}
                containerNum={c.containerNum ?? c.id.slice(-6)}
                initialLots={c.containerLots.map((cl) => ({
                  id: cl.id,
                  quantityQQ: Number(cl.quantityQQ),
                  lot: {
                    id: cl.lot.id,
                    lotNumber: cl.lot.lotNumber,
                    stage: cl.lot.stage,
                    quantityQQ: Number(cl.lot.quantityQQ),
                    supplier: cl.lot.supplier,
                  },
                }))}
                availableLots={availableOroLots}
              />
            </div>
          ))}
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
