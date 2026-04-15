# Lot ↔ MateriaPrima Unification — Implementation Plan

**Item:** 5b from the parked follow-up list
**Source:** [docs/quality-lab-wiring-audit.md](quality-lab-wiring-audit.md) §"Handoff 4"
**Status:** REFRAMED 2026-04-15 — mission changed from "backend unification" to "Hector adoption MVP"
**Author:** Claude Opus 4.6 (session 2026-04-15)
**Rule adherence:** [_THE_RULES.MD](../_THE_RULES.MD) — every section grounds in explicit evidence from the codebase, business rules doc, or user direction. Nothing is inferred from spreadsheet formatting. Nothing is fabricated. Questions that cannot be answered from the source material are surfaced in §4 instead of guessed.

---

## MISSION (2026-04-15 reframe — supersedes everything below unless marked "future")

The zero-diff January reconciliation hooked the CFO. He's now INTERESTED in the app. The equivalent hook for Hector is the real deliverable of item 5b — not the architectural unification, not the data-model cleanup, but **a feature so painful on paper that Hector wants to open the app every morning.**

Adoption is the single enemy. A technically-correct unification nobody uses is worse than a hacky MVP that becomes load-bearing in the CFO + COO daily workflow.

**Reframed rule set for this plan:**

1. **CFO-world and Hector-world stay permanently independent at Lab-3 scope.** Updated 2026-04-15 per user direction: *"Octavio's numbers come from Octavio's xlsx files. Hector's numbers come from Hector's Lab. The app doesn't break if they differ."* Hector's work writes to Lot / CuppingRecord / MillingOrder / SupplierAccountEntry. The CFO's numbers read from MateriaPrima / Shipment. **Applied yield adjustments update the supplier ledger only; they do not propagate to contract margins.** Divergence is tolerated by design. Unification is a fork-in-the-road, not a deferred task — it only happens if a future business reason makes it worth doing.
2. **Historical data is out of scope for Hector's Lab.** Per user direction 2026-04-15, no backfilling, no synthesis of Lots for the 46 historical contracts. Hector's Lab is forward-looking only — it starts from the first bodega receipt logged after MVP ships.
3. **Item 3 (Feb–Dec reconciliation) is unblocked and can run in parallel.** It touches CFO-world. Hector MVP touches Lab-world. No overlap.
4. **Foot-in-the-door strategy:** identify the ONE feature that is most painful for Hector today and build that first at production quality. Every subsequent feature extends from that beachhead. Do not try to ship "a complete lab management system" — ship one feature that earns daily use.
5. **The 5-phase unification plan (§5 below) is parked as "Future Phase V."** It stays in this doc as the long-term endgame, but it does not start until Hector is a daily user and the case for unification is organic.

**Success criterion for this mission:** Hector opens the app on at least 5 working days out of 7 for 4 consecutive weeks without being asked to. That's the definition of adoption. Everything else in this plan ladders up to that metric.

The MVP strategy is in §H. The old architectural plan is preserved in §5 onward as "Future Phase V."

---

## §H. Hector MVP — the adoption strategy

*This section is the live plan as of 2026-04-15. §0 onward is preserved as the long-term architectural reference ("Future Phase V") and does not start until Hector is a daily user.*

### H.0 What Hector actually said he needs (from [hector.txt](../hector.txt))

Grounding the strategy in Hector's own words, not my interpretation:

| Quote (approx line) | Need |
|---|---|
| L14 *"Si se compra con 1.32, si no me da 1.33 en el laboratorio, el precio debe ser ajustado"* | Catación → price adjustment loop |
| L15-17 *"cuando yo ingrese mi catación con el número de recibo, cuando aquel genere su pago, plum, ya era el ajuste"* | Fast catación entry keyed by receipt number |
| L27-28 *"Tengo este inventario en esta bodega, este proveedor en esta calidad"* | Live warehouse inventory by supplier × quality × facility |
| L30 *"Llevo mis órdenes de trigo y las manda también"* | Milling order creation + dispatch to the beneficio |
| L354-363 *"yo quiero el inventario del beneficio de la joya... te saca todo, que fecha ingresó, que peso, que calidad dio"* | Inventory query filtered by facility with reception date, weight, grade |
| L357-362 *"reporte inventario lo puedo hacer por beneficio, por proveedor, por calidad"* | Pivot inventory by facility / supplier / quality |
| L393-404 *"cuánto café yo vendí, cuánto café hemos comprado, cuánto nos falta comprar... vendido por calidad... cuánto café he comprado en cada tría"* | Buy/sell/remaining reports with quality + facility dimensions |
| L94 *"estoy guardando todo, no he vendido ni un quintal de rechazos"* | Reject inventory tracking (accumulates, not yet sold) |

Four themes emerge: **live inventory visibility**, **fast catación entry**, **milling order creation**, **operational reports**. The pain ordering (most painful first, my reading) is inventory visibility → catación → milling → reports.

### H.1 The beachhead — pick ONE feature

Not four features. **One.** The one that is painful enough on paper that switching to the app is obviously worth it on day one.

Candidate ranking:

**H.1.1 Live warehouse inventory view (STRONG beachhead candidate)**

What it is: a page listing every `Lot` currently in `PERGAMINO_BODEGA` (or `ORO_EXPORTABLE`) stage, filterable by facility, supplier, quality, date range. Columns: lot number, facility (bodega), supplier, reception date, current qty, quality grade, cupping score if cupped, days since reception, status flags.

