# Changelog — 2026-04-24: Marzo 2026 SSOT Reconciliation

## Summary

Reconciled Marzo 2026 to match the `Marzo` sheet inside `Mayo.xlsx` cell-for-cell in Supabase prod. Second month in the Feb → Mayo clean-slate ETL sequence. First month to exercise the duplicate-contract-number split pattern (`POUS-00003761` → `-01` / `-02`) and the multi-client variant-map resolution in one script. Client-variant-map infrastructure (landed with Febrero) used live for 3 clients with zero ambiguity.

**Tests:** 39/39 green (was 32 — added 7 Marzo cases). `tsc --noEmit` clean. **Prod DB:** 1 Shipment + 6 Contracts + 6 MP + 6 MP allocations + 1 Subproducto inserted; 5 legacy Mar shipments + 15 legacy contracts + 16 legacy MP + 5 legacy subproductos cascade-deleted in the same transaction. **Phase D parity:** 110 OK / 0 MISMATCH. **Sheet hash:** `d5cc26b3afc0d772c07cff9105e2ca9d0e2b966e84247bacf44b5c9e3e85f87f` (unchanged since Phase 0.1 — CFO has not edited Mayo.xlsx since 2026-04-24 AM).

---

## Notable differences vs Febrero

1. **Posición date serials.** Marzo's column C (`POSICION`) stores Excel date serials (e.g. `46143` = 2026-05-01), not the text `May-26` that Febrero used. Added [`posicionString()`](../scripts/etl-marzo-2026.ts) helper that normalizes both formats to `Mmm-YY` before `mapPosicionBolsa()`. All 6 contracts correctly resolve to `PosicionBolsa.MAY`.
2. **Multi-client month.** Three distinct sheet clients (`Serengetti`, `Opal`, `Onyx`). All three resolved via tier-1 exact variant-map match — zero Levenshtein / substring fallback.
3. **Duplicate contract split.** `POUS-00003761` appears on sheet rows 9 and 10 with different diferencials (50 vs 38) and different sacos (100/150 vs 175/262.5). Phase C split into `POUS-00003761-01` / `POUS-00003761-02` per user Q2 answer. Positional MP pairing preserved both contracts' own `montoCredito`.
4. **Region-typo tolerance.** Sheet row 9 has `lote="Orgnaico"` (typo). Added `includes("ORGNAIC")` fallback to `mapRegions` so POUS-00003761-01 correctly tags `CoffeeRegion.ORGANICO`.
5. **Prisma transaction timeout.** Default 5-second interactive-transaction timeout is insufficient for Marzo's workload (5 legacy shipment cascade + 6 contract / MP / MPA inserts + 6 contract updates + 1 AuditLog). Raised to `timeout: 60000, maxWait: 15000` in the Marzo ETL's `$transaction` call; Mayo will inherit the same setting.
6. **Clean-slate scope extended.** Febrero's clean-slate only swept by-contractNumber orphans. Marzo's ETL also sweeps Mar 2026 shipment cascade (5 shipments with 15 contracts / 16 MP / 5 subproductos from the pre-reconciliation importer). Directive-1 guard asserts no Jan shipments in the deletion set.

---

## SSOT structure

Same three-section layout as Febrero:

- **Contract table** rows 6–11 (6 contracts), TOTAL at row 12.
- **Materia Prima block** rows 14–20, TOTAL at row 21.
- **Subproducto + right-side P&L** rows 22–25: `MATERIA PRIMA` (−Q 3,881,936.52-ish), `COMISION COMPRA/VENTA` (−Q 47,334.38), `SUBPRODUCTOS` (+Q 202,861.61), `UTILIDAD BRUTA` Q 323,430.77 / 6.01 %.

Cross-sheet references flagged (intentional per user Q8):
- `M15 =Enero!M13` — PROM. Q pulls Enero's per-qq average (Q 1,782.34).
- `M24 =Enero!M20` — subproducto precio sin IVA pulls Enero's (Q 2,049.11).

No `#REF!` errors. Zero formula-vs-value mismatches.

---

## Phase C — mutations

Single transaction, `timeout: 60s`, `maxWait: 15s`.

