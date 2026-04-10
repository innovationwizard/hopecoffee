"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { applyYieldAdjustment, rejectYieldAdjustment } from "../../actions";

export function AdjustmentActions({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  function handleApply() {
    startTransition(async () => {
      try {
        await applyYieldAdjustment(id);
        toast.success("Ajuste aplicado");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Error al aplicar ajuste"
        );
      }
    });
  }

  function handleReject() {
    startTransition(async () => {
      try {
        await rejectYieldAdjustment(id);
        toast.success("Ajuste rechazado");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Error al rechazar ajuste"
        );
      }
    });
  }

  return (
    <div className="flex gap-1">
      <Button
        size="sm"
        variant="primary"
        onClick={handleApply}
        disabled={isPending}
        loading={isPending}
      >
        Aplicar
      </Button>
      <Button
        size="sm"
        variant="danger"
        onClick={handleReject}
        disabled={isPending}
      >
        Rechazar
      </Button>
    </div>
  );
}
