"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatGTQ, formatUSD, formatNumber, formatPercent, toNum } from "@/lib/utils/format";
import { updateFarm } from "../actions";
import type { Farm } from "@prisma/client";

export function FarmCard({ farm }: { farm: Farm }) {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);

    try {
      await updateFarm({
        id: farm.id,
        name: farm.name,
        totalQuetzales: Number(fd.get("totalQuetzales")),
        tipoCambio: Number(fd.get("tipoCambio")),
        aumentoPorcentaje: Number(fd.get("aumentoPorcentaje")),
        porcentajePrest: Number(fd.get("porcentajePrest")),
      });
      toast.success("Finca actualizada");
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  if (editing) {
    return (
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {farm.name}
          </h3>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              label="Total Quetzales"
              name="totalQuetzales"
              type="number"
              step="0.01"
              defaultValue={toNum(farm.totalQuetzales)}
            />
            <Input
              label="Tipo de Cambio"
              name="tipoCambio"
              type="number"
              step="0.01"
              defaultValue={toNum(farm.tipoCambio)}
            />
            <Input
              label="% Aumento"
              name="aumentoPorcentaje"
              type="number"
              step="0.01"
              defaultValue={toNum(farm.aumentoPorcentaje)}
            />
            <Input
              label="% Préstamo"
              name="porcentajePrest"
              type="number"
              step="0.01"
              defaultValue={toNum(farm.porcentajePrest)}
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" loading={loading}>
                Guardar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditing(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {farm.name}
          </h3>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Editar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          <div>
            <dt className="text-xs text-gray-500">Total Quetzales</dt>
            <dd className="font-mono font-medium text-gray-900 dark:text-white">
              {formatGTQ(toNum(farm.totalQuetzales))}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Tipo de Cambio</dt>
            <dd className="font-mono font-medium text-gray-900 dark:text-white">
              {formatNumber(toNum(farm.tipoCambio), 2)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Total USD</dt>
            <dd className="font-mono font-medium text-gray-900 dark:text-white">
              {formatUSD(toNum(farm.totalUSD))}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">% Aumento</dt>
            <dd className="font-mono font-medium text-gray-900 dark:text-white">
              {formatPercent(toNum(farm.aumentoPorcentaje))}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Nuevo Total</dt>
            <dd className="font-mono font-medium text-gray-900 dark:text-white">
              {formatUSD(toNum(farm.nuevoTotal))}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">% Préstamo</dt>
            <dd className="font-mono font-medium text-gray-900 dark:text-white">
              {formatPercent(toNum(farm.porcentajePrest))}
            </dd>
          </div>
          <div className="col-span-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <dt className="text-xs text-gray-500">Total Préstamo</dt>
            <dd className="text-xl font-mono font-bold text-emerald-700 dark:text-emerald-400">
              {formatUSD(toNum(farm.totalPrestamo))}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
