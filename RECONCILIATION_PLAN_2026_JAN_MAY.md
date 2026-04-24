---
name: 2026 Multi-Month SSOT Reconciliation Plan (Feb → May)
description: Reconcile app DB with monthly CFO xlsx SSOTs for Feb, Mar, Apr, May 2026 via clean-slate ETL, per-month scripts, dry-run→approve→live, strict sequential with hard gates. Jan 2026 is FROZEN. Whole-DB scripts forbidden. SSOT inconsistencies → flag & wait for CFO.
status: READY — Phase 0 unblocked. All clarifying questions resolved.
authored: 2026-04-23
supersedes: nothing (scope excludes Jan — see directive 1)
---

# 2026 Multi-Month SSOT Reconciliation Plan — Feb, Mar, Apr, May

**Status:** Ready to start Phase 0. All clarifying questions resolved (§5). Six answers recorded in [`RECONCILIATION_OPEN_QUESTIONS.md`](RECONCILIATION_OPEN_QUESTIONS.md).

**For any future month's reconciliation**, consult [`docs/monthly-reconciliation-playbook.md`](docs/monthly-reconciliation-playbook.md) first — it distills the Feb → Mayo 2026 sequence into a reusable field manual (templates, formulas, error catalog, troubleshooting).
**Goal:** Cell-for-cell parity between Feb / Mar / Apr / May 2026 prod DB and their respective sheets in `Mayo.xlsx`, via clean-slate ETL, one month at a time, strict sequential (Feb → Mar → Abr → May), hard gate between months, dry-run → approve → live per month, no changes to January data in prod, no programmatic SSOT edits.
**Adherence:** Strictly [`_THE_RULES.MD`](_THE_RULES.MD). No assumptions. No mock data. No silent fixes.

---

## 0. User directives — 2026-04-23

Non-negotiable; supersede every other line in this document.

1. **Jan prod DB is frozen.** Forbidden to make any changes to January 2026 data in prod.
2. **Clean-slate ETL is authorized for Feb, Mar, Apr, May.** Truncating / dropping existing Feb–May rows is permitted.
3. **Per-month scripts and procedures.** One set of artifacts per month. No parameterization. Structural differences expected.
4. **All schema decisions are the user's.** Novel conditions → stop and ask.
5. **Single SSOT workbook:** `Mayo.xlsx` at the repo root. Standalone `Enero.xlsx` untouched (no longer canonical).
6. **No whole-DB scripts.** Scripts are month-scoped in both name and content, or split into per-month variants. Whole-DB business logic belongs in the DB or the service layer.
7. **No script deletions.** Scope-and-rename instead.
8. **Flag-only on Jan divergences; never mutate Jan in prod.**
9. **Flag and wait on any SSOT inconsistency.** No programmatic xlsx rewrites, no propose-and-apply loops. Every hygiene issue is surfaced in a report and waits for the user or Octavio to edit `Mayo.xlsx`. Phase C cannot start for a month until its SSOT is clean. (§5 Q5 resolution.)
10. **Execution mode: dry-run → approve → live** for every month's Phase C, including Mayo. No snapshot requirement. (§5 Q7 resolution.)
11. **Strict sequential, hard gate:** Febrero → Marzo → Abril → Mayo. Each month must hit Phase F (closed out) before the next month's Phase 0 analysis starts on that month. (§5 Q12 resolution.)

---

## 1. Ground state (facts verified in repo)

### 1.1 January is frozen
[`RECONCILIATION_PLAN.md §11`](RECONCILIATION_PLAN.md): cell-for-cell parity with the then-current `Enero.xlsx`, 85 OK / 0 MISMATCH / 0 MISSING on Phase A, 31/31 Vitest green. Prod DB has: 4 Jan contracts (P30172 / P40028 / P40022 / P40129), 2 shipments (Bloque 1 / Bloque 2), 4 MP rows, 4 `MateriaPrimaAllocation` rows, 1 `Subproducto`, 1 `facturacionKgsOverride` on P40129, 1 `isrAmount` on P40129, entity split populated.

[`src/lib/services/__tests__/january-ssot.test.ts`](src/lib/services/__tests__/january-ssot.test.ts) stays as-is — in-process calc-engine gate, not a mutation path.

### 1.2 Jan-touching scripts — scope-and-rename disposition

Per directives 1, 6, 7: scripts get Jan-scoped (name includes `january`, content touches only Jan) or split into per-month variants. No deletions. No whole-DB behavior remains.

