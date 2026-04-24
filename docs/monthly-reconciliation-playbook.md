---
name: Monthly SSOT Reconciliation Playbook
description: Step-by-step field manual for reconciling a new month's xlsx sheet into Supabase prod. Distilled from Feb–Mayo 2026. Includes templates, common errors, and troubleshooting.
audience: future-me (Claude), any engineer running the same workflow
authored: 2026-04-24
status: LIVE — update as new classes of errors / structural drift are observed
related:
  - _THE_RULES.MD
  - RECONCILIATION_PLAN_2026_JAN_MAY.md (concrete history: Feb–Mayo)
  - RECONCILIATION_PLAN.md (Jan historical)
  - hopecoffee_business_rules.md
  - docs/client-variant-map.md
  - docs/01-DOMAIN-MODEL.md
---

# Monthly SSOT Reconciliation Playbook

**Goal of this document**: make any future month's reconciliation fast, easy, **correct**, and straightforward — without re-discovering everything I learned over the Feb → Mayo 2026 sequence.

---

## 0. What this workflow actually is

The user's CFO (Octavio) maintains an xlsx workbook as the canonical source of truth for monthly coffee export contracts. The app persists that data in Supabase prod so it can be viewed/filtered/aggregated via the web UI. For each new month, the workflow is:

> Read the sheet → build a parsed plan → dry-run the plan → confirm with user → execute transactionally → verify parity cell-for-cell → write regression test → close out with a changelog.

Each month gets its own per-month script family (per directive 3: no parameterization). The workflow is the same; what drifts is the xlsx layout, novel exceptions, and new clients/importers.

---

## 1. Non-negotiables before touching anything

Every month's work is bounded by these (`_THE_RULES.MD` + user directives 2026-04-23/24):

1. **Never modify January 2026 prod data.** Any script that could touch Jan is already `*-january*` named, guarded with a top-of-file `throw`, and scoped to Jan-only reads if read-only. If I find myself about to mutate Jan state, **stop**.
2. **No whole-DB scripts.** Every new script is month-scoped in filename and content.
3. **No deletions of existing scripts.** Scope-and-rename instead.
4. **All schema changes require user approval.** If the sheet surfaces a condition that doesn't fit the schema, **stop, ask, wait**.
5. **Flag-and-wait on SSOT issues.** I do not edit `Mayo.xlsx` or any other CFO sheet — the CFO / user edits it in Excel; I re-hash and re-read.
6. **Dry-run → approve → execute** for every Phase C run.
7. **Strict sequential, hard gate** between months — finish Phase F of month N before starting Phase A of month N+1.
8. **No data dismissed.** Quality descriptors, alternate codes, importers, overrides — every datum on the BL must land in the right DB column (never silently zeroed).
9. **Never duplicate a Client or Importer.** Consult [`docs/client-variant-map.md`](client-variant-map.md) first; create only if `needs-create` is the map's approved decision.

---

## 2. The six phases (template)

Every month follows this arc. The names are stable; only the contents change per month.

```
Phase 0   Prelude (ONCE for the whole batch — usually done; re-check at new month)
Phase A   Cell inventory + DB baseline (read-only)
Phase B   Decide — pause on any novel / ambiguous signal
Phase C   Clean-slate ETL — dry-run first, then execute in a transaction
Phase D   Post-ETL parity against the sheet
Phase E   Regression gate (Vitest SSOT test file)
Phase F   Close-out (changelog + status-table update)
```

Artifacts created per month:

| Path | Phase | Purpose |
|---|---|---|
| `scripts/phase-a-{M}-2026.ts` | A | cell inventory + hygiene + variant-map preview + DB baseline |
| `docs/ssot/{M}-2026-cell-inventory.md` | A | every formula + literal in the sheet |
| `reports/phase-a-{M}-2026.md` | A | hygiene findings + Phase B decision |
| `scripts/etl-{M}-2026.ts` | C | the actual mutation script, `--dry-run` / `--execute` |
| `reports/dry-run-{M}-2026.md` | C | last dry-run output |
| `reports/execute-{M}-2026.md` | C | execute-mode output |
| `scripts/phase-d-{M}-2026-parity.ts` | D | post-ETL cell-for-cell diff |
| `reports/phase-d-{M}-2026-YYYY-MM-DD.md` | D | Phase D output |
| `src/lib/services/__tests__/{M}-2026-ssot.test.ts` | E | Vitest regression gate |
| `changelog/YYYY-MM-DD-{M}-2026-reconciliation.md` | F | close-out |

