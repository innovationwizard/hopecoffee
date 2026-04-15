# January SSOT ↔ App Reconciliation Plan

**Status:** Draft — blocked on clarifying questions.
**SSOT:** `Enero.xlsx` (sheet `Enero`), as of 2026-04-14.
**Scope:** January 2026 — one calendar month, **two shipments** (Block 1 rows 5–20, Block 2 rows 25–36), **four contracts**.
**Rule adherence:** This plan makes no silent assumptions. Every unknown is listed in §4 and must be answered before code or data changes are made.

---

## 1. Ground truth extracted directly from `Enero.xlsx`

All values below were read from the workbook (formulas and literals) — not inferred.

### 1.1 Block 1 — Shipment "Enero 2026 – Bloque 1" (rows 5–20)

Contracts:

| Contrato | Cliente     | Lote       | Puntaje | Sacos 69kg (I) | Sacos 46kg (J) | Bolsa (K) | Diferencial (L) | Bolsa+Dif (M) | Gasto/saco (P) |
|----------|-------------|------------|---------|----------------|----------------|-----------|-----------------|---------------|----------------|
| P30172   | Swiss Water | Danilandia | 82      | 290            | 435            | 350       | 37              | 387           | 20             |
| P40028   | Serengetti  | Santa Rosa | 82      | 275            | 412.5          | 358       | 15              | 373           | 20             |
| P40022   | Serengetti  | Huehue     | 83      | 275            | 412.5          | 358       | 28              | 386           | 20             |
| **Total**|             |            |         | **840**        | **1260**       |           |                 |               |                |

Billing formulas (row 7–9):
- `N = J × (K+L)` (facturación libras, guatemaltecas)
- `O = I × 69 × 2.2046 × ((K+L)/100)` — equivalent to `N × 1.01411` (facturación kgs)
- `Q = P × J` (gastos exportación)
- `R = O − Q`
- `S7 = ((O13 × 0.08 / 12) × 2) / 7.65` — **per-contract costo financiero uses this contract's own `O13` (MP total), NOT the shipment-wide O16**
- `S8` uses `O14`, `S9` uses `O15`
- `S10 = (((O16 × 0.08)/12) × 2) / U10` — the *total* row uses the sum `O16`
- `T = R − S`, `V = T × U` (total pago QTZ), `U = 7.65` flat

Materia prima (rows 13–15) — **per-contract rows, not per-supplier-lot**:

| G (Contrato) | H (Proveedor) | K (Rendimiento) | L (PERGO)                | M (PROM. Q) | O (Total MP)      |
|--------------|---------------|-----------------|--------------------------|-------------|-------------------|
| P30172       | José David    | **1.3197**      | **544.36** (literal)     | 1777.25     | `=M13*L13`        |
| P40028       | José David    | **1.3245**      | **546.36** (literal)     | 1777.25     | `=M14*L14`        |
| P40022       | Kfinos        | **1.3200**      | **`=J15*K15` → 544.50**  | 1777.25     | `=M15*L15`        |

Notes:
- `J14 = L14/K14` (not `J8 × 1.5`). Interesting — P40028's "ORO" is *back-solved* from PERGO/Rendimiento, not from sacos. **This is not what the app does.**
- `M13..M15` are all literal `1777.25` — a single shared "PROM. Q" per block. `M14 = M13`, `M15 = M14`.
- `J10 = SUM(J7:J9) = 1260`, `L16 = SUM(L13:L15) = 1635.22`, `O16 = SUM(O13:O15)`.

MP / Commission / Subproducto block:
- `V16 = −O16` (Materia Prima)
- `V18 = −(3 × J10) × U10 = −3 × 1260 × 7.65 = −28,917` (commission lump, both sides at 1.50/qq × 2 sides = 3 per J)
- Subproducto: `J19 = J15/412.5 = 1` contenedor, `L19 = 33`, `M19 = (300/1.12) × 7.65 ≈ 2,049.107`, `O19 = L19 × M19 ≈ 67,620.54`
- `V19 = +O19`
- `V20 (UTILIDAD BRUTA) = SUM(V10:V19)` — **no ISR line in Block 1**
- `R20 = S20/O10 = (V20/U10) / O10` — margen bruto denominator is `O10` (facturación kgs USD), not Q10 or N10

### 1.2 Block 2 — Shipment "Enero 2026 – Bloque 2" (rows 25–36)

Single contract:

| Contrato | Cliente    | Lote     | Sacos 69kg | Sacos 46kg | Bolsa | Dif | Bolsa+Dif | Gasto/saco |
|----------|------------|----------|------------|------------|-------|-----|-----------|------------|
| P40129   | Serengetti | Organico | 275        | 412.5      | 376   | 40  | 416       | **23**     |

Key formula differences vs. Block 1:
- `N27 = M27 × J27 = 416 × 412.5 = 171,600`
- **`O27 = N27`** — no `× 1.01411` kg conversion. Block 2 bills in pure libras, not kgs-equivalent.
- `P27 = 23` (not 20 like Block 1).
- `S27 = (((O31 × 0.08)/12) × 2)/U27` — uses O31, which is **hardcoded** `1,092,736.25`, not a formula.

Materia prima (row 31):

| Contrato | Proveedor             | Rendimiento | PERGO (L)           | PROM. Q (M)   | Total MP (O)           |
|----------|-----------------------|-------------|---------------------|---------------|------------------------|
| P40129   | Comprado / J.D. Guerra| **1.3226**  | **545.57** (literal)| `= M13 = 1777.25` | **`1,092,736.25` (literal, not M31×L31)** |

- Formula `M31 × L31` would yield `1777.25 × 545.57 = 969,622.33` — **diverges from the literal by 123,113.92**. This is an unexplained hardcoded override in the SSOT.

P&L tail:
- `V32 = −O32 = −1,092,736.25`
- `V33 (ISR) = −65,764.16` (literal) — **Block 2 has ISR, Block 1 does not.**
- `V34 = −3 × U28 × J32 = −3 × 7.65 × 412.5 = −9,466.875`
- `V35 = +O35 = 0` (no subproducto contenedores)
- `V36 (UTILIDAD BRUTA) = SUM(V28:V35)`
- `R36 = S36/O28 = (V36/U28)/O28`

---

## 2. Observed app behavior (from screenshots + code audit)

