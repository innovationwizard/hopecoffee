"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { completeMillingOrder, deleteMillingOrder } from "../actions";

export function CompleteButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleComplete() {
    if (!confirm("Marcar esta orden como completada?")) return;
    setLoading(true);
    try {
      await completeMillingOrder(orderId);
      toast.success("Orden completada");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error completando orden");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleComplete} loading={loading}>
      Completar
    </Button>
  );
}

export function DeleteButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Eliminar esta orden? Los lotes de entrada volveran a PERGAMINO_BODEGA y los lotes de salida seran eliminados.")) return;
    setLoading(true);
    try {
      await deleteMillingOrder(orderId);
      toast.success("Orden eliminada");
      router.push("/milling");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error eliminando orden");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="danger" onClick={handleDelete} loading={loading}>
      Eliminar
    </Button>
  );
}