`{M}` is the lowercase Spanish month: `febrero`, `marzo`, `abril`, `mayo`, `junio`, etc.

Skeleton scripts to copy from: whichever month is structurally closest to the new one.
- 1-block, clean: **Febrero** is the simplest template.
- 1-block with dup-splits + multi-client: **Marzo**.
- 2-blocks + `STOCK_LOT_AFLOAT`: **Abril**.
- 1-block, importer parenthesis, alternate contract numbers: **Mayo**.

---

## 3. Phase 0 — Prelude

**Check these once per batch (not per month), or whenever a new xlsx lands:**

- [ ] The Jan-scoped guard scripts still `throw` at module load: `import-excel-january.ts`, `phase-c-january-reconcile.ts`, `reaggregate-shipments-january.ts`, `recalc-january.ts`, `migrate-subproductos-january.ts`. If any got un-guarded, restore.
- [ ] The xlsx is at repo root (`Mayo.xlsx` is the current filename — may get renamed seasonally). Hash it once via `phase-0-1-mayo-xlsx-inventory.ts` pattern and stash the hash in `reports/`.
- [ ] Sheet names match expectation. `PROMEDIOS` sheet is DERIVED — never source for ETL. Monthly sheets may be title-case (`Enero`) or CAPS (`MAYO`) — always case-exact when calling `wb.Sheets[name]`.
- [ ] Prisma client up to date: `npx prisma generate`.
- [ ] DB reachable: `.env` has `DATABASE_URL` with the transaction pooler (port 6543, `pgbouncer=true`). Direct hostnames don't work from serverless.

---

## 4. Phase A — Cell Inventory + DB Baseline

**Goal**: dump every non-empty cell, produce a machine-readable picture of the sheet, detect hygiene issues, confirm prod-DB baseline is clean-slate.

### 4.1 Starter template — copy from the closest-structured prior month

Most-reusable skeleton: [`scripts/phase-a-marzo-2026.ts`](../scripts/phase-a-marzo-2026.ts) (1-block, multi-client, handles duplicates and needs-create resolution cleanly).

Change the constants block:

```ts
const SHEET = "Junio";    // case-exact from Mayo.xlsx tab
const MONTH_NUM = 6;
const YEAR = 2026;
```

### 4.2 Column map (stable across months — verify per run)

**Contract rows** (header row has `CONTRATO` at col E, `ESTATUS` at col F):

| Col | Field |
|---|---|
| B | EMBARQUE (may be string `"Jun-26"` OR Excel serial) |
| C | POSICION (same) |
| D | CLIENTE |
| E | CONTRATO |
| F | ESTATUS (`Fijado` / `No fijado` / `FIJADO` / `NO FIJADO` — case varies) |
| G | LOTE (`Santa Rosa`, `Huehue`, `Organico`, `Stocklot`, …) |
| H | PUNTAJE (numeric 80-90) **or** textual quality (`300 defectos`) — route correctly! |
| I | SACOS 69 KGS |
| J | SACOS 46 KG (= I × 1.5 usually; Mayo had a 1:1 anomaly at row 9) |
| K | BOLSA (USD/qq NY C-market ref) |
| L | DIFERENCIAL (may be empty — back-derive if M is literal) |
| M | BOLSA + DIF (K+L OR sometimes a literal overriding K+L) |
| N | FACTURACION LIBRAS = J × M |
| O | FACTURACION KILOS = I × 69 × 2.2046 × (M/100) |
| P | GASTOS EXPORTACION POR SACO (per quintal! = per sacos46) |
| Q | GASTOS EXPORTACION = P × J |
| R | UTILIDAD US$ SIN GASTOS = O − Q |
| S | COSTO FINANCIERO = ((O_{MP_i} × 0.08/12) × 2) / U    ← references this contract's OWN MP total |
| T | UTILIDAD SIN CF = R − S |
| U | TIPO CAMBIO (7.65 typically — NOT guaranteed) |
| V | TOTAL PAGO QTZ = T × U |

