const PIPELINE_STEPS = [
  { key: "NEGOCIACION", label: "Negociación" },
  { key: "CONFIRMADO", label: "Confirmado" },
  { key: "FIJADO", label: "Fijado" },
  { key: "EMBARCADO", label: "Embarcado" },
  { key: "LIQUIDADO", label: "Liquidado" },
] as const;

const STEP_INDEX: Record<string, number> = {
  NEGOCIACION: 0,
  CONFIRMADO: 1,
  NO_FIJADO: 1,
  FIJADO: 2,
  EMBARCADO: 3,
  LIQUIDADO: 4,
  CANCELADO: -1,
};

interface ChecklistItem {
  label: string;
  done: boolean;
  required: boolean;
}

interface ContractProgressProps {
  status: string;
  hasPrecioBolsa: boolean;
  hasDiferencial: boolean;
  hasEmbarque: boolean;
  hasMateriaPrima: boolean;
  hasFechaEmbarque: boolean;
}

export function ContractProgress({
  status,
  hasPrecioBolsa,
  hasDiferencial,
  hasEmbarque,
  hasMateriaPrima,
  hasFechaEmbarque,
}: ContractProgressProps) {
  const currentIndex = STEP_INDEX[status] ?? 0;
  const isCancelled = status === "CANCELADO";

  const checklist: ChecklistItem[] = [
    { label: "Precio de bolsa definido", done: hasPrecioBolsa, required: true },
    { label: "Diferencial acordado", done: hasDiferencial, required: true },
    { label: "Materia prima asignada", done: hasMateriaPrima, required: true },
    { label: "Asignado a embarque", done: hasEmbarque, required: true },
    { label: "Fecha de embarque", done: hasFechaEmbarque, required: false },
  ];

  const completedRequired = checklist.filter((i) => i.required && i.done).length;
  const totalRequired = checklist.filter((i) => i.required).length;

  return (
    <div className="space-y-4">
      {/* Pipeline steps */}
      {isCancelled ? (
        <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-600 dark:text-red-400 text-center">
          Contrato cancelado
        </div>
      ) : (
        <div className="flex items-center gap-1">
          {PIPELINE_STEPS.map((step, i) => {
            const isActive = i === currentIndex;
            const isPast = i < currentIndex;
            return (
              <div key={step.key} className="flex-1 flex flex-col items-center">
                <div
                  className={`w-full h-2 rounded-full ${
                    isPast
                      ? "bg-emerald-500"
                      : isActive
                      ? "bg-blue-500"
                      : "bg-gray-200 dark:bg-gray-700"
                  }`}
                />
                <span
                  className={`text-[10px] mt-1 ${
                    isActive
                      ? "font-semibold text-blue-600 dark:text-blue-400"
                      : isPast
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-gray-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Checklist — only show when not yet FIJADO */}
      {currentIndex < 2 && !isCancelled && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Requisitos para fijar ({completedRequired}/{totalRequired})
          </p>
          {checklist.map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-xs">
              <span
                className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                  item.done
                    ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
                }`}
              >
                {item.done ? "✓" : "—"}
              </span>
              <span
                className={
                  item.done
                    ? "text-gray-600 dark:text-gray-300"
                    : "text-gray-400 dark:text-gray-500"
                }
              >
                {item.label}
                {item.required && !item.done && (
                  <span className="text-red-400 ml-1">*</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Post-fix status messages */}
      {status === "FIJADO" && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          Precio fijado. Listo para embarque.
        </p>
      )}
      {status === "EMBARCADO" && (
        <p className="text-xs text-purple-600 dark:text-purple-400">
          En tránsito. Pendiente de liquidación.
        </p>
      )}
      {status === "LIQUIDADO" && (
        <p className="text-xs text-gray-500">
          Completado y liquidado.
        </p>
      )}
    </div>
  );
}
