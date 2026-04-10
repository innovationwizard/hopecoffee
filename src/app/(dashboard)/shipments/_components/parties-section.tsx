"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { createShipmentParty, deleteShipmentParty } from "../party-actions";

type Party = {
  id: string;
  role: string;
  notes: string | null;
  client: { id: string; name: string };
};

const ROLE_OPTIONS = [
  { value: "BROKER", label: "Broker" },
  { value: "IMPORTER", label: "Importador" },
  { value: "BUYER", label: "Comprador" },
];

const ROLE_COLORS: Record<string, "purple" | "blue" | "emerald"> = {
  BROKER: "purple",
  IMPORTER: "blue",
  BUYER: "emerald",
};

export function PartiesSection({
  shipmentId,
  parties: initialParties,
  clients,
}: {
  shipmentId: string;
  parties: Party[];
  clients: { id: string; name: string }[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta parte?")) return;
    setLoading(true);
    try {
      await deleteShipmentParty(id);
      toast.success("Parte eliminada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {initialParties.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="dense-table w-full">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Rol</th>
                <th>Notas</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {initialParties.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">{p.client.name}</td>
                  <td>
                    <Badge variant={ROLE_COLORS[p.role] ?? "gray"}>
                      {ROLE_OPTIONS.find((r) => r.value === p.role)?.label ?? p.role}
                    </Badge>
                  </td>
                  <td className="text-gray-500 text-sm">{p.notes ?? "—"}</td>
                  <td>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(p.id)}
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
        <p className="text-sm text-gray-400">No hay partes registradas.</p>
      )}

      {!showForm ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowForm(true)}
        >
          + Agregar Parte
        </Button>
      ) : (
        <PartyInlineForm
          shipmentId={shipmentId}
          clients={clients}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

function PartyInlineForm({
  shipmentId,
  clients,
  onClose,
}: {
  shipmentId: string;
  clients: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);

    const clientId = fd.get("clientId") as string;
    const role = fd.get("role") as string;
    const notes = (fd.get("notes") as string) || null;

    if (!clientId || !role) {
      toast.error("Selecciona cliente y rol");
      setLoading(false);
      return;
    }

    try {
      await createShipmentParty({
        shipmentId,
        clientId,
        role: role as "BROKER" | "IMPORTER" | "BUYER",
        notes,
      });
      toast.success("Parte agregada");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear");
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
        <Select
          label="Cliente"
          name="clientId"
          placeholder="Seleccionar..."
          options={clients.map((c) => ({ value: c.id, label: c.name }))}
        />
        <Select
          label="Rol"
          name="role"
          placeholder="Seleccionar..."
          options={ROLE_OPTIONS}
        />
        <Input label="Notas" name="notes" placeholder="Notas opcionales" />
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
