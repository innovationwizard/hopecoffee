"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";

const STAGE_OPTIONS = [
  { value: "", label: "Todas las etapas" },
  { value: "PERGAMINO_BODEGA", label: "Pergamino en Bodega" },
  { value: "EN_PROCESO", label: "En Proceso" },
  { value: "ORO_EXPORTABLE", label: "Oro Exportable" },
  { value: "EXPORTADO", label: "Exportado" },
  { value: "SUBPRODUCTO", label: "Subproducto" },
];

interface InventoryFiltersProps {
  facilities: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  currentStage?: string;
  currentFacilityId?: string;
  currentSupplierId?: string;
}

export function InventoryFilters({
  facilities,
  suppliers,
  currentStage,
  currentFacilityId,
  currentSupplierId,
}: InventoryFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/inventory?${params.toString()}`);
  }

  const facilityOptions = [
    { value: "", label: "Todas las instalaciones" },
    ...facilities.map((f) => ({ value: f.id, label: f.name })),
  ];

  const supplierOptions = [
    { value: "", label: "Todos los proveedores" },
    ...suppliers.map((s) => ({ value: s.id, label: s.name })),
  ];

  return (
    <div className="flex flex-wrap gap-3">
      <div className="w-48">
        <Select
          options={STAGE_OPTIONS}
          value={currentStage ?? ""}
          onChange={(e) => updateFilter("stage", e.target.value)}
        />
      </div>
      <div className="w-48">
        <Select
          options={facilityOptions}
          value={currentFacilityId ?? ""}
          onChange={(e) => updateFilter("facilityId", e.target.value)}
        />
      </div>
      <div className="w-48">
        <Select
          options={supplierOptions}
          value={currentSupplierId ?? ""}
          onChange={(e) => updateFilter("supplierId", e.target.value)}
        />
      </div>
    </div>
  );
}