Why it wins:
- **Already possible with the existing schema.** `Lot` rows are created automatically on `SupplierAccountEntry.create` ([suppliers/actions.ts:48-71](../src/app/(dashboard)/suppliers/actions.ts#L48-L71)). Hector's team is presumably already logging bodega receipts somewhere; whether in the app or in another system, the data exists.
- **Visual and shareable.** Hector can open it in a meeting and show someone "look, this is what I have right now." That's a natural demo loop that drives internal adoption.
- **Zero dependency on the financial layer.** It reads Lot-world exclusively. No touching MP, no touching shipment-aggregation, no touching contract margins.
- **Every other Hector feature builds on it.** Catación entry needs "which lot am I cupping?" → inventory view. Milling orders need "which lots go into this order?" → inventory view. Reports need "group these lots by X" → inventory view. The inventory view is the substrate.
- **Directly answers Hector's loudest complaint.** He literally said *"necesito un inventario en calidad de hoy"* and described how he currently can't answer "how much of X do I have" without scrolling through paper.

Why it might lose:
- If Hector's team isn't already logging bodega receipts in the app, the inventory view will be empty on day one. That's a chicken-and-egg problem — see §H.2 for the workaround.
- "An inventory list" sounds unexciting on paper. The magic has to be in the filters + speed, not the concept.

**H.1.2 Fast catación entry with automatic yield-adjustment preview**

What it is: a "Nueva catación" flow that starts with a receipt number lookup, auto-fills supplier + contracted yield from the matching lot, presents the SCA cupping form, and on save immediately shows the yield-adjustment preview (using the already-wired [quality-lab/actions.ts:143-182](../src/app/(dashboard)/quality-lab/actions.ts#L143-L182) auto-creation path). If the variance is beyond tolerance, it shows the computed price delta against the supplier ledger and asks "Apply?"

Why it might win:
- **This is literally the "plum" moment from hector.txt.** Hector described this workflow word-for-word as what he wants. Building exactly what he described is the strongest possible alignment signal.
- **The backend wiring is done for Handoffs 1 and 2** per [quality-lab-wiring-audit.md](quality-lab-wiring-audit.md) + commit `4103987`. Handoff 3 (MP propagation) was intentionally reverted on 2026-04-15 per the independence contract — yield adjustments update the supplier ledger only, never the contract margin. The UI is the only missing piece for the plum moment; the financial integration for the supplier side is complete.
- **Every catación is a daily repeated action.** If it's 5x faster than his current paper flow, he uses it 5x a day.

Why it might lose:
- Depends on H.1.1 (inventory view) to find the lot to cup. Without inventory visibility, Hector doesn't know what's available to cup without a paper side-reference.
- The "plum" moment is spectacular the first time and then normal. Live inventory is a daily-looked-at thing; catación is an occasional-action thing.

**H.1.3 Milling order creation from selected lots**

What it is: select multiple lots from the inventory view → "Generar orden de trilla" → pick beneficio + target output volume → system creates a `MillingOrder` with `MillingInput` rows pointing at the selected lots.

Why it loses as a beachhead:
- Depends on both H.1.1 (inventory) and H.1.2 (catación) to be useful — Hector wants to mill lots whose quality is confirmed.
- The `MillingOrder`/`MillingInput`/`MillingOutput` models exist in the schema but I have NOT verified their full semantics in this session ([§5 Phase 0.2 in the original plan](#phase-0--research-read-only-zero-risk) still applies).
- Less daily-repeated than inventory or catación.

**H.1.4 Reports (buy/sell/remaining by quality/facility)**

Loses because reports are weekly/monthly, not daily. Hector won't open the app every morning just to look at a report.

**DECISION: beachhead = H.1.1 (live warehouse inventory view).** Catación (H.1.2) is the immediate follow-up so the "plum" moment arrives in week 2, not month 3. Milling and reports come after.

### H.2 The empty-state problem

If Hector's team isn't already logging bodega receipts in the app, the inventory view is empty on day one. No inventory = no adoption = death spiral.

Three ways to handle it:

- **(a) Bulk-entry flow.** Ship a "bulk import receipts" form: CSV paste or a 10-row inline table that creates `SupplierAccountEntry` + `Lot` rows in one action. Hector enters his existing paper/Excel inventory as a one-time migration. After that, every new receipt goes through the normal single-entry flow.
- **(b) Accept the ramp-up.** Inventory view is empty on day 1, has 5 lots on day 3, has the full warehouse by day 10 as Hector enters each new receipt going forward. Day-1-to-day-10 is the risky window — if Hector doesn't see value before day 10, he gives up.
- **(c) Side-by-side seed.** Ask Hector what he has today in paper/Excel, have an engineer enter it manually into the app in a 1-hour session. Inventory is complete on day 1.

**Recommendation: (a) + (c).** Build the bulk-entry form AND offer the one-hour seeding session. Both remove the day-1 friction.

### H.3 Phase-by-phase MVP sequence

**These phases supersede §5 of the original plan for the duration of the MVP push. §5 is archived as "Future Phase V" and does not start until the MVP has earned Hector's adoption.**

#### H.3.1 — Phase Lab-0: Schema + action audit (1 day, zero risk)

Read-only investigation of what's already implemented vs what's missing.

- Query prod for current counts: how many Lots exist, how many CuppingRecords, how many SupplierAccountEntries. Is Hector's team already using the app at all, or is this a cold start?
- Read the existing UI under [src/app/(dashboard)/quality-lab/](../src/app/(dashboard)/quality-lab/) and [src/app/(dashboard)/suppliers/](../src/app/(dashboard)/suppliers/) and [src/app/(dashboard)/inventory/](../src/app/(dashboard)/inventory/). Enumerate every existing page, form, and action that Hector's workflow already touches.
- Read the full `MillingOrder` / `MillingInput` / `MillingOutput` schema and grep for consumers. Document the PERGAMINO → ORO lifecycle for later phases.
- Write findings to `docs/phase-lab-0-snapshot.md`.

**Deliverable:** snapshot doc. No code changes.

**Exit criterion:** we know exactly which pieces of the existing schema + UI already support Hector's flow and which are missing.

#### H.3.2 — Phase Lab-1: Live warehouse inventory view (2–3 days)

Build the beachhead feature.

**New page:** `src/app/(dashboard)/inventory/bodega/page.tsx` (or similar — Phase Lab-0 determines the right location to avoid collision with any existing inventory page).

**Features:**
- Table view of all Lots in `PERGAMINO_BODEGA` stage with `quantityQQ > 0`.
- Columns: lot number, facility, supplier, reception date, quality grade, cupping score (null if uncupped), quantity remaining, days in bodega, catación status (pending / done / variance).
- Filters:
  - Facility (dropdown, from `Facility.findMany()`)
  - Supplier (autocomplete)
  - Quality / punteo range
  - Date range (reception)
  - "Has catación" yes/no
  - "Has yield variance" yes/no
- Sort by any column.
- Pagination (default 50 rows).
- Row click → lot detail drawer (reception info, cupping history, adjustments, downstream milling orders).
- Export to CSV button (one-click, current filter applied).

**Permissions:** `inventory:read` or whatever the existing permission scheme uses. Hector's role gets read access to every facility.

**Tests:** component tests for the filter logic, E2E happy-path test.

**Exit criterion:** Hector (or the user proxying for him) can answer *"how many qq of Danilandia-sourced pergamino do I have in La Joya bodega with punteo ≥ 82?"* in under 10 seconds. That's the speed threshold that beats paper.

#### H.3.3 — Phase Lab-2: Bulk-entry form for seeding (1 day)

Solve the empty-state problem.

**New page:** `src/app/(dashboard)/inventory/bodega/bulk-entry/page.tsx`.

**Features:**
- A 10-row inline table form with columns: date, supplier, facility, pergamino qq, precio Q/qq, quality grade, optional notes.
- Supplier column is an autocomplete over existing `Supplier` rows with a "create new" option.
- Facility column is a dropdown.
- On submit, creates 10 (or however many rows were filled) `SupplierAccountEntry` records in a single transaction. Each one cascades to a `Lot` via the existing [suppliers/actions.ts:48-71](../src/app/(dashboard)/suppliers/actions.ts#L48-L71) path.
- CSV upload variant as a follow-up if Hector wants it.

**Exit criterion:** a user can seed 20 lots into the app in under 5 minutes. Used once at onboarding, then replaced by single-entry for new receipts.

#### H.3.4 — Phase Lab-3: Fast catación entry ("plum" moment) (3–4 days)

The second beachhead feature. This is where the app shows Hector the magic.

**Refactor existing page:** [quality-lab/new/page.tsx](../src/app/(dashboard)/quality-lab/new/page.tsx) and its associated cupping form.

**Independence contract:** Per user direction 2026-04-15, Phase Lab-3 stays strictly in Lab-world. The catación flow writes to `CuppingRecord`, auto-creates `YieldAdjustment` (via the existing createCuppingRecord path), and on apply writes to `SupplierAccountEntry`. **It does not touch `MateriaPrima`, `Contract`, or `Shipment`.** Octavio's margin dashboard numbers are unaffected by any catación Hector enters. If Hector's supplier-ledger view of a lot's cost diverges from the CFO's monthly-xlsx view of the same contract's cost, the app does not try to reconcile them — divergence is tolerated by design.

**Features:**
- Entry point: big "Nueva catación" button on the inventory page (Phase Lab-1). Click a lot row → "Cup this lot" → pre-fills supplier, lot, contracted yield.
- Alternative entry: dedicated "Nueva catación" page with a lot-number / receipt-number search field at the top. Autocomplete shows matching lots with their current status.
- Form: SCA 10-attribute fields, physical analysis (moisture, defects, screen size), and **`yieldMeasured` is a prominent input**, not buried.
- On save:
  - Creates `CuppingRecord` via existing [quality-lab/actions.ts](../src/app/(dashboard)/quality-lab/actions.ts) `createCuppingRecord` action (already plumbed for auto-creating a `YieldAdjustment` when variance > tolerance).
  - If an adjustment was auto-created, immediately navigate to a confirmation screen: *"Variance detected: contracted 1.32 → actual 1.33. Computed price adjustment to supplier ledger: Q X,XXX. Apply now?"*
  - "Apply" button calls the existing `applyYieldAdjustment`. After the 2026-04-15 revert, that action: flips the status to `APLICADO`, creates a `SupplierAccountEntry` tagged with `orderCode = "ADJ-<id>"` carrying the price delta, and sets the bidirectional FK. **No MateriaPrima mutation, no `recalculateShipment` call.**
- Toast confirmation: *"Catación guardada. Ajuste de Q X,XXX aplicado al ledger del proveedor Y."* (Note the phrasing: "al ledger del proveedor" — not "al contrato" — so Hector's mental model stays in Lab-world.)

**Exit criterion:** Hector enters a catación in under 90 seconds from "Nueva catación" click to confirmation. Current paper flow is likely 5+ minutes because it involves cross-referencing paper contracts, lab notebooks, and supplier payment sheets.

#### H.3.5 — Phase Lab-4: Bodega transfer between facilities (1-2 days, OPTIONAL)

Hector didn't explicitly ask for this but it emerges naturally if Hope Coffee operates multiple bodegas. Skip unless Phase Lab-0 findings show multiple active facilities.

**Feature:** move a Lot (or fraction of one) from one Facility to another. Creates child Lots for the split. Already possible via `parentLotId` lineage but may need a UI wrapper.

#### H.3.6 — Phase Lab-5: Milling order creation (3–4 days)

After Phases Lab-1 through Lab-3 are stable and Hector is using them daily.

- Select multiple lots from the inventory view → "Generar orden de trilla" → pick a `Facility` of type `BENEFICIO_SECO` → creates a `MillingOrder` with `MillingInput` rows.
- Lot stage transitions `PERGAMINO_BODEGA → EN_PROCESO` (verify stage enum in Phase Lab-0).
- Dispatch flow: print / PDF the order for handoff to the beneficio.
- Later (Lab-6): receive the milling output back — `MillingOutput` rows, which create child `ORO_EXPORTABLE` Lots with `parentLotId` lineage.

#### H.3.7 — Phase Lab-6: Operational reports (2–3 days)

After inventory + catación + milling are all in daily use. Reports are the least daily-repeated feature, so they come last.

- "Inventory snapshot by bodega / supplier / quality"
- "Compras por mes + calidad"
- "Ventas por mes + calidad" (from the existing Contract data — read-only join across the two worlds)
- "Pending adjustments" (already exists, but refine for Hector's filters)
- "Reject inventory" (unsold rechazo tracking — needs a new flag on lots or a separate model, see §H.5 open items)

### H.4 What gets SKIPPED in the MVP

Per the "foot in the door" strategy, these are out of scope:

- **Any touching of `MateriaPrima` or financial aggregation.** CFO-world stays parallel. The commit `4103987` best-effort path handles the one place (yield adjustment apply) where Lab-world tries to reach into Contract-world; that's enough until unification is organic.
- **The full `Lot ↔ MateriaPrima` unification refactor.** Archived as §5 onward / "Future Phase V."
- **Historical backfill.** Per user direction 2026-04-15, Lab starts from the first post-MVP bodega receipt.
- **Stock Lock contract handling.** Stock Lock contracts bypass the MP chain entirely per business_rules §1.2; they're not a Lab concern.
- **Subproducto / rechazo sale tracking.** Hector mentioned it but it's not daily and not the beachhead.
- **Client-side broker/importer separation.** He mentioned this for the Contract side, not Lab.
- **Roasted coffee operation** (hector.txt is mostly about this). Entirely separate business line; not MVP.

### H.5 Open items / future work (not in MVP)

- Multi-facility transfer with partial quantities (Lab-4 if needed).
- `MillingOutput` → oro lot lineage with automatic allocation to contracts.
- Reject inventory as a first-class tracked entity (needs data model decision — a new `RejectLot` model or a flag on existing `Lot`?).
- `YieldAdjustmentStatus = PAGADO` when the associated `SupplierAccountEntry` is actually paid (today `APLICADO` means "applied to the ledger," not "money moved").
- Mobile-friendly views if Hector ever uses the app from his phone.
- Multi-language support (everything is in Spanish in the business; the app is bilingual).

### H.6 Risks specific to the adoption push

| # | Risk | Mitigation |
|---|---|---|
| AH1 | Hector tries the inventory view on day 1, it's empty or buggy, he never comes back | Phase Lab-0 verifies data presence; Phase Lab-2 bulk-seeding closes the empty-state gap; pre-ship smoke test with a real user before Hector sees it |
| AH2 | The inventory view works but Hector finds the filters clumsy and keeps using paper | Rapid iteration on filter UX during the first 2 weeks post-launch; Hector-specific user-testing session in week 1 |
| AH3 | Catación entry works but the supplier-ledger adjustment direction is wrong (Q4 sign convention unresolved) | Q4 sign meeting with Octavio happens BEFORE Phase Lab-3 ships. Hard dependency. **Narrower scope since 2026-04-15 independence revert:** the sign only affects the supplier ledger entry, never the contract margin. The CFO dashboard cannot be wrong because of this, only the supplier payment amount. |
| AH4 | Hector's workflow is more complex than hector.txt suggests (e.g. multi-stage cupping, re-cupping after a failed batch) | Phase Lab-0 includes a 30-minute call with Hector to walk through his actual daily flow, not just re-reading the transcript |
| AH5 | The `MillingOrder` lifecycle is messier than assumed, Phase Lab-5 balloons | Lab-5 is deferred until after Lab-1/2/3/4 are stable. If it's messy, it gets its own mini-plan document. |
| AH6 | Item 3 (Feb–Dec reconciliation) and Hector MVP are worked on in parallel, and one blocks the other unexpectedly | Strict separation of touchpoints: Item 3 only touches `MateriaPrima` / `Shipment` / the importer's writer path. Hector MVP only touches `Lot` / `CuppingRecord` / `MillingOrder` / `SupplierAccountEntry`. Monitor for any accidental coupling. |

### H.7 Ladder of adoption checkpoints

Each checkpoint is a binary signal. If the signal isn't there, pause and iterate before going further.

- **Checkpoint 1 (end of Lab-1):** Hector or a proxy user opens the inventory view and successfully answers a real "how much do I have of X" question. If the filters are wrong for his workflow, iterate before Lab-2.
- **Checkpoint 2 (end of Lab-2):** the bulk-entry form survives a 20-lot seeding session without bugs. Hector's team has real data in the app.
- **Checkpoint 3 (end of Lab-3):** Hector enters a real catación for a real lot, the "plum" adjustment flow runs end-to-end, and he says something positive. If the magic doesn't land, investigate why before Lab-4.
- **Checkpoint 4 (week 4 post-Lab-3):** Hector has opened the app on ≥20 days in the past 4 weeks without being asked. Adoption is secure. Proceed to Lab-5/6.
- **Checkpoint 5 (week 8):** Hector is creating milling orders from the app. Full operational flow is live.
- **Checkpoint 6 (month 3+):** Hector and the CFO are both daily users. THE CASE FOR UNIFICATION IS NOW ORGANIC. Unparking §5 / Future Phase V makes business sense.

---

---

# Future Phase V — the architectural unification (possibly never)

*Everything below this line is the long-term architectural plan for unifying Lot-world and MateriaPrima-world. As of 2026-04-15, this work is **not merely deferred** — it is a **fork-in-the-road decision** that may never be taken.*

*User direction 2026-04-15: "Octavio's numbers come from Octavio's xlsx files. Hector's numbers come from Hector's Lab. The app doesn't break if they differ." That statement admits permanent independence as a valid operating mode, not just a temporary one. If both users adopt the app and neither ever asks for their numbers to reconcile, Future Phase V is never needed and this document stays a historical artifact.*

*The content below is preserved in case the business ever needs Lab-world and CFO-world to produce unified numbers — for instance, if an external auditor requires a single cost-of-goods ledger that reconciles both views. It does not start until someone in the business asks a question that only unification can answer.*

---

## 0. Challenge to the premise (Rule 5)

Before laying out the plan, per the added "permission to challenge the user's premise" rule, I want to surface the question of whether this work should happen **now**.

**Arguments for doing it:**

- The parallel-worlds problem (documented in [quality-lab-wiring-audit.md §"Handoff 4"](quality-lab-wiring-audit.md)) is a permanent financial-integrity risk. Hector's quality-lab data and the CFO's margin reports are independent universes.
- The Handoff 3 best-effort MP update in commit `4103987` falls back to supplier-ledger-only in prod because `ContractLotAllocation` is (almost certainly) empty. Every applied yield adjustment today silently skips the MP update and writes a WARN.
- Eventually someone asks: *"why does Hector's lot-quality report for contract X show different costs than the margin dashboard for the same contract?"* That conversation is much easier after this is fixed than during a live financial review.

**Arguments against doing it now:**

- January is reconciled cell-for-cell to the SSOT. Every other prod-facing number is stable. No current user is suffering from this.
- The calc engine and business rules are solid. Item 5b is an **infrastructure and data-model refactor**, not a bug fix and not a new feature.
- **Item 3 (Feb–Dec reconciliation) probably has higher business value in the next 1–2 weeks.** The CFO is actively using the January view; unlocking Feb–Dec lets him use the whole year.
- Item 5b is a data model refactor AND a historical data migration AND a service-layer refactor AND a read-path cutover — four independent risks at once.
- The Excel importer fix (commit `3554d2b`) already unblocked fresh imports. Today's imports are structurally sound; it's the pre-April historical data that carries the parallel-worlds legacy.

**My recommendation:** do item 3 before item 5b. Reconcile the remaining 11 months, lock the yearly margin numbers, let the CFO use the system in anger for a month. THEN pick up 5b with full knowledge of how the data actually flows in production use.

That said, the user asked for the plan, so the rest of this document proceeds as if 5b is the next item. If the user agrees with the above and wants to reorder, the plan waits until item 3 lands.

---

## 1. Goal

Replace the two parallel inventory models (Lot-world and MateriaPrima-world) with a single source of truth. Specifically:

- **Every unit of pergamino cost that hits a contract's margin must trace back to a physical `Lot`** with a supplier, a bodega receipt, a cupping record, and (when applicable) a yield adjustment.
- **`MateriaPrima.totalMP` for a contract must be derivable from the sum of `ContractLotAllocation × Lot.costPerQQ × allocation share`** (with yield adjustments applied).
- **`shipment-aggregation.ts` and `calculateShipmentMargin` read the derived values**, not values imported from a spreadsheet.
- **The Excel importer stops creating `MateriaPrima` rows directly.** Instead, it creates (or updates) Lots + `ContractLotAllocation` rows that the derived view aggregates.
- **Hector's applied yield adjustments flow through to the dashboard margin without the WARN path.**

## 2. Current state (grounded)

This section states only facts that can be verified from the codebase, the schema, the business rules doc, or prior session findings. No speculation.

### 2.1 Schema facts

From [prisma/schema.prisma](../prisma/schema.prisma):

- **`Lot`** carries `supplierId`, `facilityId`, `stage`, `quantityQQ`, `contractedYield`, `actualYield`, `costPerQQ`, `parentLotId` (lineage), `receptionDate`, `sourceAccountEntryId`. Relations: `supplier`, `facility`, `parentLot`, `childLots`, `cuppingRecords`, `millingInputs`, `millingOutputs`, `contractLotAllocations`, `containerLots`, `sourceAccountEntries`.
- **`ContractLotAllocation`** carries `contractId`, `lotId`, and `quintalesAllocated Decimal?` (nullable — the schema comment says `null = full allocation`).
- **`MateriaPrima`** carries `shipmentId`, `supplierId?`, `supplierNote`, `isPurchased`, `punteo`, `oro`, `rendimiento`, `pergamino`, `precioPromQ`, `totalMP`. Relation: `allocations` (back to `MateriaPrimaAllocation`).
- **`MateriaPrimaAllocation`** carries `materiaPrimaId`, `contractId`, `quintalesAllocated Decimal?`. Populated as of 2026-04-15 for the 4 January contracts only.
- **`SupplierAccountEntry`** (bodega receipts) has a `lotId` FK. When an entry is created via [suppliers/actions.ts:48-71](../src/app/(dashboard)/suppliers/actions.ts#L48-L71), a `Lot` is automatically created in the same transaction.
- **`CuppingRecord`** has `lotId` FK. Saves `actualYield` and `cuppingScore` back to the Lot.
- **`YieldAdjustment`** has `cuppingRecordId` and (as of commit `4103987`) a populated `supplierAccountEntryId` on apply.
- **`MillingOrder`** / **`MillingInput`** / **`MillingOutput`** exist but I have not read their full schema during this session. They are the bridge PERGAMINO → ORO via the dry mill. **This plan needs to read them carefully in Phase 0 before claiming anything about their shape.**

### 2.2 Code-path facts

- `scripts/import-excel.ts` creates `MateriaPrima` rows directly from xlsx cells (post commit `3554d2b`, also creates `MateriaPrimaAllocation` rows 1:1 when contracts.length === materiaPrima.length).
- `scripts/import-excel.ts` does **not** create `Lot` rows. The xlsx has no "lot" concept; it has MP rows that represent per-contract averaged rollups.
- [src/lib/services/shipment-aggregation.ts:24-31](../src/lib/services/shipment-aggregation.ts#L24-L31) reads `prisma.materiaPrima.aggregate({ where: { shipmentId }, _sum: { totalMP: true } })`. This is the single financial consumer of MP cost in the app.
- [src/app/(dashboard)/quality-lab/actions.ts](../src/app/(dashboard)/quality-lab/actions.ts) (post `4103987`) reads the chain `Lot → ContractLotAllocation → Contract → MateriaPrimaAllocation → MateriaPrima` on yield-adjustment apply. Writes to `MateriaPrima.totalMP` directly when the chain resolves.
- `ContractLotAllocation` has a create action at [contracts/lot-actions.ts:47-66](../src/app/(dashboard)/contracts/lot-actions.ts#L47-L66) and UI in the contract detail page, but no backfill or bulk-create path.

### 2.3 Data volume facts (prod, as of 2026-04-15)

Known from prior session work:

- 46 contracts in prod (9 more were duplicates skipped at import).
- 25 shipments.
- 53 MP rows.
- 4 `MateriaPrimaAllocation` rows (January contracts only; populated by `scripts/phase-c-january-reconcile.ts`).
- 0 `ContractLotAllocation` rows — **NOT verified by direct query; this is my assumption based on never seeing any path that populates it at scale**. See §4 Q4.
- Lot count — **unknown**. `suppliers/actions.ts` creates one per supplier account entry, so the number equals the number of bodega receipts entered via the UI since go-live. See §4 Q5.

### 2.4 Business rules facts

From [hopecoffee_business_rules.md](../hopecoffee_business_rules.md) (gitignored, local only):

- **§1.3:** *"A single contract can be covered by multiple purchases of different coffee types. If multiple purchases with different rendimientos cover one contract, they must be tracked separately — you cannot simply average them without breaking the cost calculation."* This directly supports the Lot-first model: per-purchase granularity is a hard requirement from Octavio, and the averaged MP rollup was always a simplification.
- **§2.5:** `costo_pergamino_i = qq_pergamino_needed_i × precio_pergamino_qq_i`, summed across purchases. This is the formula the computed view must produce.
- **§1.8:** Financial cost is calculated on the total materia prima (sum of all pergamino purchases). Per-contract financial cost uses each contract's own `O_i` per the SSOT (confirmed in the January reconciliation).

### 2.5 User direction facts

From the session transcript:

- *"CFO practically creates a whole new structure each month. Although the xlsx files will change, the logic and the business rules don't change."* → The parser has to stay heuristic and defensive; the calc engine is month-agnostic. Any Lot-first refactor must preserve this split: calc engine stays clean, parsing adapts.
- Q8 (monthly aggregation across entities) is **explicitly out of scope**. Whatever 5b does at the shipment level must not entangle with entity-based aggregation.
- ISR details (item 6) are parked pending an Octavio meeting.

---

## 3. Unknowns that gate the plan

Every one of these must be resolved before implementation starts. Some are §4 clarifying questions for the user; others are §5 Phase-0 investigation tasks the assistant can complete alone.

| # | Unknown | Resolution path |
|---|---|---|
| U1 | Current count of Lots and `ContractLotAllocation` rows in prod | §5 Phase 0.1 — direct DB query |
| U2 | Shape and purpose of `MillingOrder` / `MillingInput` / `MillingOutput` | §5 Phase 0.2 — read schema + existing usages |
| U3 | What `Lot.costPerQQ` currently equals in prod (same as `SupplierAccountEntry.precio`? something else?) | §5 Phase 0.3 — sample query |
| U4 | Whether Lot stage `PERGAMINO_BODEGA` → `ORO_EXPORTABLE` is tracked via `parentLotId` lineage or via `MillingOutput` or both | §5 Phase 0.2 |
| U5 | Whether `Lot.quantityQQ` is decremented when a lot is milled or allocated, or whether decrement happens via a separate join table | §5 Phase 0.2 |
| U6 | **Whether the 46 historical contracts in prod should have Lots synthesized for them, or stay as legacy MP rows** | §4 Q1 (user decision) |
| U7 | **Hard constraint or soft?** Whether the January reconciliation margenBruto must be preserved cell-for-cell after the cutover, or whether a documented small drift is acceptable | §4 Q2 (user decision) |
| U8 | **Rollout shape** — single PR, phased rollout, or feature-flagged cutover | §4 Q3 (user decision) |
| U9 | **Sign convention** on yield adjustments (from prior audit) — whether a positive `totalAdjustment` increases or decreases the MP cost of the affected contract | §4 Q4 (Octavio, carried over from ISR meeting) |
| U10 | Whether the Excel importer should continue to exist as a fallback path for new-month ingestion, or whether all future ingestion happens via Lot-first UI entry | §4 Q5 (user decision) |

---

## 4. Clarifying questions — **blocking**

Per [_THE_RULES.MD](../_THE_RULES.MD) Rule 1, these cannot be guessed. Implementation does not start until they are answered.

### Q1 — Historical contracts: synthesize Lots, or keep legacy?

The 46 contracts currently in prod were imported from `docs/hopecoffee.xlsx` with `MateriaPrima` rows created directly from xlsx cells. There is no corresponding `Lot` data — the xlsx does not carry lot granularity. Two options:

- **(a) Synthesize Lots.** For each historical `MateriaPrima` row, create a matching `Lot` with `quantityQQ = MP.pergamino`, `costPerQQ = MP.precioPromQ`, `contractedYield = MP.rendimiento`, `supplierId = MP.supplierId` (if set), `stage = PERGAMINO_BODEGA`, and a special `supplierNote` marker like *"Synthesized from xlsx import 2026-04-15"*. Create `ContractLotAllocation` rows linking each synthetic Lot to the original Contract via the existing `MateriaPrimaAllocation`. Then decommission the original MP rows OR keep them as historical read-only shadows.

  **Pro:** single data model everywhere; the derived MP view works for every contract in prod.

  **Con:** synthesizing Lots from averaged rollups fabricates granularity that wasn't in the SSOT. This may violate Rule 4 (*"no false information"*) if the synthetic Lots are not clearly flagged as derived-from-rollup rather than real receipts. It also creates a trust problem: if Hector later sees a "Lot" for January that he didn't physically receive into bodega, he may reasonably object.

- **(b) Keep legacy.** Historical MP rows stay exactly as they are. The new derived-view code path only runs for contracts where `ContractLotAllocation` rows actually exist. Shipment aggregation reads from both sources: the derived view for lot-backed contracts, the MP table for legacy contracts. A discriminator field on `Contract` (`inventorySource: LOT | LEGACY_MP`) picks the path.

  **Pro:** no fabricated data. Historical parity with the SSOT is mechanically preserved — the January reconciliation numbers never move. Rule 4 compliant.

  **Con:** the parallel-worlds problem persists for historical data, just more cleanly scoped. The cutover is incremental and longer-lived.

**My recommendation: (b)**, because Rule 4 is non-negotiable and (a) risks fabricating data. The cutover happens naturally as new contracts are created via the Lot-first path; historical contracts stay read-only.

**Decision needed from user:** (a) or (b)?

### Q2 — January parity: hard or soft constraint?

The January reconciliation locked every contract's margenBruto to a 2-decimal-precision match with `Enero.xlsx`. The regression gate in [src/lib/services/__tests__/january-ssot.test.ts](../src/lib/services/__tests__/january-ssot.test.ts) asserts this.

If the cutover switches January's reads from `MateriaPrima.totalMP` (stored, currently 2,958,989.29 for Block 1) to a derived sum over Lots (which would require either option (a) in Q1 or keeping the legacy path), the numbers may shift by rounding. The derivation `Σ(quantityQQ × costPerQQ × allocation_share)` might produce 2,958,989.30 or 2,958,989.28 instead of 2,958,989.29 depending on which order the sums are taken and whether Decimal.js rounding is ROUND_HALF_UP everywhere.

- **Hard constraint:** derived values must match stored values to 2 decimals for every historical contract. If they don't, the cutover is blocked and the derivation is reworked.
- **Soft constraint:** documented drift of up to ±Q 10 per contract per shipment is acceptable, with the drift logged in an audit report at cutover time.

**My recommendation: hard constraint for January (already reconciled), soft for Feb–Dec (not yet reconciled; the cutover is part of getting them right the first time).**

**Decision needed from user.**

### Q3 — Rollout shape

Three reasonable shapes:

- **(a) Single PR.** All phases land together. Most reviewable as a single diff but highest blast radius. One bug = one rollback of the entire refactor.
- **(b) Phased PRs, no runtime flag.** Phase 0 → Phase 5 as separate commits. Each phase is reviewable and deployable independently. Rollback scope = one phase. Downside: intermediate states are live in prod, so each phase must leave the system functional.
- **(c) Feature-flagged cutover.** A `USE_LOT_BASED_MP` env var or database-level flag. Old and new code paths live side by side; the flag controls which one shipment-aggregation reads. Flip the flag to cut over. Flip it back to roll back. Remove the old path after a stable period.

**My recommendation: (b) phased, no flag.** The phases can be designed to leave the system functional at each boundary. Feature flags add complexity that isn't justified for a single-tenant app with one CFO reviewing every change. But if the user wants (c), I can design the phases to accommodate a flag without significant extra work.

**Decision needed from user.**

### Q4 — Yield adjustment sign convention

Carried over from [quality-lab-wiring-audit.md §"Handoff 2"](quality-lab-wiring-audit.md). `ADJUSTMENT_RATE_PER_POINT = 50` in [quality-lab/actions.ts:93](../src/app/(dashboard)/quality-lab/actions.ts#L93). A positive `(actualYield − contractedYield)` produces a positive `totalAdjustment`. Whether this represents *"Hope Coffee owes more"* or *"supplier is penalized"* is not documented. The cutover MUST get this right because the MP cost update direction depends on it.

**Requires Octavio meeting** (same meeting as Q4a/Q4b on ISR). No implementation decision possible until then.

### Q5 — Does the Excel importer continue to exist post-cutover?

Two models:

- **(a) Importer stays, adapts.** The importer continues to read `docs/hopecoffee.xlsx` but, instead of creating `MateriaPrima` rows directly, it creates `Lot` + `ContractLotAllocation` rows. The derived view picks it up from there. This preserves the monthly "CFO sends new xlsx, we import" workflow.

- **(b) Importer is deprecated.** Post-cutover, all inventory entry is via the existing `suppliers/actions.ts` bodega-receipt UI (Hector's team uses this today for real receipts). The xlsx becomes a reference document, not an ingestion source. Historical contracts stay as legacy.

**My recommendation: (a) importer stays.** Per the user's own statement from the session (*"CFO practically creates a whole new structure each month... although the xlsx files will change, the logic and the business rules don't change"*), the monthly xlsx is the CFO's working surface and will not go away. The importer's job shape just changes: from "create MP rows" to "create Lots that the derived view aggregates into MP."

**Decision needed from user.**

---

## 5. Phase-by-phase implementation

Contingent on §4 answers. The phases below assume the recommendations above: Q1(b), Q2(hard for January / soft for Feb–Dec), Q3(b), Q5(a). If the user picks differently, specific phases adjust but the overall shape holds.

### Phase 0 — Research (read-only, zero risk)

**Goal:** answer the §3 U1–U5 unknowns before touching anything.

**Tasks:**

1. **0.1** Query the live Supabase prod DB for current counts: Lots total, Lots by `stage`, Lots with cuppingRecords, Lots with `sourceAccountEntryId` populated, `ContractLotAllocation` rows, `MillingOrder` rows. Write the findings to `docs/phase-0-lot-inventory-snapshot.md`.
2. **0.2** Read the full schema for `MillingOrder`, `MillingInput`, `MillingOutput`. Grep `src/` for every consumer. Document the exact semantics of the lifecycle `PERGAMINO_BODEGA → (milling) → ORO_EXPORTABLE` in the same snapshot doc. Answer U2, U4, U5.
3. **0.3** Query a sample of 20 prod Lots, join to `SupplierAccountEntry`, and verify that `Lot.costPerQQ === SupplierAccountEntry.precio` in every case (or document drift). Answer U3.
4. **0.4** Write a throwaway script `scripts/phase-5b-derive-mp-dryrun.ts` that, for each current `MateriaPrima` row, attempts to compute what the derived value **would** be from the Lot-world data (where Lots exist). For rows where derivation is impossible (no Lot chain), record "legacy-only." Output a diff report.
5. **0.5** Based on 0.1–0.4, classify every contract in prod as one of:
   - `LOT_DERIVABLE` — has ContractLotAllocation + Lot chain, MP value can be computed
   - `LOT_PARTIAL` — has some Lot data but gaps prevent full derivation
   - `LEGACY_MP` — no Lot chain; must stay on the old read path

**Deliverable:** a snapshot doc under `docs/` with the exact counts and classification. **This is a prerequisite for every subsequent phase.** No code changes in Phase 0.

**Rollback:** not applicable (read-only).

### Phase 1 — Schema additions (additive, low risk)

**Goal:** add every column and table needed to support the derived view without removing anything existing. No data migrations. No read-path changes.

**Changes:**

1. `Contract.inventorySource InventorySource @default(LEGACY_MP)` — enum `LEGACY_MP | LOT_DERIVED`. Default is `LEGACY_MP` so every historical contract is explicitly flagged. New contracts created via the `suppliers/actions.ts` bodega path (or via future Lot-first UI) get `LOT_DERIVED`.
2. **New model** `MateriaPrimaSnapshot` — captures a cached derived value per (contract, computedAt) tuple so the derived view doesn't recompute from scratch on every shipment read. Fields: `contractId`, `totalMP Decimal`, `pergaminoQQ Decimal`, `weightedPrecioPromQ Decimal`, `weightedRendimiento Decimal`, `computedAt`, `sourceVersion` (monotonic counter that increments when upstream Lot data changes). This is effectively a materialized view, implemented as a Prisma model rather than a Postgres materialized view so it stays in the ORM.
3. `Lot.derivedFromMpId String?` — optional FK back to `MateriaPrima.id`, populated only if option (a) of Q1 is picked. If option (b) is picked, this field is not added.

**Deployment:** `prisma db push --accept-data-loss` (no actual loss; all additions). No data migrations.

**Invariants after Phase 1:**

- Every existing contract has `inventorySource = LEGACY_MP`.
- The `MateriaPrimaSnapshot` table is empty.
- `shipment-aggregation.ts` and every other reader is unchanged and reads `MateriaPrima.totalMP` directly. The new fields exist but are unused.
- January Phase A diff still returns 85 / 0 / 0 / 1.

**Rollback:** drop the new field + table via a reverse migration. Low risk because nothing reads them yet.

### Phase 2 — Derivation service (code-only, low risk)

**Goal:** write `deriveMateriaPrimaForContract(contractId): MateriaPrimaSnapshot` as a pure function that can be called in isolation. Read the Lot chain, walk lineage where needed, compute weighted values, return a snapshot. **Does not write anywhere yet.**

**New file:** `src/lib/services/materia-prima-derivation.ts`

**Signature:**

```ts
export async function deriveMateriaPrimaForContract(
  contractId: string,
  opts: { includeYieldAdjustments: boolean; asOf?: Date }
): Promise<MateriaPrimaSnapshotData>
```

**Algorithm (rough; Phase 0 findings may refine):**

1. Load all `ContractLotAllocation` rows for this contract, eager-load their Lots.
2. For each allocation, determine the effective quantity: `allocation.quintalesAllocated ?? lot.quantityQQ` (null = full allocation per the existing schema comment).
3. Walk `Lot.parentLotId` lineage to find the `PERGAMINO_BODEGA` ancestor that produced this `ORO_EXPORTABLE` lot (or whatever the Phase 0 investigation determines is the right direction). Capture its `costPerQQ`.
4. Sum: `totalMP = Σ (effectiveQuantity × costPerQQ_of_ancestor)`.
5. Weighted averages: `weightedPrecioPromQ = totalMP / Σ(effectiveQuantity)`, `weightedRendimiento = Σ(quantity × rendimiento) / Σ(quantity)`.
6. If `opts.includeYieldAdjustments` is true, query `YieldAdjustment` rows where status is `APLICADO` and the chain resolves to this contract's lots; add their `totalAdjustment` to `totalMP` with the correct sign (per Q4).
7. Return a `MateriaPrimaSnapshotData` (plain object, not yet persisted).

**Tests:** unit tests with hand-constructed Lot / Allocation fixtures covering:
- Single lot, full allocation
- Multiple lots, partial allocations summing to contract oro
- Parent lineage (pergamino lot → oro lot)
- With and without yield adjustments
- Edge cases: null quintalesAllocated, zero lots (legacy contract)

**Deployment:** code-only PR, no DB changes. No readers cut over yet.

**Rollback:** delete the file.

**Exit criteria:** the derivation service passes its unit tests and, when run as a dry-run against each Lot-backed contract in prod, produces values that either match the stored `MateriaPrima.totalMP` within the Q2 tolerance OR are documented as deliberate corrections.

### Phase 3 — Snapshot population (idempotent script, medium risk)

**Goal:** populate `MateriaPrimaSnapshot` for every contract classified `LOT_DERIVABLE` in Phase 0. Verify the snapshot values satisfy the Q2 constraint. Does not change any read path yet.

**New script:** `scripts/phase-5b-populate-snapshots.ts`

**Behavior:**

1. Load every contract where `inventorySource = LOT_DERIVED` OR where Phase 0 classified it as `LOT_DERIVABLE`.
2. For each, call `deriveMateriaPrimaForContract` and upsert the result into `MateriaPrimaSnapshot`.
3. Diff the derived `totalMP` against the stored `MateriaPrima.totalMP` (via `MateriaPrimaAllocation`). Log all diffs.
4. Fail hard if any diff exceeds the Q2 tolerance for a contract flagged as requiring hard parity (January contracts).

**Deployment:** run the script against prod after Phase 2 is merged. Idempotent — re-runs produce the same end state.

**Rollback:** `DELETE FROM materia_prima_snapshots` — the table is a cache, nothing else reads from it yet.

### Phase 4 — Read-path cutover (medium-high risk)

**Goal:** switch `shipment-aggregation.ts` (and any other reader identified in Phase 0) to read from `MateriaPrimaSnapshot` for `LOT_DERIVED` contracts and fall back to `MateriaPrima.totalMP` for `LEGACY_MP` contracts.

**Changes:**

1. [src/lib/services/shipment-aggregation.ts](../src/lib/services/shipment-aggregation.ts): replace the `prisma.materiaPrima.aggregate` call with a composition:
   - For `LOT_DERIVED` contracts in the shipment, sum from `MateriaPrimaSnapshot`.
   - For `LEGACY_MP` contracts, sum from `MateriaPrima` via `MateriaPrimaAllocation`.
   - Total is the sum of both streams.
2. [src/app/(dashboard)/quality-lab/actions.ts](../src/app/(dashboard)/quality-lab/actions.ts) `applyYieldAdjustment`: when the contract is `LOT_DERIVED`, invalidate the `MateriaPrimaSnapshot` for that contract and re-derive immediately inside the same transaction. When `LEGACY_MP`, keep the current direct-write path to `MateriaPrima.totalMP`. The WARN path for "no ContractLotAllocation found" disappears for LOT_DERIVED contracts.
3. Any other consumer identified in Phase 0.

**Tests:**

1. Add Vitest cases to [src/lib/services/__tests__/january-ssot.test.ts](../src/lib/services/__tests__/january-ssot.test.ts) asserting that the cutover preserves January parity. January is `LEGACY_MP`, so this should just confirm the legacy path is unchanged.
2. Add a new test file `src/lib/services/__tests__/lot-derived-mp.test.ts` asserting the `LOT_DERIVED` path produces correct aggregates for a fixture shipment with multiple lot-backed contracts.

**Deployment:** after Phase 3 runs cleanly and the snapshot table is populated and diffs are within tolerance.

**Rollback:** revert the shipment-aggregation change. The snapshot table stays populated (harmless); all readers go back to the direct MP path.

**Exit criteria:**

- Phase A diff (`scripts/phase-a-january-diff.ts`) still returns 85 / 0 / 0 / 1.
- January's `Shipment.margenBruto` is bit-identical to the pre-cutover value.
- For any `LOT_DERIVED` contract with an applied yield adjustment, the contract's margen bruto reflects the adjustment (the WARN path no longer fires).
- `npx tsx scripts/phase-c-january-reconcile.ts` can still be re-run idempotently.
- Full test suite green, `npx tsc --noEmit` clean.

### Phase 5 — Importer cutover (high risk — last)

**Goal:** change `scripts/import-excel.ts` to create Lots + `ContractLotAllocation` instead of `MateriaPrima` rows, for new months imported after the cutover.

**Changes:**

1. The parser stays the same — it still extracts `ParsedContract` and `ParsedMP` from the xlsx.
2. The writer changes: for each `ParsedMP`, instead of `prisma.materiaPrima.create`, do `prisma.lot.create` with the derived values, then `prisma.contractLotAllocation.create` linking it to the matching contract, then set the contract's `inventorySource = LOT_DERIVED`. Optionally create a `SupplierAccountEntry` for completeness (marker: "imported from xlsx row N").
3. For blocks where `contracts.length !== materiaPrima.length`, the importer's existing fallback (skip allocation creation, log WARN) still applies — same semantics, just at the Lot level.
4. Historical months that were imported under the old path are NOT touched. Their contracts stay `LEGACY_MP`.

**Tests:**

1. Re-run `./scripts/validate-importer.sh` against a fresh Postgres. The assertions script changes to verify that Lots + allocations are being created instead of MP rows.
2. Assert that `MateriaPrimaSnapshot` rows get populated for the newly-imported contracts (either by an end-of-import hook that calls the derivation service, or by a separate post-import script).

**Deployment:** merge AFTER the user confirms they want to re-import a month via the new path. Before this phase, fresh imports still use the old MP path. This phase is purely an upgrade to the fresh-import workflow; nothing about prod data changes automatically.

**Rollback:** revert the commit. The fresh-import path goes back to creating MP rows directly.

**Exit criteria:** a test re-import of a month (against the disposable Postgres from `validate-importer.sh`) produces Lots + allocations with values that match the xlsx cell-for-cell, and the derived `MateriaPrimaSnapshot` values match the raw calculation.

---

## 6. Risks and mitigations

| # | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Derivation algorithm produces values that differ from stored MP by more than tolerance on January | Medium | High (blocks cutover, forces rework) | Phase 0 dry-run catches this before Phase 1. If it fails, rework derivation before proceeding. |
| R2 | Phase 0 reveals that `MillingOrder` lifecycle is more complex than anticipated (e.g. lots split into multiple outputs) | Medium | Medium (adds Phase 0 scope) | Phase 0 is explicitly sized to absorb complexity. If it balloons, surface and re-estimate before Phase 1. |
| R3 | The `MateriaPrimaSnapshot` table drifts from the underlying Lot data (cache invalidation bug) | Medium | Medium (reported margins become wrong) | `sourceVersion` counter on every Lot mutation; snapshot is only valid if `sourceVersion` matches at read time. Otherwise trigger re-derivation. |
| R4 | Q4 sign convention gets flipped during implementation | Low | High (margins become wrong in the wrong direction) | Explicit `yieldAdjustmentDirection` test fixture, hand-verified against a known scenario. |
| R5 | Feb–Dec reconciliation (item 3) is run against the old MP path, then the cutover happens, and snapshots for reconciled contracts drift | Low | High | **Sequence 5b AFTER item 3.** This is part of why my §0 recommendation is to do item 3 first. |
| R6 | ContractLotAllocation UI is too painful for Hector to use at scale, so no Lots get allocated and the cutover benefits zero contracts | Medium | High (all effort wasted) | Phase 0 must include a real-world test with Hector — "can you allocate the Lots for one in-progress shipment in under 10 minutes?" If no, Phase 5b is blocked on a UX refactor first. |
| R7 | Parallel-reader code in Phase 4 has a bug where it reads from the wrong source for a specific contract | Low | Medium | Exhaustive test coverage in Phase 4 (one test per `inventorySource` × scenario combination). |
| R8 | A new month's xlsx arrives mid-refactor and the importer is in an inconsistent state | Medium | Medium | Phase 5 is last for exactly this reason. Until Phase 5 lands, the existing importer path works. |
| R9 | `MateriaPrimaSnapshot` is kept in sync by every writer that touches Lots, allocations, or yield adjustments — a new writer added after the refactor forgets to invalidate | High (over time) | Medium | Prisma middleware / extension that invalidates snapshots automatically when upstream tables are written to, or a scheduled recalc job as a safety net. |
| R10 | Octavio doesn't answer Q4 (sign convention) and Phase 4 cannot proceed | Low | Medium | Phases 0–3 do not depend on Q4. Phase 4 can partially proceed (everything except the yield-adjustment integration) and wait for the meeting. |

---

## 7. Rollback plan per phase

Summarized from the per-phase sections for quick reference:

| Phase | Rollback |
|---|---|
| 0 | N/A (read-only) |
| 1 | Drop new fields + table via reverse migration. |
| 2 | Delete the new file. |
| 3 | `DELETE FROM materia_prima_snapshots`. |
| 4 | Revert the shipment-aggregation commit. Snapshots stay populated but unread. |
| 5 | Revert the importer commit. Fresh imports go back to creating MP rows. |

Because each phase leaves the system in a working state, rollback never requires a data restore — only code reverts or cache deletions.

---

## 8. Success criteria (system-level)

The refactor is considered complete when **all** of these are true:

1. Every `LOT_DERIVED` contract's margen bruto is computed from `MateriaPrimaSnapshot` (which is itself derived from `ContractLotAllocation × Lot × YieldAdjustment`).
2. Every January and Feb–Dec contract's margen bruto matches its SSOT value to the Q2-configured tolerance.
3. Applied yield adjustments flow through to the contract's margen bruto automatically, without WARN paths.
4. The Excel importer (for months imported post-cutover) creates Lots + allocations, not MP rows directly.
5. A fresh re-import via `scripts/validate-importer.sh` produces Lot-backed data that passes both structural (allocation count) and value-level (derived MP matches xlsx) assertions.
6. No single code path reads `MateriaPrima.totalMP` for a contract whose `inventorySource = LOT_DERIVED`.
7. `MateriaPrima` table still exists for `LEGACY_MP` contracts, with no auto-generated write path and no ongoing mutations (read-only in practice).
8. Full test suite green. `npx tsc --noEmit` clean. Phase A diff returns zero mismatches for January.

---

## 9. What happens if the user approves this plan

1. Wait for §4 answers (Q1–Q5). Without them, nothing starts.
2. Schedule the Octavio meeting for Q4 (sign convention) if not already scheduled — it's the long pole.
3. Begin Phase 0 as soon as Q1, Q2, Q3, Q5 are answered (Q4 is not Phase 0–blocking).
4. Re-estimate Phase 1–5 scope after Phase 0 completes. The Phase 0 snapshot doc is the real input to the implementation PRs.
5. At each phase boundary, wait for user review before starting the next phase. No blind autopilot — every phase ends with a "phase N complete, go/no-go on phase N+1" checkpoint.

---

## 10. Open items not in this plan

The following are out of scope for item 5b as defined, but are related and may surface during implementation. Flagging so they're not forgotten:

- **Container-level aggregation.** The `Container` and `ContainerLot` models exist. Are they part of the Lot-first refactor or independent? Phase 0 should clarify.
- **Inventory valuation for stock-lock contracts.** Per business rules §1.12, coffee is valued at cost, not realizable value. Stock-lock contracts (§1.2) bypass the MP chain entirely. The derivation service must handle this cleanly — probably by returning an empty `MateriaPrimaSnapshot` for `STOCK_LOCK` contracts.
- **Reject/subproducto tracking at the Lot level.** Hector tracks rejects separately. If they become part of the Lot-first model, the derivation needs to handle it.
- **Audit log volume.** Every applied yield adjustment already writes 3–4 audit log entries. After Phase 4, every snapshot invalidation also writes an entry. Check the audit table doesn't balloon.

---

*End of plan. Blocked on §4 user answers + Octavio meeting for Q4.*