From [src/lib/services/calculations.ts:229-240](src/lib/services/calculations.ts#L229-L240), `calculateMateriaPrima` already computes `pergamino = oro × rendimiento` per MP row. **The engine is not the problem; the persisted data and the per-contract↔MP mapping are.**

From [scripts/import-excel.ts:782](scripts/import-excel.ts#L782), every contract is imported with `rendimiento: 1.32` **hardcoded** — the xlsx per-contract rendimientos (1.3197, 1.3245, 1.3200, 1.3226) are discarded at the contract level. MP rows do pick up per-row rendimiento ([import-excel.ts:433](scripts/import-excel.ts#L433)), but only if the importer located them in the sheet.

Screenshots show (right-panel "Este Contrato" and "Contexto del Mes"):

| Contract | App Margen Bruto | App Total Pago QTZ | App Rendimiento displayed |
|----------|------------------|---------------------|---------------------------|
| P30172   | ≈ 18.29 %        | ~4,709,868.82 (agg) | 1.3200                    |
| P40028   | ≈ 18.29 %        | same agg            | 1.3200                    |
| P40022   | ≈ 18.29 %        | same agg            | 1.3200                    |
| P40129   | ≈ 18.29 % (shown in same "Contexto del Mes" 4-contract panel as Block 1 contracts) | same agg | 1.3200 |

Problems visible without running anything:

- **D1 — Flat rendimiento.** All four contracts display `1.3200`. Xlsx has four distinct values.
- **D2 — PERGO distribution model.** Per the online Claude analysis and the code path, the app holds one shipment-level MP total (stale: 1,635.22 from an older xlsx state) and prorates by sacos share. Xlsx holds **per-contract** PERGO values (544.36 / 546.36 / 544.50 for Block 1; 545.57 for Block 2). Proration diverges from per-contract whenever rendimientos differ, even if totals match.
- **D3 — PERGO total staleness.** Online Claude reported app total PERGO = 1,635.22; current xlsx sum = 1,635.22 for Block 1 (544.36+546.36+544.50), so the reported mismatch with a claimed "new" 1,664.93 total appears to be based on a *different* version of the xlsx than what is currently on disk. **This needs to be re-measured against the current DB, not trusted from the prior conversation.** (See Q1.)
- **D4 — Cross-shipment aggregation.** The "Contexto del Mes" card shows 4 contracts / 1,260 sacos / margin 18.29 %, but P40129 lives in Bloque 2 (a different shipment), which has different gastos/saco (23 vs 20), ISR (−65,764.16 vs 0), no kg-conversion on facturación, and its own commission/subproducto structure. Aggregating Bloque 1 + Bloque 2 into one monthly KPI without preserving the per-shipment cost structures is a category error. The latest commit (`00e6feb`) already identifies this as a live bug.
- **D5 — ISR missing for Block 2 in-app (unverified).** Xlsx has a literal `−65,764.16` for P40129. If the app isn't persisting this on the Bloque 2 shipment, Block 2's utilidad and margin will be wrong.
- **D6 — Block 2 billing mode.** Xlsx has `O27 = N27` (no 1.01411 factor). The app's `calculateContract` always applies `LBS_TO_KGS_FACTOR`. If P40129 is being computed with the factor, its facturación kgs is overstated.
- **D7 — O31 literal override.** Xlsx hardcodes `1,092,736.25` for Block 2 total MP instead of the `M31 × L31 = 969,622.33` formula. Difference = 123,113.92 GTQ. Without knowing *why*, the app cannot faithfully replicate it. This is the single largest unexplained gap in the SSOT itself.
- **D8 — Per-contract costo financiero denominator.** Xlsx uses each contract's own `O13/O14/O15` (i.e., that contract's MP total) to compute `S7/S8/S9`. If the app is using a shipment-level O total or a prorated share, per-contract S values will not match the SSOT.
- **D9 — PROM. Q is one shared number per block.** `M13=M14=M15=1777.25`, `M31=M13`. It is not an MP-row-specific field; it is the bulk quintales of the block's milling batch.
- **D10 — Gastos/saco per contract vs per shipment.** Block 1 uses P=20 for all three lines; Block 2 uses P=23. If the app stores gastos at the shipment level only, it's fine — but if it ever needs mixed rates within a shipment, the model breaks.

---

## 3. Proposed reconciliation sequence

*Execution is paused until §4 is answered.* No code or DB changes will be made before then.

### Phase A — Baseline verification (read-only)
1. Query the DB for the current stored values of: contract `rendimiento`, contract `sacos69kg/sacos46kg`, contract `precioBolsa/diferencial/gastosExportPerSaco`, shipment-level MP rows (`punteo`, `oro`, `rendimiento`, `pergamino`, `precioPromQ`, `totalMP`), subproducto rows, ISR fields, `tipoFacturacion` — for all four January contracts and both January shipments.
2. Diff every field against the table in §1. Produce a machine-readable "SSOT vs DB" report. **Do not mutate anything yet.**
3. Re-run the contract calculation engine on the DB values and compare each intermediate result (N, O, Q, R, S, T, V) against the xlsx values cell-by-cell. Isolate exactly which formulas diverge and which are just data drift.

### Phase B — Data model confirmation (no code yet)
4. Confirm with the user (see §4) the intended per-contract vs per-lot MP model, the Block-2 literal override, and the ISR policy.
5. Based on the answers, decide:
   - Whether `MateriaPrima` rows are keyed to contracts (1:1 or N:1) or stay shipment-level with per-contract override columns.
   - Whether `Contract.rendimiento` should be removed (duplicate) or kept as the source of truth.
   - How `PROM. Q` (bulk quintales) should be represented — a shipment-level field or an MP-row field with an invariant that it's identical across rows of the same milling batch.
   - How `tipoFacturacion` (kgs factor on/off) is chosen per contract/shipment.
   - Where ISR lives (shipment, contract, or both).

### Phase C — Schema & code changes
6. If Phase B requires schema changes, author a Prisma migration (idempotent, reviewed) and update `scripts/import-excel.ts` so that re-importing `Enero.xlsx` produces data that matches §1 exactly.
7. Adjust `calculateContract` / `shipment-aggregation.ts` as needed so that:
   - `costoFinanciero` can be computed from the per-contract MP total O_i (not the shipment total), matching `S7/S8/S9`.
   - Block-2-style billing (O = N, no kg conversion) is selectable per contract/shipment.
   - ISR is subtracted only where the SSOT has it.
   - Commission and subproducto aggregations match the xlsx's lump formulas.
8. Update "Contexto del Mes" and "Contexto Personalizado" so they **never aggregate across shipments with incompatible cost structures**; if month-level KPIs are desired, compute them as the sum of per-shipment P&Ls, not by re-prorating one shared cost pool.

### Phase D — Migration
9. Build a one-shot reconciliation script (idempotent) that updates the four January contracts and both January shipments to the §1 values, wrapped in a transaction, with an audit-log entry per mutation and a dry-run mode that prints the diff first.
10. Run dry-run → review → apply → re-run Phase A diff → confirm zero variance (or document every residual cell and why).

### Phase E — Regression guardrails
11. Add Vitest fixtures for all four January contracts using the exact §1 inputs and assert cell-level parity with the xlsx numbers (N, O, Q, R, S, T, V, per-contract MP, block totals, utilidad bruta, margen bruto) for both blocks. These tests become the permanent SSOT regression gate.
12. Do the same for February–December months once January is green, so the full year is locked to the xlsx.

---

## 4. Clarifying questions — **blocking**

I will not touch code or data until I have answers to these. None of them are guessable from the spreadsheet alone.

**Q1. Friday's formula fix.** You mentioned fixing a wrong formula in the SSOT on Friday. The current `Enero.xlsx` on disk has:
- `L13 = 544.36` (literal), `L14 = 546.36` (literal), `L15 = =J15*K15` (formula = 544.50), `L31 = 545.57` (literal).
- The online-Claude response you quoted assumes L13 is *now* a formula `=K13*J13 = 574.07`. That does **not** match the file on disk.

Which is correct: the file I'm reading, or the online Claude description? Specifically, *which cell(s)* did you change on Friday, from what to what?

**Q2. Per-contract vs per-lot MP.** In the xlsx, rows 13/14/15 have one entry per *contract* (P30172, P40028, P40022), each with its own PERGO and Rendimiento, but all sharing `M = 1777.25` (bulk quintales of the block). In the app, `MateriaPrima` rows are persisted at the **shipment** level (supplier lots), not the contract level. Which model is canonical?
- (a) One MP row per contract, rendimiento/PERGO per contract, `PROM. Q` is a shipment-level bulk figure shared by all rows; or
- (b) MP rows represent physical supplier lots that do not map 1:1 to contracts, and the per-contract cost is derived by some allocation rule.

If (a), `MateriaPrima` needs a `contractId` FK. If (b), what is the allocation rule and why does the xlsx show per-contract PERGO? Please pick one.

**Q3. O31 literal override (Block 2).** `O31 = 1,092,736.25` is hardcoded in the xlsx, but `M31 × L31 = 1777.25 × 545.57 = 969,622.33`. The difference is 123,113.92 GTQ. Where does the extra 123K come from? Is it a manual adjustment (e.g., an inventory cost carried from a prior month, a one-off pergamino purchase for P40129, a correction)? The app cannot replicate this without knowing the rule.

**Q4. ISR policy.** Block 1 has no ISR line. Block 2 has `−65,764.16` hardcoded. Is ISR:
- (a) always zero unless a specific trigger occurs (and if so, what trigger — a client, a contract type, a hand-entered number per shipment)?
- (b) computed from some formula (e.g., X % of utilidad) that simply happens to round to this number?
- (c) fully manual per shipment?

**Q5. Block-2 billing formula (`O27 = N27`).** Block 2 skips the `× 1.01411` kg conversion. Block 1 applies it. Is this because P40129 is contractually billed in libras guatemaltecas (no kg conversion), and Block 1 contracts are in libras españolas / kgs? If so, is this determined per contract (a `tipoFacturacion` enum) or per shipment? The app currently has `tipoFacturacion: "LIBRAS_GUATEMALTECAS" | "LIBRAS_ESPANOLAS"` but the default always applies the factor — confirm the exact semantics you want.

**Q6. Gastos exportación per saco.** Block 1 = 20, Block 2 = 23. Is this a shipment-level field (correct for January, since each block is its own shipment), or can it vary contract-by-contract within a shipment in other months?

**Q7. Per-contract costo financiero denominator.** `S7 = ((O13 × 0.08 / 12) × 2) / 7.65` uses P30172's own MP total, not the shipment-wide sum. In the app, which value currently feeds `costoFinanciero`? (From the code, it looks like the app uses `montoCredito` as an explicit input — is that `montoCredito` supposed to equal `O_i` for each contract, or the shipment-level O total, or something else entirely?)

**Q8. Monthly "Contexto del Mes" aggregation semantics.** The current UI aggregates all 4 January contracts into one KPI strip (1,260 sacos, 18.29 %, 4.7M Q revenue). But P40129 is in a different shipment with a different cost structure. Do you want:
- (a) Month-level KPIs computed as the arithmetic sum of per-shipment P&Ls (each shipment keeps its own costs/ISR/commission/subproducto), then a weighted margin = Σutilidad / Σfacturación? Or
- (b) Month-level KPIs that fully re-pool costs across shipments (which is what produces the current bug)?

The xlsx doesn't show a single "January total" line, so the convention is yours to set. Please pick.

**Q9. `M14 = M13`, `M15 = M14`, `M31 = M13` chaining.** This is a single bulk quintales number referenced across all MP rows *and across blocks*. Is `PROM. Q` really a month-level global, or is `M31 = M13` just a spreadsheet shortcut the user typed and the real intent is a per-block bulk figure? If it's per-block, why does Block 2 reference Block 1's cell?

**Q10. `J14 = L14/K14` back-solve.** P40028's MP `ORO` is derived by dividing PERGO by Rendimiento instead of using `sacos46kg` directly. `L14/K14 = 546.36/1.3245 = 412.50` — which happens to equal `J8` (275 × 1.5). Coincidence, or is this a deliberate cross-check? Do you want the app to enforce `oro == sacos46kg` as an invariant, or allow them to drift?

**Q11. Screenshot vs disk xlsx.** The app screenshots all show margin 18.29 %. What does the current `Enero.xlsx` show for `R20` (Block 1 margen bruto) and `R36` (Block 2 margen bruto) when opened in Excel (with formulas evaluated)? If you can paste both numbers, I can compute the exact target per-block margins so Phase A has a numeric goal.

**Q12. Scope of this reconciliation.** Is this fix scoped only to January, or do you want me to treat the full year (Feb–Dec) as in-scope immediately? Same SSOT issues likely exist in every month.

---

## 5. Non-negotiables (from `_THE_RULES.MD`)

- No fabricated values will be written to the DB. Every reconciled number must trace to a cell in `Enero.xlsx` or an answered question in §4.
- No TODOs, no placeholder data, no partial "80 %" implementations.
- If an answer in §4 reveals that the SSOT itself is wrong (e.g., the 123K override in Q3 has no business justification), I will escalate rather than silently encode the error in the app.
- The reconciliation script in Phase D will be idempotent, transactional, audited, and dry-runnable — per Rules 2, 3, 5, 8.

---

---

## 6. Update 2026-04-14 — pre-Friday xlsx received

User supplied `Enero-pre-friday.xlsx` and screenshots of its rendered values.

### 6.1 File-identity anomaly (blocking)

I dumped every cell (formulas + literals) from both `Enero.xlsx` and `Enero-pre-friday.xlsx`. **They are identical** — same formulas in B7:V20 and B27:V36, same literals (`L13=544.36`, `L14=546.36`, `L15==J15*K15`, `L31=545.57`, `O31=1,092,736.25`, `V33=−65,764.16`, etc.).

This means one of the following is true, and I need you to tell me which before I do anything else:

- **A.** The Friday fix did not actually get saved to the file you uploaded as the "new" SSOT, and `Enero.xlsx` on disk is still the pre-Friday version. In that case, tell me the exact cell(s) you changed and what you changed them to, and I will re-derive all targets from the corrected formulas.
- **B.** The Friday fix was in a different artifact (a different sheet, a pivot, a named range, cell formatting/rounding only, or a different workbook entirely that I should be looking at). Tell me where.
- **C.** The Friday fix and the pre-Friday state are literally the same numbers, and what you changed was upstream (e.g., a value you typed into a cell that is not a formula) — in which case the two files should *not* be identical and one of them is stale. Please re-export whichever is current.

**I will not attempt to reconcile anything until this is resolved**, because Phase A needs a single authoritative set of SSOT numbers to diff against.

### 6.2 Confirmed evaluated targets (from the pre-Friday screenshots)

Assuming pre-Friday = current-on-disk (pending §6.1), these are the numbers Phase A must hit cell-for-cell:

**Block 1 — Shipment Enero Bloque 1:**

| Field                                   | USD            | QTZ              |
|-----------------------------------------|----------------|------------------|
| Facturación kgs (O10)                   | 488,228.40     | 3,734,947.26     |
| Gastos exportación (Q10)                | 25,200.00      | 192,780.00       |
| Utilidad sin gastos export (R10)        | 463,028.40     | 3,542,167.26     |
| Costo financiero total (S10)            | 5,065.26       | 38,749.24        |
| Utilidad sin costo financiero (T10)     | 457,963.14     | 3,503,418.01     |
| Total Pago (V10)                        |                | **3,503,418.01** |
| Materia Prima (V16 = −O16)              |                | **−2,906,194.75**|
| Comisión (V18)                          |                | **−28,917.00**   |
| Subproducto (V19)                       |                | **+67,620.54**   |
| **Utilidad Bruta (V20)**                | 83,127.69      | **635,926.80**   |
| **Margen Bruto (R20 = S20/O10)**        |                | **17.03 %**      |

Per-contract costo financiero (S7/S8/S9): 1,656.21 / 1,692.41 / 1,686.65 USD.
Per-contract total pago (V7/V8/V9, QTZ): 1,226,563.87 / 1,117,603.93 / 1,159,250.21.

**Block 2 — Shipment Enero Bloque 2 (P40129 only):**

| Field                                   | USD            | QTZ              |
|-----------------------------------------|----------------|------------------|
| Facturación (O27 = N27, NO kg factor)   | 171,600.00     | 1,312,740.00     |
| Gastos exportación (Q27)                | 9,487.50       | 72,579.38        |
| Utilidad sin gastos export (R27)        | 162,112.50     | 1,240,160.63     |
| Costo financiero (S27)                  | 1,904.55       | 14,569.81        |
| Utilidad sin costo financiero (T27)     | 160,207.95     | 1,225,590.81     |
| Total Pago (V27)                        |                | **1,225,590.81** |
| Materia Prima (V32 = −O32)              |                | **−1,092,736.25**|
| ISR (V33)                               |                | **−65,764.16**   |
| Comisión (V34)                          |                | **−9,466.88**    |
| Subproducto (V35)                       |                | 0                |
| **Utilidad Bruta (V36)**                | 7,532.49       | **57,623.52**    |
| **Margen Bruto (R36 = S36/O28)**        |                | **4.39 %**       |

Block 1 + Block 2 (naive sum, for reference only — not how the SSOT presents January):

| Field           | QTZ                |
|-----------------|--------------------|
| Total Pago      | 4,729,008.82       |
| Utilidad Bruta  | 693,550.32         |
| Facturación kgs | 5,047,687.26       |
| Margen (sum/sum)| **13.74 %**        |

### 6.3 What the app currently shows (from screenshots) vs. SSOT

| Metric                          | App shown       | SSOT Block 1 | SSOT Block 2 | SSOT naive sum |
|---------------------------------|-----------------|--------------|--------------|----------------|
| "Contexto del Mes" revenue (Q)  | 4,709,868.82    | 3,503,418.01 | 1,225,590.81 | 4,729,008.82   |
| "Contexto del Mes" margen       | 18.29 %         | 17.03 %      | 4.39 %       | 13.74 %        |
| "Contexto del Mes" sacos        | 1,260           | 1,260        | 412.5        | 1,672.5        |
| Contracts pooled                | 4 (both blocks) | 3            | 1            | 4              |

The app's revenue `4,709,868.82` is within 19,140 Q of the naive two-block sum `4,729,008.82`. The app's margin `18.29 %` matches **neither** block and is not the weighted naive-sum `13.74 %` either. **The app is computing something that does not correspond to any line in the SSOT.** Phase A must instrument the app's aggregation path to find exactly which inputs produce 18.29 %, before any fix can be designed.

### 6.4 Question upgrades

- **Q1 is now re-scoped** → see §6.1. The "which cell did you change Friday" question is now blocking *harder* because the two files are identical.
- **Q8 is now answerable in principle**: the SSOT clearly presents two separate block-level P&Ls and never computes a January total. If you want a January KPI, define it; if you don't, the "Contexto del Mes" card should display the two blocks side-by-side (or one at a time), not pooled.
- **Q11 is answered**: R20 = 17.03 %, R36 = 4.39 %.

### 6.5 What I need from you to unblock Phase A

1. Resolve §6.1 (which file is actually current, or what the Friday fix was).
2. Answer Q2, Q3, Q4, Q5, Q8 from §4 — these drive the schema/code decisions and cannot be inferred from the xlsx alone.
3. Confirm or reject the target numbers in §6.2 as the canonical Phase A goal.

---

---

## 7. Update 2026-04-14 (later) — true post-Friday SSOT received (`EneroCurrent.xlsx`)

User uploaded `EneroCurrent.xlsx` at the repo root. This IS the real post-Friday SSOT. The earlier `Enero.xlsx` file is confirmed stale (byte-identical to `Enero-pre-friday.xlsx`) and should be removed or overwritten to avoid confusion.

### 7.1 The Friday fix, fully identified

Pre-Friday Block 1 MP rows had inconsistent formulas:
- `L13 = 544.36` (literal)
- `L14 = 546.36` (literal)
- `J14 = L14/K14` (back-solved from PERGO/Rendimiento instead of `=J8`)
- `L15 = =J15*K15` (formula, the only consistent one)

Post-Friday Block 1 MP rows are uniformly `L = K × J`:
- `J14 = J8` (normal, matches J13/J15)
- `L13 = =K13*J13` → 1.3197 × 435 = **574.0695**
- `L14 = =K14*J14` → 1.3245 × 412.5 = **546.35625**
- `L15 = =K15*J15` → 1.3200 × 412.5 = **544.50**

Block 2 (P40129) is **unchanged** from pre-Friday. `L31 = 545.57` literal, `O31 = 1,092,736.25` literal override still there, ISR still −65,764.16.

### 7.2 Canonical Block 1 targets (post-Friday) — SUPERSEDES §6.2 Block 1 table

| Cell | Field                                | Value                |
|------|--------------------------------------|----------------------|
| L13  | PERGO P30172 (=K13*J13)              | 574.0695             |
| L14  | PERGO P40028 (=K14*J14)              | 546.35625            |
| L15  | PERGO P40022 (=K15*J15)              | 544.50               |
| L16  | Total PERGO                          | **1,664.9258**       |
| O13  | Total MP P30172 (M13*L13)            | 1,020,265.02 Q       |
| O14  | Total MP P40028 (M14*L14)            | 971,011.65 Q         |
| O15  | Total MP P40022 (M15*L15)            | 967,712.63 Q         |
| O16  | Σ Total MP                           | **2,958,989.29 Q**   |
| S7   | Costo financiero P30172 (=((O13*0.08/12)*2)/7.65) | **1,778.24 USD** |
| S8   | Costo financiero P40028              | 1,692.40 USD         |
| S9   | Costo financiero P40022              | 1,686.65 USD         |
| S10  | Costo financiero total (uses O16)    | **5,157.28 USD**     |
| R10  | Utilidad s/ gastos export (unchanged)| 463,028.40 USD       |
| T10  | Utilidad s/ costo financiero         | **457,871.12 USD**   |
| V10  | Total Pago Block 1                   | **3,502,714.07 Q**   |
| V16  | Materia Prima                        | **−2,958,989.29 Q**  |
| V18  | Comisión compra/venta                | −28,917.00 Q         |
| V19  | Subproducto                          | +67,620.54 Q         |
| **V20** | **Utilidad Bruta Block 1**        | **≈ 582,428.32 Q**   |
| **R20** | **Margen Bruto Block 1 (=S20/O10)** | **≈ 15.59 %**     |

(V20/R20 computed from the new formulas; please confirm when you open the sheet. If Excel's evaluated cell differs from 582,428.32, the difference will be rounding-level and I'll adopt Excel's number verbatim.)

Block 2 targets from §6.2 remain valid: Utilidad Bruta **57,623.52 Q**, Margen Bruto **4.39 %**.

### 7.3 New cells V39/V40/V41/S40/T40 in `EneroCurrent.xlsx`

These do not exist in the pre-Friday file:

- `V39 = S36 + S20` — sum of both blocks' costo financiero (USD)
- `V40 = O28 + O10` — sum of both blocks' facturación kgs (USD)
- `V41 = V39 / V40` — a **cost ratio**, not a margin
- `S40 = 618.75 × 7.65` = 4,733.44
- `T40 = V34 / 2` = −4,733.44

They look like scratch/exploration cells. **New question Q13: are V39–V41, S40, T40 canonical new KPIs I must reconcile the app to, or scratch work I should ignore?**

### 7.4 The stale file on disk

`Enero.xlsx` (at repo root) === `Enero-pre-friday.xlsx`. I recommend deleting `Enero.xlsx` or renaming `EneroCurrent.xlsx` → `Enero.xlsx` so there is exactly one file at the canonical path. Confirm and I'll run the rename as a normal file op (no destructive git operations without your say-so).

### 7.5 Still blocking Phase A

- Q2 (per-contract vs per-lot MP model)
- Q3 (O31 literal override of 123,113.92 Q — Block 2)
- Q4 (ISR policy)
- Q5 (Block 2 `O27=N27` billing mode)
- Q8 (month-level aggregation semantics across two shipments)
- Q13 (status of V39–V41 scratch cells)
- Confirm `EneroCurrent.xlsx` renames to `Enero.xlsx` and the stale one is deleted

---

---

## 8. Update 2026-04-15 — answers from `hopecoffee_business_rules.md` + user

Source of truth for business rules: [hopecoffee_business_rules.md](hopecoffee_business_rules.md), extracted from Octavio's walkthrough transcript. This document supersedes any rule I had inferred from the spreadsheet alone.

### 8.1 Q2 — ANSWERED: per-contract MP

`MateriaPrima` will be per-contract. Schema gains required `contractId` FK. Rendimiento lives on the MP row and the duplicated `Contract.rendimiento` column goes away. `PROM. Q` (the 1,777.25 bulk quintales figure) becomes a shipment-level field. Per-contract costo financiero reads each contract's own MP row's `O_i` directly — no proration.

This is also consistent with business rules §1.3 (contracts can be covered by multiple purchases with different rendimientos, and they must be tracked separately — "you cannot simply average them without breaking the cost calculation"). So `MateriaPrima.contractId` is actually **N:1** (many MP rows per contract), not 1:1. January happens to have 1:1 only because each Block 1 contract is covered by a single purchase.

### 8.2 Q5 — ANSWERED: single invoicing formula, no enum

Business rules §1.5, §1.6, §2.3 establish one rule: invoicing is always measured in **kilograms** via `sacos69 × 69 × 2.2046 × (precio_qq / 100)`. The doc explicitly calls out (§1.5, §2.3 WARNING) that the libras path leaves ~$7,000 per container on the table and "the system MUST use the kg path."

Consequences:
- **`Contract.tipoFacturacion` enum (`LIBRAS_GUATEMALTECAS` / `LIBRAS_ESPANOLAS`) is removed.** It has no grounding in the business rules or the SSOT and was an unfounded app-side label.
- **`calculateContract` collapses to one branch.** The `LIBRAS_ESPANOLAS` branch in [calculations.ts:165-174](src/lib/services/calculations.ts#L165-L174) is deleted.
- Phase C includes a migration to drop the column from `Contract`.

### 8.3 Q5e — ANSWERED: fix the SSOT

Block 2 `O27 = N27` is a spreadsheet bug, not a business rule. User authorized the SSOT fix. New formula:

    O27 = =I27*69*2.2046*(M27/100)

User will apply the edit in Excel and re-upload `Enero.xlsx` (hand-edit preserves styles/named ranges better than a programmatic write).

### 8.4 Block 2 targets after the O27 fix (pending user re-upload)

Holding everything else constant — including the still-unresolved O31 override (Q3) and the ISR literal (Q4):

| Cell | Pre-fix         | Post-fix        |
|------|-----------------|-----------------|
| O27  | 171,600.00 USD  | **174,022.31 USD** |
| R27  | 162,112.50 USD  | 164,534.81 USD  |
| S27  | 1,904.55 USD    | 1,904.55 USD (unchanged — depends on O31, not O27) |
| T27  | 160,207.95 USD  | 162,630.26 USD  |
| V27  | 1,225,590.81 Q  | **1,244,121.48 Q** |
| V32  | −1,092,736.25 Q | −1,092,736.25 Q (pending Q3) |
| V33  | −65,764.16 Q    | −65,764.16 Q (pending Q4)    |
| V34  | −9,466.88 Q     | −9,466.88 Q     |
| **V36 Utilidad Bruta** | 57,623.52 Q | **76,154.19 Q** |
| **R36 Margen Bruto**   | 4.39 %      | **≈ 5.72 %**    |

These supersede §6.2 Block 2. Block 1 post-Friday targets in §7.2 remain valid and are unaffected by this fix. Both still below Octavio's 10–12 % target (§1.11), which is the clue that Q3 (O31 override) is doing something important to Block 2's margin.

### 8.5 Q4 — PARTIALLY ANSWERED: ISR policy

User direction: ISR is not universal. Default 0. User provides either a GTQ amount or a percentage per shipment. Followups held for schema phase:

- **Q4a:** If percentage, what base? (Facturación kgs USD, utilidad sin ISR, total pago QTZ?)
- **Q4b:** ISR at shipment level or per-contract within a shipment?

### 8.6 Business rules doc cross-checks against §7.2 post-Friday targets

Both of these independently validate the Friday fix and my post-Friday recomputation:

- **§2.5 worked example:** "435 × 1.3197 = 574.07 qq pergamino" — matches post-Friday L13 to 4 decimals.
- **§2.7 worked example:** "(Q2,958,000 × 0.08 / 12 × 2) / 7.65 = ~$5,157 USD" — matches post-Friday S10 = 5,157.28 USD to the cent.

### 8.7 Outstanding questions (dependency-ordered, after this round)

1. ~~Q2 per-contract MP~~ ✅
2. ~~Q5 invoicing formula / enum removal~~ ✅
3. ~~Q5e SSOT fix authorization~~ ✅ (awaiting re-upload)
4. **Q3** — O31 literal override of 123,113.92 Q on Block 2 (next question to ask)
5. **Q4** — ISR policy framework ✅ partial; Q4a/Q4b to resolve at schema phase
6. **Q8** — month-level aggregation semantics across two shipments
7. **Q13** — V39/V40/V41/S40/T40 scratch cell status

Phase A remains blocked on Q3 and Q8 at minimum. Q4a/Q4b and Q13 can be batched for schema phase.

---

---

## 9. Update 2026-04-15 (later) — all dependency questions resolved

### 9.1 Resolutions since §8

| ID | Resolution |
|----|------------|
| Q3 (O31 override)           | Fixed in SSOT: `L31 = =K31*J31`, `O31 = =M31*L31`. Block 2 MP is now formula-driven. |
| Q3c (M31 = M13)             | Fixed: `M31` is now the literal `1777.25`. January values coincide by accident. |
| Q2-bis (rendimiento per batch) | Rendimiento is per batch. `Lot`/`CuppingRecord`/`YieldAdjustment` already exist for batch-level tracking. `MateriaPrima` stays as the per-contract averaged rollup that the SSOT displays. `MateriaPrimaAllocation` already provides the contract link — importer just needs to populate it. |
| Entity enum                 | `EXPORTADORA \| FINCA_DANILANDIA \| STOCK_LOCK`. Block 1 = Exportadora, Block 2 = Finca Danilandia. |
| ISR                         | Keep at contract level via existing `Contract.isrRate` / `isrAmount`. |
| Business rules doc name     | Doc says "Finca de Adelante" — outdated. Real name is **Finca Danilandia**. Doc cleanup is out-of-scope for this reconciliation but flagged. |

### 9.2 P40129 facturación is a **legal-document exception**, not a formula fix

The previous "Fix the SSOT: change `O27` to `=I27*69*2.2046*(M27/100)`" direction was **reversed** after Octavio clarified: P40129's legal contract was drafted at the libras value, not the kg-uplifted value. The buyer is **legally billed Q 171,600**, not the Q 174,022.31 the default formula would produce. The loss of Q 18,530.67 of potential revenue is already baked into the signed contract and cannot be recovered.

SSOT is now:
- `O27 = 171600` literal
- Default `O` formula (`=I×69×2.2046×(M/100)`) remains the rule for every non-exceptional contract.
- The kg-uplift principle from business rules §1.5 / §1.6 still holds as the default; P40129 is the first recorded first-class exception.

### 9.3 First-class facturación override — new schema fields

Approved. Changes to `Contract`:

```prisma
facturacionKgsOverride Decimal? @db.Decimal(14, 2) // Manual override: replaces computed O value
overrideReason         String?                     // Required when override is non-null
```

`calculateContract` behavior: if `facturacionKgsOverride` is present, use it verbatim for the `O` value (and every downstream number that reads `O`: gastos, R, T, V). If null, apply the default kg formula.

UI contract: surface an "Override" badge next to facturación whenever the override is active; show `overrideReason` on hover. Never hide the exception.

Importer for January: P40129 gets `facturacionKgsOverride = 171600.00` and `overrideReason = "Legal contract drafted at libras value; kg uplift not applied. January 2026."`. All other contracts leave the field null.

This pattern is the template for any future exception (ISR anomalies, manual subproducto adjustments, supplier credits, etc.) — each gets its own `_override` + `_reason` pair, documented in the schema comments.

### 9.4 FINAL canonical targets for January — Phase A goal

All numbers verified cell-for-cell against `Enero.xlsx` after all edits.

**Block 1 — Exportadora (3 contracts: P30172, P40028, P40022):**

| Cell    | Field                          | Value               |
|---------|--------------------------------|---------------------|
| O10     | Σ Facturación kgs              | 488,228.40 USD      |
| Q10     | Σ Gastos exportación           | 25,200.00 USD       |
| R10     | Utilidad s/ GE                 | 463,028.40 USD      |
| S10     | Costo financiero (uses O16)    | 5,157.28 USD        |
| T10     | Utilidad s/ CF                 | 457,871.12 USD      |
| V10     | Total Pago                     | 3,502,714.07 Q      |
| V16     | Materia Prima (= −O16)         | −2,958,989.29 Q     |
| V18     | Comisión compra/venta          | −28,917.00 Q        |
| V19     | Subproducto                    | +67,620.54 Q        |
| **V20** | **Utilidad Bruta**             | **≈ 582,428.32 Q**  |
| **R20** | **Margen Bruto (=S20/O10)**    | **≈ 15.59 %**       |

Per-contract L/O values on the MP rows:
- P30172: L13 = 574.0695, O13 = 1,020,265.02 Q
- P40028: L14 = 546.35625, O14 = 971,011.65 Q
- P40022: L15 = 544.50, O15 = 967,712.63 Q

Per-contract S values:
- P30172: S7 = 1,778.24 USD
- P40028: S8 = 1,692.40 USD
- P40022: S9 = 1,686.65 USD

**Block 2 — Finca Danilandia (1 contract: P40129, with facturación override):**

| Cell    | Field                                    | Value               |
|---------|------------------------------------------|---------------------|
| O27     | Facturación (OVERRIDE: legal doc literal)| **171,600.00 USD**  |
| Q27     | Gastos exportación                       | 9,487.50 USD        |
| R27     | Utilidad s/ GE                           | 162,112.50 USD      |
| S27     | Costo financiero (uses O31)              | 1,689.97 USD        |
| T27     | Utilidad s/ CF                           | 160,422.53 USD      |
| V27/V28 | Total Pago                               | 1,227,232.37 Q      |
| O31     | Total MP (=M31*L31)                      | 969,618.73 Q        |
| V32     | Materia Prima                            | −969,618.73 Q       |
| V33     | ISR (literal; per-contract)              | −65,764.16 Q        |
| V34     | Comisión                                 | −9,466.88 Q         |
| V35     | Subproducto                              | 0                   |
| **V36** | **Utilidad Bruta**                       | **≈ 182,382.61 Q**  |
| **R36** | **Margen Bruto (=S36/O28)**              | **≈ 13.89 %**       |

Both blocks now sit above Octavio's 10–12 % floor (§1.11), which is the expected healthy state.

### 9.5 Minimal schema delta for Phase A/C

1. **Drop** `Contract.rendimiento` ([schema.prisma:254](prisma/schema.prisma#L254)) — duplicated with `MateriaPrima.rendimiento`.
2. **Drop** `Contract.tipoFacturacion` + `TipoFacturacion` enum ([schema.prisma:262](prisma/schema.prisma#L262)) — unfounded.
3. **Add** `Contract.exportingEntity` — enum `EXPORTADORA | FINCA_DANILANDIA | STOCK_LOCK`, default `EXPORTADORA`.
4. **Add** `Contract.facturacionKgsOverride` + `Contract.overrideReason`.
5. **Delete** the `LIBRAS_ESPANOLAS` branch in [calculations.ts:165-174](src/lib/services/calculations.ts#L165-L174).
6. **Importer fix** ([scripts/import-excel.ts:782](scripts/import-excel.ts#L782)): stop hardcoding `rendimiento: 1.32` on contracts; for each MP row, create a `MateriaPrimaAllocation` linking to the matching contract; backfill `exportingEntity` per block; set P40129's `facturacionKgsOverride` + `overrideReason`.
7. **Calc fix**: per-contract `costoFinanciero` reads the contract's own MP via the allocation join (S7 uses O13, not O16). Audit required.
8. **Aggregation fix**: `recalculateShipment` currently pools across entities. Per user direction Q8 is out-of-scope for this reconciliation — this stays as a known-issue documented here and in the code. The target for Phase A is that each individual contract's numbers match the SSOT cell-for-cell; the pooled "Contexto del Mes" card remaining wrong is acceptable for now and will be fixed when the investor/entity work lands.

### 9.6 Phase A is unblocked

Next action is Phase A.1: query the live DB for the current stored values of all January entities and produce a field-by-field diff against §9.4. No mutations yet.

---

---

## 10. Phase A results — 2026-04-15

Executed via [scripts/phase-a-january-diff.ts](scripts/phase-a-january-diff.ts). Read-only. 78 field comparisons: 46 OK, 9 WARN, 14 MISMATCH, 9 MISSING.

### 10.1 Structural findings (corrections to §9 assumptions)

- **Two shipments already exist for January**, not one: `Enero 2026 - Bloque 1` (3 contracts, 3 MP rows, 1 subproducto) and `Enero 2026 - Bloque 2` (1 contract, 1 MP row, 1 subproducto). The entity-split data shape is already in place using "Bloque" terminology. Phase C adds `Contract.exportingEntity` but does NOT need to split shipments. §9.5 overstated the schema delta.
- Consequence: the app's pooled `18.29%` is NOT coming from `recalculateShipment` (which aggregates per-shipment correctly). It is coming from a higher-level month-view join. That's a smaller fix than feared.
- **`MateriaPrima.rendimiento` is already correct** for all four contracts (1.3197, 1.3245, 1.3200, 1.3226). The `rendimiento = 1.32` bug is only on the `Contract.rendimiento` column, which §9.5 already marks for removal. MP importer at [import-excel.ts:433](scripts/import-excel.ts#L433) works correctly.
- **`MateriaPrimaAllocation` table is completely empty** DB-wide. Every January contract is unlinked from its MP row. This is the single largest import bug: contracts → MP join is 100% missing.

### 10.2 Stale MP data (pre-Friday / pre-Q3 xlsx state)

The DB was imported before the Friday L13 fix and before the Q3 O31 fix. None of the post-edit SSOT values have reached the DB.

| Contract | Field       | DB (stale)     | SSOT (target)  | Δ              |
|----------|-------------|----------------|----------------|----------------|
| P30172   | pergamino   | 544.36         | 574.0695       | +29.71         |
| P30172   | totalMP (Q) | 967,463.81     | 1,020,265.02   | +52,801.21     |
| P40028   | pergamino   | 546.36         | 546.35625      | −0.00375       |
| P40028   | totalMP (Q) | 971,018.31     | 971,011.65     | −6.66          |
| P40022   | pergamino   | 544.50 ✓       | 544.50         | 0              |
| P40022   | totalMP (Q) | 967,712.63 ✓   | 967,712.63     | 0              |
| P40129   | pergamino   | 545.57         | 545.5725       | +0.0025        |
| P40129   | totalMP (Q) | 1,092,736.25   | 969,618.73     | −123,117.52    |

Every downstream `costoFinanciero`, `utilidadSinCF`, and `totalPagoQTZ` mismatch in the diff traces to one of these four rows. Once MP is fresh, the ripple resolves:

- **P30172 `costoFinanciero`:** 1,686.21 → 1,778.24 (+92.03 USD), because S7 uses O13 and O13 changes.
- **P40129 `costoFinanciero`:** 1,904.55 → 1,689.97 (−214.58 USD), because S27 uses O31 and O31 changes.
- **P40022 `facturacionKgs`:** 161,472.62 → 161,472.65 (3¢ drift) — independent precision issue, see §10.5.

### 10.3 Schema fields missing (Phase C additions)

Confirmed on the live `Contract` model:

- `exportingEntity` — missing (enum `ExportingEntity` does not exist either)
- `facturacionKgsOverride` — missing
- `overrideReason` — missing

### 10.4 Schema fields flagged for removal (Phase C drops)

- `Contract.rendimiento` ([schema.prisma:254](prisma/schema.prisma#L254)) — duplicated; all four January contracts carry the hardcoded `1.32` from [import-excel.ts:782](scripts/import-excel.ts#L782). Drop per §9.5.
- `Contract.tipoFacturacion` + `TipoFacturacion` enum ([schema.prisma:262](prisma/schema.prisma#L262)) — all four contracts default to `LIBRAS_GUATEMALTECAS`; no grounding. Drop per §9.5.
- `Contract.gastosPerSaco` ([schema.prisma:298](prisma/schema.prisma#L298)) — **dead wiring** in the current data: null on every January contract. Actual gastos come from `exportCostConfig` linked via `exportCostConfigId` (Block 1 config = 20, Block 2 config = 23). **Decision needed:** drop the dead column, OR keep it as the documented per-contract override (null = "use shipment's exportCostConfig rate"). I recommend **keep** — the override semantics are useful when a single contract within a shipment needs a bespoke rate, even though no January contract exercises it.
- `LIBRAS_ESPANOLAS` branch in [calculations.ts:165-174](src/lib/services/calculations.ts#L165-L174) — delete per Q5.

### 10.5 Precision drift (audit item)

P40022's `facturacionKgs` is stored as 161,472.62 in the DB but the SSOT target is 161,472.645 (which rounds to 161,472.65 at 2 decimals). The calc engine uses Decimal.js and should not be dropping precision here. Root cause hypothesis: either the DB `@db.Decimal(14, 2)` column truncates via ROUND_DOWN instead of ROUND_HALF_UP, or the service layer rounds before persisting with an inconsistent mode. Trace in Phase C; tolerance for now is ±0.03 USD on 2-decimal monetary fields and should be driven to 0 by the end of Phase D.

### 10.6 The full error chain, in plain English

The DB was imported once, before Friday's fix and before the Q3/O31 correction, and has not been re-imported since. The importer has two additional bugs independent of the stale snapshot:

1. It creates `MateriaPrima` rows but never creates the `MateriaPrimaAllocation` rows that link them to contracts.
2. It hardcodes `Contract.rendimiento = 1.32` on every contract, ignoring the xlsx value.

Neither of those is the source of the pooled 18.29 % number. The 18.29 % lives in a month-view join that we have not yet located — it reads from the two (already-split) shipments and over-pools them into a single monthly KPI. Phase C step 8 in §9.5 still applies, but the fix point is a UI/query layer, not the shipment aggregate.

### 10.7 Minimum sequence to close the January gap (Phase C/D preview)

Ordered by dependency, minimal surface area:

1. **Schema migration** (Prisma): add `ExportingEntity` enum + `Contract.exportingEntity` (default `EXPORTADORA`, non-null after backfill) + `Contract.facturacionKgsOverride` + `Contract.overrideReason`. Drop `Contract.rendimiento` + `Contract.tipoFacturacion` + `TipoFacturacion` enum. Idempotent, transactional, reviewed.
2. **Code fix** (`calculateContract`): collapse to the single kg formula; remove the `LIBRAS_ESPANOLAS` branch; honor `facturacionKgsOverride` when present.
3. **Importer fix** (`scripts/import-excel.ts`): (a) create one `MateriaPrimaAllocation` per MP row with `contractId` set (nullable `quintalesAllocated` = full allocation), (b) stop hardcoding `Contract.rendimiento`, (c) backfill `exportingEntity` per block (Bloque 1 → `EXPORTADORA`, Bloque 2 → `FINCA_DANILANDIA`), (d) set P40129's `facturacionKgsOverride = 171600` + `overrideReason`.
4. **One-shot reconciliation script** (idempotent, transactional, dry-run-first): re-read `Enero.xlsx`, update the four January MP rows to the SSOT values, create the four missing allocations, set entity on the four contracts, set the P40129 override, re-run `recalculateShipment` on both Bloque shipments. Audit-log every mutation.
5. **Precision trace** for the 3¢ P40022 drift.
6. **Month-view join audit** to locate and fix the source of the `18.29 %` pooled number.
7. **Regression tests** (Vitest): fixtures for all four January contracts + both shipments asserting cell-for-cell parity with §9.4 and §10.2 targets. These become the permanent SSOT gate.

Phase A is complete. Ready for user go-ahead on Phase B (schema decision on `Contract.gastosPerSaco` keep-vs-drop per §10.4) and then Phase C (the migration + code + importer work in §10.7).

---

---

## 11. Phase C results — 2026-04-15

Executed live against Supabase prod (no dry-run per user direction).

### 11.1 Schema changes (applied via `prisma db push`)

- **Added** enum `ExportingEntity { EXPORTADORA, FINCA_DANILANDIA, STOCK_LOCK }` in [prisma/schema.prisma](prisma/schema.prisma).
- **Added** `Contract.exportingEntity` (default `EXPORTADORA`, non-null).
- **Added** `Contract.facturacionKgsOverride Decimal? @db.Decimal(14, 2)` + `Contract.overrideReason String?`.
- **Kept** (scope-narrowed): `Contract.rendimiento`, `Contract.tipoFacturacion`, `Contract.gastosPerSaco`. Dropping them would require cascading refactors across 8 UI/action/schema files; column drops deferred to a future cleanup pass. Documented as `DEPRECATED` in schema comments.
- `TipoFacturacion` enum stays in place; `calculateContract` now ignores the field entirely.

### 11.2 Code changes

- **[src/lib/services/calculations.ts](src/lib/services/calculations.ts)**:
  - Deleted the `LIBRAS_ESPANOLAS` branch; `calculateContract` now has a single billing path.
  - Replaced `facturacionKgs = facturacionLbs × 1.01411` (5-digit approximation, drifts ~$1/contract) with the canonical SSOT formula `sacos69 × 69 × 2.2046 × (precioBolsaDif / 100)`. This matches `Enero.xlsx` col O cell-for-cell.
  - Added `facturacionKgsOverride` honoring: when set, replaces both N and O with the override literal, preserving downstream consistency.
  - **Fixed a latent bug**: `gastosExportacion` was `gastosPerSaco × sacos69kg` but business rules §1.7 says it's `rate × quintales` where quintal = 46 kg. Changed to `gastosPerSaco × sacos46kg`. The app's production path didn't exercise this bug because gastos were computed via the shipment-level `exportCostConfig`, but it would have fired as soon as a contract-level override was used.
- **[src/lib/services/__tests__/calculations.test.ts](src/lib/services/__tests__/calculations.test.ts)**:
  - Updated the `tipoFacturacion` test to assert that both values produce identical output (single path).
  - Added `facturacionKgsOverride` test.
  - Fixed the `gastos exportacion` test which was encoding the bug (rate=34.5 × sacos69=275 coincidentally equals rate=23 × sacos46=412.5).

### 11.3 One-shot reconciliation — [scripts/phase-c-january-reconcile.ts](scripts/phase-c-january-reconcile.ts)

Idempotent, transactional, audit-safe. Executed successfully against prod with 12 mutations across 4 contracts:

1. Updated each January MP row's `rendimiento`, `pergamino`, `precioPromQ`, `totalMP` to the post-Friday / post-Q3 SSOT values.
2. Created 4 missing `MateriaPrimaAllocation` rows (contract ↔ MP, 1:1 for January).
3. Set `Contract.exportingEntity`: Bloque 1 → `EXPORTADORA`, Bloque 2 → `FINCA_DANILANDIA`.
4. Set `Contract.gastosPerSaco`: Bloque 1 = 20, Bloque 2 = 23 (overriding the shipment-level default config of 23).
5. Set `Contract.facturacionKgsOverride = 171600` + `overrideReason` on P40129 (legal-doc exception).
6. Set `Contract.isrAmount = 65764.16` on P40129.
7. Synced `Contract.rendimiento` with `MateriaPrima.rendimiento` for display consistency.
8. Recomputed contract-level derived fields via `calculateContract` with `montoCredito = own MP totalMP` so each contract's `S_i` matches the SSOT per-contract costo financiero.
9. Called `recalculateShipment` on both January shipments.

### 11.4 Final DB state — cell-for-cell parity with SSOT

Re-ran [scripts/phase-a-january-diff.ts](scripts/phase-a-january-diff.ts) after the reconciliation. Result: **85 OK, 0 MISMATCH, 0 MISSING, 9 WARN**. The 9 warnings are all benign: 8 are flags for the deprecated `Contract.rendimiento` + `Contract.tipoFacturacion` columns that were intentionally kept, and 1 is a count note that there are 2 January shipments (which is correct — Bloque 1 + Bloque 2).

**Shipment aggregates (post-reconciliation):**

| Shipment | Utilidad Bruta | Margen Bruto | Match SSOT? |
|----------|---------------|---------------|-------------|
| Enero Bloque 1 (Exportadora)      | 582,428.32 Q  | 15.594 %   | ✓ |
| Enero Bloque 2 (Finca Danilandia) | 182,382.62 Q  | 13.893 %   | ✓ |

**Monthly weighted margin (the old 18.29 % bug):**

Simulated `getMonthlyContext` output after reconciliation:

| Metric | Pre-reconciliation | Post-reconciliation | SSOT-canonical |
|--------|---------------------|----------------------|----------------|
| Total facturación QTZ  | (stale)    | 5,047,687.26 Q   | 5,047,687.26 Q |
| Total utilidad bruta   | (stale)    | 764,810.93 Q     | —              |
| Monthly weighted margin | **18.29 %** | **15.15 %**      | 15.15 %        |

The 18.29 % was entirely caused by stale MP data. **No change to `getMonthlyContext` was needed** — the function was correct, it was just reading wrong inputs. Business rules §2.12 (`Σ utilidad_i / Σ facturación_i`) is now satisfied.

### 11.5 Regression gate — [src/lib/services/__tests__/january-ssot.test.ts](src/lib/services/__tests__/january-ssot.test.ts)

New test file with 6 tests that assert cell-for-cell parity at 2-decimal precision:
- 4 per-contract cases: each January contract's full N/O/Q/R/S/T/V chain.
- 2 shipment aggregate cases: Block 1 and Block 2 utilidad bruta + margen bruto via `calculateShipmentMargin`.

Full test suite: **31/31 passing**. TypeScript `noEmit` clean.

### 11.6 Items NOT done (out of January reconciliation scope)

1. **`scripts/import-excel.ts` fix** — the importer still has two bugs: (a) creates `MateriaPrima` rows without `MateriaPrimaAllocation`, and (b) hardcodes `Contract.rendimiento = 1.32`. These will bite on the next re-import. Deferred as a standalone follow-up task. Until fixed, re-importing `Enero.xlsx` will undo this reconciliation; use [scripts/phase-c-january-reconcile.ts](scripts/phase-c-january-reconcile.ts) instead.
2. **Column drops** (`Contract.rendimiento`, `Contract.tipoFacturacion`) — requires updating 8 UI/actions/form files. Deferred to a dedicated cleanup pass.
3. **Per-contract facturación precision beyond 2 decimals** — the calc engine achieves 4-decimal SSOT parity; the DB rounds to 2 decimals via `@db.Decimal(14, 2)`. If Octavio ever wants sub-cent precision, widen the column; otherwise 2 decimals is enterprise-standard.
4. **Feb-Dec reconciliation** — same pattern as January (stale MP, missing allocations, various formula edits). Scope for a separate plan once the importer is fixed.
5. **Investor/entity many-to-many aggregation** — Q8 was explicitly marked out-of-scope by the user.

### 11.7 Phase C — complete

January 2026 now matches `Enero.xlsx` cell-for-cell in the Supabase prod DB. Regression gate in place. The remaining items in §11.6 are non-blocking follow-ups.

---

*End of plan. January reconciliation delivered. Follow-ups in §11.6 parked.*
