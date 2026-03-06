// ============================================================================
// HOPE COFFEE — Formatting Utilities
// ============================================================================

import Decimal from "decimal.js";

// ---------------------------------------------------------------------------
// CURRENCY
// ---------------------------------------------------------------------------

export function formatUSD(value: number | Decimal | null | undefined): string {
  if (value == null) return "—";
  const num = value instanceof Decimal ? value.toNumber() : value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatGTQ(value: number | Decimal | null | undefined): string {
  if (value == null) return "—";
  const num = value instanceof Decimal ? value.toNumber() : value;
  return `Q${new Intl.NumberFormat("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)}`;
}

// ---------------------------------------------------------------------------
// NUMBERS
// ---------------------------------------------------------------------------

export function formatNumber(
  value: number | Decimal | null | undefined,
  decimals: number = 2
): string {
  if (value == null) return "—";
  const num = value instanceof Decimal ? value.toNumber() : value;
  return new Intl.NumberFormat("es-GT", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function formatPercent(
  value: number | Decimal | null | undefined
): string {
  if (value == null) return "—";
  const num = value instanceof Decimal ? value.toNumber() : value;
  return `${(num * 100).toFixed(2)}%`;
}

export function formatInteger(
  value: number | Decimal | null | undefined
): string {
  if (value == null) return "—";
  const num = value instanceof Decimal ? value.toNumber() : value;
  return new Intl.NumberFormat("es-GT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(num));
}

// ---------------------------------------------------------------------------
// DATES
// ---------------------------------------------------------------------------

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-GT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatMonth(month: number, year: number): string {
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat("es-GT", {
    month: "long",
    year: "numeric",
  }).format(date);
}

// ---------------------------------------------------------------------------
// DOMAIN-SPECIFIC
// ---------------------------------------------------------------------------

export function formatContractStatus(status: string): {
  label: string;
  color: string;
  bgColor: string;
} {
  const map: Record<string, { label: string; color: string; bgColor: string }> = {
    NEGOCIACION: { label: "Negociación", color: "text-amber-700", bgColor: "bg-amber-50 border-amber-200" },
    CONFIRMADO:  { label: "Confirmado", color: "text-blue-700", bgColor: "bg-blue-50 border-blue-200" },
    FIJADO:      { label: "Fijado", color: "text-emerald-700", bgColor: "bg-emerald-50 border-emerald-200" },
    NO_FIJADO:   { label: "No Fijado", color: "text-orange-700", bgColor: "bg-orange-50 border-orange-200" },
    EMBARCADO:   { label: "Embarcado", color: "text-purple-700", bgColor: "bg-purple-50 border-purple-200" },
    LIQUIDADO:   { label: "Liquidado", color: "text-gray-500", bgColor: "bg-gray-50 border-gray-200" },
    CANCELADO:   { label: "Cancelado", color: "text-red-700", bgColor: "bg-red-50 border-red-200" },
  };
  return map[status] ?? { label: status, color: "text-gray-700", bgColor: "bg-gray-50 border-gray-200" };
}

export function formatShipmentStatus(status: string): {
  label: string;
  color: string;
  bgColor: string;
} {
  const map: Record<string, { label: string; color: string; bgColor: string }> = {
    PREPARACION: { label: "Preparación", color: "text-amber-700", bgColor: "bg-amber-50 border-amber-200" },
    EMBARCADO:   { label: "Embarcado", color: "text-purple-700", bgColor: "bg-purple-50 border-purple-200" },
    LIQUIDADO:   { label: "Liquidado", color: "text-gray-500", bgColor: "bg-gray-50 border-gray-200" },
  };
  return map[status] ?? { label: status, color: "text-gray-700", bgColor: "bg-gray-50 border-gray-200" };
}

export function formatPOStatus(status: string): string {
  const map: Record<string, string> = {
    PENDIENTE: "Pendiente",
    RECIBIDO: "Recibido",
    LIQUIDADO: "Liquidado",
  };
  return map[status] ?? status;
}

export function formatRegion(region: string): string {
  const map: Record<string, string> = {
    SANTA_ROSA: "Santa Rosa",
    HUEHUETENANGO: "Huehuetenango",
    ORGANICO: "Orgánico",
    DANILANDIA: "Danilandia",
    SANTA_ISABEL: "Santa Isabel",
    OTHER: "Otra",
  };
  return map[region] ?? region;
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/** Convert Prisma Decimal to number safely */
export function toNum(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (value instanceof Decimal) return value.toNumber();
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

/** CSS class for positive/negative values */
export function valueColorClass(value: number | Decimal | null): string {
  if (value == null) return "";
  const num = value instanceof Decimal ? value.toNumber() : value;
  if (num > 0) return "text-emerald-600";
  if (num < 0) return "text-red-600";
  return "text-gray-500";
}

/** CSS class for margin thresholds */
export function marginColorClass(margin: number): string {
  if (margin >= 0.10) return "text-emerald-600 font-semibold";
  if (margin >= 0.05) return "text-blue-600";
  if (margin >= 0) return "text-amber-600";
  return "text-red-600 font-semibold";
}