| Step | Count | Detail |
|------|-------|--------|
| DELETE orphan contracts by number | 0 | None existed — 6 brand-new Mar contract numbers |
| DELETE Mar 2026 shipments cascade | 5 shipments · 15 contracts · 16 MP · 5 subproductos | Legacy pre-reconciliation importer state |
| INSERT Shipment | 1 | "Marzo 2026 - Bloque único" (status=EMBARCADO, numContainers=6, regions="SANTA_ROSA/HUEHUETENANGO/ORGANICO") |
| INSERT Contract | 6 | P40030, P40024, POUS-00003748, POUS-00003761-01, POUS-00003761-02, 1002605 — all `exportingEntity=EXPORTADORA`, `status=FIJADO`, `posicionBolsa=MAY`, `tipoCambio=7.65`, `cosecha=25-26` |
| INSERT MateriaPrima | 6 | rend=1.32 each; pergo 544.50 / 544.50 / 544.50 / 198 / 346.5 / 544.50; promQ 1,782.34 |
| INSERT MateriaPrimaAllocation | 6 | 1:1 positional, `quintalesAllocated=null` |
| INSERT Subproducto | 1 | 3 contenedores × 33 qq × Q 2,049.11 = Q 202,861.61 |
| UPDATE Contract (derived) | 6 | `calculateContract(..., montoCredito=own MP totalMP)` |
| CALL recalculateShipment | 1 | outside tx, on the new shipment id |
| INSERT AuditLog | 1 | `action=ETL_MONTH`, records sheet hash + suffixedContracts list + all deletedCounts |

Shipment id: `cmocf3oka00003qla4dhx94np`.

---

## Phase D — post-ETL parity

[scripts/phase-d-marzo-2026-parity.ts](../scripts/phase-d-marzo-2026-parity.ts).

**Result: 110 OK / 0 MISMATCH.**

| Metric | Sheet | DB | Δ |
|--------|-------|-----|----|
| Utilidad Bruta | Q 323,430.77 | Q 323,430.79 | +Q 0.02 (within ±0.03) |
| Margen Bruto | 6.01 % | 6.01 % | exact |

**Heads-up (business, not ETL):** Mar margen at 6.01 % is well below Octavio's 10–12 % target (business rules §1.11). This is a real business signal, not a calc/import bug — the Phase D diff confirms the app faithfully reflects what the sheet says. A ping to Octavio may be warranted; out of ETL scope.

---

## Phase E — regression gate

[src/lib/services/__tests__/marzo-2026-ssot.test.ts](../src/lib/services/__tests__/marzo-2026-ssot.test.ts) — 7 tests:

- 6 per-contract cases (full N/O/Q/R/S/T/V chain each).
- 1 shipment-aggregate case: `calculateShipmentMargin` → utilidadBruta Q 323,430.77 / margenBruto 6.01 %.

Full suite: **39/39 passing** (23 calculations + 6 Jan + 3 Feb + 7 Mar). `tsc --noEmit` clean.

---

## Files changed

```
Created:
  changelog/2026-04-24-marzo-2026-reconciliation.md                 (this file)
  docs/ssot/marzo-2026-cell-inventory.md                            (Phase A)
  reports/phase-a-marzo-2026.md                                     (Phase A)
  reports/dry-run-marzo-2026.md                                     (Phase C dry-run)
  reports/execute-marzo-2026.md                                     (Phase C execute)
  reports/phase-d-marzo-2026-2026-04-24.md                          (Phase D parity)
  scripts/etl-marzo-2026.ts                                         (Phase C ETL)
  scripts/phase-a-marzo-2026.ts                                     (Phase A)
  scripts/phase-d-marzo-2026-parity.ts                              (Phase D)
  src/lib/services/__tests__/marzo-2026-ssot.test.ts                (regression gate)
```

No schema changes. No calc-engine changes. No modifications to the client-variant-map (3 new variants seen — `Serengetti`, `Opal`, `Onyx` — but all already listed as variants under their respective canonicals from the Febrero-era seed).

---

## Hard gate

Abril cannot start Phase A until:
- `pnpm vitest run` remains green (currently 39/39 ✓)
- Prod reflects the Marzo state recorded above (shipment `cmocf3oka00003qla4dhx94np`, utilidad Q 323,430.79, margen 6.01 %)

---

## Next

Abril begins on user go-ahead. Known complications to watch for per earlier conversation:

- **Stock-lock block.** Abril has a second block at the bottom with `Plateau Harvest` / `GT260360` / client `Stocklot`, two rows same name distinguished by diferencial. Entity `STOCK_LOCK`, no MP, no subproducto (business rules §1.2).
- **`#REF!` errors in stock-lock P&L.** Screenshots surfaced broken formulas on `COSTO FINANCIERO`, `UTILIDAD SIN CF`, `TOTAL PAGO` for both stock-lock rows. Per directive 9, Phase B will pause Abril until the CFO fixes those cells and re-saves `Mayo.xlsx`.
- **Plateau Harvest not in variant map.** Will be flagged as unresolved; I'll propose adding a new canonical block and wait for user confirmation before appending.
