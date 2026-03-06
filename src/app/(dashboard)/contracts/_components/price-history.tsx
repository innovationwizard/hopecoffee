import { formatUSD, formatNumber, formatContractStatus } from "@/lib/utils/format";
import type { ContractPriceSnapshot } from "@prisma/client";

function toNum(v: unknown): number {
  if (v == null) return 0;
  return Number(v);
}

export function PriceHistory({
  snapshots,
}: {
  snapshots: ContractPriceSnapshot[];
}) {
  if (snapshots.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        Sin historial de precios aún.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="dense-table w-full text-xs">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Razón</th>
            <th>Estado</th>
            <th className="text-right">Bolsa</th>
            <th className="text-right">Dif</th>
            <th className="text-right">T.C.</th>
            <th>Posición</th>
          </tr>
        </thead>
        <tbody>
          {snapshots.map((s) => (
            <tr key={s.id}>
              <td className="whitespace-nowrap">
                {new Date(s.snapshotAt).toLocaleDateString("es-GT", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
              <td>
                {s.reason === "price_update" ? "Edición" : "Cambio estado"}
              </td>
              <td>{formatContractStatus(s.status).label}</td>
              <td className="text-right font-mono">
                {formatUSD(toNum(s.precioBolsa))}
              </td>
              <td className="text-right font-mono">
                {formatNumber(toNum(s.diferencial), 2)}
              </td>
              <td className="text-right font-mono">
                {formatNumber(toNum(s.tipoCambio), 2)}
              </td>
              <td>{s.posicionBolsa ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