| # | Current path | Current scope | Target state |
|---|--------------|--------------|---------------|
| 1 | [`scripts/import-excel.ts`](scripts/import-excel.ts) | Whole-DB — reads `docs/hopecoffee.xlsx`, iterates every sheet, imports Jan + all other months. Has the two bugs from [`RECONCILIATION_PLAN.md §11.6.1`](RECONCILIATION_PLAN.md). | **Rename** → `scripts/import-excel-january.ts`. **Scope** sheet iteration to Jan only. Add top-of-file `throw` so accidental `tsx` invocation fails before any DB connection. Keep as frozen reference material. |
| 2 | [`scripts/phase-c-january-reconcile.ts`](scripts/phase-c-january-reconcile.ts) | Jan-named, Jan-scoped by content. Mutating. | Name compliant. Add top-of-file `throw`. Keep body as reference. |
| 3 | [`scripts/phase-a-january-diff.ts`](scripts/phase-a-january-diff.ts) | Jan-named, Jan-scoped, read-only. | Keep as-is. |
| 4 | [`scripts/validate-importer-assertions.ts`](scripts/validate-importer-assertions.ts) | Whole-DB read-only. Confirmed by reading file (iterates every contract / MP / allocation). | **Rename** → `scripts/validate-importer-assertions-january.ts`. **Scope** `findMany` filters to `month='2026-01'`. Keep as frozen reference. |
| 5 | [`scripts/reaggregate-shipments.ts`](scripts/reaggregate-shipments.ts) | Whole-DB sweeper: `prisma.shipment.findMany()` + `recalculateShipment`. | **Rename** → `scripts/reaggregate-shipments-january.ts`. **Scope** to Jan shipments only. Add run guard. Feb–May ETL scripts call `recalculateShipment(shipmentId)` directly. |
| 6 | [`scripts/recalc.ts`](scripts/recalc.ts) | Whole-DB sweeper over shipments + contracts. | **Rename** → `scripts/recalc-january.ts`. **Scope** to Jan. Run guard. |
| 7 | [`scripts/migrate-subproductos.ts`](scripts/migrate-subproductos.ts) | Whole-DB one-shot migration. | **Rename** → `scripts/migrate-subproductos-january.ts`. **Scope** `findMany` to Jan's subproductos. Run guard. Per-month variants built on demand. |

### 1.3 Calc engine & schema
- `calculateContract` in [`src/lib/services/calculations.ts`](src/lib/services/calculations.ts) — single kg billing path, honors `facturacionKgsOverride`, `gastosExportacion = gastosPerSaco × sacos46kg`. Month-agnostic.
- Schema: `ExportingEntity { EXPORTADORA | FINCA_DANILANDIA | STOCK_LOT_AFLOAT }`, `Contract.facturacionKgsOverride + overrideReason`, `Contract.isrAmount + isrRate`, `MateriaPrimaAllocation` N:1.
- No migration expected for Feb–May unless Phase B surfaces a novel exception class — then **stop and ask** (directive 4).
- Deprecated-but-kept: `Contract.rendimiento`, `Contract.tipoFacturacion`. ETL must not reintroduce dependencies.

### 1.4 Business-rules doc
[`hopecoffee_business_rules.md`](hopecoffee_business_rules.md) carries the post-Jan corrections. Default rule set for Feb–May; per-month deviations are discovered via Phase A, never assumed.

---

## 2. What is structurally variable month-to-month

Re-measured per month during Phase 0.1 / Phase A. Never assumed.

