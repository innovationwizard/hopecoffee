"use client";

import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <h2 className="text-lg font-medium text-red-600 dark:text-red-400 mb-2">
        Algo salió mal
      </h2>
      <p className="text-sm text-gray-500 mb-4 max-w-md">
        {error.message || "Error inesperado. Intenta de nuevo."}
      </p>
      <Button onClick={reset} variant="outline">
        Reintentar
      </Button>
    </div>
  );
}
