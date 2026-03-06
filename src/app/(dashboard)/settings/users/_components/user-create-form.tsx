"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { createUser } from "../../actions";

export function UserCreateForm() {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);

    try {
      await createUser({
        name: fd.get("name") as string,
        email: fd.get("email") as string,
        password: fd.get("password") as string,
        role: fd.get("role") as "ADMIN" | "OPERATOR" | "VIEWER",
      });
      toast.success("Usuario creado");
      e.currentTarget.reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Input label="Nombre" name="name" placeholder="Juan Pérez" />
      <Input
        label="Email"
        name="email"
        type="email"
        placeholder="juan@hopecoffee.com"
      />
      <Input
        label="Contraseña"
        name="password"
        type="password"
        placeholder="Min 8 caracteres"
      />
      <Select
        label="Rol"
        name="role"
        options={[
          { value: "VIEWER", label: "Viewer" },
          { value: "OPERATOR", label: "Operator" },
          { value: "ADMIN", label: "Admin" },
        ]}
      />
      <Button type="submit" size="sm" loading={loading} className="w-full">
        Crear Usuario
      </Button>
    </form>
  );
}
