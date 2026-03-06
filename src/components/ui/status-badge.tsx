import { formatContractStatus, formatShipmentStatus } from "@/lib/utils/format";
import { Badge } from "./badge";

const STATUS_VARIANT: Record<string, "amber" | "blue" | "emerald" | "orange" | "purple" | "gray" | "red"> = {
  NEGOCIACION: "amber",
  CONFIRMADO: "blue",
  FIJADO: "emerald",
  NO_FIJADO: "orange",
  EMBARCADO: "purple",
  LIQUIDADO: "gray",
  CANCELADO: "red",
  PREPARACION: "amber",
  PENDIENTE: "amber",
  RECIBIDO: "blue",
};

export function StatusBadge({ status, type = "contract" }: { status: string; type?: "contract" | "shipment" | "po" }) {
  const label =
    type === "shipment"
      ? formatShipmentStatus(status).label
      : formatContractStatus(status).label;
  const variant = STATUS_VARIANT[status] || "gray";

  return <Badge variant={variant}>{label}</Badge>;
}
