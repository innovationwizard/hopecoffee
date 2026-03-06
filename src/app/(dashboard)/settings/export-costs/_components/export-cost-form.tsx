"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createExportCostConfig, updateExportCostConfig } from "../../actions";
import type { ExportCostConfigInput } from "@/lib/validations/schemas";

interface ExportCostFormProps {
  mode: "create" | "edit";
  initialData?: {
    id: string;
    name: string;
    gastosPerSaco: number;
    trillaPerQQ: number;
    sacoYute: number;
    estampado: number;
    bolsaGrainPro: number;
    fitoSanitario: number;
    impuestoAnacafe1: number;
    impuestoAnacafe2: number;
    inspeccionOirsa: number;
    fumigacion: number;
    emisionDocumento: number;
    fletePuerto: number;
    seguro: number;
    custodio: number;
    agenteAduanal: number;
    comisionExportadorOrganico: number;
    isDefault: boolean;
  };
  onDone: () => void;
}

const FIELDS = [
  { name: "gastosPerSaco", label: "Gastos/Saco (USD)" },
  { name: "trillaPerQQ", label: "Trilla/QQ (USD)" },
  { name: "sacoYute", label: "Saco Yute (Q)" },
  { name: "estampado", label: "Estampado (Q)" },
  { name: "bolsaGrainPro", label: "Bolsa GrainPro (Q)" },
  { name: "fitoSanitario", label: "Fito Sanitario (Q)" },
  { name: "impuestoAnacafe1", label: "ANACAFE 1 (Q)" },
  { name: "impuestoAnacafe2", label: "ANACAFE 2 (Q)" },
  { name: "inspeccionOirsa", label: "Inspección OIRSA (Q)" },
  { name: "fumigacion", label: "Fumigación (Q)" },
  { name: "emisionDocumento", label: "Emisión Doc (Q)" },
  { name: "fletePuerto", label: "Flete Puerto (Q)" },
  { name: "seguro", label: "Seguro (Q)" },
  { name: "custodio", label: "Custodio (Q)" },
  { name: "agenteAduanal", label: "Agente Aduanal (Q)" },
  { name: "comisionExportadorOrganico", label: "Com. Exportador Orgánico" },
] as const;

export function ExportCostForm({ mode, initialData, onDone }: ExportCostFormProps) {
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const fd = new FormData(e.currentTarget);
      const numericFields = Object.fromEntries(
        FIELDS.map((f) => [f.name, parseFloat(fd.get(f.name) as string) || 0])
      );
      const data = {
        name: fd.get("name") as string,
        isDefault: fd.get("isDefault") === "on",
        ...numericFields,
      } as ExportCostConfigInput;

      if (mode === "edit" && initialData) {
        await updateExportCostConfig({ ...data, id: initialData.id });
        toast.success("Config actualizada");
      } else {
        await createExportCostConfig(data);
        toast.success("Config creada");
      }
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error guardando config");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Nombre"
          name="name"
          defaultValue={initialData?.name ?? ""}
          required
        />
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isDefault"
              defaultChecked={initialData?.isDefault ?? false}
              className="rounded"
            />
            Config por defecto
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {FIELDS.map((f) => (
          <Input
            key={f.name}
            label={f.label}
            name={f.name}
            type="number"
            step="0.01"
            min={0}
            defaultValue={initialData?.[f.name] ?? 0}
          />
        ))}
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={submitting}>
          {mode === "edit" ? "Guardar" : "Crear Config"}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
