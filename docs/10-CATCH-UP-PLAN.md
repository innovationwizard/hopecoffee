# Catch-Up Plan: Consolidated Pending Work

> Consolidates all unimplemented items from docs 06, 07, and 08 into a single, dependency-ordered execution plan.
> Supersedes the pending sections of those documents — they remain as reference but this plan governs execution order.
> Date: 2026-04-10

---

## Origin Tracking

Every item traces back to its source document so nothing is lost.

| Source | Document | Items Integrated |
|--------|----------|-----------------|
| Doc 06 | Database Design Review | Issues 3, 7 |
| Doc 07 | DB Enhancement Plan | Waves 4, 5A (partial), 5B (partial) |
| Doc 08 | Operations Refactor Plan | Phases 5A, 5B, 6, 7, 8, 9, 10, 11 |

### Already Implemented (excluded from this plan)

These items were previously listed as pending but are confirmed implemented:

| Item | Status | Evidence |
|------|--------|----------|
| Doc 06 Issue 3 — getDashboardStats aggregate | Done | Uses `prisma.shipment.aggregate()` |
| Doc 06 Issue 3 — getMonthlyContext aggregate | Done | Uses `prisma.contract.aggregate()` |
| Doc 06 Issue 5 — quintalesAllocated field | Done | Field exists on MateriaPrimaAllocation |
| Doc 06 Issue 9 — Price snapshots in updateContract | Done | Creates ContractPriceSnapshot on update |
| Doc 06 Issue 9 — Price snapshots in changeContractStatus | Done | Creates ContractPriceSnapshot on status change |
| Doc 07 Wave 4A — Dashboard aggregate | Done | Same as Doc 06 Issue 3 |
| Doc 07 Wave 4B — Monthly context aggregate | Done | Same as Doc 06 Issue 3 |

---

## Pending Items — Precise Inventory

### From Doc 06 / Doc 07 (Database Enhancements)

| ID | Description | Source |
|----|-------------|--------|
| DB-1 | GIN index on `contracts.regions` for array queries | Doc 06 Issue 7 / Doc 07 Wave 1B |
| DB-2 | `recalculateShipment()` — use DB aggregate for MP and subproducto sums instead of JS `.reduce()` | Doc 06 Issue 3 / Doc 07 Wave 4C |

### From Doc 08 (Operations Refactor)

| ID | Description | Source |
|----|-------------|--------|
| OPS-5A | New Prisma models: Facility, Lot, CuppingRecord, MillingOrder, MillingInput, MillingOutput, YieldAdjustment, ShipmentParty, YieldToleranceConfig | Doc 08 Phase 5A |
| OPS-5A-EXT | Extend Contract with `officialCorrelative` and `cooContractName` fields. Extend SupplierAccountEntry with `lotId`, `facilityId`, `qualityGrade`. | Doc 08 Phase 5A |
| OPS-5B | Auto-correlative generation service (`HC-{YEAR}-{SEQ}`, `LOT-{YEAR}-{SEQ}`, `TRIA-{YEAR}-{SEQ}`) + retroactive generation for 46 existing contracts | Doc 08 Phase 5B |
| OPS-6A | Quality Lab — Cupping Record CRUD with full SCA 10-attribute protocol at `/quality-lab` | Doc 08 Phase 6A |
| OPS-6B | Yield Reconciliation — adjustments list, COO approval workflow at `/quality-lab/adjustments` | Doc 08 Phase 6B |
| OPS-6C | Quality Dashboard Widget — avg cupping score, yield variance, pending cupping | Doc 08 Phase 6C |
| OPS-7A | Facility Management — CRUD page at `/settings/facilities`, seed La Joya (Beneficio, Bodega, Patio) | Doc 08 Phase 7A |
| OPS-7B | Lot Reception — create Lot record when creating SupplierAccountEntry | Doc 08 Phase 7B |
| OPS-7C | Inventory Views — by beneficio, supplier, quality, stage at `/inventory` (refactor) | Doc 08 Phase 7C |
| OPS-7D | Inventory Balances — real-time pergamino/en-proceso/oro computation | Doc 08 Phase 7D |
| OPS-8A | Milling Order CRUD at `/milling` — input lots, output lots, stage transitions | Doc 08 Phase 8A |
| OPS-8B | Milling Yield Analysis — actual vs expected yield per batch | Doc 08 Phase 8B |
| OPS-8C | Subproducto Migration — existing records → MillingOutput, Subproducto table archived | Doc 08 Phase 8C |
| OPS-9A | Per-Shipment Client Roles — ShipmentParty inline CRUD (broker/importer/buyer) | Doc 08 Phase 9A |
| OPS-9B | Four-Layer Contract Identification — officialCorrelative + cooContractName in UI | Doc 08 Phase 9B |
| OPS-9C | Contract-to-Lot Assignment — allocate oro lots to sales contracts | Doc 08 Phase 9C |
| OPS-10A | Export Order — ContainerLot join, lot stage → EXPORTADO on ship | Doc 08 Phase 10A |
| OPS-10B | Carta de Porte — document generation metadata on shipment detail | Doc 08 Phase 10B |
| OPS-11A | Dual-Perspective Dashboard — financial KPIs + operational KPIs | Doc 08 Phase 11A |
| OPS-11B | Operational Reports — inventory, yield variance, milling efficiency | Doc 08 Phase 11B |

