"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleUserActive } from "../../actions";

export function UserToggle({
  userId,
  isActive,
}: {
  userId: string;
  isActive: boolean;
}) {
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    try {
      await toggleUserActive(userId);
      toast.success(isActive ? "Usuario desactivado" : "Usuario activado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant={isActive ? "danger" : "outline"}
      size="sm"
      loading={loading}
      onClick={handleToggle}
    >
      {isActive ? "Desactivar" : "Activar"}
    </Button>
  );
}
