# Phase Lab-0 — Snapshot (read-only investigation)

**Date:** 2026-04-15
**Scope:** Inventory of everything relevant to Phase Lab-1 (live warehouse inventory view) already present in the codebase and in Supabase prod. Establishes the baseline Lab-1 must build on, per [docs/lot-materia-prima-unification-plan.md §H.3.1](lot-materia-prima-unification-plan.md).
**Rule adherence:** [_THE_RULES.MD](../_THE_RULES.MD) — every factual claim below is traced to a code file, schema section, or prod query result. Nothing inferred, nothing fabricated.
**Role terminology note (added 2026-04-20):** References to `FIELD_OPERATOR` below predate the multi-role RBAC refactor. Current equivalent for the lab/inventory navigation context is the `LAB` role (or `VENTAS`). See [11-RBAC-MULTI-ROLE-PROPOSAL.md](11-RBAC-MULTI-ROLE-PROPOSAL.md).

---

## 1. Prod database state (as of 2026-04-15 17:50 UTC)

Direct queries via `scripts`-style tsx script against Supabase prod `DATABASE_URL`:

| Entity | Count | Notes |
|---|---|---|
| `Lot` total | **22** | all in `SUBPRODUCTO` stage |
| `Lot` by stage | `SUBPRODUCTO: 22` | **zero** in `PERGAMINO_BODEGA`, `EN_PROCESO`, `ORO_EXPORTABLE`, `EXPORTADO` |
| `Lot` with `supplierId` not null | **0** / 22 | every lot has no supplier FK |
| `Lot` with `facilityId` not null | **0** / 22 | every lot has no facility FK |
| `Lot` with `quantityQQ > 0` | 21 / 22 | one zero-qty lot |
| `Lot` with at least one `CuppingRecord` | **0** / 22 | none have been cupped |
| `SupplierAccountEntry` | 61 | more than lots → most came from the importer, not the `suppliers/actions.ts` path |
| `CuppingRecord` | **0** | **Hector's team has never used the quality-lab side of the app** |
| `YieldAdjustment` | 0 | consistent with zero cataciones |
| `ContractLotAllocation` | 0 | the table is empty DB-wide |
| `MillingOrder` | 22 | 1:1 with the 22 subproducto lots |
| `Facility` | 3 | Beneficio (`BENEFICIO`), Bodega (`BODEGA`), Patio (`PATIO`), all active |
| `Supplier` | 3 | |

### 1.1 Interpretation of the 22 SUBPRODUCTO lots

Per user direction 2026-04-15 (*"the only subproducto possible origins I'm aware of are octavio's xlsx files"*), the 22 SUBPRODUCTO lots in prod came from the Excel importer's historical ingestion path, not from Hector's operational workflow. This matches the observable state:

