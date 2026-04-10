"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { deleteFacility } from "../actions";

export function FacilityDeleteButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Eliminar instalacion "${name}"?`)) return;
    setDeleting(true);
    try {
      await deleteFacility(id);
      toast.success("Instalacion eliminada");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error eliminando");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="p-1 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
      title="Eliminar"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
