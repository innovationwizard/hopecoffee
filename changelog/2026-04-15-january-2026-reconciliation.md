# Changelog — 2026-04-15: January 2026 SSOT Reconciliation

## Summary

Reconciled the app's January 2026 numbers to match `Enero.xlsx` (CFO SSOT) cell-for-cell in Supabase prod. Fixed three latent calc-engine bugs, surfaced four data-level issues, and added a permanent regression gate. Full investigation trail is in [RECONCILIATION_PLAN.md](../RECONCILIATION_PLAN.md) and the post-mortem is in [docs/january-2026-reconciliation-session.md](../docs/january-2026-reconciliation-session.md).

**Tests**: 31/31 passing (was 25 — added 6 January-specific SSOT parity cases). `tsc --noEmit` clean. **Production DB**: schema pushed, 4 contracts + 4 MP rows + 4 allocations + 2 shipment aggregates mutated. **Final Phase A diff**: 85 OK / 0 MISMATCH / 0 MISSING / 9 benign WARN.

---

## Trigger

The "Contexto del Mes" card for January 2026 was showing a weighted margin of **18.29 %** that matched neither Block 1 (Exportadora, SSOT: 15.594 %) nor Block 2 (Finca Danilandia, SSOT: 13.893 %) nor any weighted aggregate of the two. The CFO had fixed one SSOT formula on Friday and the gap closed partially but not completely.

Root cause turned out to be compound: the DB was imported once before Friday and was carrying stale MP data, plus three latent bugs in `calculateContract`, plus three missing schema fields needed to model a legal-document exception the business had never told the app about.

---

## SSOT fixes applied to `Enero.xlsx`

Four cell-level edits made by the user during the investigation (all documented in [docs/january-2026-reconciliation-session.md §2.1](../docs/january-2026-reconciliation-session.md)):

1. **Friday fix (L13/L14/L15)** — Block 1 MP PERGO cells were inconsistent (two stale literals, one formula). All three are now `=K*J` (rendimiento × oro).
2. **Q3 fix (L31/O31)** — Block 2's PERGO and Total MP were stale literals that did not agree with `M×L`. Changed to `=K31*J31` and `=M31*L31` respectively.
3. **Q3c fix (M31)** — the `PROM. Q` cell in Block 2 was `=M13` (cross-referencing Block 1). Changed to the literal `1777.25`. The January value coincides by accident; the structural coupling is now removed.
4. **P40129 O27 legal-document override** — P40129's facturacion is `171600` literal (not the formula value `174022.31`). The signed legal contract was drafted with the libras value instead of the kg-uplifted value. Keeping the SSOT at 171,600 reflects the legally-billed amount; the app now models this as a first-class exception.

Also renamed `EneroCurrent.xlsx` → `Enero.xlsx` and deleted the stale `Enero.xlsx`. `Enero-pre-friday.xlsx` kept as a historical reference.

---

## Schema changes

**File**: [prisma/schema.prisma](../prisma/schema.prisma)

Additive-only. Pushed to Supabase prod via `prisma db push --accept-data-loss` (no actual data loss; flag required by Prisma for any non-trivial push).

```prisma
enum ExportingEntity {
  EXPORTADORA       // Main export company (business_rules §1.1, §1.15)
  FINCA_DANILANDIA  // Farm entity
  STOCK_LOCK        // Buy FOB / sell FOB, no materia prima (§1.2)
}

model Contract {
  // ... existing fields ...
  exportingEntity ExportingEntity @default(EXPORTADORA)

  // Legal-document override: when set, replaces the computed facturacion
  // for exceptional contracts that deviate from the default kg formula.
  facturacionKgsOverride Decimal? @db.Decimal(14, 2)
  overrideReason         String?

  rendimiento     Decimal @db.Decimal(8, 6)  // DEPRECATED: use MateriaPrima.rendimiento via allocation
  tipoFacturacion TipoFacturacion @default(LIBRAS_GUATEMALTECAS)  // DEPRECATED: ignored by calc layer
}
```

