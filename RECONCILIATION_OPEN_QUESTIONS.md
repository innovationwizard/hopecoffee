---
name: Reconciliation Open Questions (Feb → May 2026)
description: Six non-blocking questions split off from RECONCILIATION_PLAN_2026_JAN_MAY.md §5. Answer one at a time. Each has context, why it matters, options with tradeoffs, and a recommendation.
status: CLOSED — all six answered 2026-04-23. Resolutions recorded in RECONCILIATION_PLAN_2026_JAN_MAY.md §5.
authored: 2026-04-23
related: RECONCILIATION_PLAN_2026_JAN_MAY.md, RECONCILIATION_PLAN.md (January), _THE_RULES.MD
---

# Reconciliation Open Questions — Feb → May 2026

Context: [`RECONCILIATION_PLAN_2026_JAN_MAY.md`](RECONCILIATION_PLAN_2026_JAN_MAY.md) is ready to start **Phase 0** (script scope-and-rename + `Mayo.xlsx` inventory). **Phase C** (the actual per-month ETL against prod) is blocked on the six questions below. I can start Phase 0 as soon as you acknowledge the plan; these questions gate what happens *inside* Phase C for each month.

Format per question:
- **The question** — one sentence.
- **Why it matters** — what changes in the scripts / tests / workflow depending on your answer.
- **Options** — concrete choices with tradeoffs.
- **My recommendation** — if I had to decide alone.
- **Your answer** — for you to fill in.

---

## Q4 — What counts as "reconciled" for a month? And what tolerance do we accept?

**Why it matters.** "Done" must be measurable per month, otherwise we'll argue about it after the fact. Jan used a three-part numeric gate at ±0.03 USD tolerance; extending it to Feb–May is the default, but Mayo's volume (business rules §4.1: 25 → 57 containers) could mean absolute dollar drift becomes more visible even at the same relative precision.

The three gates Jan used:
1. **Per-contract parity**: each contract's full N/O/Q/R/S/T/V chain (facturación libras, facturación kgs, gastos, utilidad s/GE, costo financiero, utilidad s/CF, total pago QTZ) within ±0.03 USD on 2-decimal monetary fields.
2. **Shipment parity**: each shipment's `utilidadBruta` (Q) and `margenBruto` (%) match the SSOT's block row (V20/R20-style cells).
3. **Monthly weighted margin** per business-rules §2.12: `Σ utilidad_i / Σ facturación_i` matches within the same tolerance.

**Options.**
- **(a)** Keep the Jan gate as-is: three parts, ±0.03 USD, ±0.0001 on ratios, ±0.00005 on 4-decimal rendimientos.
- **(b)** Tighten to zero-cent tolerance. Requires investigating and fixing the Jan precision drift ([`RECONCILIATION_PLAN.md §10.5`](RECONCILIATION_PLAN.md)) before Feb starts. Higher quality bar; more work.
- **(c)** Keep (a) for Feb–Abr, tighten for Mayo only because volume makes drift more visible.
- **(d)** Add a fourth gate: per-contract `costoFinanciero USD` to the cent, for audit traceability.

**My recommendation.** (a) — same gate as Jan. The ±0.03 tolerance came from `@db.Decimal(14, 2)` rounding, not from a calc-engine bug. Tightening requires widening the schema column, which is directive-4 territory (your call).

**Your answer:**
(a) Keep the Jan gate as-is.

---

## Q5 — If Feb–May sheets have Jan-style hygiene issues, what's my authority?

**Why it matters.** Jan's session needed four CFO edits to `Enero.xlsx` before its formulas were internally consistent (stale literals in L13/L14, back-solve in J14, hardcoded O31, cross-sheet M31). If Feb–May have the same class of bugs in their sheets inside `Mayo.xlsx`, the next step depends on who is authoritative to fix the spreadsheet.

**Options.**
- **(a) Flag and wait.** I surface every inconsistency in `docs/ssot/{month}-2026-cell-inventory.md` and in a dedicated `issues` section, and do nothing until you or Octavio edit the xlsx in Excel. Slowest, safest, highest friction.
- **(b) Propose and user-edits (Jan pattern).** I describe exactly what cell should change to what, and you apply the edit in Excel and re-save `Mayo.xlsx`. This was the pattern for Jan (O27 literal override, M31 delink, L31/O31 formulas). Medium friction.
- **(c) Programmatic xlsx rewrite when intent is unambiguous.** I use `xlsx` / `exceljs` to rewrite specific cells directly — e.g., turn a stale literal back into the canonical `=K×J` formula — when the correct form is already documented in `hopecoffee_business_rules.md`. Fastest; risk is that "unambiguous" is in the eye of the beholder. Requires a strict "only cells where the business-rules doc already prescribes the formula" guardrail.
- **(d) Hybrid: (c) for formula-drift cases (business rules explicitly cover it), (b) for semantic cases (legal-doc overrides, ISR literals, new exceptions).**

**My recommendation.** (d). The formula-drift cases (restoring `=K×J` for pergamino calculation, restoring the per-block PROM. Q literal) are grounded in business rules §2.5 and can be rewritten programmatically without judgement. The semantic cases (is this a legal-doc override? is this ISR genuinely this value?) are judgement calls that belong with you or Octavio.

**Your answer:**
(a) Flag and wait. 

---

## Q7 — How do we execute Phase C against prod?

