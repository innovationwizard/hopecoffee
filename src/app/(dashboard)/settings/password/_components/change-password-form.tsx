"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { changeOwnPassword } from "../actions";

export function ChangePasswordForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    try {
      await changeOwnPassword({ currentPassword, newPassword });
      toast.success("Contraseña actualizada. Inicie sesión nuevamente.");
      router.push("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Input
        label="Contraseña actual"
        name="currentPassword"
        type="password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        autoComplete="current-password"
        required
      />
      <Input
        label="Nueva contraseña"
        name="newPassword"
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        placeholder="Min 8 caracteres"
        autoComplete="new-password"
        minLength={8}
        required
      />
      <Input
        label="Confirmar nueva contraseña"
        name="confirmPassword"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        autoComplete="new-password"
        minLength={8}
        required
      />
      <Button type="submit" size="sm" loading={loading} className="w-full">
        Cambiar contraseña
      </Button>
    </form>
  );
}
