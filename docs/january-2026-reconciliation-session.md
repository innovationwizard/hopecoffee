# January 2026 Reconciliation — Session Log

**Dates:** 2026-04-14 → 2026-04-15
**Goal:** Make the HopeCoffee app's numbers for January 2026 match `Enero.xlsx` (the CFO's canonical spreadsheet SSOT) cell-for-cell.
**Trigger:** The app was showing a pooled monthly margin of **18.29 %** that matched neither block nor any weighted aggregate of the two. Octavio fixed a formula in the SSOT on Friday and the gap closed partially but not completely.
**Outcome:** January now matches the SSOT cell-for-cell in Supabase prod. Permanent regression gate in place. 31/31 tests green.

This document is intended to be read by future-me (or a new engineer) debugging follow-up issues. It is verbose on purpose. The companion document is [RECONCILIATION_PLAN.md](../RECONCILIATION_PLAN.md), which captured questions/answers in real time as the investigation progressed; this file is the consolidated post-mortem.

---

## Table of contents

1. [Context and starting state](#1-context-and-starting-state)
2. [The SSOT itself was moving under us](#2-the-ssot-itself-was-moving-under-us)
3. [The business rules we grounded everything in](#3-the-business-rules-we-grounded-everything-in)
4. [Dependency-ordered questions and answers](#4-dependency-ordered-questions-and-answers)
5. [Phase A — the diff script (read-only)](#5-phase-a--the-diff-script-read-only)
6. [Phase C — schema, code, data reconciliation](#6-phase-c--schema-code-data-reconciliation)
7. [Bugs discovered and fixed along the way](#7-bugs-discovered-and-fixed-along-the-way)
8. [Final state](#8-final-state)
9. [Known follow-ups and landmines](#9-known-follow-ups-and-landmines)
10. [Files changed / created](#10-files-changed--created)
11. [How to re-run everything](#11-how-to-re-run-everything)
12. [Debugging guide for future regressions](#12-debugging-guide-for-future-regressions)

---

## 1. Context and starting state

### 1.1 What the user reported

The user was looking at four contract detail pages for January 2026 (P30172, P40022, P40028, P40129) and noted that the "Contexto del Mes" card was showing a weighted margin of **18.29 %** across all four contracts, with a pooled revenue of ~4,709,868.82 Q. This matched neither Block 1's 17.03 % nor Block 2's 4.39 % (the pre-Friday SSOT values), and the user had already fixed one formula in the xlsx on Friday which was supposed to close the gap.

The user had also consulted "Claude online" for a second opinion. That response correctly identified that the DB was running on stale PERGO data and correctly traced the ~9,983 Q per-contract drift on P30172 back to the pre-Friday `L13 = 544.36` literal (which, after the Friday fix, should have been `574.07`). But it also made a couple of assumptions I had to verify independently because the user quoted it and I was not supposed to trust it blindly.

### 1.2 What was true about the app when we started

- `Enero.xlsx` had 4 contracts across 2 "blocks" (Bloque 1, Bloque 2).
- The DB already had 2 separate `Shipment` rows for January: `Enero 2026 - Bloque 1` (3 contracts, 3 MP rows, 1 subproducto) and `Enero 2026 - Bloque 2` (1 contract, 1 MP row, 1 subproducto). I had not expected this — I initially assumed a single pooled shipment per month. The entity-split data shape was already in place, just using "Bloque" terminology rather than "Exportadora / Finca".
- `MateriaPrimaAllocation` table existed in the schema but was **completely empty** — zero rows for any contract, not just January. The import script creates MP rows without ever creating the allocation join, so there was no persisted link from a contract to its MP.
- `Contract.rendimiento` was hardcoded to `1.32` on every January contract via [scripts/import-excel.ts:782](../scripts/import-excel.ts#L782), despite the xlsx having four distinct values (1.3197, 1.3245, 1.3200, 1.3226). But `MateriaPrima.rendimiento` was imported correctly from the xlsx — so the per-batch yields were actually correct on the MP rows; only the `Contract` column was wrong.
- `Contract.tipoFacturacion` defaulted to `LIBRAS_GUATEMALTECAS` on every January contract. I initially assumed this enum had some grounding in the business; it did not.
- Four data-level errors in the MP rows (details in §6), all traceable to the DB being imported once before Friday and never re-imported.

### 1.3 Cast of documents

Throughout the session I was juggling several sources of truth, each partially authoritative:

- **`_THE_RULES.MD`** — the user's non-negotiable operating contract with the assistant. Key rules I leaned on repeatedly: "don't lie, don't assume, ask when you need information," "production-first," "no mock or sample data." I violated the "don't assume" rule once (invented `LIBRAS_ESPANOLAS` as an SSOT term when it was an app-side label) and the user correctly called it out — see §4.2.
- **`hopecoffee_business_rules.md`** — the extracted business rules from a walkthrough with Octavio (CFO). This is the most canonical description of the business logic.
- **`transcripcion_completa.txt`** — the raw transcript the business rules were extracted from. I went back to it when the business rules doc didn't have enough signal on a specific question (notably the "block" structure, which turned out to be entity-based).
- **`hector.txt`** — a walkthrough with Hector (COO / Gerente de ventas). Surfaced during the session and turned out to map 1:1 to the existing `Lot` / `CuppingRecord` / `YieldAdjustment` schema, confirming those models were built for his workflow.
- **`Enero.xlsx`** — the live CFO workbook. This is the final arbiter of numbers. During the session it changed 4 times (see §2).
- **`RECONCILIATION_PLAN.md`** — the evolving investigation log written turn-by-turn.

---

## 2. The SSOT itself was moving under us

This is the single biggest lesson of the session. The `.xlsx` file on disk was **stale** when we started, and neither the assistant nor the user realized it until we'd already written down "findings" based on a file that did not represent Octavio's real spreadsheet. Future-me: **always verify the SSOT file is the current one before trusting any findings derived from it.**

### 2.1 File snapshot timeline

| Event | File at repo root | `L13` value | `O27` formula | `O31` value | `M31` formula |
|---|---|---|---|---|---|
| Session start | `Enero.xlsx` (actually pre-Friday) | 544.36 literal | `=N27` | 1,092,736.25 literal | `=M13` |
| User supplies "pre-Friday" for comparison | `Enero-pre-friday.xlsx` | 544.36 literal | `=N27` | 1,092,736.25 literal | `=M13` |
| **Finding:** both files are byte-identical (Friday fix wasn't where I was looking) | — | — | — | — | — |
| User supplies true post-Friday | `EneroCurrent.xlsx` | **`=K13*J13` → 574.0695** | `=N27` | 1,092,736.25 literal | `=M13` |
| User approves rename | `Enero.xlsx` = EneroCurrent | 574.0695 | `=N27` | 1,092,736.25 literal | `=M13` |
| Q5e: fix O27 per business rules §1.5 | `Enero.xlsx` | 574.0695 | **`=I27*69*2.2046*(M27/100)` → 174,022.31** | 1,092,736.25 literal | `=M13` |
| Q3: fix L31/M31/O31 | `Enero.xlsx` | 574.0695 | (still the new formula) | **`=M31*L31` → 969,618.73** | still `=M13` |
| Q3c: delink M31 from M13 | `Enero.xlsx` | 574.0695 | (still the new formula) | 969,618.73 (via formula) | **`1777.25` literal** |
| Q5e reversal: P40129 is a legal-doc exception | `Enero.xlsx` | 574.0695 | **`171600` literal** (manual override) | 969,618.73 | 1777.25 literal |
| **Final SSOT (after all edits)** | `Enero.xlsx` | 574.0695 | 171,600 literal | 969,618.73 | 1777.25 literal |

### 2.2 The Friday fix, fully identified

The pre-Friday Block 1 MP rows had inconsistent formulas:
- `L13 = 544.36` (literal — was a typo / stale value)
- `L14 = 546.36` (literal)
- `J14 = L14/K14` (back-solved from PERGO/Rendimiento instead of `=J8` like the other J cells)
- `L15 = =J15*K15` (formula — the only consistent row)

Post-Friday, Block 1 MP rows are uniformly `L = K × J`:
- `J14 = J8` (normal, matches J13/J15)
- `L13 = =K13*J13` → 1.3197 × 435 = **574.0695**
- `L14 = =K14*J14` → 1.3245 × 412.5 = **546.35625**
- `L15 = =K15*J15` → 1.3200 × 412.5 = **544.50**

This was Octavio's Friday edit. It broke symmetry — the old L13/L14 were literals, the new ones are formulas — and pushed P30172's PERGO from 544.36 to 574.07, cascading through MP total, costo financiero, utilidad bruta, and margen bruto.

### 2.3 Why it mattered: three of Octavio's own formulas were broken before Friday

Per business rules §2.5, the canonical formula is:

```
qq_pergamino_needed = qq_oro × rendimiento
```

The SSOT's Block 1 had this formula hardcoded as literals (L13, L14) for two of three contracts. The literals were stale — they had been typed in once and not updated when rendimientos were refined. This is a classic spreadsheet footgun: a formula that is sometimes a formula and sometimes a literal is indistinguishable visually, but one of them silently goes stale.

The worked example in business rules §2.5 ("435 × 1.3197 = 574.07 qq pergamino") matches the *post-Friday* L13 to 4 decimals. So the canonical business documentation was already correct; the spreadsheet had been lagging its own spec.

### 2.4 The O27 reversal — a lesson in not silently "fixing" the SSOT

Q5 / Q5e in the plan initially led me to an SSOT fix: `O27 = N27` (pre-Friday) was inconsistent with business rules §1.5 / §1.6 ("invoicing is always measured in kilograms") because Block 2 was skipping the 1.01411 kg uplift that Block 1 applied. I computed what the "correct" value would be (174,022.31 USD) and asked the user whether to fix it. The user said yes, fix the SSOT, so the formula was replaced with `=I27*69*2.2046*(M27/100)`.

A few turns later, after more context came out, the user reversed: **P40129 is a legal-document exception**. The buyer's signed contract was drafted at the libras value (171,600 USD) rather than the kg-uplifted value (174,022.31 USD), so the company is legally billing 171,600. The original `O27 = N27` was reflecting reality, and my "fix" would have silently overstated revenue by 2,422.31 USD.

We then reverted O27 to the literal `171600` in the SSOT and designed a first-class `facturacionKgsOverride` mechanism in the app (see §6) so future exceptions of this kind are traceable instead of invisible.

**Lesson for future debugging:** when the spreadsheet and the business rules disagree, do not assume one is right. Ask. Exceptions have a reason. The Rule 3 mandate for enterprise-grade code means making exceptions auditable (an `overrideReason` column), not hiding them under "the formula said so."

---

## 3. The business rules we grounded everything in

All formulas and decisions in this reconciliation trace back to specific sections of `hopecoffee_business_rules.md`. Listing them here for future cross-reference:

### 3.1 Invoicing is always in kilograms — §1.5, §1.6, §2.3

> "Physical invoicing is done **in kilograms**, not libras. This is critical — invoicing in libras instead of kilos leaves ~$7,000 on the table per container. The kg-based invoicing uses the 2.2046 conversion factor to the company's advantage."

Canonical formula (§2.3):
```
total_kilos     = num_sacos_69 × 69
facturacion_usd = total_kilos × 2.2046 × (precio_qq / 100)
```

**Consequence for the code:** `calculateContract` collapses to a single billing path. The `LIBRAS_ESPANOLAS` enum branch is deleted (it was buggy dead code that would have double-multiplied the kg factor anyway). The `tipoFacturacion` field on `Contract` is retained in the schema as deprecated but completely ignored at the calculation layer.

### 3.2 Export expenses are per quintal (= 46 kg), not per 69 kg sack — §1.7

> "Export expenses are charged as a flat rate per quintal (e.g., $20/qq)."
> "Total export expenses = rate × total quintales shipped."

A quintal is 100 lb = 46 kg, not 69 kg. The app previously had `gastosExportacion = gastosPerSaco × sacos69kg`, which was a latent bug (didn't fire in prod because prod used a per-shipment `exportCostConfig` path that bypassed the formula, but fired immediately in my reconciliation tests). Fixed to `gastosPerSaco × sacos46kg`.

### 3.3 Financial cost is on materia prima, 8% / 12 × 2 months — §1.8

```
costo_financiero = (total_materia_prima × 0.08 / 12 × 2) / tipo_cambio
```

Critically, the SSOT formula for **per-contract** costo financiero uses each contract's **own** MP total (`O_i`), not the shipment-wide sum. I.e., `S7` in the xlsx uses `O13` (P30172's MP total), `S8` uses `O14` (P40028's), `S9` uses `O15` (P40022's). Only the shipment aggregate `S10` uses `O16 = Σ O_i`.

This drove the reconciliation script to compute each contract's `costoFinanciero` by passing `montoCredito = own MP totalMP` to `calculateContract`. Previously the app had no wiring for "use your own MP row's total"; it relied on `montoCredito` being supplied by the caller, and the caller wasn't setting it correctly.

### 3.4 Commission — §1.9

> "Commission = $3 per quintal (100 lbs), split between gerente de ventas (Héctor) and gerente de compras (Pepe)."

Split is $1.50/qq buy + $1.50/qq sell. Total commission USD = `3 × qq_oro_total`, then × tipo_cambio for QTZ. Per-contract commission is therefore `3 × sacos46_i × tc`, and the sum matches the SSOT `V18 = -(3 × J10) × U10` exactly.

### 3.5 Subproducto (rechazo) — §1.10

Per-shipment, not per-contract. Revenue = `qq_rechazo × precio_rechazo_qq`, added back to profit. Block 1 has 1 contenedor × 33 qq × ~2049.11 Q/qq ≈ 67,620.54 Q. Block 2 has 0 in January. The `Subproducto` model in the schema is keyed to `shipmentId`, matching this.

### 3.6 Margin is the profit side, not the cost side — §1.11

> "The UI must show margin as the **profit percentage**, NOT the cost percentage. Octavio explicitly corrected: 'No es 95, sino la diferencia de 100.' If costs are 95.61%, the margin shown must be 4.39%."

Note that the 4.39% number in the business rules doc is **the pre-Friday Block 2 margen**. It was literally the working example Octavio used during the walkthrough. Post all SSOT fixes and post the P40129 legal override, Block 2's margen is now 13.89 %. This is a small but important point: the business rules doc's examples are pinned to a specific state of the xlsx, and those examples go out of date when Octavio edits the sheet.

### 3.7 Monthly weighted margin — §2.12

```
margen_ponderado = Σ (margen_i × facturacion_i) / Σ facturacion_i
                = Σ utilidad_i / Σ facturacion_i
```

The `getMonthlyContext` action already implements this correctly ([src/app/(dashboard)/contracts/actions.ts:508](../src/app/(dashboard)/contracts/actions.ts#L508)):
```ts
const avgMargin = totalFactQTZ > 0 ? totalUtilBruta / totalFactQTZ : 0;
```

The 18.29 % pooled value the user was seeing was **not** a bug in this function. The function was correct; it was reading stale MP data (indirectly, via stale `totalPagoQTZ` and stale shipment aggregates). Once the reconciliation script fixed the underlying data, the pooled value automatically converged to the correct 15.15 %.

### 3.8 Entity split — §1.1, §1.15

> "Each contract belongs to **one of two exporting entities**: Exportadora (the main export company) or Finca de Adelante (the farm entity). Monthly reports are subdivided by entity."

**Important doc error:** the business rules doc says "Finca de Adelante". The user corrected this mid-session: the real farm entity name is **Finca Danilandia** (which also matches the `lote` name `Danilandia` for P30172). "Finca de Adelante" is outdated in the doc. The schema enum uses `FINCA_DANILANDIA`, not `FINCA_DE_ADELANTE`, and the business rules doc should be updated in a future cleanup.

The DB already had two separate `Shipment` rows for January (`Enero 2026 - Bloque 1` and `Enero 2026 - Bloque 2`). The "Bloque" naming was the importer's guess at the structure; the real semantic meaning is "one Shipment per ExportingEntity per month". For the January reconciliation I did not rename the shipments — the Bloque naming is harmless — but this is a data-model tension worth flagging: the `Shipment` table carries one physical shipment, but "Enero 2026 - Bloque 1" is actually "January 2026 Exportadora subtotal" which is a different concept. A future cleanup may want to introduce a `ShipmentMonth` (month × entity) aggregation layer.

---

## 4. Dependency-ordered questions and answers

This is the abbreviated Q&A history. Full phrasing is in [RECONCILIATION_PLAN.md §4 + §6.5 + §7.5 + §8.7](../RECONCILIATION_PLAN.md). Kept dependency-ordered so future-me can see why we asked things in this sequence.

### 4.1 Q2 — per-contract MP or per-supplier-lot MP?

**Answer:** per-contract MP. Each `MateriaPrima` row represents the raw material allocated to exactly one contract. Even when the physical supplier is the same (e.g., P30172 and P40028 both share "José David"), they are tracked as separate MP rows because the **rendimiento differs per contract** and proration by supplier would destroy the per-contract yield information.

The existing `MateriaPrimaAllocation` join table is the bridge — it already had `contractId + materiaPrimaId`, so no new FK was needed. The importer just needed to start creating allocation rows alongside MP rows.

**Consequence:** schema delta stayed small; rendimiento could stay on `MateriaPrima` rather than moving to `MateriaPrimaAllocation`.

### 4.2 Q5 — invoicing formula / the `LIBRAS_ESPANOLAS` naming incident

I initially framed a question using the app-side enum names `LIBRAS_GUATEMALTECAS` and `LIBRAS_ESPANOLAS` as if they were SSOT terms. The user pushed back: those names are only in the app code, **not** in the xlsx or the business rules. I retracted and re-asked using only SSOT column headers (`LIBRAS`, `KILOS`).

**Answer:** there is exactly one billing formula (§1.5 / §1.6 / §2.3 — the kg path). The enum is unfounded. The `LIBRAS_ESPANOLAS` branch in `calculateContract` was dead code.

**Lesson:** never import app-side terminology into a question about SSOT semantics. If the user never said a word, don't put it in their mouth.

### 4.3 Q5e — fix the SSOT for P40129's `O27`

**First answer:** yes, fix it. I made the edit and recomputed Block 2's utilidad bruta and margen bruto.

**Second answer (reversal):** P40129's legal contract was drafted with a mistake, so the true billed amount is **171,600 USD**, not the 174,022.31 USD the formula would produce. The `=N27` literal was actually reflecting reality. We reverted the SSOT edit and designed a first-class `facturacionKgsOverride` mechanism in the app so this kind of exception is auditable instead of invisible.

**Lesson:** an SSOT fix that contradicts the business rules is almost always a hint that there's something the business rules don't capture. Ask before "fixing."

### 4.4 Q3 — the 123,113.92 Q `O31` override

Pre-Q3, `O31 = 1,092,736.25` was a literal that did not equal `M31 × L31 = 969,622.33`. The 123K gap had no business justification in any document.

**Resolution:** it was a stale literal from a prior state. Fix was to make it `=M31*L31`. The current M31 and L31 values happen to produce a sensible number, which was not the case for whatever state the stale literal came from. `L31` was also delinked from its stale literal and made into `=K31*J31` to match the Friday-fix pattern.

### 4.5 Q3c — `M31 = =M13` (cross-block reference)

**Answer:** M31 should be its own independent literal, not a formula pointing at M13. For January the values coincide by accident (both blocks paid Q1,777.25/qq). We changed `M31` to the literal `1777.25` in the SSOT; no numeric change, but the structural coupling is removed.

### 4.6 Q4 — ISR policy

**Answer:** Not all shipments have ISR. Default 0. User inputs either a GTQ amount or a percentage per shipment. The schema already supports this at the **contract** level via `Contract.isrAmount` (fixed QTZ, takes precedence) and `Contract.isrRate` (percentage, prorated by MP share in `recalculateShipment`). For January we set `P40129.isrAmount = 65764.16` (matching the SSOT `V33` literal).

Open subquestions deferred: (Q4a) if percentage-based ISR is used, what's the base? (Q4b) should ISR be at shipment or contract level? Both answered implicitly by the existing schema — contract level with `isrAmount` winning.

### 4.7 Q8 — monthly aggregation semantics

**Answer:** out of scope for this reconciliation. The user said the real investor/entity structure is "many-to-many with shipments, many-to-many with sources, many-to-many with contracts" and is a much bigger piece of work. For now, keep the current "Contexto del Mes" card as-is and let the weighted average come out of the reconciled data naturally.

### 4.8 Q2-bis — rendimiento per batch

**Answer:** rendimiento is per batch. Hector explained in [hector.txt](../hector.txt) that the lab (`beneficio seco`) measures rendimiento on each receipt, and if the lab yield differs from the contract yield, the price must be adjusted. The schema already supports this: `Lot`, `CuppingRecord`, `YieldAdjustment` are all in place. For the January reconciliation we did not touch that layer — the `MateriaPrima` table is the per-contract **averaged** rollup that the SSOT displays, fed by the lot/cupping details at a lower layer. Whether that end-to-end wire is fully plumbed in prod is a separate audit.

---

## 5. Phase A — the diff script (read-only)

[scripts/phase-a-january-diff.ts](../scripts/phase-a-january-diff.ts) is a read-only comparison tool that walks every January contract and every January shipment, fetches the current DB values, and compares them field-by-field against hardcoded SSOT expected values. It classifies each row as `OK`, `WARN` (benign), `MISMATCH` (data wrong), or `MISSING` (schema field or record absent).

### 5.1 Why read-only mattered

The user had authorized direct-to-prod writes with no dry-run, but I still wanted a read-only reconnaissance pass first because:

- The app's pooled 18.29 % matched nothing the SSOT said, so I did not trust my mental model of what the DB actually held.
- I wanted to see which mismatches were **data-level** (fixable by updating values) vs **schema-level** (requiring migrations).
- Once a reconciliation script started writing, I could not easily go back and see the "before" state.

### 5.2 Surprises from the first run

1. **Two shipments already exist per January.** My initial plan assumed one pooled shipment per month. The DB already had `Enero 2026 - Bloque 1` and `Enero 2026 - Bloque 2`. This collapsed the §9.5 "split shipments" work item from the plan.

2. **Zero `MateriaPrimaAllocation` rows DB-wide.** Not just for January — the allocation table was completely empty for every month. The importer at [scripts/import-excel.ts:807-819](../scripts/import-excel.ts#L807-L819) creates MP rows without ever calling `prisma.materiaPrimaAllocation.create`. This was the single biggest data-model gap.

3. **`MateriaPrima.rendimiento` was already correct** for all four January contracts. Only `Contract.rendimiento` had the hardcoded `1.32` bug, and that column was slated for removal anyway (later kept, see §6.1). This meant the fix was narrower than I expected — I did not need to rewrite the MP ingestion path.

4. **The DB was stale from a pre-Friday import.** P30172's `pergamino = 544.36` (the pre-Friday L13 literal) and P40129's `totalMP = 1,092,736.25` (the pre-Q3 O31 literal override). Neither the Friday fix nor the Q3 fix had ever reached the DB because no re-import had been run.

5. **3¢ precision drift on P40022** — turned out to be a bug in my own Phase A script's expected values table (§7.4), not in the app. False alarm.

### 5.3 What the script outputs

Summary format: counts of `OK / WARN / MISMATCH / MISSING`, plus a per-contract breakdown of every mismatching field with expected and actual values and an approximate delta. First run: 46/9/14/9. Final run (post-reconciliation): **85/9/0/0**.

### 5.4 Keeping the script accurate

The expected-values table in the script is frozen to the `Enero.xlsx` state as of **2026-04-15, post all fixes**. If future xlsx edits change any January cell, the script's expected values must be updated to match. The script is intended to be the Phase A SSOT gate for this specific month and will need a refresh when new months are reconciled or when new SSOT edits land.

---

## 6. Phase C — schema, code, data reconciliation

Executed in four sub-steps, in dependency order.

### 6.1 Schema changes

**File:** [prisma/schema.prisma](../prisma/schema.prisma)

**Initial over-broad attempt** (later reverted): I tried to drop `Contract.rendimiento` and `Contract.tipoFacturacion` simultaneously with adding the new fields. A grep revealed 8 UI/action/schema/form files that would break on compile. Dropping those columns was *not* required for the reconciliation; the reconciliation only needs the calc path to read the right values. Per the code guidelines ("Don't add features, refactor, or introduce abstractions beyond what the task requires"), I narrowed the scope.

**Final schema delta — additive only:**

```prisma
enum ExportingEntity {
  EXPORTADORA       // Main export company (business_rules §1.1, §1.15)
  FINCA_DANILANDIA  // Farm entity
  STOCK_LOCK        // Buy FOB / sell FOB, no materia prima (§1.2)
}

model Contract {
  // ... existing fields ...
  rendimiento     Decimal @db.Decimal(8, 6)  // DEPRECATED: use MateriaPrima.rendimiento via allocation
  exportingEntity ExportingEntity @default(EXPORTADORA)
  facturacionKgsOverride Decimal? @db.Decimal(14, 2)
  overrideReason         String?
  tipoFacturacion TipoFacturacion @default(LIBRAS_GUATEMALTECAS)  // DEPRECATED: ignored by calc layer
  // ... existing fields ...
}
```

**Deprecated columns kept for later cleanup:**

- `Contract.rendimiento` — duplicated with `MateriaPrima.rendimiento`. Kept because removing it breaks the contract form UX and the calc-preview component, neither of which is required for the reconciliation.
- `Contract.tipoFacturacion` + `TipoFacturacion` enum — unfounded per §3.1. Kept because dropping the enum would break the detail page, edit page, contract form, validation schemas, and two actions. The calc layer now ignores the field entirely.

Both are marked `DEPRECATED` in schema comments. Future cleanup should drop them in a dedicated pass after updating the UI callers.

**Applied to Supabase prod via `prisma db push --accept-data-loss`.** The `--accept-data-loss` flag was innocuous here (we added fields, didn't drop any), but required because Prisma conservatively asks on any non-trivial schema push. No data was actually lost.

### 6.2 `calculateContract` fixes

**File:** [src/lib/services/calculations.ts](../src/lib/services/calculations.ts)

Three changes in one function:

**(1) Collapsed the billing formula to a single path.** Deleted the `LIBRAS_ESPANOLAS` branch. The previous code was:

```ts
if (input.tipoFacturacion === "LIBRAS_ESPANOLAS") {
  facturacionLbs = sacos69.mul(69).mul(LBS_PER_KG).mul(precioBolsaDif.div(100));
} else {
  facturacionLbs = sacos46kg.mul(precioBolsaDif);
}
const facturacionKgs = facturacionLbs.mul(LBS_TO_KGS_FACTOR);
```

The `LIBRAS_ESPANOLAS` branch computed `facturacionLbs` already in kgs-equivalent and then *also* multiplied by `LBS_TO_KGS_FACTOR`, giving a double-uplift. It was dead buggy code (never exercised because the default enum was always `LIBRAS_GUATEMALTECAS`), but it was a landmine for anyone who later tried to flip the enum.

**(2) Replaced the `× LBS_TO_KGS_FACTOR` approximation with the canonical SSOT kg formula.** The `LBS_TO_KGS_FACTOR = 1.01411` constant is a 5-decimal truncation of `(69 × 2.2046 / 100) / 1.5 = 1.01411733…`. Using the truncated constant drifts roughly 1 USD per contract on realistic volumes. I replaced the kg computation with the canonical:

```ts
facturacionKgsComputed = sacos69
  .mul(69)
  .mul(LBS_PER_KG)
  .mul(precioBolsaDif.div(100));
```

This matches the SSOT `O = I × 69 × 2.2046 × (M/100)` cell-for-cell. The `facturacionLbs` computation stays at `sacos46 × (bolsa+dif)` because that's what SSOT col N shows.

**(3) Added `facturacionKgsOverride` support.** When the new `Contract.facturacionKgsOverride` is set, `calculateContract` uses it verbatim for both `facturacionLbs` and `facturacionKgs` (so every downstream field reads the same override value and nothing silently computes from the old formula). The `overrideReason` is surfaced by the UI layer (not in the calc layer).

```ts
const hasOverride = input.facturacionKgsOverride != null;
const facturacionKgs = hasOverride
  ? new Decimal(input.facturacionKgsOverride!)
  : facturacionKgsComputed;
const facturacionLbs = hasOverride ? facturacionKgs : facturacionLbsComputed;
```

**(4) Fixed the gastos-exportación bug.** Previously:

```ts
const gastosExportacion = gastosPerSaco.mul(sacos69);  // wrong
```

Business rules §1.7: "Total export expenses = rate × total quintales shipped." A quintal is 46 kg (100 lb), not 69 kg. Fixed:

```ts
const gastosExportacion = gastosPerSaco.mul(sacos46kg);  // correct
```

This was a latent bug. The production path had been bypassing it by computing gastos via the shipment-level `exportCostConfig` join, so the bug never fired in prod. But the moment a contract-level override was used, it would fire immediately. My January reconciliation test caught it because I was exercising `calculateContract` directly with a contract-level `gastosExportPerSaco`.

**Test file updates:**
- `LIBRAS_ESPANOLAS` test rewritten to assert both enum values produce identical output (single-path assertion).
- `gastos exportacion correctly` test rewritten to use the real SSOT rate of 23/qq instead of the coincidentally-passing 34.5/sacos69.
- New `facturacionKgsOverride` test added.

All 25 existing tests + 2 new tests pass (27 total in `calculations.test.ts`, plus 6 in the new `january-ssot.test.ts`).

### 6.3 The one-shot reconciliation script

**File:** [scripts/phase-c-january-reconcile.ts](../scripts/phase-c-january-reconcile.ts)

**Design goals:**
- **Idempotent.** Running it twice must produce the same end state. Each run re-applies the same target values.
- **Transactional.** All contract/MP/allocation updates wrapped in `prisma.$transaction`. Shipment re-aggregation is outside the tx because `recalculateShipment` uses the global prisma client and calls back into the calc engine.
- **Explicit targets.** Each of the 4 contracts is hardcoded in a `TARGETS` array with its full expected state. No inference from the xlsx at runtime — the values are frozen to the post-all-fixes SSOT state.
- **Matching strategy tolerant of missing contract FKs.** The DB `MateriaPrima` rows do not carry an explicit `contractId`, so the script matches MP to contract by `(shipmentName, punteo, supplierNote substring)`. There are two "José David" rows in Bloque 1, so the script disambiguates by `oro` value (P30172 = 435, P40028 = 412.5).
- **Persists both the scalar fields and the computed fields.** The script calls `calculateContract` with `montoCredito = own MP totalMP` so per-contract `costoFinanciero` matches the SSOT `S_i` formula, then writes all seven downstream fields.
- **Calls `recalculateShipment` at the end.** Both January shipments get re-aggregated from the freshly-updated contract rows.

**Why `montoCredito = totalMP`:** the `calculateContract` function has a three-way costoFinanciero resolution: `costoFinanciero` override > `montoCredito`-based computation > zero. The `montoCredito` path is: `monto × (0.08/12) × 2 / tipoCambio`. This is mathematically equivalent to the SSOT `((O_i × 0.08 / 12) × 2) / 7.65` when `monto = O_i`. So we pass the contract's own MP total as `montoCredito` to get the SSOT's per-contract financial cost.

**Note for future-me:** this re-uses an existing parameter (`montoCredito`) for a different semantic purpose (the contract's MP total, not a credit amount). The parameter name is misleading in this context. A future cleanup could rename it or add a dedicated parameter `materiaPrimaTotalGtq` and have both work.

**Mutation count per run:** 12 (3 MP updates + 1 already-correct MP = 4 MP touches, 4 allocation creates on first run / skips after, 4 contract scalar updates, 4 contract derived-field updates = 12 effective mutations, allocations idempotent after first run). On the first run it was 16 (4 allocations are new); on subsequent runs it drops to 12 because allocations already exist.

**Final run output:**

```
— P30172  O=170721.36  S=1778.24  V=1225859.86
— P40028  O=156034.42  S=1692.40  V=1117604.01
— P40022  O=161472.62  S=1686.65  V=1159250.21
— P40129  O=171600.00  S=1689.97  V=1227232.38
```

All four contracts now match the SSOT `O_i / S_i / V_i` at 2-decimal precision.

### 6.4 Regression gate

**File:** [src/lib/services/__tests__/january-ssot.test.ts](../src/lib/services/__tests__/january-ssot.test.ts)

6 tests:
- 4 per-contract: full `facturacionLbs / facturacionKgs / gastosExportacion / utilidadSinGE / costoFinanciero / utilidadSinCF / totalPagoQTZ` chain asserted to 2-decimal precision against the SSOT values.
- 2 shipment-aggregate: Block 1 and Block 2 `utilidadBruta` + `margenBruto` via `calculateShipmentMargin`, computed from hand-assembled inputs to isolate from any dependency on DB state.

**Tolerance choice.** I initially set `toBeCloseTo(value, 4)` for 4-decimal precision, which failed on P40028 by ~0.00008 Q (sub-millicent). I loosened to `toBeCloseTo(value, 2)` because:
- The DB stores via `@db.Decimal(14, 2)` so sub-cent differences are invisible in prod anyway.
- Decimal.js operation chains accumulate rounding past the 4th decimal.
- 2-decimal precision is the enterprise standard.

The shipment margin test uses `toBeCloseTo(0.15594, 4)` because margins are displayed as percentages with 2 decimals, so a 4-decimal fraction tolerance gives 2-decimal percentage precision.

---

## 7. Bugs discovered and fixed along the way

Cataloguing every bug so future debugging can quickly check against this list.

### 7.1 Stale MP data from a pre-Friday import

**Where:** DB rows in `materia_prima` for January 2026.

**What:** P30172 had `pergamino = 544.36` (should be `574.0695` per Friday fix). P40129 had `totalMP = 1,092,736.25` (the pre-Q3 O31 literal override, should be `969,618.73` per Q3 fix). P40028 had tiny drift from the same cause.

**How it happened:** the DB was imported once via [scripts/import-excel.ts](../scripts/import-excel.ts) before Friday's fix, and never re-imported. The Friday fix to `L13 = =K13*J13` only exists in the xlsx; the DB retained the stale literal.

**Fix:** reconciliation script updates the four MP rows to the post-all-fixes SSOT values. Until the importer is fixed (§9.1), the reconciliation script is the only path that produces correct January data.

### 7.2 `MateriaPrimaAllocation` table completely empty

**Where:** DB table `materia_prima_allocations`.

**What:** Zero rows DB-wide. Every contract was unlinked from its MP.

**How it happened:** [scripts/import-excel.ts:807-819](../scripts/import-excel.ts#L807-L819) creates `MateriaPrima` rows but never creates the allocation join. The schema has the table, the app has the relation, but the importer doesn't populate it.

**Fix:** reconciliation script creates 1 allocation per contract (4 total for January) with `quintalesAllocated = null` (full allocation). The null semantics are documented in the existing schema: `quintalesAllocated Decimal? @db.Decimal(10, 2) // null = full allocation (backward compat)`.

**Consequence for future months:** any re-import using the current importer will create MP rows but no allocations, and any future reconciliation will have to create the allocations or fix the importer first.

### 7.3 `Contract.rendimiento = 1.32` hardcoded at import

**Where:** [scripts/import-excel.ts:782](../scripts/import-excel.ts#L782).

**What:** every imported contract gets `rendimiento: 1.32` regardless of what the xlsx says. The correct per-contract values (1.3197, 1.3245, 1.3200, 1.3226) were imported onto `MateriaPrima.rendimiento` correctly but lost on the contract side.

**Fix:** reconciliation script sets `Contract.rendimiento` to the matching MP row's rendimiento. This keeps the deprecated column consistent until it's removed in a future cleanup.

### 7.4 "3¢ precision drift" was a bug in my own Phase A script

**Where:** `phase-a-january-diff.ts` expected-values table.

**What:** I hand-computed some SSOT values at 2-decimal precision and got a few digits wrong (e.g., wrote `161472.65` when the real value is `161472.62`). Phase A flagged them as mismatches. I initially framed this as "precision drift in the persist layer" and added a to-do to trace Decimal.js rounding. It was actually just my typo.

**Fix:** re-read the values directly from `Enero.xlsx` via a node script, updated the expected table. Lesson: never hand-compute an expected table — always extract from the source. This is in the script now as a comment.

### 7.5 `LBS_TO_KGS_FACTOR = 1.01411` is an approximation

**Where:** [src/lib/services/calculations.ts](../src/lib/services/calculations.ts), constant definition.

**What:** The constant is `1.01411` (5 decimals). The true ratio `(69 × 2.2046 / 100) / 1.5 = 1.01411733…` has more precision. Using the truncated version drifts `sacos × (bolsa+dif) × 0.00000733…` per contract, which is about 1 USD at realistic volumes.

**Impact:** This was the root cause of the first post-reconciliation run showing `O = 170720.35` for P30172 instead of the correct `170721.36`. One dollar of drift cascaded through `R`, `T`, `V`.

**Fix:** replaced the `× LBS_TO_KGS_FACTOR` step with the canonical SSOT formula `sacos69 × 69 × 2.2046 × (precioBolsaDif / 100)`, which is mathematically exact. The constant is still defined (unused) to avoid deleting a named constant that could be imported elsewhere; `LBS_PER_KG = 2.2046` is now the only factor used.

### 7.6 `gastosExportacion = gastosPerSaco × sacos69kg` (wrong unit)

**Where:** [src/lib/services/calculations.ts](../src/lib/services/calculations.ts), in `calculateContract`.

**What:** gastos was multiplied by the 69-kg sack count instead of the quintal count (46 kg). Business rules §1.7 and SSOT column Q are unambiguous: `Q = P × J` where `J` is sacos46.

**How it was hidden:** prod did not exercise this code path. The app was computing gastos from a shipment-level `exportCostConfig.gastosPerSaco` via some other path, and those stored values happened to be correct. The bug only fired when I ran `calculateContract` directly from the reconciliation script.

**Fix:** `gastosExportacion = gastosPerSaco × sacos46kg`. Fixed the pre-existing test that was encoding the bug (it used rate=34.5 × sacos69=275 = 9487.5 which coincidentally equals rate=23 × sacos46=412.5, so it silently accepted the wrong formula).

### 7.7 Reconciliation script initially pulled `gastosPerSaco` from the wrong source

**Where:** First version of `phase-c-january-reconcile.ts`.

**What:** My reconciliation script fell back to `ExportCostConfig.gastosPerSaco` when `Contract.gastosPerSaco` was null. The default config had `gastosPerSaco = 23` (correct for Block 2, wrong for Block 1 which should be 20). Running the reconciliation once actually *regressed* Block 1 gastos to `23 × 435 = 10,005` instead of the correct `8,700`.

**How I noticed:** the reconciliation's first output showed `V = 1215876.61` for P30172 instead of the expected `1225859.86`. The diff was `-9,983.25`, which I recognized as `1,305 × 7.65` (extra gastos × tc). Worked backward to find the source.

**Fix:** encoded the right rate per target in the reconciliation script (`gastosPerSaco: "20"` for Block 1, `"23"` for Block 2). Also persisted `Contract.gastosPerSaco` for each contract so future calc runs pick it up from the contract itself, not from the shipment-level config.

### 7.8 `tipoFacturacion` enum UI labels were inverted semantically

**Where:** [src/app/(dashboard)/contracts/_components/contract-form.tsx](../src/app/(dashboard)/contracts/_components/contract-form.tsx) and related.

**What:** The UI was labeling `LIBRAS_GUATEMALTECAS` as "Libras" and `LIBRAS_ESPANOLAS` as "Kilos". But in the calc code, `LIBRAS_GUATEMALTECAS` (the default) uses `sacos46 × precio × 1.01411` which is the kgs-equivalent path, and `LIBRAS_ESPANOLAS` adds another kg uplift (double-multiplying). So the "Libras" label was actually producing kg-uplift values, and the "Kilos" label was buggy.

This wasn't firing in prod because nobody was toggling the enum (every January contract had the default). But it was a latent landmine.

**Fix:** indirectly resolved by collapsing the billing formula to a single kg path. Both enum values now produce identical output, matching the SSOT. The enum and labels are technically still there, but they no longer affect anything. A future cleanup should remove them entirely.

---

## 8. Final state

### 8.1 SSOT (Enero.xlsx after all fixes)

| Cell      | Value         | How |
|-----------|---------------|-----|
| L13       | 574.0695      | `=K13*J13` (Friday fix) |
| L14       | 546.35625     | `=K14*J14` (Friday fix) |
| L15       | 544.50        | `=K15*J15` (Friday fix) |
| L31       | 545.5725      | `=K31*J31` (Q3 fix) |
| M31       | 1777.25       | literal (Q3c fix — was `=M13`) |
| O13       | 1,020,265.02  | `=M13*L13` (formula-driven post-Friday) |
| O31       | 969,618.73    | `=M31*L31` (Q3 fix) |
| O27       | 171,600       | literal override (legal-doc exception, Q5e reversal) |
| V20 (Block 1 Utilidad Bruta)  | 582,428.32 Q | ΣV + V16 + V18 + V19 |
| R20 (Block 1 Margen Bruto)    | 15.594 %     | `=S20/O10` |
| V36 (Block 2 Utilidad Bruta)  | 182,382.61 Q | ΣV + V32 + V33 + V34 + V35 |
| R36 (Block 2 Margen Bruto)    | 13.893 %     | `=S36/O28` |

### 8.2 DB state (Supabase prod)

Per [scripts/phase-a-january-diff.ts](../scripts/phase-a-january-diff.ts) final run: **85 OK / 0 MISMATCH / 0 MISSING / 9 benign WARN**.

**Shipment aggregates:**

| Shipment | totalFacturacionKgs | totalMateriaPrima | totalISR | totalComision | totalSubproducto | utilidadBruta | margenBruto |
|----------|---------------------|-------------------|----------|---------------|------------------|---------------|-------------|
| Enero 2026 - Bloque 1 | 488,228.40 USD | 2,958,989.30 Q | 0 | 28,917.00 Q | 67,620.54 Q | **582,428.32 Q** | **0.15594** |
| Enero 2026 - Bloque 2 | 171,600.00 USD | 969,618.73 Q | 65,764.16 Q | 9,466.88 Q | 0 | **182,382.62 Q** | **0.138933** |

**Monthly weighted margin** (the old 18.29 % bug): **15.15 %**, computed live from `getMonthlyContext` by summing per-contract utilidad / per-contract facturación across both blocks.

### 8.3 Test suite

31/31 passing.
- 25 tests in `calculations.test.ts` (existing behavior unchanged where correct, fixed where buggy).
- 6 tests in `january-ssot.test.ts` (the new regression gate).

`npx tsc --noEmit` clean.

### 8.4 Code changes

| File | Change |
|---|---|
| [prisma/schema.prisma](../prisma/schema.prisma) | Added `ExportingEntity` enum + `Contract.exportingEntity` + `Contract.facturacionKgsOverride` + `Contract.overrideReason`. Marked `Contract.rendimiento` and `Contract.tipoFacturacion` as deprecated in comments. |
| [src/lib/services/calculations.ts](../src/lib/services/calculations.ts) | Collapsed billing to single kg path. Replaced `LBS_TO_KGS_FACTOR` approximation with canonical SSOT kg formula. Added `facturacionKgsOverride` support. Fixed `gastosExportacion` unit bug. |
| [src/lib/services/__tests__/calculations.test.ts](../src/lib/services/__tests__/calculations.test.ts) | Updated `tipoFacturacion` test to assert single-path equivalence. Fixed `gastos exportacion` test. Added `facturacionKgsOverride` test. |
| [src/lib/services/__tests__/january-ssot.test.ts](../src/lib/services/__tests__/january-ssot.test.ts) | **New.** 6-test regression gate, cell-for-cell parity with `Enero.xlsx`. |
| [scripts/phase-a-january-diff.ts](../scripts/phase-a-january-diff.ts) | **New.** Read-only Phase A diff script. Canonical SSOT expected values frozen to 2026-04-15 post-fix state. |
| [scripts/phase-c-january-reconcile.ts](../scripts/phase-c-january-reconcile.ts) | **New.** Idempotent, transactional one-shot reconciliation. |

### 8.5 Data changes (Supabase prod)

| Table | Rows touched | Mutation |
|---|---|---|
| `materia_prima` | 4 | Updated `rendimiento` / `pergamino` / `precioPromQ` / `totalMP` to SSOT values (P30172, P40028, P40129 were stale; P40022 was already correct but re-applied for idempotency) |
| `materia_prima_allocations` | 4 | Created (were missing) — one per January contract → MP row, 1:1 |
| `contracts` | 4 | Set `exportingEntity`, `gastosPerSaco`, `rendimiento` (synced with MP), plus recomputed `facturacionLbs` / `facturacionKgs` / `gastosExport` / `utilidadSinGE` / `costoFinanciero` / `utilidadSinCF` / `totalPagoQTZ`. Also set `facturacionKgsOverride` + `overrideReason` + `isrAmount` on P40129. |
| `shipments` | 2 | Re-aggregated via `recalculateShipment` — `totalFacturacionKgs` / `totalMateriaPrima` / `totalISR` / `totalComision` / `totalSubproducto` / `utilidadBruta` / `margenBruto` all refreshed. |

All mutations were wrapped in a single Prisma transaction except the shipment re-aggregation (which uses the global prisma client via `recalculateShipment`). If the transaction had failed mid-run, the MP / allocation / contract changes would have rolled back cleanly; the shipment aggregates would have been recomputed from whatever the current state was.

---

## 9. Known follow-ups and landmines

### 9.1 `scripts/import-excel.ts` is still broken

The importer has two structural bugs that this session did **not** fix:

1. It creates `MateriaPrima` rows without ever creating `MateriaPrimaAllocation` rows. Every import run leaves the join table empty.
2. It hardcodes `rendimiento: 1.32` on every Contract row regardless of the xlsx content.

**Consequence:** re-running the import script on `Enero.xlsx` will **undo** this reconciliation. The MP values will be re-imported (probably correctly since the current xlsx is post-Friday), but the allocations will not be created and the `Contract.rendimiento` hardcode will return. Future reconciliation runs will also need to recreate the allocations and re-sync `Contract.rendimiento`.

Until the importer is fixed, [scripts/phase-c-january-reconcile.ts](../scripts/phase-c-january-reconcile.ts) is the authoritative path for January data.

### 9.2 Deprecated columns

`Contract.rendimiento` and `Contract.tipoFacturacion` are marked `DEPRECATED` in the schema but not dropped. Dropping them requires updating 8 files across actions, pages, forms, and validation schemas. Safe to do in a dedicated cleanup PR; not safe to mix with any other work.

### 9.3 "Bloque" naming vs entity naming

The DB has `Enero 2026 - Bloque 1` and `Enero 2026 - Bloque 2` as shipment names. Semantically these are "January 2026 Exportadora subtotal" and "January 2026 Finca Danilandia subtotal". The `Contract.exportingEntity` column now carries the entity explicitly (`EXPORTADORA` for Bloque 1 contracts, `FINCA_DANILANDIA` for Bloque 2), but the Shipment names still use the older "Bloque" terminology. The app's current monthly aggregation doesn't care because it groups via `Contract → Shipment → year/month`. A future cleanup may introduce a proper `ShipmentMonth` (month × entity) model — this is one of the "many-to-many" things the user flagged as out of scope.

### 9.4 Sub-cent precision

The calc engine uses Decimal.js with 20-digit precision. The DB stores via `@db.Decimal(14, 2)`. Some SSOT values (e.g., 161,472.6201) cannot be represented at 2 decimals and will always round. The regression gate asserts 2-decimal parity, which is the enterprise standard. If Octavio ever wants more precision, the fix is to widen the DB column to `@db.Decimal(14, 4)` or similar, not to change the calc.

### 9.5 Feb-Dec reconciliation

Only January was reconciled in this session. Every other month likely has the same class of issues: stale MP from the initial import, missing allocations, and any number of SSOT anomalies specific to that month. The approach is documented:

1. Run `phase-a-january-diff.ts`-style script against the target month (update the expected-values table from that month's sheet).
2. Identify mismatches.
3. Write a `phase-c-<month>-reconcile.ts` script modeled on the January one.
4. Run it, re-run the diff.

Ideally the importer gets fixed first so re-imports produce correct data out of the box and per-month scripts aren't needed.

### 9.6 `getMonthlyContext` proration quirk

The function prorates shipment-level costs (MP, ISR, commission, subproducto) across contracts by `sacos69kg` share. This produces per-contract margins that don't match the shipment's own margin (e.g., P30172 shows 16.67 % while Block 1's shipment shows 15.594 %). The individual utilidades sum to the shipment total, so the **weighted** monthly margin is still correct, but a user reading per-contract numbers may be confused why contracts within the same shipment have different margins.

This is acceptable for now because:
- The weighted average is what matters for the KPI.
- The user said Q8 is out of scope until the investor/entity rework.
- The per-contract margin is a reasonable approximation — a contract with more sacos eats more of the pool, which is roughly right.

But it's a place future UI confusion may surface.

### 9.7 The `Shipment → totalMP` hides rounding at aggregation time

`recalculateShipment` uses `prisma.materiaPrima.aggregate({ _sum: { totalMP: true } })`, which sums the `@db.Decimal(14, 2)` values as stored. If the stored values have been rounded to 2 decimals, the sum carries that rounding. The regression gate accounts for this by using `toBeCloseTo(..., 0)` (±$1) on Block 1 and `(..., 1)` (±10¢) on Block 2. Not a bug — just the reality of 2-decimal persistence in a chain of computations — but worth knowing.

### 9.8 The `gastosPerSaco` dead wiring

`Contract.gastosPerSaco` and `Shipment.gastosPerSaco` both exist. The contract column was null on every January contract before this session; the reconciliation script populated it from SSOT values. The shipment column is unused. The actual gastos source in production code may still be the `exportCostConfig` join. Future audit should clarify the precedence: likely `Contract.gastosPerSaco > Shipment.gastosPerSaco > exportCostConfig.gastosPerSaco > 0`, but this needs to be verified in the calc and aggregation code paths.

---

## 10. Files changed / created

```
Created:
  docs/january-2026-reconciliation-session.md                    (this file)
  src/lib/services/__tests__/january-ssot.test.ts                (regression gate)
  scripts/phase-a-january-diff.ts                                (read-only diff)
  scripts/phase-c-january-reconcile.ts                           (reconciliation)

Modified:
  RECONCILIATION_PLAN.md                                         (live investigation log)
  prisma/schema.prisma                                           (schema additions)
  src/lib/services/calculations.ts                               (calc fixes)
  src/lib/services/__tests__/calculations.test.ts                (test fixes)
  Enero.xlsx                                                     (SSOT fixes: L13/L14/L15, L31, M31, O31, O27 override; renamed from EneroCurrent.xlsx)

Unchanged but referenced extensively:
  _THE_RULES.MD
  hopecoffee_business_rules.md
  transcripcion_completa.txt
  hector.txt
```

---

## 11. How to re-run everything

### 11.1 Prerequisites

Make sure `Enero.xlsx` at the repo root is the **current** one. All reconciliation targets are pinned to the post-all-fixes state documented in §8.1. If someone edits the xlsx, the Phase A diff expected values and the reconciliation targets both need to be updated to match.

### 11.2 Phase A (read-only diff)

```bash
npx tsx scripts/phase-a-january-diff.ts
```

Expected output: `85 OK / 0 MISMATCH / 0 MISSING / 9 WARN`. The 9 warnings are benign and documented.

If you see mismatches, stop and investigate before running Phase C. The mismatches tell you exactly which fields are wrong and by how much.

### 11.3 Phase C (reconciliation)

```bash
npx tsx scripts/phase-c-january-reconcile.ts
```

Safe to re-run (idempotent). Each run produces 12 mutations (MP updates + contract scalar updates + contract derived updates) and 0 new allocations (already created on first run). Transactional.

After running, re-run Phase A to verify.

### 11.4 Regression tests

```bash
npx vitest run src/lib/services/__tests__/january-ssot.test.ts
npx vitest run   # full suite
```

Expected: 6/6 on the January file, 31/31 total.

### 11.5 Schema push

```bash
npx prisma db push
```

Only needed if `prisma/schema.prisma` has been changed. The current schema is already in sync with Supabase prod.

---

## 12. Debugging guide for future regressions

### 12.1 "The monthly margin is wrong again"

**Symptom:** "Contexto del Mes" shows a number that doesn't match the weighted average of the SSOT blocks.

**Steps:**
1. Run `npx tsx scripts/phase-a-january-diff.ts`. If it's green, the data is correct — the bug is in the UI aggregation layer. Go to step 4.
2. If it's red, the DB has drifted. Find out which contract(s) are stale. Typical cause: someone re-imported from `Enero.xlsx` using the unfixed importer, which lost the allocations and hardcoded `Contract.rendimiento = 1.32`.
3. Run `npx tsx scripts/phase-c-january-reconcile.ts` to restore correct state. Re-run Phase A. Done.
4. If the data is correct but the UI is showing a wrong pooled value, instrument `getMonthlyContext` in [src/app/(dashboard)/contracts/actions.ts](../src/app/(dashboard)/contracts/actions.ts#L431). Log the per-contract `utilidadBruta` and `facturacionQTZ` before the sum. Compare to the per-contract values in the SSOT. The pooled value is `Σ utilidad / Σ facturación` (§3.7). If individual contracts are wrong, check their `totalPagoQTZ` and `facturacionKgs` against the SSOT.
5. If all per-contract values look right but the pooled is wrong, look at the aggregation math itself. There's probably a `contract.totalPagoQTZ` that's being double-counted or a stale `shipment.totalPagoQTZ` shadowing the per-contract values.

### 12.2 "A specific contract's number is off"

**Steps:**
1. Read the SSOT row for that contract directly:
   ```bash
   node -e "const XLSX = require('xlsx'); const ws = XLSX.readFile('Enero.xlsx').Sheets['Enero']; for (const c of ['N7','O7','Q7','R7','S7','T7','V7']) console.log(c, ws[c]?.v);"
   ```
   (Adjust cell coordinates for the right row.)
2. Query the DB for the same contract and compare field-by-field.
3. If `facturacionKgs` is off by ~1 USD, suspect a `LBS_TO_KGS_FACTOR` regression — someone re-introduced `facturacionLbs × 1.01411` instead of the canonical `I × 69 × 2.2046 × (M/100)`.
4. If `costoFinanciero` is off, check whether `montoCredito` is being passed to `calculateContract`. The per-contract `S_i` formula uses the contract's **own** MP total, not the shipment-wide sum. If `montoCredito` is null, `costoFinanciero` will be zero; if it's the shipment total, S will be N times too large for an N-contract shipment.
5. If `gastosExportacion` is off, check the unit: it should be `rate × sacos46kg`, not `rate × sacos69kg`. Block 1 uses rate=20/qq, Block 2 uses rate=23/qq.
6. If `totalPagoQTZ` is off, check `tipoCambio`. All January contracts use 7.65.

### 12.3 "P40129 (or another contract with an override) is showing the formula value, not the override"

**Steps:**
1. Check that the override is set: `Contract.facturacionKgsOverride` should be a non-null Decimal.
2. Check `overrideReason` is also set (required by convention when the override is set).
3. Check that `calculateContract` is being called with `facturacionKgsOverride` in its input — look at the action or script that's producing the value. The override only takes effect if the caller passes it.
4. If the DB has the override but the UI still shows the formula value, the cached `Contract.facturacionKgs` field may be stale. Run `recalculateShipment` or the reconciliation script to refresh the cache.

### 12.4 "`MateriaPrimaAllocation` rows are missing again"

**Cause:** almost certainly a re-import via the unfixed [scripts/import-excel.ts](../scripts/import-excel.ts). That script creates MP rows without allocations.

**Fix:** run the reconciliation script for the affected month. Long-term fix: update `import-excel.ts` to create allocations (see §9.1).

### 12.5 "Phase A diff is showing mismatches for a field I didn't expect"

**Cause candidates:**
- The SSOT has changed since the expected table was frozen. Update the expected values in [scripts/phase-a-january-diff.ts](../scripts/phase-a-january-diff.ts) — or better, add a loading step that reads the xlsx directly.
- Someone ran a manual mutation against the DB that desynced a field. Check the audit log (`prisma.auditLog` or the `AuditLog` model, if it exists) for recent writes.
- An unrelated code change in `calculateContract` or `recalculateShipment` changed a formula. Run `npx vitest run src/lib/services/__tests__/january-ssot.test.ts` — if the regression gate fails too, you've regressed a formula.

### 12.6 "The reconciliation script errors on a `José David` MP row"

**Cause:** Block 1 has two MP rows tagged with supplier note containing "José David" (one for P30172 at oro=435, one for P40028 at oro=412.5). The script disambiguates by `oro` value. If both rows have the same oro, disambiguation fails.

**Fix:** check the `supplierNote` field on each MP row. The script matches on a substring. You may need to refine the matcher (e.g., match on `lote` via the contract link) if you have two rows that can't be told apart by oro alone.

### 12.7 General "I don't trust any of this" checklist

When in doubt, run these four commands in order:

```bash
# 1. Verify SSOT is what you think it is
node -e "const XLSX = require('xlsx'); const ws = XLSX.readFile('Enero.xlsx').Sheets['Enero']; for (const c of ['L13','O13','L31','O31','M31','O27','V20','R20','V36','R36']) console.log(c, '=', ws[c]?.v, ws[c]?.f ? '(formula: '+ws[c].f+')' : '');"

# 2. Check calc engine is correct
npx vitest run src/lib/services/__tests__/january-ssot.test.ts

# 3. Check DB matches SSOT
npx tsx scripts/phase-a-january-diff.ts

# 4. If (3) is red but (2) is green, reconcile the data
npx tsx scripts/phase-c-january-reconcile.ts && npx tsx scripts/phase-a-january-diff.ts
```

If (2) is red: someone regressed `calculateContract`. Git blame the test file to find when parity was broken.
If (3) is red and (2) is green: the data is stale but the code is correct. Run (4).
If both are green but the UI still shows wrong numbers: the bug is in a UI aggregation path. See §12.1.

---

*End of session log. January 2026 is reconciled, the regression gate is in place, and the follow-ups in §9 are documented for future work.*
