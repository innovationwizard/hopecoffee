"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface Client {
  id: string;
  name: string;
}

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "NEGOCIACION", label: "Negociación" },
  { value: "CONFIRMADO", label: "Confirmado" },
  { value: "FIJADO", label: "Fijado" },
  { value: "NO_FIJADO", label: "No Fijado" },
  { value: "EMBARCADO", label: "Embarcado" },
  { value: "LIQUIDADO", label: "Liquidado" },
  { value: "CANCELADO", label: "Cancelado" },
];

export function ContractFilters({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`/contracts?${params.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <div className="flex flex-wrap gap-3 mb-4">
      <select
        value={searchParams.get("clientId") ?? ""}
        onChange={(e) => updateFilter("clientId", e.target.value)}
        className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
      >
        <option value="">Todos los clientes</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <select
        value={searchParams.get("status") ?? ""}
        onChange={(e) => updateFilter("status", e.target.value)}
        className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <input
        type="month"
        value={searchParams.get("month") ?? ""}
        onChange={(e) => updateFilter("month", e.target.value)}
        className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
      />

      <input
        type="text"
        placeholder="Cosecha (25/26)"
        value={searchParams.get("cosecha") ?? ""}
        onChange={(e) => updateFilter("cosecha", e.target.value)}
        className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white w-28"
      />

      <input
        type="text"
        placeholder="Buscar contrato..."
        defaultValue={searchParams.get("search") ?? ""}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            updateFilter("search", (e.target as HTMLInputElement).value);
          }
        }}
        className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white w-48"
      />
    </div>
  );
}
