// ============================================================================
// Phase 0.1 — Mayo.xlsx structural inventory (read-only)
// ============================================================================
// Per RECONCILIATION_PLAN_2026_JAN_MAY.md §3 Phase 0.1:
//   - Enumerate sheet names in Mayo.xlsx.
//   - Confirm Enero / Febrero / Marzo / Abril / MAYO sheets exist.
//   - Hash the file (sha256) and record the hash in reports/.
//   - Per sheet (excluding PROMEDIOS per user direction 2026-04-23): emit the
//     used range, row count, column count, non-empty cell count, and a first
//     guess at block count via "STATUS:" markers (matching the pattern used
//     by the legacy import-excel-january.ts).
//
// PROMEDIOS is intentionally excluded from ETL processing (user direction
// 2026-04-23: "No new data that I can see, all pulled from month pages.
// This sheet is Octavio's way of calculating YTD KPIs. Ignore it for
// processing."). It is still enumerated here for completeness.
//
// Read-only. Makes no DB connection. Writes two report files under reports/.
// Safe to run any time.
//
// Usage:  npx tsx scripts/phase-0-1-mayo-xlsx-inventory.ts
// ============================================================================

import * as XLSX from "xlsx";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

const MAYO_PATH = path.join(process.cwd(), "Mayo.xlsx");
const REPORTS_DIR = path.join(process.cwd(), "reports");

const EXPECTED_MONTH_SHEETS = ["Enero", "Febrero", "Marzo", "Abril", "MAYO"];
const EXCLUDED_SHEETS = ["PROMEDIOS"]; // derived YTD KPIs, not source data

type SheetInventory = {
  name: string;
  isExcluded: boolean;
  usedRange: string | null;
  rowCount: number;
  colCount: number;
  nonEmptyCells: number;
  statusMarkerCount: number;
  statusMarkerRows: number[];
  firstNonEmptyRow: number | null;
  lastNonEmptyRow: number | null;
};

function sha256(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function inventorySheet(wb: XLSX.WorkBook, name: string): SheetInventory {
  const ws = wb.Sheets[name];
  const isExcluded = EXCLUDED_SHEETS.includes(name);

  if (!ws) {
    return {
      name,
      isExcluded,
      usedRange: null,
      rowCount: 0,
      colCount: 0,
      nonEmptyCells: 0,
      statusMarkerCount: 0,
      statusMarkerRows: [],
      firstNonEmptyRow: null,
      lastNonEmptyRow: null,
    };
  }

  const ref = ws["!ref"] ?? null;
  const range = ref ? XLSX.utils.decode_range(ref) : null;
  const rowCount = range ? range.e.r - range.s.r + 1 : 0;
  const colCount = range ? range.e.c - range.s.c + 1 : 0;

  let nonEmptyCells = 0;
  let firstNonEmptyRow: number | null = null;
  let lastNonEmptyRow: number | null = null;
  const statusMarkerRows: number[] = [];

  if (range) {
    for (let r = range.s.r; r <= range.e.r; r++) {
      let rowHasContent = false;
      let rowHasStatus = false;
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (cell && cell.v !== null && cell.v !== undefined && cell.v !== "") {
          nonEmptyCells++;
          rowHasContent = true;
          const txt = String(cell.v).toUpperCase();
          if (txt.includes("STATUS:") || txt.startsWith("STATUS")) {
            rowHasStatus = true;
          }
        }
      }
      if (rowHasContent) {
        if (firstNonEmptyRow === null) firstNonEmptyRow = r + 1; // 1-indexed for human report
        lastNonEmptyRow = r + 1;
      }
      if (rowHasStatus) statusMarkerRows.push(r + 1);
    }
  }

  return {
    name,
    isExcluded,
    usedRange: ref,
    rowCount,
    colCount,
    nonEmptyCells,
    statusMarkerCount: statusMarkerRows.length,
    statusMarkerRows,
    firstNonEmptyRow,
    lastNonEmptyRow,
  };
}

