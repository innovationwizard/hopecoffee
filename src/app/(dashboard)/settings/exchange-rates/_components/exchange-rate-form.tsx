"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createExchangeRate } from "../../actions";

export function ExchangeRateForm() {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);

    try {
      await createExchangeRate({
        rate: Number(fd.get("rate")),
        validFrom: new Date(fd.get("validFrom") as string),
        notes: (fd.get("notes") as string) || undefined,
      });
      toast.success("Tipo de cambio creado");
      e.currentTarget.reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Input
        label="Tasa (GTQ/USD)"
        name="rate"
        type="number"
        step="0.01"
        min={1}
        max={50}
        defaultValue={7.65}
      />
      <Input
        label="Válido Desde"
        name="validFrom"
        type="date"
        defaultValue={new Date().toISOString().split("T")[0]}
      />
      <Input label="Notas" name="notes" placeholder="Opcional" />
      <Button type="submit" size="sm" loading={loading} className="w-full">
        Agregar
      </Button>
    </form>
  );
}
