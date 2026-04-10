"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { FacilityCreateSchema } from "@/lib/validations/schemas";
import type { z } from "zod";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { createFacility } from "../actions";

type FacilityFormValues = z.input<typeof FacilityCreateSchema>;

const FACILITY_TYPES = [
  { value: "BENEFICIO", label: "Beneficio" },
  { value: "BODEGA", label: "Bodega" },
  { value: "PATIO", label: "Patio" },
];

export function FacilityForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FacilityFormValues>({
    resolver: zodResolver(FacilityCreateSchema),
    defaultValues: {
      name: "",
      code: "",
      type: "BODEGA",
      capacity: undefined,
      isActive: true,
    },
  });

  async function onSubmit(data: FacilityFormValues) {
    setSubmitting(true);
    try {
      await createFacility(data);
      toast.success("Instalacion creada");
      reset();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error creando instalacion");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <Input
        label="Nombre"
        placeholder="Beneficio Orion"
        error={errors.name?.message}
        {...register("name")}
      />
      <Input
        label="Codigo"
        placeholder="BEN"
        error={errors.code?.message}
        {...register("code")}
      />
      <Select
        label="Tipo"
        options={FACILITY_TYPES}
        error={errors.type?.message}
        {...register("type")}
      />
      <Input
        label="Capacidad (QQ)"
        type="number"
        step="0.01"
        placeholder="Opcional"
        error={errors.capacity?.message}
        {...register("capacity", { valueAsNumber: true })}
      />
      <Button type="submit" loading={submitting} className="w-full">
        Crear Instalacion
      </Button>
    </form>
  );
}