function formatReport(
  filePath: string,
  fileHash: string,
  fileBytes: number,
  allSheetNames: string[],
  inventories: SheetInventory[],
  expectedMissing: string[],
  unexpectedPresent: string[]
): string {
  const now = new Date().toISOString();
  const lines: string[] = [];

  lines.push("# Mayo.xlsx — Phase 0.1 Structural Inventory");
  lines.push("");
  lines.push(`**Generated:** ${now}`);
  lines.push(`**File:** \`${filePath}\``);
  lines.push(`**Size:** ${fileBytes.toLocaleString()} bytes`);
  lines.push(`**SHA-256:** \`${fileHash}\``);
  lines.push("");
  lines.push("This inventory is the Phase 0.1 artifact per `RECONCILIATION_PLAN_2026_JAN_MAY.md §3`.");
  lines.push("It is **read-only**; no cell values are persisted, no prod mutation occurs.");
  lines.push("");

  lines.push("## 1. Sheet presence check");
  lines.push("");
  lines.push(`**All sheet names in workbook:** ${allSheetNames.join(", ")}`);
  lines.push("");
  lines.push(`**Expected monthly sheets:** ${EXPECTED_MONTH_SHEETS.join(", ")}`);
  lines.push(`**Excluded from ETL processing (per user direction 2026-04-23):** ${EXCLUDED_SHEETS.join(", ")}`);
  lines.push("");
  if (expectedMissing.length > 0) {
    lines.push(`**⚠️  MISSING expected sheets:** ${expectedMissing.join(", ")}`);
    lines.push("");
  } else {
    lines.push("✓ All expected monthly sheets present.");
    lines.push("");
  }
  if (unexpectedPresent.length > 0) {
    lines.push(`**ℹ️  Unexpected additional sheets:** ${unexpectedPresent.join(", ")}`);
    lines.push("");
  }

  lines.push("## 2. Per-sheet inventory");
  lines.push("");
  lines.push("| Sheet | ETL? | Used range | Rows | Cols | Non-empty cells | STATUS markers | First-last row |");
  lines.push("|-------|------|------------|------|------|-----------------|----------------|----------------|");
  for (const inv of inventories) {
    const etl = inv.isExcluded ? "excluded" : "yes";
    lines.push(
      `| ${inv.name} | ${etl} | ${inv.usedRange ?? "-"} | ${inv.rowCount} | ${inv.colCount} | ${inv.nonEmptyCells} | ${inv.statusMarkerCount} | ${inv.firstNonEmptyRow ?? "-"}–${inv.lastNonEmptyRow ?? "-"} |`
    );
  }
  lines.push("");

  lines.push("## 3. STATUS marker rows per sheet");
  lines.push("");
  lines.push("The legacy `import-excel-january.ts` detects blocks by finding rows whose cells contain the text `STATUS:` or `STATUS`. This table surfaces those rows so block boundaries can be eyeballed before Phase A.");
  lines.push("");
  for (const inv of inventories) {
    const tag = inv.isExcluded ? " (EXCLUDED)" : "";
    lines.push(`### ${inv.name}${tag}`);
    if (inv.statusMarkerRows.length === 0) {
      lines.push("No STATUS markers detected (may use a different block convention — investigate in Phase A).");
    } else {
      lines.push(`STATUS marker rows: ${inv.statusMarkerRows.join(", ")}`);
    }
    lines.push("");
  }

  lines.push("## 4. Next steps");
  lines.push("");
  lines.push("- Phase 0.1a: read the Enero sheet inside `Mayo.xlsx` and compare against the Jan prod DB (flag-only per directive 8). Any divergence goes into `reports/january-divergence-YYYY-MM-DD.md`.");
  lines.push("- Phase A (Febrero): full cell inventory of the Febrero sheet → `docs/ssot/febrero-2026-cell-inventory.md`.");
  lines.push("- If SSOT hygiene issues appear in any month's sheet (stale literals, back-solves, cross-sheet refs), Phase B pauses that month per directive 9 until the CFO edits `Mayo.xlsx` and re-saves.");
  lines.push("");
  lines.push("---");
  lines.push("*End of Phase 0.1 inventory report.*");

  return lines.join("\n") + "\n";
}

function main() {
  if (!fs.existsSync(MAYO_PATH)) {
    console.error(`✗ Mayo.xlsx not found at ${MAYO_PATH}`);
    process.exit(1);
  }

  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  const stat = fs.statSync(MAYO_PATH);
  const fileHash = sha256(MAYO_PATH);

  console.log("");
  console.log("=".repeat(78));
  console.log(" Phase 0.1 — Mayo.xlsx structural inventory");
  console.log("=".repeat(78));
  console.log(` File:   ${MAYO_PATH}`);
  console.log(` Size:   ${stat.size.toLocaleString()} bytes`);
  console.log(` SHA256: ${fileHash}`);
  console.log("");

  const wb = XLSX.readFile(MAYO_PATH);
  const allSheetNames = wb.SheetNames.slice();
  console.log(` Sheets (${allSheetNames.length}): ${allSheetNames.join(", ")}`);
  console.log("");

  const expectedMissing = EXPECTED_MONTH_SHEETS.filter(
    (n) => !allSheetNames.includes(n)
  );
  const knownNames = new Set([...EXPECTED_MONTH_SHEETS, ...EXCLUDED_SHEETS]);
  const unexpectedPresent = allSheetNames.filter((n) => !knownNames.has(n));

  if (expectedMissing.length > 0) {
    console.error(`⚠️  MISSING expected sheets: ${expectedMissing.join(", ")}`);
  } else {
    console.log(" ✓ All expected monthly sheets present.");
  }
  if (unexpectedPresent.length > 0) {
    console.log(` ℹ️  Unexpected additional sheets: ${unexpectedPresent.join(", ")}`);
  }
  console.log("");

  const inventories: SheetInventory[] = allSheetNames.map((n) =>
    inventorySheet(wb, n)
  );

  for (const inv of inventories) {
    const tag = inv.isExcluded ? " (EXCLUDED)" : "";
    console.log(
      `  ${inv.name}${tag}: range=${inv.usedRange ?? "-"} rows=${inv.rowCount} cols=${inv.colCount} cells=${inv.nonEmptyCells} STATUS=${inv.statusMarkerCount}`
    );
  }
  console.log("");

  // Write artifacts
  const metaPath = path.join(REPORTS_DIR, `mayo-xlsx-${fileHash}.meta`);
  const metaBody =
    `file: Mayo.xlsx\n` +
    `size: ${stat.size}\n` +
    `sha256: ${fileHash}\n` +
    `mtime: ${stat.mtime.toISOString()}\n` +
    `sheets: ${allSheetNames.join(",")}\n` +
    `expected_missing: ${expectedMissing.join(",") || "(none)"}\n` +
    `unexpected_present: ${unexpectedPresent.join(",") || "(none)"}\n`;
  fs.writeFileSync(metaPath, metaBody);
  console.log(` → wrote ${metaPath}`);

  const reportPath = path.join(REPORTS_DIR, "phase-0-1-mayo-xlsx-inventory.md");
  const reportBody = formatReport(
    MAYO_PATH,
    fileHash,
    stat.size,
    allSheetNames,
    inventories,
    expectedMissing,
    unexpectedPresent
  );
  fs.writeFileSync(reportPath, reportBody);
  console.log(` → wrote ${reportPath}`);

  console.log("");
  console.log("=".repeat(78));
  console.log(" Done. No mutations; two report files written.");
  console.log("=".repeat(78));
  console.log("");
}

main();