**Materia Prima block** (header row detection: col G = `CONTRATO` AND col L = `PERGO`):

| Col | Field |
|---|---|
| G | CONTRATO (may be parenthesis — parse primary) |
| H | PROVEEDOR |
| I | PUNTEO |
| J | ORO (= contract's sacos46) |
| K | RENDIMIENTO (yield factor; typically 1.32, sometimes 1.3197 etc.) |
| L | PERGO = J × K |
| M | PROM. Q (often shared across block via `=M_i` cross-refs; sometimes cross-sheet `=Enero!M13`) |
| O | TOTAL MP = M × L |

**Subproducto block** (detect: col J = `CONTENEDORES` header, data 1 OR 2 rows below):

| Col | Field |
|---|---|
| J | CONTENEDORES (may be fractional, e.g. Abril 5.749, Mayo 16.848) |
| K | ORO X CONTENEDOR (33 is the observed constant) |
| L | TOTAL ORO = J × K |
| M | PRECIO SIN IVA (often cross-sheet `=Enero!M20` = 2049.107) |
| O | TOTAL PERGAMINO = L × M |

### 4.3 Hygiene checks to apply

Per-contract formula consistency (warn on > ±0.03 USD drift):

- `N = J × M`
- `O = I × 69 × 2.2046 × (M/100)`
- `Q = P × J`

Per-MP consistency (warn on > 0.05 / 1.0 drift):

- `L = J × K` (pergamino = oro × rendimiento)
- `totalMP = M × L` (= promQ × pergo)

Other info-level flags:

- Cross-sheet references (`=Enero!Mxx`, `=Marzo!Mxx`) — intentional, note but do not block.
- Duplicate contract numbers in col E — split later with `-01`/`-02` suffix.
- Contract-number parenthesis (`P2600329 (W26320-GT)`) — store primary; `alternateContractNumber` = inner.
- Cliente parenthesis (`Falcon (Wastrade)`) — plain = IMPORTER, paren = CLIENT per `feedback_importer_client_parenthesis.md` (confirmed Falcon/ICC only; new cases stop-and-ask).
- `#REF!` errors — BLOCK unless the row is `STOCK_LOT_AFLOAT` (tolerate per directive 3) OR the user has explicitly authorized loading as null.

### 4.4 Variant-map resolution preview

Every distinct `cliente` string must resolve via `resolveStrict()` to one of:

- **resolved** — map lists the variant, DB has the canonical row.
- **needs-create** — map lists the variant, DB missing the row; ETL creates on `--execute`.
- **unresolved** — map doesn't list it. **Phase C REFUSES**; user must append to the map.

Parenthesis rows: resolve BOTH the buyer and the importer separately (both can be needs-create).

---

## 5. Phase B — Decide

This isn't a script — it's a human decision point reading the Phase A report. Stop and ask the user on ANY of:

| Signal | Decision owner |
|---|---|
| Unresolved client / importer (not in variant map) | User — approve canonical + code + variants |
| `needs-create` for multiple clients in one month | User — confirm before Phase C |
| Novel schema need (no existing field captures the data) | User — approve migration |
| SSOT inconsistency (stale literal, back-solve, cross-sheet ref where literal expected, `#REF!` on non-stock-lot-afloat row) | User or Octavio — fix xlsx; I re-run Phase A |
| Duplicate contract number with NON-distinguishable details | User — clarify |
| Parenthesis pattern on a client never seen before | User — confirm which is IMPORTER vs CLIENT |
| Computed-vs-sheet divergence > ±0.03 on a non-stock-lot-afloat row | User — fix xlsx or add override field |

**Proceed to Phase C** only when: 0 errors, all variants resolved or needs-create, no novel schema need.

---

## 6. Phase C — Clean-slate ETL

### 6.1 Script skeleton

Copy the closest prior month's ETL. Key constants:

```ts
const SHEET = "Junio";
const MONTH_NUM = 6;
const YEAR = 2026;
const SHIPMENT_NAME = "Junio 2026 - Bloque único"; // or "Bloque 1/2" if multi-entity
```

### 6.2 Dry-run first, always

Every ETL script supports two modes:

```
npx tsx scripts/etl-{M}-2026.ts --dry-run    # no writes, prints diff
npx tsx scripts/etl-{M}-2026.ts --execute    # transactional mutation
```

Dry-run output must have:

- Sheet hash.
- Client / importer resolutions (no unresolved).
- Planned `{M}` inserts: shipment(s), contracts, MP, MPA, subproducto.
- Per-contract computed-vs-sheet validation — **0 divergences** within ±0.03 or refuse.
- Mutations summary.

If any computed differs from sheet by > ±0.03, `--execute` refuses. Either fix the xlsx (CFO edit + re-save) or investigate why the ETL's formula is wrong. Don't loosen the tolerance.

### 6.3 Clean-slate deletion sequence (inside the transaction)

Order matters for FK constraints:

1. `assertMonthNotJanuary(MONTH_NUM, "...")` — directive-1 guard at module-load AND inside tx.
2. Find contracts with `contractNumber IN (planNumbers)` — sweep orphans from prior imports regardless of which shipment they're linked to.
3. Guard: none of those contracts may be linked to a Jan 2026 shipment. Throw if so.
4. Delete referencing rows first:
   - `ContractPriceSnapshot` where `contractId IN (...)`
   - `ContractLotAllocation` where `contractId IN (...)`
   - `MateriaPrimaAllocation` where `contractId IN (...)`
5. Delete the orphan contracts.
6. Find the month's existing shipments: `Shipment` where `year=YEAR AND month=MONTH_NUM`.
7. Guard: none may be month=1.
8. Cascade delete: `Subproducto` → `MateriaPrimaAllocation` (by MP→shipment) → `MateriaPrima` → `Contract` → `Shipment`.

### 6.4 Insert sequence

1. Resolve needs-create clients/importers — `tx.client.create()`.
2. Create the shipment(s).
3. Create contracts with `clientId`, optional `importerId`, optional `alternateContractNumber`.
4. For each contract:
   - Apply `-NN` suffix if duplicate detected.
   - Set `exportingEntity` (EXPORTADORA default; STOCK_LOT_AFLOAT if lote matches `/stocklot/i` — detect in parser, not inserter).
   - Set `montoCredito = own MP.totalMP` (per business rules §2.7); `0` for stock-lot-afloat.
   - Set `cfMeses = 2` (default) or `0` for stock-lot-afloat.
   - `puntaje` + `defectos` — parse once; pass nulls cleanly.
5. Create MP rows (only for EXPORTADORA / FINCA_DANILANDIA; stock-lot-afloat has none).
6. Create MPA rows 1:1 positional.
7. Create Subproducto (only for blocks that have one).
8. Run `calculateContract(...)` for each contract; update DB with derived fields.
9. Write **one** `AuditLog` row with `action: "ETL_MONTH"`, `entityId` = the first shipment id, newValue = full run summary (hash, counts, suffixes, deletions).
10. After transaction commits: call `recalculateShipment(shipmentId)` per shipment — OUTSIDE the tx (service uses global prisma, not the tx handle).

### 6.5 Transaction timeout

Default Prisma interactive-transaction timeout is 5 seconds — NOT enough for any real month. Use:

```ts
await prisma.$transaction(
  async (tx) => { ... },
  { maxWait: 15000, timeout: 60000 }
);
```

Mayo (14 contracts) used `timeout: 90000`. Bigger months need more. Pattern: start with 60s, escalate if the transaction times out.

---

## 7. Phase D — Parity

Post-execute, re-read the sheet and diff against the DB. Target: **0 MISMATCH** within tolerance.

Tolerance (Jan three-part gate, carried forward):

- ±0.03 USD on 2-decimal monetary fields
- ±0.0001 on ratios (margen_bruto)
- ±0.00005 on 4-decimal rendimientos

Per-contract comparisons: the 14-field N/O/Q/R/S/T/V chain + 4-field MP chain.
Shipment: `utilidadBruta`, `margenBruto`.
Stock-lot-afloat: **skip** `costoFinanciero`/`utilSinCF`/`totalPago` (sheet is `#REF!`, DB is authoritative).

Total per month (examples): Febrero 38, Marzo 110, Abril 148 (6 skipped), Mayo 142. If any MISMATCH, do NOT proceed to Phase E.

---

## 8. Phase E — Regression gate

New test file `src/lib/services/__tests__/{M}-2026-ssot.test.ts`. Streamlined:

- 2-3 per-contract test cases covering the representative / unusual rows
- 1 shipment-aggregate case OR skip (Phase D is the exhaustive gate)

Use `toBeCloseTo(expected, 2)` (±0.005) for 2-decimal precision. If the sheet's N/O etc. are 3-decimal literals like `133051.875`, use that exact number (don't round to `133051.88` — `toBeCloseTo` uses strict `<` not `<=`).

