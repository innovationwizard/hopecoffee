"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createUser } from "../../actions";

const ROLE_OPTIONS = [
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
] as const;

export function UserCreateForm() {
  const [loading, setLoading] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  function toggleRole(role: string) {
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
    const fd = new FormData(e.currentTarget);

    try {
      await createUser({
        name: fd.get("name") as string,
        email: fd.get("email") as string,
        password: fd.get("password") as string,
        roles: selectedRoles as Array<(typeof ROLE_OPTIONS)[number]["value"]>,
      });
      toast.success("Usuario creado");
      e.currentTarget.reset();
      setSelectedRoles([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Input label="Nombre" name="name" placeholder="Juan Perez" />
      <Input
        label="Email"
        name="email"
        type="email"
        placeholder="name@example.com"
      />
      <Input
        label="Contrasena"
        name="password"
        type="password"
        placeholder="Min 8 caracteres"
      />
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
        Crear Usuario
      </Button>
    </form>
  );
}
