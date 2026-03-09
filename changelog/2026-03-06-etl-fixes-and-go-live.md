# Changelog — 2026-03-06: ETL Fixes & Go-Live Infrastructure

## Summary

Fixed Supabase connectivity (IPv4), resolved 6 Excel import discrepancies through
iterative debugging, wiped and re-imported all production data with corrected counts,
and documented the full ETL complexity in `docs/etl-complexity-report.md`.

---

## Infrastructure

### Supabase Connectivity Fix
- **Problem 1**: `db.oghjrudsurmkhzmoryfy.supabase.co` (Direct connection) does not
  resolve over IPv4, which Vercel serverless functions require.
- **Problem 2**: Session pooler (port 5432) hit `MaxClientsInSessionMode` under
  concurrent serverless function invocations.
- **Fix**: Switched `DATABASE_URL` to the Transaction pooler (port 6543) with
  `pgbouncer=true&connection_limit=1`. Transaction pooler is designed for serverless
  and supports many more concurrent clients via PgBouncer.
- Updated `.env` and Vercel environment variables.

### Database Reset & Re-Import
- Wiped all existing data (truncate cascade) to ensure clean state.
- Ran `prisma db push` (schema already in sync).
- Re-seeded admin user, clients, suppliers, exchange rate, export cost config, farms.
- Re-ran `scripts/import-excel.ts` with all 6 fixes applied.

---

## ETL Fixes (scripts/import-excel.ts)

### Fix 1: KFINOS Column Offset Mismatch
- Column groups were shifted by 2 positions (dateCol started at 2 instead of 0).
- Data start row was 4 instead of 1.
- **Result**: 61 account entries imported (was 52).

### Fix 2: Phantom Total Row Detection
- Monthly sheet contract blocks end with a summary row containing PUNTAJE + SACOS
  but no CLIENTE/CONTRATO. These were being imported as real contracts.
- Two-layer detection: (a) empty client+contract with 2+ contracts above = total;
  (b) post-process: if last row's sacos equals sum of all others, remove it.
- **Result**: ~15 phantom contracts eliminated.

### Fix 3: Client Sheet Deduplication
- Client sheets (SERENGETTI, SUCAFINA SPECIALTY, onyx) reorganize the same data
  already present in monthly sheets. Contracts were being imported twice.
- Client sheet contracts with real P-numbers already imported from monthly sheets
  are now skipped. Monthly duplicates (same P-number in different blocks) get a
  suffix (e.g., `P40029-FEB3`).
- **Result**: 5 duplicate contracts eliminated.

### Fix 4: Client Sheet Shipment Name Collisions
- All SERENGETTI blocks got the same shipment name, so Blocks 2 and 3 were skipped
  along with their MP and subproducto data.
- Multi-block client sheets now get suffixed names: `SERENGETTI - Bloque 1`, etc.
- **Result**: 25 shipments imported (was 23). MP and subproducto counts corrected.

### Fix 5: Non-Numeric Puntaje (SHB Grade)
- Sopex contract (Robusta) has `puntaje = "SHB"` (Strictly Hard Bean). `safeNum("SHB")`
  returned 0, triggering the break guard and skipping the contract and its MP row.
- Break guard now only fires when puntaje is 0 AND the raw cell is empty.
- MP guard relaxed: `oro === 0` is the only skip condition (removed punteo check).
- **Result**: Sopex contract and MP row both import.

### Fix 6: Sopex Client Added
- Added `sopex: { name: "Sopex", code: "SPX" }` to CLIENT_MAP.

---

## Post-Import: Contract Recalculation

The import script was creating contracts with raw pricing data (`precioBolsa`,
`diferencial`) but not computing downstream financial fields (`facturacionLbs`,
`facturacionKgs`, `gastosExport`, `totalPagoQTZ`, etc.) and not aggregating
shipment-level totals. This caused the dashboard to show all zeros.

- Added a recalculation pass at the end of `scripts/import-excel.ts` that computes
  all contract fields (using Decimal.js) and aggregates shipment totals.
- Created `scripts/recalc.ts` as a standalone tool to re-run calculations without
  re-importing data.

## Prisma Client Generation for Vercel

- Added `postinstall: "prisma generate"` to `package.json` — ensures the Prisma
  Client is generated on Vercel after `npm install`.
- Updated `build` script to `prisma generate && next build` as belt-and-suspenders.

## Login Error Logging

- Added `console.error` to the login route catch block so actual errors appear in
  Vercel function logs instead of being silently swallowed.

---

## File Changes

| File | Action | Description |
|---|---|---|
| `.env` | Modified | DATABASE_URL switched to Transaction pooler (port 6543) |
| `package.json` | Modified | Added postinstall hook, updated build script |
| `scripts/import-excel.ts` | Modified | All 6 ETL fixes + recalculation pass |
| `scripts/recalc.ts` | Created | Standalone recalculation script |
| `src/app/api/auth/login/route.ts` | Modified | Added error logging |
| `src/lib/services/excel-import.ts` | Deleted | Replaced by scripts/import-excel.ts |
| `docs/etl-complexity-report.md` | Created | Exhaustive documentation of all discrepancies |
| `go-live-checklist.md` | Modified | Updated with verified record counts |

---

## Final Production Data Counts

| Entity | Count | Delta vs Previous |
|---|---|---|
| Clients | 12 | +1 (Sopex added) |
| Shipments | 25 | +2 |
| Contracts | 46 | -16 (dedup + phantom removal) |
| Materia Prima | 53 | +5 |
| Subproductos | 25 | +2 |
| Purchase Orders | 2 | 0 |
| Account Entries | 61 | +9 |

One contract delta remains (-1 vs spreadsheet's 47): an ambiguous row in the onyx
sheet that matches the phantom total pattern. See `docs/etl-complexity-report.md`
section 2 for details.