Then:

```
npx vitest run          # expect all green
npx tsc --noEmit        # clean
```

---

## 9. Phase F — Close-out

Changelog file `changelog/YYYY-MM-DD-{M}-2026-reconciliation.md`. Template fields:

- Summary — what changed, test count, Phase D totals, sheet hash
- Trigger
- Infrastructure added (if any)
- SSOT structure notes
- Per-month mutations table
- Phase D metrics
- Files changed
- Hard gate + next-month heads-up

Update `RECONCILIATION_PLAN_2026_JAN_MAY.md` §6 status table — flip the month's row to ✅.

---

## 10. Real SSOT errors encountered Feb → Mayo (what to look for)

| Month | Cell(s) | What was wrong | How it was fixed |
|---|---|---|---|
| Enero (pre-session) | `L13/L14` | Stale literals from a prior version; no formula — broke `L=J×K` invariant | CFO edited xlsx, re-saved with `=K×J` formulas; I re-hashed + re-parsed |
| Enero (pre-session) | `J14` | Back-solved `=L14/K14` instead of `=J8` | Fixed in same CFO edit |
| Enero | `O27` | Business rules prescribe kg uplift formula; sheet had literal 171,600 | Turned out to be intentional — legal contract drafted at libras value. Added `Contract.facturacionKgsOverride` field; stored literal + reason. DO NOT silently "fix" apparent formula violations until user confirms intent |
| Enero | `O31` | Literal 1,092,736.25 disagreed with `M31×L31` | Fixed by CFO as `=M31*L31` |
| Enero | `M31` | Cross-sheet `=M13` (Block 2 referenced Block 1) | Changed to literal `1777.25` |
| Abril | `H36/H37` (stock-lot-afloat) | Textual `"300 defectos"` where numeric puntaje expected | Routed to new `Contract.defectos` column; `puntaje` null. Schema change user-approved. NEVER silently zero unknown quality data |
| Abril | `S36/T36/V36/S37/T37/V37` (stock-lot-afloat) | `#REF!` — formulas depend on MP which stock-lot-afloat has none | Tolerated per user directive; ETL computes via `calculateContract(montoCredito=0)`. DB is authoritative |
| Abril | Row 38 TOTALES (stock-lot-afloat) | `#REF!` aggregate | Tolerated (downstream of above) |
| Mayo | `O13`, `Q13` (ONYX OC26-41) | Copy-paste error: `O13 = =(J13*69*2.2046*(M13/100))` — should be `I13`, not `J13`. `Q13 = =P13*K13` should be `=P13*J13` | Flagged to user; CFO fixed in xlsx + re-saved; I re-ran Phase A |
| Mayo | `J9` (LIST+BEISLER 1002649-01) | Literal `125` where rule requires `= I9 × 1.5 = 187.5` | CFO fixed |
| Mayo | `L11`, `L12` (ONYX OC26-09, OC26-08) | Empty diferencial cells; `M11`, `M12` are literals `410` (not formulas) | ETL back-derives `diferencial = M − K` when `L` is empty AND `M` is a literal. This preserves sheet's authoritative M |
| Mayo row 17, 18 | `D17`, `D18`, `E17`, `E18` | Parenthesis patterns `Falcon (Wastrade)`, `ICC (Westrade)` in cliente; `P2600329 (W26320-GT)` in contract number | Per `feedback_importer_client_parenthesis.md`: plain=IMPORTER, paren=CLIENT. Added `Contract.importerId` + `alternateContractNumber`. User-confirmed for Falcon/ICC; new cases MUST stop-and-ask |

