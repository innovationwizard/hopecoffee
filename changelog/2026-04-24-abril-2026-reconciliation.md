# Changelog — 2026-04-24: Abril 2026 SSOT Reconciliation

## Summary

Reconciled Abril 2026 to match `Mayo.xlsx` → sheet `Abril` in Supabase prod. Third month in the Feb → Mayo sequence. First month to exercise **two entity blocks** (Exportadora + Stock Lock), **stock-lock contracts with no MP / no subproducto**, **#REF!-tolerant ETL**, and the `needs-create` client-variant-map pathway for auto-creating new DB `Client` rows from pre-approved canonicals.

Two shipments created: `Abril 2026 - Bloque 1` (Exportadora, 7 contracts) and `Abril 2026 - Bloque 2` (Stock Lock, 2 contracts). Two new canonical clients auto-created in DB: **Westrade [WST]** and **Plateau Harvest [PLH]**.

**Tests:** 45/45 green (was 39 — added 6 Abril cases). `tsc --noEmit` clean. **Phase D parity:** 148 OK / 0 MISMATCH / 6 SKIPPED (stock-lock #REF! fields intentionally excluded per user directive 3). **Sheet hash:** `d5cc26b3afc0d772c07cff9105e2ca9d0e2b966e84247bacf44b5c9e3e85f87f`.

---

## Infrastructure additions

### `needs-create` resolver kind
[`scripts/lib/client-variants.ts`](../scripts/lib/client-variants.ts) — `StrictResolve` gained a third kind:

```ts
| { kind: "needs-create"; canonical: CanonicalEntry; matchedVariant: string }
```

When a variant is listed in the map but no DB `Client` has the canonical's code, `resolveStrict` now returns `needs-create` instead of `unresolved`. ETL scripts that support client creation (Abril and beyond) insert the row inside the transaction using name+code from the map. Febrero and Marzo ETLs continue to refuse `needs-create` — they remain strict-resolve-only.

### Importer/client parenthesis memory
[`feedback_importer_client_parenthesis.md`](../../.claude/projects/-Users-jorgeluiscontrerasherrera-Documents--git-hopecoffee/memory/feedback_importer_client_parenthesis.md) — persisted business rule: `NameA (NameB)` patterns encode IMPORTER + CLIENT in one cell. **The convention is not uniform** (sometimes plain = client, sometimes parenthesis = client). ETL must always stop and ask. Confirmed fact recorded: **in `Falcon (Wastrade)` and `ICC (Wastrade)` patterns, Falcon/ICC are IMPORTERS and Wastrade is the CLIENT.** Mayo Phase A will surface these cases.

### Variant map additions
[`docs/client-variant-map.md`](../docs/client-variant-map.md) now has 14 canonicals (was 12):
- **Westrade [WST]** — includes `Wastrade` typo as a variant
- **Plateau Harvest [PLH]**

Pending-likely-new list trimmed to LIST+BEISLER, Falcon, ICC (all for Mayo).

---

## SSOT structure — Abril

Two distinct blocks separated in the sheet:

- **Top block (rows 5–12)** — Exportadora, 7 contracts (Serengetti ×2, Stonex ×2, Westrade ×3 incl. duplicate `W26350-GT`), MP block (rows 14–21, 7 rows), subproducto at row 24 (`5.7491 contenedores`, fractional per user Q9 exception).
- **Bottom block (rows 36–37)** — Stock Lock, 2 contracts both named `GT260360` (Plateau Harvest), distinguished by `diferencial` (-37 vs -52). No MP rows. No subproducto.

Excel errors present on stock-lock cells per user directive 3: `S36/S37/T36/T37/V36/V37` all `#REF!`, plus `S38/T38/V38` on the aggregated TOTAL row. All tolerated — ETL recomputes via `calculateContract(montoCredito=0)` and persists correct values.

Cross-sheet references (intentional per Q8):
- `M15 =Marzo!M15` (PROM. Q chains Mar → Enero)
- `M24 =Enero!M20` (subproducto precio sin IVA)

---

## Phase C — mutations

Single transaction, `timeout: 60s`, `maxWait: 15s`.

| Step | Count | Detail |
|------|-------|--------|
| CREATE Client | 2 | Westrade [WST], Plateau Harvest [PLH] — pre-approved in variant map |
| DELETE orphans by number | 0 | None existed |
| DELETE Abril shipments cascade | 1 shipment · 2 contracts · 2 MP · 1 subproducto | Legacy pre-reconciliation state |
| INSERT Shipment (Bloque 1) | 1 | `Abril 2026 - Bloque 1`, status=EMBARCADO, numContainers=7 |
| INSERT Shipment (Bloque 2) | 1 | `Abril 2026 - Bloque 2`, status=EMBARCADO, numContainers=2 |
| INSERT Contract (Exp) | 7 | P40031, P40025, SCS_177612, SCS_177617, W26342-GT, `W26350-GT-01`, `W26350-GT-02` |
| INSERT Contract (SL) | 2 | `GT260360-01` (dif=-37), `GT260360-02` (dif=-52). `montoCredito=0`, `cfMeses=0`, `puntaje=0` (sheet had textual `"300 defectos"`) |
| INSERT MateriaPrima | 7 | Exportadora only, 1:1 positional with contracts |
| INSERT MateriaPrimaAllocation | 7 | Exportadora only |
| INSERT Subproducto | 1 | `contenedores=5.7491` (fractional — first of its kind) |
| UPDATE Contract (derived) | 9 | `calculateContract(..., montoCredito=own or 0)` |
| CALL recalculateShipment | 2 | one per shipment, outside tx |
| INSERT AuditLog | 1 | `action=ETL_MONTH`, records two shipments + clients created + suffixed contracts + all deletedCounts |

Shipment IDs: Exp `cmocgruem00023qydc4uwx16b`, SL `cmocgrujq00033qydb9vv3u8k`.

---

## Phase D — post-ETL parity

[`scripts/phase-d-abril-2026-parity.ts`](../scripts/phase-d-abril-2026-parity.ts).

**Result: 148 OK / 0 MISMATCH / 6 SKIPPED.** The 6 skipped comparisons are stock-lock `costoFinanciero/utilidadSinCF/totalPagoQTZ` × 2 contracts — sheet carries `#REF!`, DB is authoritative.

| Shipment | Utilidad Bruta Q | Margen Bruto |
|---|---|---|
| Bloque 1 / Exportadora | 695,754.10 | **8.98 %** |
| Bloque 2 / Stock Lock | 1,483,994.95 | **90.04 %** |

### ⚠ Stock-lock margin flag (business-model, not ETL)

The 90.04 % Stock Lock margin is a **direct consequence of directive 4** (`load MP + subproducto as zeros`). Without a COGS deduction the full facturación appears as profit, whereas business rules §1.2 describe stock-lock as earning only a ~$15/qq spread. The schema has no Stock-Lock-specific COGS field; a future design pass (schema + calc branch, or post-ETL app CRUD like ISR) can correct this. **Flagged and visible to user — not fixed this month per scope discipline.**

---

## Phase E — regression gate

[`src/lib/services/__tests__/abril-2026-ssot.test.ts`](../src/lib/services/__tests__/abril-2026-ssot.test.ts) — 6 tests (streamlined; Phase D parity is the exhaustive gate):

- **2 Exportadora cases**: `P40031` (standard 275-sacos with gastos=14.12), `W26350-GT-02` (suffixed, 550 sacos, 2× MP).
- **2 Stock-lock cases**: `GT260360-01` and `-02` — only `factLbs/factKgs/gastos/utilSinGE` from sheet (sheet #REF! on S/T/V); `costoFin=0`, `utilSinCF=utilSinGE`, `totalPago=utilSinGE × TC` from `calculateContract(montoCredito=0)`.
- **2 shipment-aggregate cases**: Bloque 1 = Q 695,754.10 / 8.98 %; Bloque 2 = Q 1,483,994.97 / 90.04 %.

Full suite: **45/45 passing**. `tsc --noEmit` clean.

---

## Files changed

```
Created:
  changelog/2026-04-24-abril-2026-reconciliation.md                (this file)
  docs/ssot/abril-2026-cell-inventory.md                           (Phase A)
  reports/phase-a-abril-2026.md                                    (Phase A)
  reports/dry-run-abril-2026.md                                    (Phase C dry-run)
  reports/execute-abril-2026.md                                    (Phase C execute)
  reports/phase-d-abril-2026-2026-04-24.md                         (Phase D parity)
  scripts/etl-abril-2026.ts                                        (Phase C ETL)
  scripts/phase-a-abril-2026.ts                                    (Phase A)
  scripts/phase-d-abril-2026-parity.ts                             (Phase D)
  src/lib/services/__tests__/abril-2026-ssot.test.ts               (regression gate)

Modified:
  docs/client-variant-map.md                                       (+ Westrade [WST], Plateau Harvest [PLH])
  scripts/lib/client-variants.ts                                   (+ needs-create kind)
  scripts/etl-febrero-2026.ts                                      (narrow needs-create)
  scripts/etl-marzo-2026.ts                                        (narrow needs-create)
  scripts/phase-a-marzo-2026.ts                                    (narrow needs-create)

Memory:
  feedback_importer_client_parenthesis.md                          (new rule)
  MEMORY.md                                                        (new index entry)
```

---

## Hard gate

Mayo cannot start Phase A until the changelog is in, prod reflects Abril state, and `pnpm vitest run` stays green. Currently 45/45 ✓.

---

## Next — Mayo heads-up

- **14 contracts, single block** per user. Transaction timeout of 60s should be plenty.
- **Parenthesis patterns confirmed imminent**: `Falcon (Wastrade)` rows 36, `ICC (Wastrade)` row 37. Per [`feedback_importer_client_parenthesis.md`](../../.claude/projects/-Users-jorgeluiscontrerasherrera-Documents--git-hopecoffee/memory/feedback_importer_client_parenthesis.md), Falcon/ICC = IMPORTER, Wastrade = CLIENT (already confirmed, do not re-ask). Phase A must flag them but Phase C can proceed since the mapping is pre-approved.
- **LIST+BEISLER** rows 28–29: new canonical, needs user approval before adding to map. Likely flagged as `unresolved` in Phase A.
- **ONYX** (all caps) may appear — should already match `Onyx` via normalize.
- **Wastrade** typo (when it appears as the bare client name) resolves to `Westrade [WST]` canonical — variant already in map.
- At end of Mayo: user will eyeball `PROMEDIOS` row 38–40 against app YTD panel (per Q11 answer). Total YTD = Q 39,607,314.61 total pago, utilidad $682,115.20, margen 12.28 %.
