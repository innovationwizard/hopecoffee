"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ShipmentCreateSchema } from "@/lib/validations/schemas";
import type { z } from "zod";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { createShipment, updateShipment } from "../actions";

type ShipmentFormValues = z.input<typeof ShipmentCreateSchema>;

const STATUS_OPTIONS = [
  { value: "PREPARACION", label: "Preparación" },
  { value: "EMBARCADO", label: "Embarcado" },
  { value: "LIQUIDADO", label: "Liquidado" },
];

const MONTH_OPTIONS = [
  { value: "1", label: "Enero" },
  { value: "2", label: "Febrero" },
  { value: "3", label: "Marzo" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Mayo" },
  { value: "6", label: "Junio" },
  { value: "7", label: "Julio" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
];

interface ShipmentFormProps {
  mode: "create" | "edit";
  initialData?: Partial<ShipmentFormValues> & { id?: string };
}

export function ShipmentForm({ mode, initialData }: ShipmentFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ShipmentFormValues>({
    resolver: zodResolver(ShipmentCreateSchema),
    defaultValues: {
      name: initialData?.name ?? "",
      status: initialData?.status ?? "PREPARACION",
      month: initialData?.month ?? new Date().getMonth() + 1,
      year: initialData?.year ?? new Date().getFullYear(),
      numContainers: initialData?.numContainers ?? 3,
      regions: initialData?.regions ?? "",
      notes: initialData?.notes ?? "",
    },
  });

  async function onSubmit(data: ShipmentFormValues) {
    setSubmitting(true);
    try {
      const parsed = ShipmentCreateSchema.parse(data);
      if (mode === "edit" && initialData?.id) {
        await updateShipment({ ...parsed, id: initialData.id });
        toast.success("Embarque actualizado");
      } else {
        await createShipment(parsed);
        toast.success("Embarque creado");
      }
      router.push("/shipments");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error guardando embarque"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-4">
      <Input
        label="Nombre"
        placeholder="Enero 2026"
        error={errors.name?.message}
        {...register("name")}
      />

      <div className="grid grid-cols-4 gap-4">
        <Select
          label="Estado"
          options={STATUS_OPTIONS}
          error={errors.status?.message}
          {...register("status")}
        />
        <Select
          label="Mes"
          options={MONTH_OPTIONS}
          error={errors.month?.message}
          {...register("month", { valueAsNumber: true })}
        />
        <Input
          label="Año"
          type="number"
          min={2020}
          max={2100}
          error={errors.year?.message}
          {...register("year", { valueAsNumber: true })}
        />
        <Input
          label="Contenedores"
          type="number"
          min={0}
          error={errors.numContainers?.message}
          {...register("numContainers", { valueAsNumber: true })}
        />
      </div>

      <Input
        label="Regiones"
        placeholder="Orgánico / Santa Rosa / Huehue"
        error={errors.regions?.message}
        {...register("regions")}
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Notas
        </label>
        <textarea
          rows={2}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          {...register("notes")}
        />
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="submit" loading={submitting}>
          {mode === "edit" ? "Guardar Cambios" : "Crear Embarque"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