---

## Dependency Graph

```
DB-1 (GIN index) ──────────────────────────────────── standalone
DB-2 (recalculate aggregate) ──────────────────────── standalone

OPS-5A (Data models) ──┬── OPS-5B (Correlatives) ──── OPS-9B (4-layer contract IDs in UI)
                       │
                       ├── OPS-7A (Facilities) ──┬── OPS-7B (Lot reception) ──┬── OPS-7C (Inventory views)
                       │                         │                            │
                       │                         │                            └── OPS-7D (Inventory balances)
                       │                         │
                       │                         └── OPS-6A (Cupping) ──── OPS-6B (Yield recon) ──── OPS-6C (Quality widget)
                       │
                       ├── OPS-8A (Milling) ──── OPS-8B (Milling yield) ──── OPS-8C (Subproducto migration)
                       │        │
                       │        └── depends on OPS-7B (lots must exist to mill)
                       │
                       ├── OPS-9A (ShipmentParty) ──── standalone after 5A
                       │
                       ├── OPS-9C (Contract-to-Lot) ──── depends on OPS-7B (lots must exist)
                       │
                       ├── OPS-10A (Export/ContainerLot) ──── depends on OPS-8A (oro lots from milling)
                       │
                       └── OPS-10B (Carta de Porte) ──── depends on OPS-10A

OPS-11A (Dashboard) ──── depends on all above for data
OPS-11B (Reports) ──── depends on all above for data
```

---

## Execution Plan

### Wave A: Quick Database Fixes (no dependencies, immediate value)

**Scope**: Standalone DB improvements that don't interact with any other pending work.

#### A1. GIN Index on Regions Array
**Source**: Doc 06 Issue 7 / Doc 07 Wave 1B

Add a GIN index for `contracts.regions` to support efficient array containment queries.

```sql
CREATE INDEX IF NOT EXISTS idx_contracts_regions ON contracts USING GIN (regions);
```