**Pattern**: when the sheet looks "wrong", it's either a CFO typo (fix-xlsx) or an intentional exception (add override field). **Never silently coerce**.

---

## 11. Common unexpected values and how to decipher them

| Observation | Decipher |
|---|---|
| `posicion` cell has a number like `46143` | Excel date serial. `46143` = `2026-05-01`. Use `posicionString()` helper which handles string / Date / serial uniformly |
| `gastos/qq` drifts across rows (14.12 / 20 / 23 / 17.12) | Complex business rule per user Q5 — distance / finca / origin / supplier / day of week / hour. Don't try to derive; read the cell as-is |
| `PROM. Q` is a formula `=Enero!M13` or `=Marzo!M15` | Octavio's "quick and dirty averages" per user Q8 — intentional. Capture the evaluated value verbatim; cross-sheet refs are informational |
| `contenedores` is fractional (5.749, 16.848) | `= SUM(block's J cells) / 412.5` — defines "container-equivalents". Per user Q9, ≤ 1 is rule-of-thumb; Mayo is an acknowledged exception due to scale |
| `ESTATUS` sometimes lowercase `No fijado`, sometimes upper `NO FIJADO` | Case drifts. Parser uses case-insensitive regex `/^(Fijado|No\s*Fijado|FIJADO|NO\s*FIJADO)$/i` |
| `lote` contains `Orgnaico` (typo of Organico) | Tolerate via `includes("ORGNAIC")` in `mapRegions()` |
| `M` cell is literal `410` but `K = 300.35`, `L` empty | Sheet author typed the final price directly in M without bolsa/dif breakdown. Back-derive `diferencial = M − K` (see Mayo OC26-09/08) |
| `H` cell is text `"300 defectos"` not a number | Broker contract — coffee assessed by defect count, not cupping score. Route to `defectos` column, `puntaje` null |
| `cliente` is `"Falcon (Wastrade)"` | plain = IMPORTER, paren = CLIENT (per `feedback_importer_client_parenthesis.md`) — confirmed for Falcon/ICC. New plain names STOP AND ASK |
| `contratoNumber` is `"P2600329 (W26320-GT)"` | Two codes for the same contract — outside code = outside-company's code. Store primary in `contractNumber`, inner in `alternateContractNumber` |
| `PROMEDIOS` sheet shows totals that don't match any month | PROMEDIOS is DERIVED (pulled from monthly sheets). Ignore for ETL; use only for end-of-batch YTD eyeball |

