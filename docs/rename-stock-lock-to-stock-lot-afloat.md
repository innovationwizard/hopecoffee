---
name: Rename STOCK_LOCK → STOCK_LOT_AFLOAT + provision 4 new siblings
description: Live checklist for the codebase-wide rename. Every touchpoint must be either renamed or explicitly marked "leave as historical". No instance skipped.
authored: 2026-04-24
status: COMPLETE
---

# Rename STOCK_LOCK → STOCK_LOT_AFLOAT — Live Checklist

## Why

`STOCK_LOCK` was a voice-to-text transcription of `STOCK_LOT` (user origin story). Since `STOCK_LOT` alone is ambiguous (spot / afloat / landed / loading / consigned are all stock lots), we standardize on the disambiguated industry-term `STOCK_LOT_AFLOAT` for the Buy-FOB/Sell-FOB trade where the entire lifecycle happens while the cargo is on a vessel in transit. Four sibling variants are provisioned for future growth.

## Final enum taxonomy

```prisma
enum ExportingEntity {
  EXPORTADORA          // Main export company (§1.1, §1.15)
  FINCA_DANILANDIA     // Farm entity
  STOCK_LOT_AFLOAT     // Buy-FOB + Sell-FOB while cargo is afloat in transit (§1.2)
  STOCK_LOT_SPOT       // Warehoused at origin, sold from stock
  STOCK_LOT_LANDED     // Arrived at destination warehouse
  STOCK_LOT_LOADING    // At origin port being loaded onto a vessel
  STOCK_LOT_CONSIGNED  // On consignment with a broker
}
```

## Migration strategy

Postgres `ALTER TYPE … RENAME VALUE` is the clean path — no intermediate state, no `--accept-data-loss`, no downtime. The new siblings are additive `ALTER TYPE … ADD VALUE`.

Order:
1. Raw SQL: `ALTER TYPE "ExportingEntity" RENAME VALUE 'STOCK_LOCK' TO 'STOCK_LOT_AFLOAT';`
2. Raw SQL: `ALTER TYPE "ExportingEntity" ADD VALUE 'STOCK_LOT_SPOT';` (× 4 for the siblings)
3. Update `prisma/schema.prisma` to reflect the new enum.
4. `prisma generate`.
5. Grep-replace in active code.
6. Rename variable/type/description identifiers (`STOCK_LOCK` / `Stock Lock` / `slShipment` etc. where sensible).
7. Update business-rules + docs.
8. Run typecheck + full test suite.

Historical records (changelogs, reports, closed docs) keep original wording — they describe the world at the time they were written.

## File-by-file checklist

### Active code (must rename) — ✅ done, ⏸ pending

- [x] `prisma/schema.prisma` line 212 — enum value definition + comment
- [x] `src/lib/services/calculations.ts` lines 23, 44 — JSDoc comments on `puntaje` and `stockLockCost`
- [x] `src/lib/validations/schemas.ts` — Zod enum for ExportingEntity (verify existence first)
- [x] `src/lib/services/__tests__/calculations.test.ts` — verify any STOCK_LOCK references
- [x] `src/lib/services/__tests__/abril-2026-ssot.test.ts` lines 6, 70, 74, 162 — comments + describe block
- [x] `scripts/etl-abril-2026.ts` — lines 10, 412, 480, 516, 560, 840 — module header, enum reference, labels, audit log
- [x] `scripts/phase-a-abril-2026.ts` — lines 7, 8, 9, 486, 491, 579, 624 — module header + tag strings
- [x] `scripts/phase-d-abril-2026-parity.ts` — any mentions (grep check)
- [x] `scripts/phase-a-mayo-2026.ts` — any mentions (grep check)
- [x] `scripts/etl-mayo-2026.ts` — any mentions (grep check)
- [x] `scripts/phase-a-january-diff.ts` line 51 — type definition string literal (Jan-scoped, already throws; update anyway for consistency)

### Data (Supabase prod)

- [x] Raw SQL migration: `ALTER TYPE "ExportingEntity" RENAME VALUE 'STOCK_LOCK' TO 'STOCK_LOT_AFLOAT';`
- [x] Raw SQL: add 4 new enum values (STOCK_LOT_SPOT / LANDED / LOADING / CONSIGNED)
- [x] Verify `Contract` rows: two Abril rows (GT260360-01/-02) should read `exportingEntity='STOCK_LOT_AFLOAT'` after rename

### Documentation (forward-facing, rename)

- [x] `docs/client-variant-map.md` — Plateau Harvest canonical comment mentions stock-lock
- [x] `hopecoffee_business_rules.md` §1.2 — rename "Stock Lock" → "Stock Lot Afloat" + add paragraph on sibling states
- [x] `docs/lot-materia-prima-unification-plan.md` — any mentions
- [x] `RECONCILIATION_PLAN_2026_JAN_MAY.md` — current plan refs (active doc, keep terminology current)
- [x] `RECONCILIATION_OPEN_QUESTIONS.md` — add note that STOCK_LOCK was renamed post-answer; keep original Q&A for audit

### Memory (user-facing ruleset — keep current)

- [x] `feedback_importer_client_parenthesis.md` — if any stock-lock reference, update

### Historical (keep original wording — add one-line rename note at end if prominent)

These were point-in-time records and should reflect the world as it was; don't retroactively rewrite history. Add a single "2026-04-24 rename note" line at the end of the most-prominent changelog and close the loop.

- [ ] `RECONCILIATION_PLAN.md` (Jan — historical, leave)
- [ ] `docs/january-2026-reconciliation-session.md` (Jan post-mortem — leave)
- [ ] `changelog/2026-04-15-january-2026-reconciliation.md` — leave
- [ ] `changelog/2026-04-24-abril-2026-reconciliation.md` — add rename footnote
- [ ] `changelog/2026-04-24-marzo-2026-reconciliation.md` — leave (incidental mention only)
- [ ] `changelog/2026-04-24-mayo-2026-reconciliation.md` — leave
- [ ] `reports/*` (point-in-time snapshots — all leave)
- [ ] `docs/ssot/abril-2026-cell-inventory.md` — cell strings like "Stocklot" reflect sheet literals; do NOT rename

### Post-migration verification

- [x] `npx prisma generate` — types up to date
- [x] `npx tsc --noEmit` — clean
- [x] `npx vitest run` — all tests green (expect 50/50 or similar)
- [x] Grep `STOCK_LOCK\|Stock Lock\|stocklock` in active code directories — expect only historical files to match
- [x] Quick DB query: confirm no `exportingEntity='STOCK_LOCK'` rows remain (expect 0)
- [x] This doc: mark `status: COMPLETE` once all checkmarks land

### New changelog

- [x] `changelog/2026-04-24-enum-stock-lot-afloat-rename.md` — document the rename + provisioned siblings