**Execution**: Run via `prisma db execute` against the production database. No schema.prisma change needed (Prisma doesn't support GIN index declarations).

**Verification**: `EXPLAIN ANALYZE SELECT * FROM contracts WHERE regions @> ARRAY['HUEHUETENANGO']::"CoffeeRegion"[]` should show index scan.

#### A2. DB-Level Aggregate in recalculateShipment
**Source**: Doc 06 Issue 3 / Doc 07 Wave 4C

Replace JS `.reduce()` for MP and subproducto sums with `prisma.aggregate()`:

**File**: `src/lib/services/shipment-aggregation.ts`

Current (JS reduce):
```typescript
const totalMateriaPrima = shipment.materiaPrima.reduce(
  (sum, mp) => sum.plus(new Decimal(toNum(mp.totalMP))), new Decimal(0)
);
const totalSubproducto = shipment.subproductos.reduce(
  (sum, sp) => sum.plus(new Decimal(toNum(sp.totalPerga))), new Decimal(0)
);
```

New (DB aggregate):
```typescript
const [mpAgg, subAgg] = await Promise.all([
  prisma.materiaPrima.aggregate({
    where: { shipmentId },
    _sum: { totalMP: true },
  }),
  prisma.subproducto.aggregate({
    where: { shipmentId },
    _sum: { totalPerga: true },
  }),
]);
const totalMateriaPrima = new Decimal(toNum(mpAgg._sum.totalMP));
const totalSubproducto = new Decimal(toNum(subAgg._sum.totalPerga));
```

Also remove `materiaPrima` and `subproductos` from the `include` clause (still need `contracts` for the calculation engine loop).

**Note**: The contract-level calculation loop (`calculateContract` per contract) must remain in JS because it uses the full calculation engine with Decimal.js precision. Only the simple sums are moved to DB.

**Verification**: Pick a known shipment, compare `totalMateriaPrima` and `totalSubproducto` values before and after. They must match exactly.

---

### Wave B: Operations Foundation — Data Models + Correlatives
**Source**: Doc 08 Phases 5A, 5B

This is the prerequisite for everything in Phases 6-11. Nothing else can start until these models exist.

#### B1. New Prisma Models (OPS-5A)

Add all new models to `prisma/schema.prisma`:

**Facility** — physical location within La Joya
```
id, name, code, type: BENEFICIO | BODEGA | PATIO, capacity, isActive
```

**Lot** — trackable unit of coffee through processing
```
id, lotNumber (auto: LOT-{YEAR}-{SEQ}), supplierId, facilityId, purchaseOrderId,
stage: PERGAMINO_BODEGA | EN_PROCESO | ORO_EXPORTABLE | EXPORTADO | SUBPRODUCTO,
quantityQQ, qualityGrade, cuppingScore, receptionDate, sourceAccountEntryId,
contractedYield, actualYield, costPerQQ, parentLotId
```

**CuppingRecord** — full SCA 10-attribute protocol
```
id, lotId, catadorUserId, date,
fragrance, flavor, aftertaste, acidity, body, balance, uniformity, cleanCup, sweetness, overall,
totalScore, moisturePercent, defectCount, screenSize, waterActivity, notes,
yieldMeasured, purchaseOrderId
```

**MillingOrder** — inventory transformation event
```
id, orderNumber (auto: TRIA-{YEAR}-{SEQ}), facilityId, date, operatorUserId,
status: PENDIENTE | EN_PROCESO | COMPLETADO
```

**MillingInput** — lots consumed by a milling order
```
id, millingOrderId, lotId, quantityQQ
```

**MillingOutput** — lots produced by a milling order
```
id, millingOrderId, lotId (new lot), quantityQQ,
outputType: ORO_EXPORTABLE | SEGUNDA | CASCARILLA | MERMA, qualityGrade, costPerQQ
```

**YieldAdjustment** — price correction from yield variance
```
id, cuppingRecordId, supplierAccountEntryId,
contractedYield, actualYield, toleranceApplied, priceAdjustmentPerQQ, totalAdjustment,
status: PENDIENTE | APLICADO, appliedAt, appliedByUserId
```

**ShipmentParty** — per-shipment client role assignment
```
id, shipmentId, clientId, role: BROKER | IMPORTER | BUYER, notes
```

**YieldToleranceConfig** — system setting for yield tolerance
```
id, toleranceValue (default 0.01), updatedAt, updatedByUserId
```

#### B2. Extend Existing Models (OPS-5A-EXT)

**Contract** — add fields:
```
officialCorrelative  String?  @unique  // auto: HC-{YEAR}-{SEQ}, immutable
cooContractName      String?           // Hector's field reference
```

**SupplierAccountEntry** — add fields:
```
lotId        String?   // links receipt to created lot
facilityId   String?
qualityGrade String?   // preliminary, before cupping
```

#### B3. Auto-Correlative Service (OPS-5B)

**New file**: `src/lib/services/correlatives.ts`

```typescript
async function generateCorrelative(prefix: string, entity: string): Promise<string>
// Pattern: {PREFIX}-{YEAR}-{SEQ} where SEQ is zero-padded 4 digits
// Examples: HC-2026-0001, LOT-2026-0347, TRIA-2026-0012
// Uses MAX(correlative) + 1 with unique constraint
```

**Migration**: Retroactively generate `officialCorrelative` for all 46 existing contracts, ordered by `createdAt`.

#### B4. Facility Seed Data

Seed La Joya with 3 facilities:
- Beneficio (type: BENEFICIO) — dry mill
- Bodega (type: BODEGA) — warehouse
- Patio (type: PATIO) — drying yard

#### B5. Zod Schemas + Permissions

- Add Zod schemas for all new entities
- Add permissions to `src/lib/services/permissions.ts` (roles as of 2026-04-20 multi-role RBAC):
  - `lot:write` → `VENTAS`, `MASTER`
  - `cupping:write` → `LAB`, `MASTER`
  - `milling:write` → `LAB`, `MASTER`
  - `yield_adjustment:write` → `LAB`, `MASTER`
  - `facility:manage` → `MASTER`

**Verification**:
- `prisma db push` succeeds
- `prisma generate` succeeds
- `next build` compiles with 0 errors
- All 46 existing contracts get `officialCorrelative` values
- Facility seed data present in DB

---

### Wave C: Sales Contract Enhancements + Shipment Parties
**Source**: Doc 08 Phases 9A, 9B

These have no dependency on inventory/quality modules — only on Wave B (models + correlatives).

#### C1. Four-Layer Contract Identification (OPS-9B)

**UI changes**:
- Contract list: show `officialCorrelative` as primary column, `contractNumber` (CFO ref) and `cooContractName` as secondary
- Contract detail: display all 3 human-readable identifiers
- Contract create/edit: `cooContractName` editable by `VENTAS`, `LAB`, `MASTER`
- Reports: use `officialCorrelative` exclusively
- Search: match across all 3 text identifiers

**Action changes**:
- `createContract`: auto-generate `officialCorrelative` via correlative service
- `updateContract`: allow editing `cooContractName` (field domain — `VENTAS`), `contractNumber` (financial — `FINANCIERO` / `MASTER`)

#### C2. Per-Shipment Client Roles (OPS-9A)

**New UI section on shipment detail page**: "Partes Comerciales"
- Inline add: select client, select role (BROKER | IMPORTER | BUYER), optional notes
- Inline delete
- Same client can appear with different roles on different shipments

**New server actions**: `src/app/(dashboard)/shipments/party-actions.ts`
- `createShipmentParty`, `deleteShipmentParty`, `getShipmentParties`
- Permission: `shipment:write`

**No changes to Client entity** — roles are per-shipment, not per-client.

**Verification**:
- Contracts display 3 identifiers (official bold, CFO + COO secondary)
- Shipment detail shows parties section
- Search by any contract identifier works

---

### Wave D: Facility Management + Lot Reception + Inventory Views
**Source**: Doc 08 Phases 7A, 7B, 7C, 7D

This is the COO's most requested feature set. Depends on Wave B (Facility and Lot models).

#### D1. Facility Management (OPS-7A)

**New route**: `/settings/facilities`
- Full CRUD page for physical locations
- Fields: name, code, type (BENEFICIO | BODEGA | PATIO), capacity, isActive
- Permission: `facility:manage` (`MASTER` only for creation/deletion)
- Seed data already present from Wave B4

#### D2. Lot Reception (OPS-7B)

**Modify**: `/suppliers/[id]` (account statement page)
- When creating a `SupplierAccountEntry`, also create a `Lot` record
- Auto-assign: `stage = PERGAMINO_BODEGA`, facilityId, lotNumber (auto-correlative)
- The lot becomes the trackable unit through the system

**New action**: extend `createAccountEntry` in `suppliers/actions.ts`
- After creating the entry, create corresponding Lot
- Link via `lotId` on SupplierAccountEntry

#### D3. Inventory Views (OPS-7C)

**Refactor route**: `/inventory`
- Current PO-focused page becomes a sub-view
- Add inventory sub-views:
  1. **By Beneficio**: lots grouped by facility, then stage
  2. **By Supplier**: lots grouped by supplier, with quality/yield info
  3. **By Quality**: lots grouped by cupping score bands (80-82, 83-84, 85+)
  4. **By Stage**: pergamino / en proceso / oro exportable
- Each view shows: lot number, supplier, facility, QQ, quality, date received, days in warehouse

#### D4. Inventory Balances (OPS-7D)

Real-time computation on inventory page:
- `Pergamino en Bodega` = lots where stage = PERGAMINO_BODEGA, SUM(quantityQQ)
- `En Proceso` = lots where stage = EN_PROCESO, SUM(quantityQQ)
- `Oro Exportable` = lots where stage = ORO_EXPORTABLE, SUM(quantityQQ)
- Filterable by facility, supplier, quality, date range
- Use `prisma.lot.aggregate()` with `groupBy` for efficient queries

**Verification**:
- Facility CRUD works at `/settings/facilities`
- Creating a supplier account entry also creates a lot
- Inventory page shows lot-based views with balances
- Lot numbers auto-generated (LOT-2026-XXXX)

---

### Wave E: Quality Lab Module
**Source**: Doc 08 Phases 6A, 6B, 6C

Depends on Wave D (lots must exist to cup). This is Hector's primary daily workflow.

#### E1. Cupping Record CRUD (OPS-6A)

**New route**: `/quality-lab`
- List view: all cupping records, filterable by lot, supplier, facility, date range, score range
- Create form: select lot (from PERGAMINO_BODEGA lots), enter 10 SCA attributes (6.00-10.00 each):
  fragrance/aroma, flavor, aftertaste, acidity, body, balance, uniformity, clean cup, sweetness, overall
- Physical analysis section: moisture %, defect count, screen size, water activity
- Auto-compute total SCA score (sum of 10 attributes)
- Auto-classify: 80+ = specialty, <80 = commercial
- On save: compare `|yieldMeasured - contractedYield|` vs tolerance (default 0.01)
  - If outside tolerance: auto-create `YieldAdjustment` with status PENDIENTE
- COO can inline-update yield tolerance (persisted in YieldToleranceConfig)
- Permission: `cupping:write` (`LAB`, `MASTER`)

#### E2. Yield Reconciliation (OPS-6B)

**New route**: `/quality-lab/adjustments`
- List pending yield adjustments
- Shows: lot, supplier, contracted yield, actual yield, computed price adjustment
- COO approves/rejects adjustment
- On approval: adjustment flows to SupplierAccountEntry as a line item
- Permission: `yield_adjustment:write` (`LAB`, `MASTER`)

#### E3. Quality Dashboard Widget (OPS-6C)

Add to dashboard (operations section):
- Avg cupping score by supplier (last 30/90/365 days)
- Yield variance by supplier
- Lots pending cupping count
- Quality compliance rate

**Verification**:
- Can create a cupping record for a lot
- Yield adjustments auto-created when yield outside tolerance
- COO can approve/reject adjustments
- Dashboard shows quality KPIs

---

### Wave F: Milling Module
**Source**: Doc 08 Phases 8A, 8B, 8C

Depends on Wave D (lots in PERGAMINO_BODEGA state). This is the inventory transformation engine.

#### F1. Milling Order CRUD (OPS-8A)

**New route**: `/milling`
- Create milling order: select facility, select input lots (pergamino), assign quantities
- Input lots' stage changes from `PERGAMINO_BODEGA` to `EN_PROCESO`
- Record outputs: oro exportable QQ, segunda QQ, cascarilla QQ, merma QQ
- Output lots created with appropriate stage and `parentLotId` for traceability
- System enforces balance: `SUM(outputs) + merma = SUM(inputs)` (within tolerance)
- Permission: `milling:write` (`LAB`, `MASTER`)
- Auto-generated order number: TRIA-{YEAR}-{SEQ}

#### F2. Milling Yield Analysis (OPS-8B)

On milling order detail page:
- Actual yield: `oro_output / pergamino_input`
- Expected yield: from lot's purchase contract
- Variance: flagged if outside tolerance
- Links to cupping records for input lots

#### F3. Subproducto Migration (OPS-8C)

**Mandatory migration**: existing subproducto records → milling output model.

Strategy:
1. For each existing `Subproducto`, create a corresponding `MillingOutput` with `outputType = SEGUNDA`
2. Create a synthetic `MillingOrder` (status: COMPLETADO, date: subproducto creation date) to house each migrated output
3. Revenue calculation preserved in `MillingOutput` cost fields
4. After migration validation, deprecate `Subproducto` table (keep in schema as archived, remove from UI)
5. Shipment P&L aggregation pulls subproduct revenue from `MillingOutput` instead of `Subproducto`

**Critical**: This migration changes how `recalculateShipment()` sources subproduct data. Must update `src/lib/services/shipment-aggregation.ts` to read from `MillingOutput` where `outputType IN (SEGUNDA, CASCARILLA)` instead of `Subproducto`.

**Verification**:
- Milling orders create/complete with input/output balance enforced
- Output lots created with correct stage and parentLotId
- Existing subproducto data migrated and revenue values preserved
- `recalculateShipment()` produces identical P&L values after migration

---

### Wave G: Contract-to-Lot + Export + Carta de Porte
**Source**: Doc 08 Phases 9C, 10A, 10B

Depends on Wave F (oro exportable lots must exist from milling).

#### G1. Contract-to-Lot Assignment (OPS-9C)

**New section on contract detail page**: "Lotes Asignados"
- Shows which oro lots are allocated to this sales contract
- Allocate: select from available oro lots, assign quantity
- Tracks: `ContractLotAllocation(contractId, lotId, quantityQQ)`
- Replaces the current MateriaPrimaAllocation with lot-level granularity (existing allocations remain functional during transition)

#### G2. Export Order (OPS-10A)

**Extend Container model**:
- New join: `ContainerLot(containerId, lotId, quantityQQ)`
- When container is shipped, linked lots' stage → `EXPORTADO`
- Oro exportable inventory decreases automatically

#### G3. Carta de Porte (OPS-10B)

**New feature on shipment detail page**:
- Generate carta de porte metadata: container #, lots included, total weight, destination
- Triggers inventory deduction via lot stage transition
- Links to customs/export documentation fields

**Verification**:
- Oro lots assignable to sales contracts
- Containers linkable to specific lots
- Shipping a container transitions lot stages to EXPORTADO
- Inventory balances decrease on export

---

### Wave H: Dashboard & Reports (Board View)
**Source**: Doc 08 Phase 11A, 11B

Depends on all prior waves — this is the final layer that surfaces accumulated data.

#### H1. Dual-Perspective Dashboard (OPS-11A)

Restructure `/dashboard` into role-prioritized sections:

**Shared KPIs** (top, all roles):
- Revenue total, weighted margin, containers, active contracts, break-even progress

**Financial Section** (`FINANCIERO` / `ANALISIS` / `GERENCIA` see first):
- Gross margin per QQ oro
- Revenue by client breakdown
- Position exposure (unfixed contracts)
- Cash conversion cycle estimate

**Operations Section** (`VENTAS` / `LAB` / `COMPRAS` see first):
- Yield Performance Index: `AVG(Contracted Rendimiento / Actual Rendimiento)`
- Contract Fulfillment Rate: `QQ Shipped / QQ Contracted`
- Inventory by Stage (visual breakdown)
- Purchase Commitment Coverage
- Subproduct Recovery Rate
- Quality Compliance Rate
- Avg Days Reception to Export

**Board Summary** (both, bottom):
- Total QQ sold vs. bought vs. remaining (overall and by quality)
- Containers shipped vs. planned

#### H2. Operational Reports (OPS-11B)

**Extend `/reports`** with new report types:
- Inventory report by facility / supplier / quality / stage
- Yield variance report (contracted vs. actual)
- Milling efficiency report (input vs output by order)
- Purchase report by supplier / quality (extends existing purchases report)
- Export as PDF/Excel

**Verification**:
- Dashboard shows operational KPIs with real data
- Financial and operations sections render in role-appropriate order
- Reports generate for all new data types
- "Data available from [date]" shown for metrics that lack historical data

---

## Execution Summary

| Wave | Name | Items | Dependencies | Estimated Effort |
|------|------|-------|--------------|-----------------|
| **A** | Quick DB Fixes | DB-1, DB-2 | None | 30 min |
| **B** | Operations Foundation | OPS-5A, 5A-EXT, 5B + facilities seed + schemas + permissions | None | 3-4 hr |
| **C** | Sales + Shipment Parties | OPS-9A, 9B | Wave B | 2-3 hr |
| **D** | Facilities + Lots + Inventory | OPS-7A, 7B, 7C, 7D | Wave B | 4-5 hr |
| **E** | Quality Lab | OPS-6A, 6B, 6C | Wave D | 4-5 hr |
| **F** | Milling | OPS-8A, 8B, 8C | Wave D | 5-6 hr |
| **G** | Contract-to-Lot + Export | OPS-9C, 10A, 10B | Wave F | 3-4 hr |
| **H** | Dashboard + Reports | OPS-11A, 11B | All above | 4-5 hr |

```
Wave A ──── standalone (do first, quick win)

Wave B ──── foundation (prerequisite for C, D, E, F, G, H)
  │
  ├── Wave C ──── standalone after B
  │
  ├── Wave D ──── standalone after B
  │     │
  │     ├── Wave E ──── depends on D (lots must exist)
  │     │
  │     └── Wave F ──── depends on D (lots must exist)
  │           │
  │           └── Wave G ──── depends on F (oro lots from milling)
  │
  └── Wave H ──── depends on all above (surfaces accumulated data)
```

**Waves C and D can run in parallel** after Wave B completes.
**Waves E and F can run in parallel** after Wave D completes.

---

## Architectural Principles (carried forward from Doc 08)

1. **Server Actions for all CRUD** — no new REST endpoints
2. **Decimal.js for all calculations** — yield reconciliation, price adjustments, inventory balances
3. **Audit logging on every mutation** — lot stage transitions, yield adjustments, milling orders
4. **Zod validation on all inputs** — schemas for every new entity
5. **Permission-based authorization** — `requirePermission()` for all new actions (see Doc 09)
6. **recalculate pattern** — extend to milling orders (input/output balance enforcement)
7. **No mock data** — all seed data and test fixtures reflect real business entities
8. **Every code artifact serves a production purpose** — no speculative abstractions

---

## Data Migration Safety

- All new models are additive — new tables, new nullable columns on existing models
- No destructive changes to existing tables until Wave F3 (Subproducto migration)
- `officialCorrelative` backfill (Wave B3) is append-only on existing contracts
- Existing `MateriaPrima` and `Subproducto` flows continue working during transition
- Dashboard KPIs show "data available from [date]" for new metrics that lack historical data
- Production database backups required before Waves B (schema changes) and F3 (subproducto migration)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Large schema push in Wave B adds many tables at once | Medium | Tables are independent — push incrementally if needed. All columns nullable or with defaults. |
| Subproducto migration (F3) changes P&L data source | High | Run migration script, compare `recalculateShipment()` output before/after for every shipment. Values must match. |
| Lot model adds complexity to existing flows | Medium | Lots are additive — existing contract/shipment flows unaffected until explicitly integrated. |
| Milling balance enforcement may reject imprecise data | Medium | Allow tolerance on `SUM(outputs) + merma = SUM(inputs)` check. Start with soft warning, then enforce. |
| Wave H (Dashboard KPIs) has no historical data for new metrics | Low | Display "Datos desde [fecha]" for new KPIs. No fabricated historical data. |