---

## 12. Formulas cheat-sheet (business rules, verbatim)

Verify every month — they don't change, but typos do.

```
precio_total_qq   = precio_bolsa + diferencial                           # M = K + L
precio_libra      = precio_total_qq / 100

total_kilos       = num_sacos_69 × 69
total_libras      = total_kilos × 2.2046
facturacion_usd   = total_libras × precio_libra                         # O col
facturacion_lbs   = sacos_46 × precio_total_qq                          # N col (display)

gastos_exportacion = tasa_por_quintal × qq_oro_total                    # = P × J

costo_financiero  = (total_materia_prima × 0.08 / 12 × 2) / tipo_cambio # uses THIS contract's own MP total
utilidad_sin_cf   = utilidad_sin_ge − costo_financiero
total_pago_qtz    = utilidad_sin_cf × tipo_cambio

pergamino         = oro × rendimiento                                   # L_mp = J_mp × K_mp
total_mp_qtz      = pergamino × precio_prom_q                           # O_mp = L_mp × M_mp

comision_usd      = 3 × qq_oro_total                                    # $1.50 compra + $1.50 venta
comision_qtz      = comision_usd × tipo_cambio

subproducto_qtz   = qq_rechazo × precio_rechazo_qq

utilidad_bruta    = total_pago_qtz − total_materia_prima − isr − comision_qtz + subproducto_qtz
margen_bruto      = utilidad_bruta / total_facturacion_qtz              # ponderada a nivel shipment
```

Stock-lot-afloat override: when `Contract.stockLotAfloatCostPerQQ` is set:

