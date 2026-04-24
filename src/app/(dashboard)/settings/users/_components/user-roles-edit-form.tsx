"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@prisma/client";
import { updateUserRoles } from "../../actions";

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: "GERENCIA", label: "Gerencia" },
  { value: "FINANCIERO", label: "Finanzas" },
  { value: "COMPRAS", label: "Compras" },
  { value: "VENTAS", label: "Ventas" },
  { value: "LAB", label: "Laboratorio" },
  { value: "ANALISIS", label: "Analisis" },
  { value: "CONTABILIDAD", label: "Contabilidad" },
  { value: "LOGISTICA", label: "Logistica" },
  { value: "LAB_ASISTENTE", label: "Lab Asistente" },
  { value: "MASTER", label: "Master" },
];

interface Props {
  userId: string;
  currentRoles: UserRole[];
}

export function UserRolesEditForm({ userId, currentRoles }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>(currentRoles);

  function toggleRole(role: UserRole) {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (selectedRoles.length === 0) {
      toast.error("Seleccione al menos un rol");
      return;
    }
    setLoading(true);
    try {
      await updateUserRoles({ userId, roles: selectedRoles });
      toast.success("Roles actualizados");
      router.push("/settings/users");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Roles
        </label>
        <div className="space-y-1">
          {ROLE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 text-sm cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedRoles.includes(opt.value)}
                onChange={() => toggleRole(opt.value)}
                className="rounded border-gray-300 text-orion-600 focus:ring-orion-500"
              />
              <span className="text-gray-700 dark:text-gray-300">
                {opt.label}
              </span>
            </label>
          ))}
        </div>
      </div>
      <Button type="submit" size="sm" loading={loading} className="w-full">
        Guardar
      </Button>
    </form>
  );
}
