"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  formatUSD,
  formatGTQ,
  formatNumber,
  toNum,
} from "@/lib/utils/format";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  assignContractToShipment,
  unassignContractFromShipment,
} from "../actions";
import type { Contract, Client } from "@prisma/client";

type ContractWithClient = Contract & { client: Client };

export function ContractsSection({
  shipmentId,
  contracts,
  unassignedContracts,
}: {
  shipmentId: string;
  contracts: ContractWithClient[];
  unassignedContracts: ContractWithClient[];
}) {
  const router = useRouter();
  const [showAssign, setShowAssign] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleAssign(contractId: string) {
    setLoading(true);
    try {
      await assignContractToShipment(contractId, shipmentId);
      toast.success("Contrato asignado");
      setShowAssign(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error asignando contrato"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleUnassign(contractId: string) {
    setLoading(true);
    try {
      await unassignContractFromShipment(contractId);
      toast.success("Contrato desasignado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  const totalPago = contracts.reduce((s, c) => s + toNum(c.totalPagoQTZ), 0);

  return (
    <div className="space-y-3">
      {contracts.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="dense-table w-full">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Contrato</th>
                <th>Estado</th>
                <th className="text-right">Sacos 69</th>
                <th className="text-right">Sacos 46</th>
                <th className="text-right">Fact. Lbs</th>
                <th className="text-right">Total Q</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr
                  key={c.id}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={() => router.push(`/contracts/${c.id}`)}
                >
                  <td>{c.client.name}</td>
                  <td>{c.contractNumber}</td>
                  <td>
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="text-right font-mono">
                    {formatNumber(toNum(c.sacos69kg), 0)}
                  </td>
                  <td className="text-right font-mono">
                    {formatNumber(toNum(c.sacos46kg), 1)}
                  </td>
                  <td className="text-right font-mono">
                    {formatUSD(toNum(c.facturacionLbs))}
                  </td>
                  <td className="text-right font-mono">
                    {formatGTQ(toNum(c.totalPagoQTZ))}
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUnassign(c.id);
                      }}
                      loading={loading}
                    >
                      ×
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6} className="text-right font-semibold">
                  Total
                </td>
                <td className="text-right font-mono font-semibold">
                  {formatGTQ(totalPago)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-400">
          No hay contratos asignados a este embarque.
        </p>
      )}

      {!showAssign ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAssign(true)}
        >
          + Asignar Contratos
        </Button>
      ) : (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Contratos Disponibles
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAssign(false)}
            >
              Cerrar
            </Button>
          </div>
          {unassignedContracts.length === 0 ? (
            <p className="text-sm text-gray-400">
              Todos los contratos ya están asignados.
            </p>
          ) : (
            <div className="space-y-1">
              {unassignedContracts.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between py-1 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <span className="text-sm">
                    {c.client.name} — {c.contractNumber}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAssign(c.id)}
                    loading={loading}
                  >
                    Asignar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