```
stock_lot_afloat_cost   = stockLotAfloatCostPerQQ × sacos_46
total_pago_qtz          = (utilidad_sin_cf − stock_lot_afloat_cost) × tipo_cambio
```

---

## 13. Client variant-map cookbook

`docs/client-variant-map.md` is append-only. Every new variant gets a line.

### Adding a new canonical

```markdown
### Canonical: {DBName} [{CODE3}]
_Added YYYY-MM-DD for {context — which month / row / why}._
- {variant 1 — the exact spelling from the sheet}
- {variant 2 — e.g. typo or case-variant}
```

`CODE3` convention: existing codes are 3 letters (SER, ONX, FAL). Pick something mnemonic and distinct.

### Adding a typo as a variant

If the CFO misspells an existing client (`Serengheti` for `Serengetti`), **append the typo to the existing canonical** — never create a new one.

### Parenthesis-pattern canonicals

Plain-name importer entities (Falcon, ICC) live in the same `Client` table as buyers, reused across roles. `Contract.importerId` is the FK. Per user 2026-04-24, a company may act as importer in one contract and buyer in another — one table, role determined by how it's linked per contract.

---

## 14. Database migration patterns

### Enum value add (pure additive)

```sql
ALTER TYPE "EnumName" ADD VALUE IF NOT EXISTS 'NEW_VALUE';
```

Safe, no-downtime, no rows disturbed.

### Enum value rename

```sql
ALTER TYPE "EnumName" RENAME VALUE 'OLD_VALUE' TO 'NEW_VALUE';
```

Postgres 10+. Atomic. Preserves row data. Prefer over drop-and-add (which needs `--accept-data-loss`).

### Column add (additive)

Just add it to `schema.prisma`, nullable, then `npx prisma db push` (no `--accept-data-loss` needed since no data loss).

### Column rename

```sql
ALTER TABLE tableName RENAME COLUMN "oldCol" TO "newCol";
```

Then update `schema.prisma` to match, `npx prisma generate`, then sweep the codebase for `.oldCol` references.

### Never

- `npx prisma db push --accept-data-loss` — only with explicit user authorization.
- `prisma migrate reset` — nukes all data.

---

## 15. Script conventions (directive 6 compliance)

- Month-scoped: filename contains the month (`etl-julio-2026.ts`). No `etl.ts --month=6` parameterization.
- First executable line: `assertMonthNotJanuary(MONTH_NUM, "module-load")` — catches config error immediately.
- Jan-touching scripts: must have `throw new Error("decommissioned ...")` at top. Re-check if one got un-guarded.
- Shared helpers go in `scripts/lib/` (e.g., `scripts/lib/client-variants.ts`). Not month-scoped because they're infrastructure, not mutators.
- Whole-DB sweeps forbidden. Any `findMany({ where: {} })` without a month filter is a bug.

---

## 16. Quick command cheat-sheet

```bash
# Fresh inventory
npx tsx scripts/phase-0-1-mayo-xlsx-inventory.ts

# Per-month Phase A (read-only, writes 2 report files)
npx tsx scripts/phase-a-{M}-2026.ts

# Phase C dry-run (no writes)
npx tsx scripts/etl-{M}-2026.ts --dry-run

# Phase C execute (transactional)
npx tsx scripts/etl-{M}-2026.ts --execute

# Phase D parity
npx tsx scripts/phase-d-{M}-2026-parity.ts

# Phase E
npx vitest run src/lib/services/__tests__/{M}-2026-ssot.test.ts
npx vitest run                 # full suite
npx tsc --noEmit               # type check

# Regenerate Prisma client after schema changes
npx prisma generate
npx prisma db push             # schema changes — additive only
```

---

## 17. Troubleshooting

### "Property 'STOCK_LOCK' does not exist on type"
You opened an old script after the 2026-04-24 rename. Enum is now `STOCK_LOT_AFLOAT`. Grep for old references.

### "Transaction already closed: ... timeout"
Your `$transaction` ran longer than the default 5s. Raise:
```ts
{ maxWait: 15000, timeout: 60000 }
```
Mayo used `timeout: 90000`. Larger months may need more.

