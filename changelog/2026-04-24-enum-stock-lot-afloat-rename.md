# Changelog — 2026-04-24: `STOCK_LOCK` → `STOCK_LOT_AFLOAT` + 4 sibling states

## Summary

Fixed a voice-to-text transcription error baked into the domain model since the app's inception. The `ExportingEntity` enum value `STOCK_LOCK` was originally meant to be `STOCK_LOT` (per CFO conversation); it's now renamed to the unambiguous, industry-standard `STOCK_LOT_AFLOAT` and four sibling states are provisioned for future growth.

**Tests:** 50/50 green. `tsc --noEmit` clean. **DB:** enum value renamed atomically via `ALTER TYPE … RENAME VALUE` (no `--accept-data-loss`, no intermediate state, no row data disturbed). Column `Contract.stockLockCostPerQQ` also renamed to `stockLotAfloatCostPerQQ` for consistency. See [docs/rename-stock-lock-to-stock-lot-afloat.md](../docs/rename-stock-lock-to-stock-lot-afloat.md) for the exhaustive file-by-file checklist.

---

## Why

From the user's own origin story: the CFO dictated "stock lot" during the domain-model walkthrough; voice-to-text transcribed it as "stock lock" and that typo landed in the Prisma enum, propagated through ~25 files, and persisted through the January reconciliation. The term is not a real coffee-trade concept.

"Stock lot" alone is ambiguous — in coffee trading there are several lifecycle states (spot / afloat / landed / loading / consigned). The canonical industry term for the trade that HopeCoffee actually brokers — buy-FOB and sell-FOB while the cargo is on a vessel in transit between origin and destination — is **afloat**. NYBOT/ICE coffee contracts, ICO publications, and every commodity trade desk use "afloat stock" as a standard term.

---

## Final taxonomy

```prisma
enum ExportingEntity {
  EXPORTADORA          // Main export company
  FINCA_DANILANDIA     // Farm entity
  STOCK_LOT_AFLOAT     // Buy-FOB + Sell-FOB while cargo is afloat in transit
  STOCK_LOT_SPOT       // Warehoused at origin, sold from stock
  STOCK_LOT_LANDED     // Arrived at destination warehouse
  STOCK_LOT_LOADING    // At origin port being loaded onto a vessel
  STOCK_LOT_CONSIGNED  // On consignment with a broker
}
```

Active use today: 2 Abril contracts (`GT260360-01`, `GT260360-02`) carry `STOCK_LOT_AFLOAT`. The other four sibling values are schema-ready; no contracts currently use them.

---

## Migration — how it was done

Clean path via Postgres native `ALTER TYPE` — no data disturbance:

```sql
ALTER TYPE "ExportingEntity" RENAME VALUE 'STOCK_LOCK' TO 'STOCK_LOT_AFLOAT';
ALTER TYPE "ExportingEntity" ADD VALUE IF NOT EXISTS 'STOCK_LOT_SPOT';
ALTER TYPE "ExportingEntity" ADD VALUE IF NOT EXISTS 'STOCK_LOT_LANDED';
ALTER TYPE "ExportingEntity" ADD VALUE IF NOT EXISTS 'STOCK_LOT_LOADING';
ALTER TYPE "ExportingEntity" ADD VALUE IF NOT EXISTS 'STOCK_LOT_CONSIGNED';

ALTER TABLE contracts RENAME COLUMN "stockLockCostPerQQ" TO "stockLotAfloatCostPerQQ";
```

The rename preserves row data — the 2 Abril rows that were `'STOCK_LOCK'` are now `'STOCK_LOT_AFLOAT'` atomically. Prisma schema + client regenerated to match.

Then a codebase-wide sweep (25 files, ~109 mentions found; code + forward-facing docs updated; historical records left verbatim for accuracy).

---

## Files touched

### Schema & data
- `prisma/schema.prisma` — enum definition + comments + `stockLotAfloatCostPerQQ` field
- Supabase prod — enum rename + column rename (both via raw `ALTER`)

### Active TypeScript
- `src/lib/services/calculations.ts` — `ContractInput.stockLotAfloatCostPerQQ`, `ContractCalculation.stockLotAfloatCost`, calc branch, variable `utilAfterStockLotAfloatCost`
- `src/lib/services/__tests__/calculations.test.ts` — stock-lot-afloat COGS branch test identifiers
- `src/lib/services/__tests__/abril-2026-ssot.test.ts` — describe block + comments
- `src/lib/validations/schemas.ts` — puntaje / defectos comments
- `scripts/etl-abril-2026.ts` — enum reference, variable names (`stockLotAfloatContracts`, `isStockLotAfloat`), labels, audit-log entity string
- `scripts/phase-a-abril-2026.ts` — detection logic, variable names, report strings
- `scripts/phase-a-mayo-2026.ts` — header comment
- `scripts/phase-d-abril-2026-parity.ts` — comments + skip-reason strings
- `scripts/phase-a-january-diff.ts` — type union literal

### Forward-facing documentation
- `hopecoffee_business_rules.md` §1.2 — full rename + new sibling-states table + historical note
- `docs/client-variant-map.md` — Plateau Harvest canonical note
- `docs/lot-materia-prima-unification-plan.md` — Lab-scope exclusions
- `RECONCILIATION_PLAN_2026_JAN_MAY.md` — current plan

### Memory
- `feedback_importer_client_parenthesis.md` — schema-design note reference

### Historical (left verbatim — preserve state-at-time)
- `RECONCILIATION_PLAN.md` (January 2026 original)
- `docs/january-2026-reconciliation-session.md`
- `changelog/2026-04-15-january-2026-reconciliation.md`
- `changelog/2026-04-24-{marzo,abril,mayo}-2026-reconciliation.md`
- `reports/*` (all point-in-time artifacts)
- `docs/ssot/*` (cell inventories — "Stocklot" there is a sheet-literal, not our enum)
- `RECONCILIATION_OPEN_QUESTIONS.md`

---

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✓ clean |
| `npx vitest run` | ✓ 50 / 50 |
| Grep `STOCK_LOCK\|stockLock\|Stock Lock` in active code + forward-facing docs | ✓ zero matches |
| DB query: `SELECT * FROM contracts WHERE exportingEntity = 'STOCK_LOCK'` would error (enum value no longer exists) | ✓ |
| DB query: `SELECT COUNT(*) FROM contracts WHERE exportingEntity = 'STOCK_LOT_AFLOAT'` | ✓ returns 2 (GT260360-01/-02) |
| Prisma client TS type for `ExportingEntity` | ✓ includes `STOCK_LOT_AFLOAT` + 4 siblings |

---

## Sheet literal `"Stocklot"` — deliberately NOT renamed

The CFO's xlsx has the string literal `"Stocklot"` in column G of Abril rows 36-37. That's the sheet's cell content — the word Octavio typed into Excel — not our enum. It stays as-is. The ETL regex `/stocklot|stock\s*lock/i` that reads those cells is preserved; it matches sheet literals and is independent of the DB enum naming.

---

## Future: when new sibling states first appear in real data

When HopeCoffee signs its first `STOCK_LOT_SPOT` or `STOCK_LOT_LANDED` contract (etc.), the ETL should treat it the same way as `STOCK_LOT_AFLOAT` unless the CFO establishes a different cost/MP structure. The current calc branch (`stockLotAfloatCostPerQQ`) is named for the first-in-class; if other sibling states need distinct COGS handling, consider renaming the field to `stockLotCostPerQQ` (drop the `Afloat`) or adding per-state fields — decision deferred until the second sibling actually shows up in data.
