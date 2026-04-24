# Changelog — 2026-04-24: Febrero 2026 SSOT Reconciliation

## Summary

Reconciled the app's Febrero 2026 numbers to match the `Febrero` sheet inside `Mayo.xlsx` cell-for-cell in Supabase prod. First month in the Feb → Mayo clean-slate ETL sequence (strict sequential, hard gate per directive 11 of [RECONCILIATION_PLAN_2026_JAN_MAY.md](../RECONCILIATION_PLAN_2026_JAN_MAY.md)). Built shared client-variant-map infrastructure to prevent duplicate client creation across future months.

**Tests:** 32/32 green (was 29 — added 3 Febrero cases). `tsc --noEmit` clean. **Prod DB:** 1 Shipment + 2 Contracts + 2 MP + 2 MP allocations + 1 Subproducto inserted. **Phase D parity:** 38 OK / 0 MISMATCH. **Sheet hash recorded:** `d5cc26b3afc0d772c07cff9105e2ca9d0e2b966e84247bacf44b5c9e3e85f87f`.

---

## Trigger

Directive 11 (strict sequential Feb → Mayo). Phase 0 completed earlier the same day (seven legacy scripts Jan-scoped-and-renamed, `Mayo.xlsx` sheet inventory + hash, Jan-sheet divergence flag report). Febrero starts the per-month ETL sequence.

---

## Client-variant-map infrastructure (new)

Per the 2026-04-24 user directive: there are only a handful of distinct clients/importers in the business, and their sheet spellings drift (`SERENGETTI` vs `Serengetti` vs `Serengheti` typo). Never auto-create a duplicate; flag and ask on uncertainty.

