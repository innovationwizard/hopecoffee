# Mayo.xlsx — Phase 0.1 Structural Inventory

**Generated:** 2026-04-24T02:04:55.428Z
**File:** `/Users/jorgeluiscontrerasherrera/Documents/_git/hopecoffee/Mayo.xlsx`
**Size:** 60,842 bytes
**SHA-256:** `d5cc26b3afc0d772c07cff9105e2ca9d0e2b966e84247bacf44b5c9e3e85f87f`

This inventory is the Phase 0.1 artifact per `RECONCILIATION_PLAN_2026_JAN_MAY.md §3`.
It is **read-only**; no cell values are persisted, no prod mutation occurs.

## 1. Sheet presence check

**All sheet names in workbook:** Enero, Febrero, Marzo, Abril, MAYO, PROMEDIOS

**Expected monthly sheets:** Enero, Febrero, Marzo, Abril, MAYO
**Excluded from ETL processing (per user direction 2026-04-23):** PROMEDIOS

✓ All expected monthly sheets present.

## 2. Per-sheet inventory

| Sheet | ETL? | Used range | Rows | Cols | Non-empty cells | STATUS markers | First-last row |
|-------|------|------------|------|------|-----------------|----------------|----------------|
| Enero | yes | A3:W39 | 37 | 23 | 284 | 0 | 5–38 |
| Febrero | yes | A3:W23 | 21 | 23 | 137 | 0 | 5–18 |
| Marzo | yes | A3:W27 | 25 | 23 | 253 | 0 | 4–25 |
| Abril | yes | A2:W40 | 39 | 23 | 367 | 0 | 3–38 |
| MAYO | yes | A2:W41 | 40 | 23 | 481 | 0 | 3–39 |
| PROMEDIOS | excluded | A1:Y41 | 41 | 25 | 755 | 0 | 3–40 |

## 3. STATUS marker rows per sheet

The legacy `import-excel-january.ts` detects blocks by finding rows whose cells contain the text `STATUS:` or `STATUS`. This table surfaces those rows so block boundaries can be eyeballed before Phase A.

### Enero
No STATUS markers detected (may use a different block convention — investigate in Phase A).

### Febrero
No STATUS markers detected (may use a different block convention — investigate in Phase A).

### Marzo
No STATUS markers detected (may use a different block convention — investigate in Phase A).

### Abril
No STATUS markers detected (may use a different block convention — investigate in Phase A).

### MAYO
No STATUS markers detected (may use a different block convention — investigate in Phase A).

### PROMEDIOS (EXCLUDED)
No STATUS markers detected (may use a different block convention — investigate in Phase A).

## 4. Next steps

- Phase 0.1a: read the Enero sheet inside `Mayo.xlsx` and compare against the Jan prod DB (flag-only per directive 8). Any divergence goes into `reports/january-divergence-YYYY-MM-DD.md`.
- Phase A (Febrero): full cell inventory of the Febrero sheet → `docs/ssot/febrero-2026-cell-inventory.md`.
- If SSOT hygiene issues appear in any month's sheet (stale literals, back-solves, cross-sheet refs), Phase B pauses that month per directive 9 until the CFO edits `Mayo.xlsx` and re-saves.

---
*End of Phase 0.1 inventory report.*
