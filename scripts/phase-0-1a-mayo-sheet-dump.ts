// ============================================================================
// Phase 0.1a — Mayo.xlsx per-sheet cell dumper (read-only)
// ============================================================================
// Dumps every non-empty cell of the monthly sheets (Enero, Febrero, Marzo,
// Abril, MAYO) to human-readable markdown reports under reports/. PROMEDIOS
// is excluded per user direction 2026-04-23.
//
// For each cell: row, column letter, cell address, value, formula (if any),
// type. This gives me full visibility into the sheet's structure so I can
// plan Phase A correctly (especially: is the layout block-based with MP +
// subproducto rows like the old Enero.xlsx, or flat one-row-per-contract?).
//
// Read-only. No DB. No mutations.
//
// Usage:  npx tsx scripts/phase-0-1a-mayo-sheet-dump.ts
// ============================================================================

import * as XLSX from "xlsx";
import * as fs from "node:fs";
import * as path from "node:path";

const MAYO_PATH = path.join(process.cwd(), "Mayo.xlsx");
const REPORTS_DIR = path.join(process.cwd(), "reports");
const SHEETS_TO_DUMP = ["Enero", "Febrero", "Marzo", "Abril", "MAYO"];

function colLetter(c: number): string {
  return XLSX.utils.encode_col(c);
}

function dumpSheet(wb: XLSX.WorkBook, name: string): string {
  const ws = wb.Sheets[name];
  if (!ws) return `# ${name}\n\n(sheet not found)\n`;

  const ref = ws["!ref"];
  if (!ref) return `# ${name}\n\n(empty sheet)\n`;

  const range = XLSX.utils.decode_range(ref);
  const lines: string[] = [];

  lines.push(`# ${name} — full non-empty cell dump`);
  lines.push("");
  lines.push(`**Used range:** \`${ref}\``);
  lines.push(`**Rows:** ${range.e.r - range.s.r + 1}, **Cols:** ${range.e.c - range.s.c + 1}`);
  lines.push("");

  // Gather rows with any content + track per-row contents
  type CellOut = { addr: string; col: string; v: unknown; f?: string; t?: string };
  const rowCells = new Map<number, CellOut[]>();
  let nonEmpty = 0;
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: CellOut[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) continue;
      if (cell.v === null || cell.v === undefined || cell.v === "") continue;
      row.push({
        addr,
        col: colLetter(c),
        v: cell.v,
        f: cell.f,
        t: cell.t,
      });
      nonEmpty++;
    }
    if (row.length > 0) rowCells.set(r + 1, row); // 1-indexed row number
  }

  lines.push(`**Non-empty cells:** ${nonEmpty}`);
  lines.push("");

  lines.push("## Cells by row");
  lines.push("");
  lines.push("Format: `ADDR [t]: value (f=formula)` — `t` cell type (n=num, s=str, b=bool, d=date, e=err), formula shown when set.");
  lines.push("");

  for (const [rowNum, cells] of Array.from(rowCells.entries()).sort(
    (a, b) => a[0] - b[0]
  )) {
    lines.push(`### Row ${rowNum}`);
    for (const c of cells) {
      const vs =
        typeof c.v === "string"
          ? JSON.stringify(c.v)
          : c.v instanceof Date
            ? c.v.toISOString()
            : String(c.v);
      const fs = c.f ? ` (f=${c.f})` : "";
      const tn = c.t ? ` [${c.t}]` : "";
      lines.push(`- \`${c.addr}\`${tn}: ${vs}${fs}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function main() {
  if (!fs.existsSync(MAYO_PATH)) {
    console.error(`✗ Mayo.xlsx not found at ${MAYO_PATH}`);
    process.exit(1);
  }
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const wb = XLSX.readFile(MAYO_PATH);

  for (const name of SHEETS_TO_DUMP) {
    const md = dumpSheet(wb, name);
    const outPath = path.join(REPORTS_DIR, `peek-${name.toLowerCase()}.md`);
    fs.writeFileSync(outPath, md);
    console.log(`  → wrote ${outPath}`);
  }
  console.log("");
  console.log("Done. Open reports/peek-*.md to inspect.");
}

main();