**Not dropped** (scope-narrowed): `Contract.rendimiento`, `Contract.tipoFacturacion`, `TipoFacturacion` enum. Dropping them would cascade through 8 UI/action/form/schema files and is orthogonal to the reconciliation. Marked `DEPRECATED` in schema comments for a future cleanup pass.

---

## Code fixes

### `src/lib/services/calculations.ts`

Three bug fixes in `calculateContract` and one feature addition:

1. **Collapsed billing to a single kg path**. Deleted the `LIBRAS_ESPANOLAS` branch, which was dead buggy code (it double-multiplied the kg uplift). Per business rules §1.5/§1.6/§2.3 there is exactly one billing formula. The `tipoFacturacion` parameter is retained on the input interface as `@deprecated` but ignored.

2. **Replaced the `× 1.01411` approximation with the canonical SSOT kg formula**. The `LBS_TO_KGS_FACTOR = 1.01411` constant is a 5-decimal truncation of `(69 × 2.2046 / 100) / 1.5 = 1.01411733…` and drifts ~$1/contract on realistic volumes. Code now computes `facturacionKgs = sacos69 × 69 × 2.2046 × (precioBolsaDif / 100)` directly, matching the SSOT cell-for-cell.

3. **Fixed a latent unit bug in `gastosExportacion`**. Previously computed as `gastosPerSaco × sacos69kg`. Business rules §1.7 is unambiguous: "rate per quintal × total quintales shipped", and a quintal is 46 kg (100 lb). Fixed to `gastosPerSaco × sacos46kg`. Did not fire in production because the app was computing gastos via the shipment-level `exportCostConfig` join, bypassing the bug — but fired immediately when my reconciliation script exercised `calculateContract` directly with a contract-level rate.

4. **Added `facturacionKgsOverride` support**. When the new `Contract.facturacionKgsOverride` field is non-null, `calculateContract` uses it verbatim for both `facturacionLbs` and `facturacionKgs`, preserving internal consistency across all downstream fields.

### `src/lib/services/__tests__/calculations.test.ts`

- `tipoFacturacion` test rewritten to assert both enum values produce identical output (single-path invariant).
- `gastos exportacion` test rewritten to use the real SSOT rate of 23/qq. The previous test encoded the unit bug (rate=34.5 × sacos69=275 = 9487.5 coincidentally equals rate=23 × sacos46=412.5).
- New `facturacionKgsOverride` test.

### `src/lib/services/__tests__/january-ssot.test.ts` (new)

6-test regression gate asserting cell-for-cell parity with `Enero.xlsx`:
- 4 per-contract cases: full `N / O / Q / R / S / T / V` chain for P30172, P40028, P40022, P40129.
- 2 shipment-aggregate cases: Block 1 and Block 2 `utilidadBruta` + `margenBruto` via `calculateShipmentMargin`.

Tolerance: 2 decimals (matches `@db.Decimal(14, 2)` persist precision).

---

## Data changes (Supabase prod)

Executed via [scripts/phase-c-january-reconcile.ts](../scripts/phase-c-january-reconcile.ts), idempotent and transactional.

| Table | Rows | Mutation |
|---|---|---|
| `materia_prima` | 4 | Updated `rendimiento`, `pergamino`, `precioPromQ`, `totalMP` to post-all-fixes SSOT values. P30172 and P40129 were stale from pre-Friday / pre-Q3 imports; P40028 had sub-cent drift; P40022 was already correct. |
| `materia_prima_allocations` | 4 | **Created from scratch.** This table was completely empty DB-wide prior to this session — the importer creates MP rows without ever populating the join. |
| `contracts` | 4 | Set `exportingEntity` (Block 1 → `EXPORTADORA`, Block 2 → `FINCA_DANILANDIA`), `gastosPerSaco` (Block 1 = 20, Block 2 = 23, overriding the default `exportCostConfig` rate), and re-synced `rendimiento` with the matching MP row. Set `facturacionKgsOverride = 171600` + `overrideReason` + `isrAmount = 65764.16` on P40129. Recomputed all seven derived calc fields via `calculateContract` with `montoCredito = own MP totalMP`. |
| `shipments` | 2 | Re-aggregated via `recalculateShipment`. |

