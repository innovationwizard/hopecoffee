"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { changeContractStatus } from "../actions";

const VALID_TRANSITIONS: Record<string, { value: string; label: string }[]> = {
  NEGOCIACION: [
    { value: "CONFIRMADO", label: "Confirmar" },
    { value: "CANCELADO", label: "Cancelar" },
  ],
  CONFIRMADO: [
    { value: "FIJADO", label: "Fijar Precio" },
    { value: "NO_FIJADO", label: "Marcar No Fijado" },
    { value: "CANCELADO", label: "Cancelar" },
  ],
  NO_FIJADO: [
    { value: "FIJADO", label: "Fijar Precio" },
    { value: "CANCELADO", label: "Cancelar" },
  ],
  FIJADO: [
    { value: "EMBARCADO", label: "Marcar Embarcado" },
    { value: "CANCELADO", label: "Cancelar" },
  ],
  EMBARCADO: [{ value: "LIQUIDADO", label: "Liquidar" }],
  LIQUIDADO: [],
  CANCELADO: [],
};

export function ContractStatusChanger({
  contractId,
  currentStatus,
}: {
  contractId: string;
  currentStatus: string;
}) {
  const [loading, setLoading] = useState(false);
  const transitions = VALID_TRANSITIONS[currentStatus] ?? [];

  if (transitions.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        No hay transiciones disponibles.
      </p>
    );
  }

  async function handleChange(newStatus: string) {
    setLoading(true);
    try {
      await changeContractStatus(contractId, newStatus);
      toast.success("Estado actualizado");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error actualizando estado"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {transitions.map((t) => (
        <Button
          key={t.value}
          variant={t.value === "CANCELADO" ? "danger" : "outline"}
          size="sm"
          loading={loading}
          onClick={() => handleChange(t.value)}
        >
          {t.label}
        </Button>
      ))}
    </div>
  );
}