### "Unique constraint failed on the fields: (`contractNumber`)"
An orphan contract from a prior import has the same number. The clean-slate delete missed it because it wasn't linked to the target month's shipment. Extend the `existingByNumber` sweep to search by `contractNumber` regardless of shipment, then cascade-delete its FK referencers.

### "Positional pairing broken: contract row X 'ABC' vs MP row Y 'DEF'"
Contract table and MP block aren't 1:1 in order. Causes: MP block has parenthesis contract numbers you didn't strip, OR stock-lot-afloat rows in contract table but not MP, OR duplicate numbers detected differently. Verify the MP parse applies same parsing rules as contract parse.

### "Unknown argument `numero`"
Prisma field name is `contractNumber`, not `numero`. Don't autopilot from Spanish context — use the actual schema identifier.

### MP-block not detected / mpRows = 0
Your header-detection heuristic needs updating. Common drift: header label moved between col G and col I, or "CONTRATO" / "PERGO" text isn't where you expect. Anchor on `col L = "PERGO"` AND `col G = "CONTRATO"` for resilience; fall back to `col J = "CONTENEDORES"` for the subproducto header.

### Dry-run shows computed ≠ sheet by ±$24,000 on one contract
Very likely the sheet has `J = I` (not `I × 1.5`) or another factor-of-1.5 inversion. Check raw cells — if the sheet's J cell is a literal that doesn't match the rule, it's a CFO typo. Flag and wait for fix.

### Phase D shows 3+¢ drift on one field
Investigate whether `Decimal.js` operation order differs between ETL and Phase A. Computed precision: persist at `@db.Decimal(14, 2)` so both must round identically. Rounding mode is `ROUND_HALF_UP`.

### `needs-create` client blocks execute but map has the entry
Run `npx prisma generate` — client is stale. Or: the map's CODE for that canonical doesn't match the DB's existing row's code. Check `normalize(code)` equality.

### "The database is already in sync" but I just added a field
The Prisma schema file didn't save before the `db push`. Verify file content with Read, then re-push.

---

## 18. When in doubt

1. **Read the memories**: `feedback_client_variant_map.md`, `feedback_importer_client_parenthesis.md`, `feedback_no_data_dismissed_quality.md`, `feedback_no_assumptions.md`. These encode lessons the hard way.
2. **Read the business rules**: `hopecoffee_business_rules.md`. §1 for entity/contract types, §2 for formulas.
3. **Read `_THE_RULES.MD`**: before any big move, re-check the 8 rules.
4. **Read the most-recent month's changelog**: it encodes the most-recent infrastructure. The pattern I used last time is probably the starting point.
5. **If unsure, ASK the user**. The cost of a clarifying question is always lower than the cost of a silent wrong assumption. See `feedback_no_assumptions.md`.

---

## 19. Known follow-ups / debt to be aware of

Surfaced during Jan → Mayo, not yet cleaned up:

- Deprecated `Contract.rendimiento` + `Contract.tipoFacturacion` columns — kept in schema, ignored by calc. Future cleanup PR.
- `Contract.stockLotAfloatCostPerQQ` — field live, null on the 2 Abril stock-lot-afloat contracts. User will CRUD in app.
- ISR per contract (`Contract.isrRate` / `isrAmount`) — CRUDed in app after ETL.
- Q10 investor/entity M:N aggregation — deferred until Octavio walkthrough.
- Q11 YTD dashboard page — deferred until all 5 months were green (now is).
- `scripts/import-excel-january.ts` + 6 other Jan-scoped scripts — frozen reference, throw-guarded. If the `throw` gets removed, that's a regression.
- `EneroCurrent.xlsx` historical artifact — possibly still on disk as `Enero.xlsx` or `Enero-pre-friday.xlsx`. Do not touch; `Mayo.xlsx` is the canonical multi-month workbook now.

---

## 20. Living document — update me

Every time a NEW class of error or structural drift is discovered that's not in this playbook, add a row to §10 or a paragraph to §11. Over time this guide becomes the reflexive answer to "I've seen this before" — which it already is.

*Updated 2026-04-24 based on the Feb → Mayo 2026 sequence. Next update: whenever the first Jun 2026 sheet surfaces something new.*
