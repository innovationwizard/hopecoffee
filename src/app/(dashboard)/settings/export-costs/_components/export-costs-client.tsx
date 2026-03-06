"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatGTQ, toNum } from "@/lib/utils/format";
import { ExportCostForm } from "./export-cost-form";
import type { ExportCostConfig } from "@prisma/client";

interface Props {
  configs: ExportCostConfig[];
}

const DISPLAY_FIELDS = [
  ["Gastos/Saco", "gastosPerSaco"],
  ["Trilla/QQ", "trillaPerQQ"],
  ["Saco Yute", "sacoYute"],
  ["Estampado", "estampado"],
  ["Bolsa GrainPro", "bolsaGrainPro"],
  ["Fito Sanitario", "fitoSanitario"],
  ["ANACAFE 1", "impuestoAnacafe1"],
  ["ANACAFE 2", "impuestoAnacafe2"],
  ["Inspección OIRSA", "inspeccionOirsa"],
  ["Fumigación", "fumigacion"],
  ["Emisión Doc", "emisionDocumento"],
  ["Flete Puerto", "fletePuerto"],
  ["Seguro", "seguro"],
  ["Custodio", "custodio"],
  ["Agente Aduanal", "agenteAduanal"],
  ["Com. Exp. Orgánico", "comisionExportadorOrganico"],
] as const;

export function ExportCostsClient({ configs }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  if (creating) {
    return (
      <Card>
        <CardContent className="py-4">
          <h3 className="font-semibold mb-4">Nueva Configuración</h3>
          <ExportCostForm mode="create" onDone={() => setCreating(false)} />
        </CardContent>
      </Card>
    );
  }

  const editConfig = editing ? configs.find((c) => c.id === editing) : null;
  if (editConfig) {
    return (
      <Card>
        <CardContent className="py-4">
          <h3 className="font-semibold mb-4">Editar: {editConfig.name}</h3>
          <ExportCostForm
            mode="edit"
            initialData={{
              id: editConfig.id,
              name: editConfig.name,
              isDefault: editConfig.isDefault,
              ...Object.fromEntries(
                DISPLAY_FIELDS.map(([, key]) => [key, toNum((editConfig as Record<string, unknown>)[key])])
              ),
            } as Parameters<typeof ExportCostForm>[0]["initialData"] & { id: string }}
            onDone={() => setEditing(null)}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="mb-4">
        <Button onClick={() => setCreating(true)}>Nuevo Config</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {configs.map((c) => (
          <Card key={c.id}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {c.name}
                </h3>
                <div className="flex items-center gap-2">
                  {c.isDefault && (
                    <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      Default
                    </span>
                  )}
                  <button
                    onClick={() => setEditing(c.id)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Editar
                  </button>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {DISPLAY_FIELDS.map(([label, key]) => (
                  <div key={key} className="flex justify-between">
                    <dt className="text-gray-500">{label}</dt>
                    <dd className="font-mono text-gray-900 dark:text-white">
                      {formatGTQ(toNum((c as Record<string, unknown>)[key]))}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>

      {configs.length === 0 && (
        <p className="text-sm text-gray-400 text-center mt-8">
          No hay configuraciones de costos.
        </p>
      )}
    </>
  );
}