- **[docs/client-variant-map.md](../docs/client-variant-map.md)** — live, append-only canonical map. Seeded with the 12 existing DB clients + Febrero's `SERENGETTI` variant under the `Serengetti` canonical.
- **[scripts/lib/client-variants.ts](../scripts/lib/client-variants.ts)** — shared helper. `loadVariantMap()` parses the markdown; `resolveStrict()` is the only resolver Phase C uses (blocks `--execute` if variant isn't mapped); `suggestFuzzy()` emits Levenshtein / substring hints for dry-run only.
- **Memory saved:** `feedback_client_variant_map.md` — documents the rule so future ETL work follows the same pattern. The Levenshtein fuzzy layer will be retired once the map is complete.

---

## Sheet structure discovered

Mayo.xlsx's Febrero sheet follows the same three-section pattern as the legacy `Enero.xlsx`:

- **Contract table** (rows 5–9): per-contract rows on columns B–V (embarque, posicion, cliente, contrato, estatus, lote, puntaje, sacos 69/46, bolsa/diferencial/bolsa+dif, facturación libras/kilos, gastos por saco/total, utilidad s/GE, costo financiero, utilidad s/CF, tipo cambio, total pago), ending in a TOTALES row.
- **Materia Prima block** (rows 11–14): columns G–O (contrato, proveedor, punteo, oro, rendimiento, pergo, prom.Q, total MP), one row per contract with 1:1 allocation, ending in TOTAL.
- **Subproducto + right-side P&L aggregate** (rows 15–18): subproducto data at V17 (+Q67,620.54), commission at V16 (−Q18,933.75), materia prima at V14 (−Q1,940,968.26), utilidad bruta at V18 (Q501,636.76) with margen 19.77 % at R18.

**Cross-sheet references** (flagged but intentional per user Q8 "Octavio's magical averages"):

- `M12 = =Enero!M32` — Febrero's PROM. Q pulled from Enero sheet (value 1,782.34).
- `M17 = =Enero!M20` — Febrero's subproducto `precio sin IVA` pulled from Enero (value 2,049.107).

---

## Phase 0.1a — Jan-sheet divergence (informational)

Flag-only per directives 1 + 8. [reports/january-divergence-2026-04-24.md](../reports/january-divergence-2026-04-24.md) records 20 divergences between Jan prod DB and Mayo.xlsx's Enero sheet. All trace to a single change: per-row `gastosPerSaco` (sheet 14.12/14.12/23/17.12 vs. prod 20/20/20/23) that cascades through gastos total / costo financiero / utilidad s/CF / total pago. **No prod mutation.** User will reconcile Jan via app CRUD if desired.

---

## Phase A — cell inventory + hygiene

Artifacts:

- [docs/ssot/febrero-2026-cell-inventory.md](../docs/ssot/febrero-2026-cell-inventory.md) — every formula + every literal + parsed contract / MP / subproducto / P&L sections.
- [reports/phase-a-febrero-2026.md](../reports/phase-a-febrero-2026.md) — hygiene findings + DB-baseline confirmation.

**Findings:** 0 Excel errors, 0 formula-vs-value mismatches, 2 info-level cross-sheet refs (above). All structural formulas verified: `L=J×K` (pergo = oro × rendimiento), `O=M×L` (totalMP = promQ × pergo), `N=J×M` (fact. libras), `O=I×69×2.2046×M/100` (fact. kgs), `Q=P×J` (gastos = rate × sacos46), `V16=−(3×U9×J9)` (commission). DB baseline: 0 / 0 / 0 / 0 / 0 clean-slate confirmed.

---

## Phase C — clean-slate ETL

[scripts/etl-febrero-2026.ts](../scripts/etl-febrero-2026.ts) executed in dry-run → execute mode per directive 10.

**Unique-constraint collision discovered:** P40029 existed in prod as an orphan contract (`shipmentId=null`, no relations) from an earlier pre-reconciliation import. First `--execute` rolled back cleanly on the `contractNumber` unique constraint. Fixed by extending clean-slate to also delete by `contractNumber` in the insert set (with directive-1 guard: refuses to delete if the orphan is somehow linked to a Jan shipment).

**Mutations (single transaction):**

| Step | Count | Detail |
|------|-------|--------|
| DELETE orphan contracts by number | 1 | P40029 (null-shipment leftover) |
| DELETE Feb shipments cascade | 0 | DB was clean-slate for month=2 |
| INSERT Shipment | 1 | "Febrero 2026 - Bloque único" (status=EMBARCADO, num_containers=2) |
| INSERT Contract | 2 | P40029 (Santa Rosa, gastos 14.12/qq) + P40023 (Huehuetenango, gastos 23/qq), both exportingEntity=EXPORTADORA, status=FIJADO, posicionBolsa=MAR, tipoCambio=7.65, cosecha=25-26, montoCredito=Q970,484.13 |
| INSERT MateriaPrima | 2 | rend=1.32, pergo=544.50, promQ=1,782.34, totalMP=Q970,484.13 each |
| INSERT MateriaPrimaAllocation | 2 | 1:1 positional; `quintalesAllocated=null` (full allocation) |
| INSERT Subproducto | 1 | 1 contenedor × 33 qq × precio Q2,049.107 = Q67,620.54 |
| UPDATE Contract (derived) | 2 | `calculateContract(..., montoCredito=own MP totalMP)` |
| CALL recalculateShipment | 1 | outside tx |
| INSERT AuditLog | 1 | `action=ETL_MONTH`, `entity=Shipment`, newValue includes sheet hash + deletedCounts + all insert counts |

**Client resolution:** matched `SERENGETTI` → canonical `Serengetti` [SER] via strict variant-map lookup. Zero Levenshtein / fuzzy fallback needed.

---

## Phase D — post-ETL parity

[scripts/phase-d-febrero-2026-parity.ts](../scripts/phase-d-febrero-2026-parity.ts), read-only.

**Result: 38 OK / 0 MISMATCH.** Per-contract N/O/Q/R/S/T/V chain (14 fields × 2 contracts) + per-contract MP (4 fields × 2 contracts) + shipment aggregates (utilidadBruta + margenBruto) all within tolerance.

| Metric | Sheet | DB | Δ |
|--------|-------|-----|----|
| Utilidad Bruta | Q 501,636.76 | Q 501,636.77 | +Q 0.01 (within ±0.03) |
| Margen Bruto | 19.77 % | 19.77 % | exact |

---

## Phase E — regression gate

[src/lib/services/__tests__/febrero-2026-ssot.test.ts](../src/lib/services/__tests__/febrero-2026-ssot.test.ts) — 3 tests asserting cell-for-cell parity at 2-decimal precision:

- 2 per-contract cases: full N/O/Q/R/S/T/V chain for P40029 and P40023.
- 1 shipment-aggregate case: `calculateShipmentMargin` → utilidadBruta Q 501,636.76 / margenBruto 19.77 %.

Full suite: **32/32 passing** (23 calculations + 6 Jan SSOT + 3 Feb SSOT). `tsc --noEmit` clean.

---

## Hard gate

Marzo cannot start Phase A until this changelog is in, `pnpm vitest run` remains green, and prod reflects the Febrero state recorded above. Directive 11.

---

## Files changed

```
Created:
  changelog/2026-04-24-febrero-2026-reconciliation.md              (this file)
  docs/client-variant-map.md                                        (new infrastructure)
  docs/ssot/febrero-2026-cell-inventory.md                          (Phase A artifact)
  reports/mayo-xlsx-d5cc26b3afc0d772c07cff9105e2ca9d0e2b966e84247bacf44b5c9e3e85f87f.meta
  reports/phase-0-1-mayo-xlsx-inventory.md                          (Phase 0.1)
  reports/january-divergence-2026-04-24.md                          (Phase 0.1a)
  reports/phase-a-febrero-2026.md                                   (Phase A report)
  reports/dry-run-febrero-2026.md                                   (Phase C dry-run)
  reports/execute-febrero-2026.md                                   (Phase C execute)
  reports/phase-d-febrero-2026-2026-04-24.md                        (Phase D parity)
  scripts/etl-febrero-2026.ts                                       (Phase C ETL)
  scripts/lib/client-variants.ts                                    (shared helper)
  scripts/phase-0-1-mayo-xlsx-inventory.ts                          (Phase 0.1)
  scripts/phase-0-1a-january-sheet-divergence.ts                    (Phase 0.1a)
  scripts/phase-0-1a-mayo-sheet-dump.ts                             (diagnostic)
  scripts/phase-a-febrero-2026.ts                                   (Phase A)
  scripts/phase-d-febrero-2026-parity.ts                            (Phase D)
  src/lib/services/__tests__/febrero-2026-ssot.test.ts              (regression gate)

Renamed (Jan-scoped, per directives 1/6/7 — all retain code body, add throw guard on mutators):
  scripts/import-excel.ts                  → scripts/import-excel-january.ts
  scripts/validate-importer-assertions.ts  → scripts/validate-importer-assertions-january.ts
  scripts/reaggregate-shipments.ts         → scripts/reaggregate-shipments-january.ts
  scripts/recalc.ts                        → scripts/recalc-january.ts
  scripts/migrate-subproductos.ts          → scripts/migrate-subproductos-january.ts
  scripts/validate-importer.sh             → scripts/validate-importer-january.sh

Modified:
  package.json                             (db:import points at renamed script)
  scripts/phase-c-january-reconcile.ts     (throw guard)
  scripts/phase-a-january-diff.ts          (no change — already compliant)
```

---

## Next

Marzo begins on user go-ahead. Phase A first: [docs/ssot/marzo-2026-cell-inventory.md](../docs/ssot/marzo-2026-cell-inventory.md) + [reports/phase-a-marzo-2026.md](../reports/phase-a-marzo-2026.md). Watch for: Opal / POUS-* contract names (new to variant map), possible Onyx ONYX casing variant, potential new block structure (Marzo has 6 contracts vs Febrero's 2).