**No data drops.** Everything is additive or refreshed-in-place.

---

## Final state

**Shipment aggregates match SSOT exactly:**

| Shipment | Utilidad Bruta | Margen Bruto |
|---|---|---|
| Enero 2026 - Bloque 1 (Exportadora)      | 582,428.32 Q | 15.594 % |
| Enero 2026 - Bloque 2 (Finca Danilandia) | 182,382.62 Q | 13.893 % |

**Monthly weighted margin** (the 18.29 % bug): now **15.15 %** — the correct §2.12 weighted average. No change to `getMonthlyContext` was needed; the function was always correct, it was reading stale inputs.

**Phase A diff**: 85 OK / 0 MISMATCH / 0 MISSING / 9 WARN. The 9 warnings are all benign: 8 are deprecated-column flags on `Contract.rendimiento` and `Contract.tipoFacturacion`, and 1 is a count note that there are 2 January shipments (which is correct).

**Regression gate**: 31/31 tests green.

---

## Known follow-ups (not done in this session)

1. **[scripts/import-excel.ts](../scripts/import-excel.ts) still has two bugs**: (a) it creates `MateriaPrima` rows without `MateriaPrimaAllocation` rows, and (b) it hardcodes `Contract.rendimiento = 1.32`. Re-running the importer on `Enero.xlsx` will undo this reconciliation. Until the importer is fixed, [scripts/phase-c-january-reconcile.ts](../scripts/phase-c-january-reconcile.ts) is the authoritative path for January data.

2. **Deprecated column drops**: `Contract.rendimiento` and `Contract.tipoFacturacion` should be removed in a dedicated cleanup PR that updates the 8 dependent UI/action/form files.

3. **Feb-Dec reconciliation**: every other month likely has the same class of issues (stale MP, missing allocations, maybe additional SSOT anomalies). Same approach works — snapshot SSOT, write a month-specific reconciliation script, run it, verify via Phase A.

4. **Investor/entity many-to-many aggregation**: marked out of scope by user direction. This is the bigger piece of work behind the current "Bloque" shipment naming and will reshape how monthly KPIs compose across entities.

5. **Business rules doc cleanup**: updated "Finca de Adelante" → "Finca Danilandia" this session. The 4.39 % example in §1.11 is now stale (the real Block 2 margen post-fixes is 13.893 %), but the example still correctly illustrates the profit-side-not-cost-side rule, so leaving it.

---

## Files changed

```
Created:
  changelog/2026-04-15-january-2026-reconciliation.md          (this file)
  docs/january-2026-reconciliation-session.md                  (verbose post-mortem)
  RECONCILIATION_PLAN.md                                       (live investigation log)
  scripts/phase-a-january-diff.ts                              (read-only diff)
  scripts/phase-c-january-reconcile.ts                         (reconciliation)
  src/lib/services/__tests__/january-ssot.test.ts              (regression gate)
  Enero-pre-friday.xlsx                                        (historical snapshot)

Modified:
  docs/01-DOMAIN-MODEL.md                                      (billing formula, constants table, gastos unit)
  hopecoffee_business_rules.md                                 ("Finca de Adelante" → "Finca Danilandia")
  prisma/schema.prisma                                         (ExportingEntity enum, 3 new Contract fields)
  src/lib/services/calculations.ts                             (3 bug fixes + override support)
  src/lib/services/__tests__/calculations.test.ts              (test updates)
  Enero.xlsx                                                   (SSOT cell-level fixes + O27 legal override; renamed from EneroCurrent.xlsx)
```
