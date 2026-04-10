import { prisma } from "@/lib/db";

/**
 * Generates a sequential correlative ID in the format {PREFIX}-{YEAR}-{SEQ}.
 * SEQ is zero-padded to 4 digits. Uses the database to determine the next sequence number.
 *
 * Examples: HC-2026-0001 (contract), LOT-2026-0347 (lot), TRIA-2026-0012 (milling)
 */
export async function generateCorrelative(
  prefix: string,
  table: string,
  field: string
): Promise<string> {
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-`;

  // Find the highest existing sequence for this prefix+year
  const result = await prisma.$queryRawUnsafe<{ max_val: string | null }[]>(
    `SELECT MAX("${field}") as max_val FROM "${table}" WHERE "${field}" LIKE $1`,
    `${pattern}%`
  );

  let nextSeq = 1;
  const maxVal = result[0]?.max_val;
  if (maxVal) {
    const parts = maxVal.split("-");
    const currentSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(currentSeq)) {
      nextSeq = currentSeq + 1;
    }
  }

  return `${pattern}${String(nextSeq).padStart(4, "0")}`;
}

/**
 * Generate an official contract correlative (HC-{YEAR}-{SEQ}).
 */
export async function generateContractCorrelative(): Promise<string> {
  return generateCorrelative("HC", "contracts", "officialCorrelative");
}

/**
 * Generate a lot number (LOT-{YEAR}-{SEQ}).
 */
export async function generateLotNumber(): Promise<string> {
  return generateCorrelative("LOT", "lots", "lotNumber");
}

/**
 * Generate a milling order number (TRIA-{YEAR}-{SEQ}).
 */
export async function generateMillingOrderNumber(): Promise<string> {
  return generateCorrelative("TRIA", "milling_orders", "orderNumber");
}