- Number of `Shipment` blocks (Jan = 2).
- Contracts per block; entity mix (`EXPORTADORA` / `FINCA_DANILANDIA` / `STOCK_LOT_AFLOAT`). Jan had no `STOCK_LOT_AFLOAT`.
- `gastosPerSaco` rate per block (Jan: 20 / 23).
- ISR presence / magnitude per shipment or contract (Jan: literal on P40129 only).
- Legal-document overrides (`facturacionKgsOverride`) — Jan = 1 (P40129).
- Subproducto rows per shipment.
- N:1 MP→Contract fan-in (Jan was 1:1; scale 25 → 57 containers makes fan-in more likely).
- Stale-literal / back-solve footguns (Jan's L13 / L14 before Friday's fix).
- Scratch cells (Jan's V39–V41 / S40 / T40) — location drifts.
- `tipoCambio` — Jan: 7.65, not guaranteed for Mayo.
- Subproducto inventory crossing months (business-rules §1.10).

---

## 3. Per-month workflow — clean-slate ETL template

Sequence: Febrero → Marzo → Abril → Mayo (strict sequential per directive 11). Each month completes Phase F before the next month starts Phase A.

### Phase 0 — Prelude (shared, runs once before Febrero)

- [ ] **0.0 Scope-and-rename** the seven scripts in §1.2. Per script: `git mv` to new name, edit filters to Jan-only rows, add top-of-file `throw` for mutators (#1, #2, #5, #6, #7), update any `package.json` references. One commit per script for bisectability.
- [ ] **0.1 `Mayo.xlsx` structural inventory.** Enumerate sheet names; confirm Feb / Mar / Abr / May sheets exist. Hash the file and record in `reports/mayo-xlsx-{sha256}.meta`. Re-hash at every subsequent phase to detect silent CFO edits.
- [ ] **0.1a Jan-sheet divergence check (flag-only, per directive 8).** Read `Mayo.xlsx`'s Enero sheet read-only. Compare against prod Jan DB. Any divergence is reported in `reports/january-divergence-{date}.md` and raised to you. **No prod mutation.**
- [ ] **0.2** `Enero.xlsx` stays untouched (§5 Q16 resolution).

### Phase A — Cell inventory + diff (per month M ∈ {febrero, marzo, abril, mayo})

Read-only.

- [ ] `docs/ssot/{M}-2026-cell-inventory.md` — every formula + every literal in the month's sheet.
- [ ] `reports/phase-a-{M}-2026.json` + `.md` — diff of the month's sheet against prod. Expected baseline: DB has 0 rows for this month; Phase A confirms that before Phase C populates it.

### Phase B — Flag-and-wait on any SSOT inconsistency (per month) — strict (directive 9)

Per §5 Q5 resolution, I do **not** edit `Mayo.xlsx` programmatically, and I do **not** propose edits for you to apply on the spot. Every inconsistency found during Phase A is logged and the month pauses until the CFO fixes the sheet.

- [ ] If Phase A surfaces any of the following, the month pauses at Phase B:
  - Stale literal where business rules §2.5 prescribes a formula.
  - Back-solved formula (like Jan's `J14 = L14/K14`).
  - Cross-sheet / cross-block cell reference where a per-block literal is expected (like Jan's `M31 = M13`).
  - Hardcoded override that doesn't match a documented business-rules exception (like Jan's pre-fix `O31 = 1,092,736.25`).
  - Novel exception needing a schema change (directive 4).
- [ ] Output: `reports/ssot-issues-{M}-2026.md` — every issue listed with cell address, observed value, expected value per business rules, and the question to resolve (e.g., "Is cell X67 a legal-document override, an ISR literal, or a spreadsheet bug?").
- [ ] I report to you. You and/or Octavio decide: edit `Mayo.xlsx` in Excel and re-save. After re-save, Phase A re-runs (new sheet hash, new inventory). Phase B re-evaluates.
- [ ] Phase C does not start for this month until `reports/ssot-issues-{M}-2026.md` contains zero open issues.

### Phase C — Clean-slate ETL (per month)

One script per month:
- `scripts/etl-febrero-2026.ts`
- `scripts/etl-marzo-2026.ts`
- `scripts/etl-abril-2026.ts`
- `scripts/etl-mayo-2026.ts`

Each script:
- [ ] Idempotent, transactional, audit-logged.
- [ ] Safety lock: first statement `assertMonthNotJanuary()` that throws if any mutation target has `month === '2026-01'`.
- [ ] Supports two modes per directive 10:
  - `--dry-run` (default): reads `Mayo.xlsx`, computes full diff of what it would insert/delete against current DB, prints the diff as a structured report (`reports/dry-run-{M}-2026.md`), writes nothing.
  - `--execute`: applies the mutations inside a single transaction.
- [ ] I run `--dry-run`, report the diff, wait for your explicit approval, then run `--execute`.
- [ ] Clean-slate scope: deletes any existing rows in `Subproducto` / `MateriaPrimaAllocation` / `MateriaPrima` / `Contract` / `Shipment` (+ linked `MillingOrder` / `MillingOutput` / `Lot` if present) **where `month == M`**.
- [ ] Inserts from the month's sheet in `Mayo.xlsx`:
  - Shipments (one per entity-block).
  - Contracts with `exportingEntity`, `gastosPerSaco`, optional `facturacionKgsOverride`+`overrideReason`, optional `isrAmount`/`isrRate`.
  - `MateriaPrima` rows (may be N:1 per contract).
  - `MateriaPrimaAllocation` rows linking MP to Contract.
  - `Subproducto` rows per shipment.
- [ ] Runs `calculateContract` with `montoCredito = own MP totalMP` per business-rules §2.7.
- [ ] Calls `recalculateShipment(shipmentId)` on each shipment it just created — never sweeps all shipments (directive 6).
- [ ] Writes `AuditLog` rows.

### Phase D — Post-ETL parity diff (per month)

- [ ] `scripts/phase-d-{M}-2026-parity.ts` — read-only re-run of Phase A diff against populated DB.
- [ ] Tolerance per §5 Q4 (directive-equivalent): ±0.03 USD on 2-decimal monetary fields, ±0.0001 on ratios, ±0.00005 on 4-decimal rendimientos.
- [ ] Target: 0 MISMATCH / 0 MISSING within tolerance. Any breach → stop before Phase E.

### Phase E — Regression gate (per month)

- [ ] `src/lib/services/__tests__/{M}-2026-ssot.test.ts` — per directive 3, per-month test file. Cell-for-cell parity assertions for every contract's N/O/Q/R/S/T/V chain and every shipment's `utilidadBruta` + `margenBruto`.
- [ ] `pnpm vitest run` green. `pnpm tsc --noEmit` clean.

### Phase F — Close-out (per month)

- [ ] `changelog/2026-04-{dd}-{M}-2026-reconciliation.md`.
- [ ] `docs/{M}-2026-reconciliation-session.md` (only if non-trivial discoveries).
- [ ] Update §6 status table.
- [ ] **Hard gate:** next month does not start its Phase A until this month's Phase F is checked in.

---

## 4. Cross-cutting concerns

### 4.1 Importer disposition — resolved
Directives 6 + 7 + §1.2 row 1: `import-excel.ts` → `import-excel-january.ts`, scoped, `throw`-guarded. Per-month ETL replaces it. Two known importer bugs are frozen in the Jan version.

### 4.2 Dashboard / multi-month views
Per-month reconciliation automatically corrects "Contexto del Mes" for each month. Cross-month YTD is a separate post-reconciliation epic — §4.4.

### 4.3 Precision tolerance
Same gate as Jan, per §5 Q4 resolution: ±0.03 USD on 2-decimal monetary fields, ±0.0001 on ratios, ±0.00005 on 4-decimal rendimientos. Any breach on any month → stop and investigate.

### 4.4 Q10 — investor / entity M:N aggregation (out of scope; deferred to Octavio walkthrough)
Per §5 Q10 resolution: still out of scope. Requires dedicated business-rules walkthrough with Octavio before it can be designed. Not a blocker for Feb–May.

### 4.5 Q11 — YTD epic (post-reconciliation, separate changelog)
Per §5 Q11 resolution: once all five months are green, add a new **YTD page** (its own route) plus a **YTD panel on the dashboard**, with entity breakdown and support for filters, drill-downs, and additional KPIs. Scope is explicitly larger than a single card: includes Exportadora / Finca Danilandia / (future) Stock Lot Afloat splits, month filter, entity filter, drill-down to contract detail. Authored in its own changelog; not part of the Feb–May reconciliation closeout. To be planned after Mayo lands.

### 4.6 Prod safety
- Every Phase C mutation writes `AuditLog`.
- `prisma migrate deploy` is the default. `prisma db push --accept-data-loss` only with explicit approval.
- Dry-run → approve → live discipline applies to every month, every execution (directive 10).

---

## 5. Clarifying questions — all resolved

### Resolved by user directive 2026-04-23 (initial round)

- **~~Q1~~** ✅ `Mayo.xlsx` is the SSOT for Jan–May.
- **~~Q2~~** ✅ Per-month ETL scripts; `import-excel.ts` scoped-and-renamed.
- **~~Q3~~** ✅ Truncate / drop allowed for Feb–May. Clean-slate ETL.
- **~~Q6~~** ✅ Replicate Jan's per-month layout; no parameterization.
- **~~Q9~~** ✅ Schema changes → stop and ask.
- **~~Q14~~** ✅ Scope-and-rename, no deletions. Whole-DB scripts forbidden.
- **~~Q15~~** ✅ Flag Jan divergences; no Jan mutation.
- **~~Q16~~** ✅ `Enero.xlsx` untouched.
- **~~Q17~~** ✅ `validate-importer-assertions.ts` is whole-DB read-only; scope-and-rename.

### Resolved via `RECONCILIATION_OPEN_QUESTIONS.md` (second round)

- **~~Q4~~** ✅ Keep Jan's gate as-is: ±0.03 USD on 2-decimal monetary fields, ±0.0001 on ratios, ±0.00005 on 4-decimal rendimientos. Three-part gate (per-contract + shipment + monthly weighted margin).
- **~~Q5~~** ✅ **Flag and wait.** No programmatic xlsx rewrites. No propose-and-apply loops. Every SSOT inconsistency is logged in `reports/ssot-issues-{M}-2026.md` and the month pauses until you and/or Octavio fix the sheet and re-save. Phase C cannot start for that month until zero open issues remain. Encoded in Phase B above.
- **~~Q7~~** ✅ **Dry-run → approve → live** for every month (Feb, Mar, Abr, Mayo). Every ETL script supports `--dry-run` and `--execute`. No snapshot requirement on Mayo beyond standard audit-log trail.
- **~~Q10~~** ✅ Still out of scope. Deferred until Octavio walkthrough.
- **~~Q11~~** ✅ YTD panel on its own new page + dashboard + entity breakdown + filters + drill-downs + KPIs. Post-reconciliation epic; scoped in §4.5. Not part of Feb–May closeout.
- **~~Q12~~** ✅ **Strict sequential** (Febrero → Marzo → Abril → Mayo), **hard gate** (each month's Phase F complete before next month's Phase A starts). No stated deadline.

---

## 6. Status tracking

| Month    | Phase 0 | Phase A | Phase B | Phase C | Phase D | Phase E | Phase F | Notes                                              |
|----------|---------|---------|---------|---------|---------|---------|---------|----------------------------------------------------|
| Enero    | —       | —       | —       | —       | —       | ✅ (frozen) | ✅ | FROZEN per directive 1.                         |
| Febrero  | ✅       | ✅       | ✅       | ✅       | ✅       | ✅       | ✅       | Complete 2026-04-24. Shipment `cmoce9r8h00003qvwyinbk29m`. Utilidad Q 501,636.77 · Margen 19.77%. |
| Marzo    | ✅       | ✅       | ✅       | ✅       | ✅       | ✅       | ✅       | Complete 2026-04-24. Shipment `cmocf3oka00003qla4dhx94np`. Utilidad Q 323,430.79 · Margen 6.01%. First use of dup-split + multi-client. |
| Abril    | ✅       | ✅       | ✅       | ✅       | ✅       | ✅       | ✅       | Complete 2026-04-24. 2 shipments: Exp `cmocgruem00023qydc4uwx16b` (Q 695,754 / 8.98%), SL `cmocgrujq00033qydb9vv3u8k` (Q 1,483,995 / 90.04% — flag: stock-lot-afloat COGS field live but null). New clients: Westrade [WST], Plateau Harvest [PLH]. |
| Mayo     | ✅       | ✅       | ✅       | ✅       | ✅       | ✅       | ✅       | Complete 2026-04-24. Shipment `cmocj0mnu00033q6a6twrvn9d`. Utilidad Q 2,157,229.70 · Margen 10.17% (above target!). First use of importerId + alternateContractNumber. New clients: LIST+BEISLER, Falcon, ICC. |

Phase 0 is shared (runs once). Phase A–F are per-month and strictly sequential.

---

## 7. Non-negotiables

- **Jan is sacrosanct** (directive 1). Every mutating code path is guarded at call-site.
- **No whole-DB scripts** (directive 6).
- **No deletions of existing scripts** (directive 7).
- **Schema changes require user approval** (directive 4).
- **Flag-and-wait on any SSOT inconsistency** (directive 9). I do not edit `Mayo.xlsx`. I do not propose on-the-spot Excel edits. I log the issue and wait.
- **Dry-run → approve → live** for every Phase C execution (directive 10).
- **Strict sequential, hard gate** (directive 11). No parallelization. No soft gate.
- **Flag-only on any Jan divergence** (directive 8). I never mutate Jan in prod.
- No fabricated values. Every reconciled cell traces to `Mayo.xlsx` or a user-answered question.
- No TODOs, no placeholders, no partial months.
- No mock data in prod paths. Test fixtures stay in `src/lib/services/__tests__/`.
- Every Phase C script: idempotent, transactional, audited, dry-runnable.
- No destructive git operations without explicit authorization.

---

*End of plan. Phase 0 starts on your go-ahead.*