- zero `supplierId` FKs (the importer doesn't link lots to Supplier rows)
- zero `facilityId` FKs (same reason)
- zero `CuppingRecord` joins (never went through the lab)
- paired 1:1 with `MillingOrder` rows that the importer creates as part of the subproducto pipeline

**These lots are CFO-world historical artifacts, not Lab-world inventory.** Phase Lab-1 excludes them from Hector's default view. They can still be reached via an explicit `?stage=SUBPRODUCTO` URL parameter for anyone who needs to see them.

### 1.2 Consequence for the Lab-1 MVP day-1 experience

With zero lots in operational stages (`PERGAMINO_BODEGA` / `EN_PROCESO` / `ORO_EXPORTABLE`), **the default Lab-1 view will be empty on day one**. This is the empty-state problem [§H.2 of the plan](lot-materia-prima-unification-plan.md) anticipated, and Phase Lab-2 (bulk-entry form) is the immediate follow-up that fills it.

Phase Lab-1 alone ships a beautiful empty state. Phase Lab-2 gives it data. The two should land within a week of each other to avoid the "Hector opens the app on day 1, sees nothing, never comes back" failure mode.

---

## 2. Existing routes and files (Hector-adjacent)

Read-only inventory of what already exists. Lab-1 builds on this rather than duplicating it.

### 2.1 `/inventory/` — the existing inventory page (60–70% of Lab-1 already)

| File | Status | Notes |
|---|---|---|
| [src/app/(dashboard)/inventory/page.tsx](../src/app/(dashboard)/inventory/page.tsx) | **live** | lot list with summary cards, stage/facility/supplier filters, empty state. Already has three stage-aggregate cards (Pergamino en Bodega / En Proceso / Oro Exportable) that show running totals. |
| [src/app/(dashboard)/inventory/lot-actions.ts](../src/app/(dashboard)/inventory/lot-actions.ts) | **live** | exposes `getLots`, `getLot`, `getLotBalances`, `createLot`, `updateLot`. `getLots` accepts `{ facilityId, supplierId, stage, search }` filters and returns rows with `supplier` and `facility` joins included. `getLot` (for single lot) also includes `cuppingRecords` and `contractLotAllocations`. |
| [src/app/(dashboard)/inventory/_components/inventory-filters.tsx](../src/app/(dashboard)/inventory/_components/inventory-filters.tsx) | **live** | client component with three dropdowns (stage / facility / supplier). Uses URL search params for filter state. Clean pattern to extend. |
| [src/app/(dashboard)/inventory/_components/po-form.tsx](../src/app/(dashboard)/inventory/_components/po-form.tsx) | **legacy / dead** | leftover from when the inventory route was about purchase orders. Not referenced by the current page. |
| `src/app/(dashboard)/inventory/[id]/page.tsx` | **legacy redirect** | `redirect('/purchase-orders/' + id)`. There is NO lot detail page today. |
| `src/app/(dashboard)/inventory/new/page.tsx` | **legacy redirect** | `redirect('/purchase-orders/new')`. |

**What the existing page already does that Lab-1 wants:**

- Table of lots with lot number, supplier name, facility name, stage, quantity, quality grade, reception date.
- Three summary cards showing aggregate qty by stage.
- Stage / facility / supplier filters wired to URL params.
- Empty state when no lots match.
- Role-nav entry: FIELD_OPERATOR lands here naturally ([app-shell.tsx:43](../src/components/layout/app-shell.tsx#L43)).

**What's missing for Lab-1 (from [§H.3.2](lot-materia-prima-unification-plan.md)):**

- **Default view excludes SUBPRODUCTO** (and probably `EXPORTADO`) so Hector sees operational stages only. Today the default shows every stage.
- **Punteo (quality grade) filter** — currently only free-text search matches `qualityGrade`. Hector needs a range filter (`≥ 82`).
- **Date range filter** on `receptionDate`.
- **"Has catación" filter** (yes / no / either).
- **"Has yield variance" filter** (only lots with an `APLICADO` YieldAdjustment).
- **Columns: cupping score, days in bodega, catación status.** The existing page doesn't join cuppings into the list query.
- **Sort controls** — the existing page hardcodes `orderBy: { createdAt: 'desc' }`.
- **Pagination** — today every matching lot is fetched in one shot.
- **Row click → lot detail** — currently rows are non-interactive. Need either a new detail route or a drawer on the list page.
- **CSV export** (per Lab-1 spec).

### 2.2 `/quality-lab/` — already exists, zero usage

| File | Status | Notes |
|---|---|---|
| [quality-lab/page.tsx](../src/app/(dashboard)/quality-lab/page.tsx) | live | cupping records list, summary cards (total / avg SCA / pending adjustments), "Nueva Catación" and "Ajustes de Rendimiento" action buttons. |
| [quality-lab/actions.ts](../src/app/(dashboard)/quality-lab/actions.ts) | live | createCuppingRecord (auto-creates YieldAdjustment on variance), applyYieldAdjustment (reverted on 2026-04-15 to supplier-ledger-only), rejectYieldAdjustment, tolerance config CRUD. |
| [quality-lab/_components/cupping-form.tsx](../src/app/(dashboard)/quality-lab/_components/cupping-form.tsx) | live | 333-line SCA protocol form — exists but this is Phase Lab-3 territory, not Lab-1. |
| [quality-lab/new/page.tsx](../src/app/(dashboard)/quality-lab/new/page.tsx) | live | wraps the cupping form for creation. |
| [quality-lab/adjustments/page.tsx](../src/app/(dashboard)/quality-lab/adjustments/page.tsx) | live | list of pending yield adjustments. |

**Relevance to Lab-1:** none directly — Lab-1 is about the inventory view, not cupping. But the existing "Nueva Catación" button structure tells us where Lab-3 will eventually hook in from the inventory page (a per-row "Cup this lot" action).

### 2.3 `/suppliers/` — bodega receipt entry path

| File | Status | Notes |
|---|---|---|
| [suppliers/page.tsx](../src/app/(dashboard)/suppliers/page.tsx) | live | supplier list |
| [suppliers/[id]/page.tsx](../src/app/(dashboard)/suppliers/[id]/page.tsx) | live | supplier detail with account statement |
| [suppliers/actions.ts](../src/app/(dashboard)/suppliers/actions.ts) | live | `createAccountEntry` creates `SupplierAccountEntry` **and** a matching `Lot` in one transaction (lines 48-71), `stage = PERGAMINO_BODEGA`, wires `supplierId + facilityId`. This is the canonical path for entering a bodega receipt. |
| [suppliers/_components/account-statement.tsx](../src/app/(dashboard)/suppliers/_components/account-statement.tsx) | live | the UI surface that creates account entries. |

**Implication for Phase Lab-2 (bulk entry):** the bulk-entry form can call `createAccountEntry` (or a new bulk variant of it) without reinventing the lot-creation logic. The suppliers/actions.ts path is the trusted entry point.

### 2.4 `/milling/` — exists but parallel to Lab-1 scope

Milling orders exist in their own route with full CRUD. Lab-5 extends this with "select lots from inventory → generate milling order" but Lab-1 does not touch it.

### 2.5 Shared infrastructure

- [src/components/ui/card.tsx](../src/components/ui/card.tsx), [empty-state.tsx](../src/components/ui/empty-state.tsx), [page-header.tsx](../src/components/ui/page-header.tsx), [button.tsx](../src/components/ui/button.tsx), [select.tsx](../src/components/ui/select.tsx), [badge.tsx](../src/components/ui/badge.tsx) — all used by the existing inventory page; Lab-1 reuses them.
- [src/lib/utils/format.ts](../src/lib/utils/format.ts) — `formatNumber`, `formatDate`, `toNum` used throughout. Lab-1 reuses.
- No existing table component with sort / pagination / row-click semantics; Lab-1 either writes one or extends `dense-table` (the existing className on [inventory/page.tsx:88](../src/app/(dashboard)/inventory/page.tsx#L88)).

---

## 3. Schema facts for Lab-1

Verified by direct read of [prisma/schema.prisma](../prisma/schema.prisma):

### 3.1 `Lot` model

```
Lot {
  id                   String    @id
  lotNumber            String    @unique  // Auto LOT-{YEAR}-{SEQ}
  supplierId           String?             // nullable — all 22 prod rows have null
  facilityId           String?             // nullable — all 22 prod rows have null
  purchaseOrderId      String?
  stage                LotStage  @default(PERGAMINO_BODEGA)
  quantityQQ           Decimal             // @db.Decimal(10, 2)
  qualityGrade         String?             // e.g. "SHB", "82", "HG"
  cuppingScore         Decimal?            // set after cupping
  receptionDate        DateTime?
  sourceAccountEntryId String?
  contractedYield      Decimal?            // from PO
  actualYield          Decimal?            // from lab
  costPerQQ            Decimal?
  parentLotId          String?             // lineage
  createdAt            DateTime
  updatedAt            DateTime

  relations: supplier, facility, parentLot, childLots[],
             cuppingRecords[], millingInputs[], millingOutputs[],
             contractLotAllocations[], containerLots[], sourceAccountEntries[]
}
```

### 3.2 `LotStage` enum

```
PERGAMINO_BODEGA  // received, in warehouse     ← Hector's daily focus
EN_PROCESO        // being milled
ORO_EXPORTABLE    // gold coffee ready for export
EXPORTADO         // shipped in a container     ← past Hector's daily focus
SUBPRODUCTO       // by-product                  ← historical CFO-world artifacts
```

Lab-1 default view shows the first three. `EXPORTADO` and `SUBPRODUCTO` are opt-in via `?stage=` URL param.

### 3.3 `FacilityType` enum

```
BENEFICIO  // Dry mill processing
BODEGA     // Warehouse / storage
PATIO      // Drying yard
```

All three facility types exist in prod (one of each, active). Lab-1 filter dropdown should surface them all.

### 3.4 `CuppingRecord` — what to join for the "has catación" column

Relevant fields: `lotId`, `date`, `totalScore`, `yieldMeasured`. A lot's "catación status" for Lab-1 is derived by: does any `CuppingRecord` exist where `lotId = lot.id`? If yes, show the most recent cupping's `totalScore` + `yieldMeasured`; if no, show "Sin catar".

For the "has yield variance" filter: join `CuppingRecord → YieldAdjustment` where `status = APLICADO`. That's the "this lot has a real applied variance" signal.

---

## 4. Design decisions for Lab-1 — **awaiting user approval**

Based on the findings in §1–§3, here are the concrete design choices for Lab-1. Each one is a fork-in-the-road that the plan doc left open. **Nothing gets coded until the user approves these.**

### D1. In-place enhancement vs new route

**Options:**
- **(a) Enhance [inventory/page.tsx](../src/app/(dashboard)/inventory/page.tsx) in place.** Add missing filters + columns + drawer. Default view defaults to operational stages only.
- **(b) Create a new route `/inventory/bodega/`.** Leaves the existing page untouched, adds a parallel Hector-focused view.

**Recommendation: (a).** The existing page is already at the right URL (`/inventory`), FIELD_OPERATOR nav already points there, duplicating it adds a route users have to choose between. The existing page is only ~130 lines of JSX; extending it is lighter than cloning it.

### D2. Default stage filter

**Options:**
- **(a) No filter = show all 5 stages** (current behavior).
- **(b) No filter = show `PERGAMINO_BODEGA`, `EN_PROCESO`, `ORO_EXPORTABLE` only.** SUBPRODUCTO and EXPORTADO are opt-in via `?stage=`.
- **(c) No filter = show `PERGAMINO_BODEGA` only.** The strictest "Hector's beachhead" view.

**Recommendation: (b).** The three operational stages together answer *"what do I have in the flow right now?"* which is Hector's core question. Showing PERGAMINO_BODEGA alone is too narrow; showing all 5 drowns him in historical subproducto rows. (b) lets him see the whole active flow while keeping noise out by default.

### D3. Lot detail — drawer vs new route

**Options:**
- **(a) Right-side slide-out drawer on the list page.** Click a row, drawer animates in with lot details, cupping history, allocations, milling lineage. Close returns to list with filter state preserved.
- **(b) New route `/inventory/lot/[id]/page.tsx`.** Full page with breadcrumb navigation back to the list.

**Recommendation: (a) drawer** for Lab-1. Better UX for a "browse-and-inspect" workflow where Hector clicks through many lots quickly. The `/inventory/[id]/page.tsx` legacy redirect stays untouched. If Hector later wants a shareable per-lot URL, that's a follow-up.

### D4. Summary cards — which stages to show

Current page shows three cards: Pergamino en Bodega, En Proceso, Oro Exportable. This is already correct for Lab-1. **Recommendation: keep them as-is**, but ensure the values reflect the same default-excluded view as the table (so if someone filters to only SUBPRODUCTO, the cards still show operational totals as a reference).

### D5. Pagination

The existing page loads all matching lots at once. With 22 lots today and modest projected growth (57 containers × ~10 lots/container × 12 months = ~6,840 lots/year), **no pagination is needed for Lab-1**. If the list reaches 500 rows we revisit. **Recommendation: no pagination in Lab-1**, add a `take: 500` safety cap and a note saying "showing first 500; refine filters if you need more."

### D6. Sort

Current page hardcodes `createdAt: desc`. Lab-1 needs sortable columns (reception date, qty, cupping score, days in bodega). **Recommendation:** add client-side sort via clickable column headers. The dataset is small enough (≤500 rows) that client-side sort is fine and avoids a server round-trip per click.

### D7. CSV export

Plan spec says "one-click, current filter applied." **Recommendation:** add a button that generates the CSV client-side from the already-fetched rows. No server round-trip, respects the current filter, downloads immediately.

### D8. Empty state copy

Current copy: *"Los lotes se crean automaticamente al registrar recepciones de proveedor."* This is accurate. **Recommendation:** update it to also link to Phase Lab-2's bulk-entry flow once that ships: *"Los lotes se crean automaticamente al registrar recepciones. Ingresa tu inventario actual en bloque: [Ingresar recepciones]."*

### D9. SUBPRODUCTO visibility toggle

Per §1.1, SUBPRODUCTO lots are CFO-world artifacts. **Recommendation:** do NOT surface them in the default filter dropdown labels as equal to operational stages. Either rename them in the dropdown to *"Subproducto (histórico)"* to flag their CFO-world origin, or move them to a collapsed "avanzado" filter group. I lean toward the rename — it's one word and makes the distinction visible without adding UI complexity.

### D10. New DB columns

**None.** Everything Lab-1 needs is already in the schema. No migration required.

---

## 5. What Lab-1 does NOT include

Per the plan §H.4 and the 2026-04-15 independence contract:

- No touching of `MateriaPrima`, `Contract`, or `Shipment` reads/writes.
- No creation of new Lots (that's Phase Lab-2's bulk-entry form).
- No cupping entry UI (that's Phase Lab-3).
- No milling order creation (Phase Lab-5).
- No changes to `applyYieldAdjustment` or the supplier ledger.
- No backfill of historical SUBPRODUCTO lots into Lab-world.

---

## 6. Open questions — **blocking Lab-1 code**

Before starting implementation, I need user confirmation on:

1. **D1** — in-place enhancement vs new route. **Recommended: in-place.**
2. **D2** — default stage filter. **Recommended: operational-3 (PERGAMINO_BODEGA + EN_PROCESO + ORO_EXPORTABLE).**
3. **D3** — drawer vs new route for lot detail. **Recommended: drawer.**
4. **D9** — how to label SUBPRODUCTO in the filter dropdown. **Recommended: "Subproducto (histórico)".**

Every other decision in §4 has a clear default that doesn't require user input.

Once approved, Lab-1 implementation proceeds with:

1. Extend `getLots` in lot-actions.ts with the new filters (punteo range, date range, has-catación, has-variance, default stage exclusion).
2. Extend inventory-filters.tsx with the new controls + the default-view behavior.
3. Update inventory/page.tsx to show the new columns (cupping score, days in bodega, catación status) and the drawer.
4. New component `lot-detail-drawer.tsx` with lot summary, cupping history, allocations, lineage.
5. CSV export button.
6. Permission check for `lot:read` (confirm the existing page already has this).
7. Update empty state copy.
8. Smoke test: page loads, filters work, drawer opens, CSV downloads.

**Estimated scope:** 2–3 working days of focused code per [§H.3.2](lot-materia-prima-unification-plan.md).

---

*End of Lab-0 snapshot. Awaiting user decision on §6 before starting Lab-1 code.*