**Why it matters.** Jan ran live in prod with no dry-run on your direction. For Feb–May, especially Mayo (highest volume), dry-run discipline reduces blast radius if a cell was misread.

**Options.**
- **(a) Same as Jan:** live in prod, no dry-run. Fastest; no safety net.
- **(b) Dry-run → approve → live** per month. Each `scripts/etl-{month}-2026.ts` supports `--dry-run` (prints the diff it would apply, no writes) and `--execute` (applies). I report the diff; you approve; I run `--execute`.
- **(c) Dry-run + DB snapshot → approve → live.** Same as (b) but with an explicit Supabase snapshot before `--execute`, so rollback is a one-step restore if anything surprises.
- **(d) (b) for Feb/Mar/Abr; (c) for Mayo only** because of scale.

**My recommendation.** (d). Dry-run is cheap to add to each script; the snapshot step is worth it for Mayo because of volume + because it's the last month and a rollback to a known-good state is cleaner than forensics.

**Your answer:**
(b) Dry-run → approve → live

---

## Q10 — Is the investor / entity M:N aggregation still out of scope?

**Why it matters.** [`RECONCILIATION_PLAN.md §9.5 point 8`](RECONCILIATION_PLAN.md) and the Jan changelog §"Known follow-ups" point 4 explicitly scoped this out for Jan. "Contexto del Mes" pools contracts across entities within a month but does not model a multi-entity investor split. If that's now in scope because Feb–May amplifies the pain, the per-month template and Phase C schema need to accommodate it — which would be a schema change under directive 4.

**Options.**
- **(a) Still out of scope.** Feb–May template matches Jan's; no investor split; `Contexto del Mes` keeps pooling within the month. Cleanest.
- **(b) In scope.** I stop and ask you a schema design question before Phase C starts (N:1 investor→entity? M:N investor↔contract? Per-month investor ledger?). This pulls forward a larger piece of work.
- **(c) Partial:** keep the current pool-within-month for the DB and tests, but add a UI-only investor filter on `Contexto del Mes` that slices by entity. No schema change; just a query-layer filter. Lightweight.

**My recommendation.** (a). It's still out of scope unless business has changed. If it's in scope, it deserves its own design doc (not part of this reconciliation plan).

**Your answer:**
(a) Still out of scope. This requires an explanation by Octavio. The business rules exist only in his head. 

---

## Q11 — Do we add any YTD / multi-month KPIs once Jan–May are green?

**Why it matters.** Business rules §4.2 lists dashboard fields but doesn't explicitly call out YTD. Five months of data is the first point where a YTD card (Jan→May totals, YTD weighted margin) becomes meaningfully useful for the CFO. It's additive work — no reconciliation dependency, but a natural follow-on.

**Options.**
- **(a) No additions.** Per-month views are enough; YTD reasoning stays in the xlsx.
- **(b) YTD panel on dashboard** with: `Σ facturación`, `Σ utilidad bruta`, YTD weighted margen bruto (per §2.12 but summed Jan–current). Additive feature, ~1 afternoon of work.
- **(c) YTD + entity breakdown:** same as (b) but split by Exportadora / Finca Danilandia / Stock Lock.
- **(d) YTD + comparisons:** YTD vs. prior period (once we have more than one year), or YTD vs. budget. Larger scope.

**My recommendation.** (b) as a separate changelog entry, not part of the reconciliation. Easy to add once reconciliation is green.

**Your answer:**
YTD panel on it's own new page and dashboard + entity breakdown. Additional filters, drill downs, kpis are allowed. 

---

## Q12 — Sequencing and deadlines.

**Why it matters.** I've been assuming natural order (Febrero → Marzo → Abril → Mayo), each month fully green (Phase F done) before the next starts. If any specific month is urgent, or if Phase C can be parallelized after Phase 0 is done, the execution plan changes.

**Options for order.**
- **(a) Strict sequential, Feb → Mar → Abr → May.**
- **(b) Reverse: May first** (it's the most current and most valuable to the CFO today), then back-fill.
- **(c) Most-recent-first: May → Abr → Mar → Feb.**
- **(d) You specify a custom order.**

**Options for gating between months.**
- **(i) Hard gate:** each month must be fully green (Phase F complete) before the next starts. Slowest, safest.
- **(ii) Soft gate:** each month must hit Phase E (tests green) before the next starts; Phase F (changelog + session log) can batch at the end.
- **(iii) Parallel Phase C once Phase 0 is done.** I write all four ETL scripts in parallel, dry-run all four, then execute in sequence. Fastest; larger blast radius if I make the same mistake four times.

**Deadline.**
- Is any month urgent (e.g., CFO needs Mayo in the dashboard by a specific date)?

**My recommendation.** (a) + (i). Slower but cleanest — each month's discoveries inform the next month's expectations, and Jan's session showed that per-month surprises are the norm.

**Your answer (order + gating + any deadline):**
(a) Strict sequential 
(i) Hard gate

---

## After answers land

Once each question is answered, I will:
1. Mark the resolution in [`RECONCILIATION_PLAN_2026_JAN_MAY.md §5`](RECONCILIATION_PLAN_2026_JAN_MAY.md).
2. Update the per-month template (§3) if the answer changes the script shape (especially Q4 / Q5 / Q7).
3. Proceed with Phase 0 when all blocking items are green.

*End of questions.*
