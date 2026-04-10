# Operations Refactor Plan

> Integrating the COO's field operations requirements with the CFO's financial management system.
> Based on: interview with Héctor (field COO), industry best practices research, and current codebase analysis.

---

## 1. Context & Problem Statement

The current system was designed from the CFO's perspective: contract management, margin tracking, export costs, and P&L. It answers the question **"how much money are we making per container?"**

The COO (Héctor) needs the system to also answer:
- **"Does this coffee match what we contracted?"** (quality validation)
- **"What's in each warehouse right now, by quality?"** (real-time inventory)
- **"What happened to the coffee between reception and export?"** (processing traceability)
- **"Should we adjust the payment to this supplier?"** (yield-based price reconciliation)
- **"Which lots go into which export container?"** (milling orders / órdenes de tría)

These two perspectives are not in conflict — they are complementary halves of the same operation. The financial numbers are only as accurate as the operational data feeding them.

---

## 2. Key Findings from COO Interview

### 2.1 Purchase Contract Validation
- Héctor validates quality and yield when coffee enters the warehouse (beneficio)
- If contracted yield is 1.32 but lab shows 1.33, the **purchase price must be adjusted**
- This adjustment must flow automatically to the supplier payment system
- Currently: no cupping module, no yield reconciliation, no automated price adjustment

### 2.2 Broker / Importer / Client Roles

**Decision**: Any client can act as broker, importer, or both — these are **roles per shipment**, not fixed entity types. The same company (e.g., Onyx) might be a broker on one deal and an importer on another.

- Sales contracts involve up to 3 parties: **broker** (e.g., Westrade, Onyx), **importer** (e.g., Serengeti), and **end buyer** (e.g., Atlas, List & Weisler)
- Sometimes one party fills all roles (e.g., Serengeti buys directly)
- Sometimes broker differs from buyer (e.g., Westrade brokers for Atlas, Kardex, Zaronu)
- Role assignment is **per shipment** with inline CRUD — not a fixed property of the Client entity
- Currently: only a single `Client` entity — no role distinction per shipment

### 2.3 Contract Identification — Four-Layer System

**Decision**: Contracts require 4 distinct identifiers because CFO and COO use completely different references and neither can map to the other's system.

| Layer | Purpose | Example | Who uses it | Editable |
|-------|---------|---------|-------------|----------|
| **UUID7** | Database primary key | `019646a1-...` | System only | Never |
| **CFO Correlative** | Current `contractNumber` in the app — CFO's reference | `SER-0125-A` | CFO (Octavio) | Yes (by ADMIN) |
| **COO Contract Name** | How Héctor identifies contracts in the field | `Serengeti Enero EP` | COO (Héctor) | Yes (by OPERATOR+) |
| **Official Correlative** | Auto-generated, human-readable company-wide ID | `HC-2026-0001` | Everyone, reports, board | Never (auto) |

- The **official correlative** is the canonical human-readable identifier across the company
- CFO and COO correlatives are preserved for each user's workflow comfort
- All four are displayed; official correlative is the one used in reports and external documents
- Currently: only `contractNumber` exists (CFO's reference)

### 2.4 Coffee Lifecycle & Inventory
Héctor described the full operational flow:

```
Reception (Recepción)
  ↓ coffee enters bodega, weighed, receipt generated
Cupping (Catación)
  ↓ quality + yield validated against purchase contract
Milling (Tría)
  ↓ parchment → exportable green + subproducts
Export (Carta de Porte)
  ↓ gold coffee leaves as container
```

At each stage, inventory must be trackable by: **beneficio, supplier, quality, date**.

Currently: no reception/cupping modules, milling is not modeled as inventory transformation, subproductos exist but are disconnected from processing events.

### 2.5 Inventory Needs
- Real-time inventory by beneficio (La Joya, etc.), by supplier, by quality
- Inventory in 3 states: **pergamino en bodega**, **en proceso**, **oro exportable**
- Milling orders consume pergamino inventory and produce oro + subproducts
- Carta de porte (export bill) reduces oro inventory
- Currently: no multi-stage inventory, no warehouse/beneficio concept

### 2.6 Operational Reporting
- Total coffee sold vs. total bought vs. remaining to buy (overall and by quality)
- Which receipts have been cupped, which are pending
- Milling yield per batch vs. expected yield
- Inventory position at any point in time

---

## 3. Industry Best Practices Applied

### 3.1 Lot-Based Inventory with Transformations
**Best practice**: Model inventory as **lots** that transform through processing stages. Each transformation event consumes input lots and produces output lots, maintaining full traceability.

**Application**: Every `SupplierAccountEntry` (receipt) becomes a trackable lot. Milling orders are transformation events that split lots into exportable + subproduct outputs. The lot genealogy chain enables traceability from export container back to farm/supplier.

### 3.2 Quality Records Attached to Lots
**Best practice**: SCA cupping protocol (10 attributes, 80+ = specialty) attached at multiple points: reception, pre-mill, pre-export. Physical analysis (moisture, defects, screen size) recorded alongside cupping scores.

**Application**: Create a `CuppingRecord` entity linked to lots. Include SCA score breakdown, physical analysis, and the catador (cupper) who performed it. Link to purchase contract for yield/quality reconciliation.

### 3.3 Multi-Party Commercial Relationships
**Best practice**: Separate the roles of broker, importer, and end buyer. A single transaction may involve all three. The party hierarchy determines payment flow, commission structure, and reporting.

**Application**: Roles are assigned **per shipment**, not per client entity. Any client can act as broker, importer, or both on any given shipment. A `ShipmentParty` join table links clients to shipments with their role for that specific deal. This avoids forcing clients into rigid categories — Onyx can broker one deal and import another.

### 3.4 Four-Layer Contract Identification
**Best practice**: Maintain separate identifiers for system use (UUID), departmental convenience (CFO/COO references), and official company communications (auto-generated correlative).

**Application**: UUID7 as PK. Existing `contractNumber` preserved as CFO's reference. New `cooContractName` for field operations. New `officialCorrelative` (auto-generated `HC-{YEAR}-{SEQ}`, immutable) as the canonical human-readable ID for reports, board, and cross-department communication.

### 3.5 Yield-Based Price Reconciliation
**Best practice**: Purchase price = f(contracted yield, actual yield, quality score). When actual yield diverges from contracted, the system computes a price adjustment that flows to the payment module.

**Application**: When a cupping record is entered with `|actualYield - contractedYield| > tolerance`, compute `priceAdjustment = (actualYield - contractedYield) * adjustmentRate` and attach it to the supplier payment. Default tolerance: +/- 0.01, configurable inline by the COO.

### 3.6 Board-Level KPIs
**Best practice**: Boards of coffee exporters track operational AND financial KPIs.

**Financial KPIs** (CFO — mostly exist):
- Gross margin per QQ oro
- Weighted average margin %
- Revenue by client / by quality
- Cash conversion cycle
- Position exposure (unfixed contracts)

**Operational KPIs** (COO — new):
- Yield Performance Index: `Contracted Rendimiento / Actual Rendimiento` (target >= 1.0)
- Contract Fulfillment Rate: `QQ Shipped / QQ Contracted`
- Inventory Turnover: `QQ Exported (12mo) / Avg QQ in Warehouse`
- Purchase Commitment Coverage: `QQ Parchment Contracted / QQ Needed for Open Sales`
- Subproduct Recovery Rate: `Revenue from Subproducts / Total Purchase Cost`
- Quality Compliance Rate: `Lots Meeting Contract Spec / Total Lots Received`
- Days to Export: avg days from reception to container loading
- Warehouse Utilization by beneficio

---

## 4. Refactor Plan: Phases

### Phase 5: Operations Foundation

**5A — Data Model Extensions**

New Prisma models:

```
Facility (physical location within La Joya)
  - id (uuid7), name, code, type: BENEFICIO | BODEGA | PATIO
  - beneficioId (nullable — parent facility, for sub-locations)
  - capacity (qq, nullable), isActive
  - Relations: lots, millingOrders
  - Seed data: La Joya with 3 facilities: Beneficio, Bodega, Patio
  - Full CRUD management page at /settings/facilities

Lot (trackable unit of coffee)
  - id (uuid7), lotNumber (auto: LOT-{YEAR}-{SEQ})
  - supplierId, facilityId, purchaseOrderId
  - stage: PERGAMINO_BODEGA | EN_PROCESO | ORO_EXPORTABLE | EXPORTADO | SUBPRODUCTO
  - quantityQQ, qualityGrade, cuppingScore
  - receptionDate, sourceAccountEntryId (links to SupplierAccountEntry)
  - contractedYield, actualYield
  - costPerQQ (Decimal — for cost-based inventory valuation)
  - parentLotId (nullable — for traceability through transformations)

CuppingRecord (full SCA 10-attribute protocol)
  - id (uuid7), lotId, catadorUserId, date
  - SCA attributes (each scored 6.00-10.00, Decimal(4,2)):
    fragrance, flavor, aftertaste, acidity, body,
    balance, uniformity, cleanCup, sweetness, overall
  - totalScore (computed sum of 10 attributes, Decimal(5,2))
  - Physical analysis:
    moisturePercent (Decimal(4,2), target 10.5-12.5%)
    defectCount (Int, per 350g sample)
    screenSize (String — e.g., "15/16", "17/18")
    waterActivity (Decimal(3,2), target <0.65 aw)
  - notes (Text)
  - yieldMeasured (Decimal(6,4) — rendimiento real)
  - purchaseOrderId (nullable — links to PO for reconciliation)

MillingOrder (inventory transformation)
  - id (uuid7), orderNumber (auto: TRIA-{YEAR}-{SEQ})
  - facilityId, date, operatorUserId
  - status: PENDIENTE | EN_PROCESO | COMPLETADO
  - Relations: inputs (MillingInput[]), outputs (MillingOutput[])

MillingInput
  - id (uuid7), millingOrderId, lotId, quantityQQ

MillingOutput
  - id (uuid7), millingOrderId, lotId (new lot created), quantityQQ
  - outputType: ORO_EXPORTABLE | SEGUNDA | CASCARILLA | MERMA
  - qualityGrade (nullable)
  - costPerQQ (Decimal — allocated from inputs using cost-based valuation)

YieldAdjustment
  - id (uuid7), cuppingRecordId, supplierAccountEntryId
  - contractedYield, actualYield
  - toleranceApplied (Decimal(6,4) — default 0.01, COO can inline-update)
  - priceAdjustmentPerQQ, totalAdjustment
  - status: PENDIENTE | APLICADO
  - appliedAt, appliedByUserId

ShipmentParty (per-shipment client role assignment)
  - id (uuid7), shipmentId, clientId
  - role: BROKER | IMPORTER | BUYER
  - notes (nullable)
  - Inline CRUD on shipment detail page
  - Same client can appear with multiple roles on different shipments

YieldToleranceConfig (system setting)
  - id (uuid7), toleranceValue (Decimal(6,4), default 0.01)
  - updatedAt, updatedByUserId
  - COO can update inline from quality lab UI
```

Extend existing models:

```
Contract — add fields:
  - officialCorrelative (auto-generated: HC-{YEAR}-{SEQ}, unique, immutable)
  - cooContractName (String, nullable — Héctor's field reference, editable by OPERATOR+)
  (existing contractNumber remains as CFO's reference, editable by ADMIN)
  (existing id remains uuid7 as DB primary key)

SupplierAccountEntry — add fields:
  - lotId (nullable — links receipt to created lot)
  - facilityId
  - qualityGrade (preliminary, before cupping)
```

Note: The `Client` model is **not** modified with a role field. Client roles are per-shipment via `ShipmentParty`.

**5B — Auto-Correlative Generation**

Service: `generateCorrelative(prefix: string, entity: string) -> string`
- Pattern: `{PREFIX}-{YEAR}-{SEQ}` where SEQ is zero-padded 4 digits
- Examples: `HC-2026-0001` (contract), `LOT-2026-0347` (lot), `TRIA-2026-0012` (milling)
- Uses DB sequence or `MAX(correlative) + 1` with unique constraint
- Applied on creation, never editable
- Migration: retroactively generate `officialCorrelative` for all 46 existing contracts (ordered by createdAt)

---

### Phase 6: Quality Lab Module

**6A — Cupping Record CRUD (Full SCA 10-Attribute Protocol)**

New route: `/quality-lab`
- List view: all cupping records, filterable by lot, supplier, facility, date range, score range
- Create form: select lot (from reception), enter all 10 SCA attributes (6.00-10.00 each):
  fragrance/aroma, flavor, aftertaste, acidity, body, balance, uniformity, clean cup, sweetness, overall
- Physical analysis section: moisture %, defect count (per 350g), screen size, water activity
- Auto-compute total SCA score (sum of 10 attributes)
- Auto-classify: 80+ = specialty, <80 = commercial
- On save: compare `|yieldMeasured - contractedYield|` vs `toleranceValue` (default +/- 0.01)
  - If outside tolerance: auto-create `YieldAdjustment` record with status PENDIENTE
  - Flag for COO review
- COO can **inline-update the yield tolerance** directly from the quality lab UI (persisted in `YieldToleranceConfig`)

**6B — Yield Reconciliation**

New route: `/quality-lab/adjustments`
- List pending yield adjustments
- Shows: lot, supplier, contracted yield, actual yield, computed price adjustment
- COO approves/rejects adjustment
- On approval: adjustment flows to `SupplierAccountEntry` as a line item
- Integration: when supplier payment is generated, adjustment is auto-applied

**6C — Quality Dashboard Widget**

On main dashboard (operations tab):
- Avg cupping score by supplier (last 30/90/365 days)
- Yield variance by supplier
- Lots pending cupping
- Quality compliance rate

---

### Phase 7: Inventory & Warehouse Module

**7A — Facility Management**

New route: `/settings/facilities`
- Full CRUD management page for physical locations within La Joya
- Each facility has: name, code, type (BENEFICIO | BODEGA | PATIO), capacity (optional), isActive
- Seed data on migration:
  - **Beneficio** (type: BENEFICIO) — dry mill processing
  - **Bodega** (type: BODEGA) — warehouse/storage
  - **Patio** (type: PATIO) — drying yard
- Future: additional facilities can be added as operations grow
- Facility selector appears on lot reception, milling orders, and inventory filters

**7B — Lot Reception**

Modify `/suppliers/[id]` (account statement):
- When creating a `SupplierAccountEntry`, also create a `Lot` record
- Auto-assign: `stage = PERGAMINO_BODEGA`, beneficioId, lotNumber (auto-correlative)
- Lot is now the trackable unit through the system

**7C — Inventory Views**

New route: `/inventory` (refactor from current PO-focused page)

Sub-views:
1. **By Beneficio**: show all lots at each location, grouped by stage
2. **By Supplier**: show all lots from each supplier, with quality/yield info
3. **By Quality**: show lots grouped by cupping score bands (80-82, 83-84, 85+)
4. **By Stage**: pergamino in bodega / en proceso / oro exportable

Each view shows: lot number, supplier, beneficio, quantity QQ, quality, date received, days in warehouse.

**7D — Inventory Balances**

Real-time computation:
- `Pergamino en Bodega` = lots where stage = PERGAMINO_BODEGA, SUM(quantityQQ)
- `En Proceso` = lots where stage = EN_PROCESO, SUM(quantityQQ)
- `Oro Exportable` = lots where stage = ORO_EXPORTABLE, SUM(quantityQQ)
- Filterable by beneficio, supplier, quality, date range

---

### Phase 8: Milling (Tría) Module

**8A — Milling Order CRUD**

New route: `/milling`
- Create milling order: select beneficio, select input lots (pergamino), assign quantities
- Input lots' stage changes from `PERGAMINO_BODEGA` to `EN_PROCESO`
- Record outputs: oro exportable QQ, segunda QQ, cascarilla QQ, merma QQ
- Output lots created with appropriate stage and parentLotId for traceability
- System enforces balance: `SUM(outputs) + merma = SUM(inputs)` (within tolerance)

**8B — Milling Yield Analysis**

On milling order detail page:
- Actual yield: `oro_output / pergamino_input`
- Expected yield: from lot's purchase contract
- Variance: flagged if outside tolerance
- Links to cupping records for the input lots

**8C — Subproducto Migration (Mandatory)**

**Decision**: Existing subproducto records must be migrated to the new milling output model — not kept as parallel historical data.

Migration strategy:
1. For each existing `Subproducto` record, create a corresponding `MillingOutput` with `outputType = SEGUNDA`
2. Create a synthetic `MillingOrder` (status: COMPLETADO, date: original subproducto creation date) to house each migrated output
3. Revenue calculation (`contenedores * oroPerContenedor * precioSinIVA`) is preserved in the `MillingOutput` cost fields
4. After migration validation, deprecate the `Subproducto` table (keep in schema as archived, remove from UI)
5. All new subproduct entries flow through milling orders exclusively

Going forward:
- Subproductos are always a byproduct of a milling order — never created in isolation
- Revenue from subproducts (segunda, cascarilla) is tracked per milling order output
- Shipment P&L aggregation pulls subproduct revenue from `MillingOutput` instead of `Subproducto`

---

### Phase 9: Sales Contract Enhancements

**9A — Per-Shipment Client Roles (Broker / Importer / Buyer)**

**Decision**: Any client can act as broker, importer, or buyer on any shipment. Roles are not fixed on the Client entity.

New `ShipmentParty` model (inline CRUD on shipment detail page):
- On each shipment detail page, a "Parties" section shows which clients play which roles
- Inline add: select client from dropdown, select role (BROKER | IMPORTER | BUYER), optional notes
- Inline delete: remove a party assignment
- Same client can be broker on shipment A and importer on shipment B
- Same client can be both broker AND importer on the same shipment
- The existing `Contract.clientId` remains as the end buyer (backward compatible)
- Reports can aggregate by: "all shipments where X acted as broker" or "all shipments where Y was importer"

No changes to the `Client` entity itself.

**9B — Four-Layer Contract Identification**

Add two new fields to Contract:
1. `officialCorrelative` — auto-generated `HC-{YEAR}-{SEQ}`, immutable, unique
2. `cooContractName` — free-text field for Héctor's field reference (e.g., "Serengeti Enero EP"), editable by OPERATOR+

Existing fields retained:
- `id` (uuid7) — DB primary key, system-only
- `contractNumber` — CFO's reference (e.g., "SER-0125-A"), editable by ADMIN

UI display:
- All 3 human-readable identifiers shown in contract list/detail views
- Official correlative in bold/primary position
- CFO ref and COO name as secondary labels
- Reports and board views use official correlative exclusively
- Search works across all three text identifiers

Migration: generate `officialCorrelative` for all 46 existing contracts ordered by `createdAt`

**9C — Contract-to-Lot Assignment**

New feature on contract detail page:
- Section: "Assigned Lots" — shows which lots (oro exportable) are allocated to this sales contract
- Allocation: select from available oro lots, assign quantity
- System tracks: `ContractLotAllocation(contractId, lotId, quantityQQ)`
- This replaces the current `MateriaPrimaAllocation` with lot-level granularity

---

### Phase 10: Export & Carta de Porte

**10A — Export Order**

Extend existing `Container` model:
- Link to specific lots being exported: `ContainerLot(containerId, lotId, quantityQQ)`
- When container is shipped, lots' stage changes to `EXPORTADO`
- Oro exportable inventory decreases

**10B — Carta de Porte Generation**

New feature on shipment detail:
- Generate carta de porte document: container #, lots included, total weight, destination
- Triggers inventory deduction
- Links to customs/export documentation (metadata fields, not document generation)

---

### Phase 11: Dashboard & KPIs (Board View)

**11A — Dual-Perspective Dashboard**

Restructure `/dashboard` into tabs or sections:

**Financial View** (CFO — enhance existing):
- Gross margin per QQ oro: `(FOB Price - (Purchase Cost / Rendimiento + Export Costs)) / FOB Price`
- Weighted average margin % (already exists — keep)
- Revenue by client breakdown (new)
- Revenue by quality grade (new)
- Position exposure: `(Unfixed Sales QQ - Unfixed Purchases QQ) * Current C Price`
- Cash conversion cycle estimate
- Margin at risk (unfixed contracts * FX volatility)

**Operations View** (COO — all new):
- Yield Performance Index: `AVG(Contracted Rendimiento / Actual Rendimiento)` across all lots cupped
- Contract Fulfillment Rate: `QQ Shipped / QQ Contracted` for current cosecha
- Inventory by Stage: visual breakdown (pergamino / en proceso / oro)
- Inventory by Beneficio: bar chart
- Purchase Commitment Coverage: `QQ Pergamino (received + contracted) / QQ Needed for Open Sales`
- Subproduct Recovery Rate: `Subproduct Revenue / Total Purchase Cost`
- Quality Compliance Rate: `Lots where actual score >= contract spec / Total Lots Cupped`
- Avg Days Reception to Export

**Board Summary** (both — top-level):
- Total QQ sold / bought / remaining
- Total QQ sold by quality
- Total QQ bought by quality
- Overall margin %
- YTD revenue vs. prior year (if data available)
- Active contracts count + total value
- Containers shipped vs. planned

**11B — Report Generation**

New route: `/reports`
- Sales report by month (as Héctor requested)
- Purchase report by supplier / by quality
- Margin report by contract / by shipment / by client
- Inventory report by beneficio / by supplier / by quality / by stage
- Yield variance report (contracted vs. actual)
- Milling efficiency report
- Export as PDF/Excel (using existing xlsx dependency)

---

## 5. Data Migration Strategy

### Existing Data (46 contracts, 25 shipments, etc.)
- All existing data remains intact
- New fields on existing models get sensible defaults or null
- `officialCorrelative` generated retroactively for all 46 contracts (ordered by `createdAt`)
- `cooContractName` populated as null — Héctor fills these in as he starts using the system
- Existing `MateriaPrima` records preserved as-is; new lot-based tracking runs alongside until full transition

### Client Roles — No Migration Needed
- Client entity is unchanged — no role field added
- Roles are per-shipment via `ShipmentParty`, populated going forward
- Historical shipments can have parties added retroactively if needed

### Subproducto Migration (Mandatory)
- All 25 existing `Subproducto` records migrated to `MillingOutput` entries
- Synthetic `MillingOrder` records created to house them (status: COMPLETADO)
- Revenue calculations preserved in cost fields
- `Subproducto` table archived after migration validation

### Facility Seed Data
- La Joya created with 3 facilities: Beneficio, Bodega, Patio
- All existing and new lot operations default to La Joya facilities

### Inventory Valuation
- **Decision**: Inventory valued at cost (not net realizable value)
- Cost flows through transformations: input lot cost allocated to output lots proportionally by quantity
- `costPerQQ` tracked on every `Lot` and `MillingOutput` record
- Margin calculations use actual cost basis, not market estimates

### Historical Lots
- Existing `SupplierAccountEntry` records can be retroactively linked to lots
- Historical milling data may not exist — lots created going forward only
- Dashboard KPIs show "data available from [date]" for new metrics

---

## 6. Implementation Priority & Dependencies

```
Phase 5A (Data Models)
  ├── Phase 5B (Correlatives)         → independent
  ├── Phase 6 (Quality Lab)           → depends on Lot model
  │   └── Phase 6B (Yield Recon)      → depends on CuppingRecord
  ├── Phase 7 (Inventory)             → depends on Lot + Beneficio models
  │   └── Phase 8 (Milling)           → depends on Lot inventory
  │       └── Phase 10 (Export)       → depends on oro inventory
  ├── Phase 9 (Sales Enhancements)    → depends on Client role extension
  └── Phase 11 (Dashboard/KPIs)       → depends on all above for data
```

### Recommended execution order:
1. **Phase 5A** — Data model extensions (foundation for everything)
2. **Phase 5B + 9B** — Correlative generation + internal numbering
3. **Phase 9A** — Broker/importer/client hierarchy (quick win, high visibility)
4. **Phase 7A + 7B** — Beneficio setup + lot reception (enables inventory)
5. **Phase 6A** — Cupping records (COO's primary daily workflow)
6. **Phase 7C + 7D** — Inventory views (COO's most requested feature)
7. **Phase 6B** — Yield reconciliation (links quality to payments)
8. **Phase 8** — Milling orders (inventory transformation)
9. **Phase 9C** — Contract-to-lot assignment (links sales to operations)
10. **Phase 10** — Export / carta de porte (closes the loop)
11. **Phase 11** — Dashboard & KPIs (requires data to be meaningful)

---

## 7. Architectural Principles

Following the same patterns already established in the codebase:

1. **Server Actions for all CRUD** — no new REST endpoints
2. **Decimal.js for all calculations** — yield reconciliation, price adjustments, inventory balances
3. **Audit logging on every mutation** — especially lot stage transitions, yield adjustments, milling orders
4. **Zod validation on all inputs** — new schemas for CuppingRecord, MillingOrder, Lot, etc.
5. **recalculate pattern** — extend to milling orders (input/output balance enforcement)
6. **Role-based access** — OPERATOR can create lots, cupping records, milling orders; ADMIN configures beneficios
7. **No mock data** — all seed data and test fixtures reflect real business entities
8. **Every code artifact serves a production purpose** — no speculative abstractions

---

## 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Lot model adds complexity to every existing flow | High | Lots are additive — existing contract/shipment flows continue working. Lots integrate gradually. |
| Historical data lacks lot-level detail | Medium | Dashboard shows "data available from [date]" for new metrics. No fabricated historical lots. |
| Per-shipment role assignment adds a new table to manage | Low | `ShipmentParty` is additive. No changes to Client entity. Inline CRUD keeps UX simple. |
| Milling orders require new operational discipline | Medium | Start with manual entry; COO trains team. Enforce input/output balance as guardrail. |
| Schema migration on live database | High | Use Prisma's additive migrations (new tables, new nullable columns). No destructive changes to existing tables. |
| Yield adjustments affect supplier payments retroactively | High | Adjustments are created as PENDIENTE, require explicit COO approval before affecting payments. |

---

## 9. Decisions Log & Remaining Questions

### Resolved (2026-04-09)

| # | Question | Decision |
|---|----------|----------|
| 1 | Client roles | Per-shipment via `ShipmentParty`, not fixed on Client entity. Any client can be broker, importer, or both. Inline CRUD on shipment detail. |
| 2 | Facilities | La Joya only. Full CRUD management page. Seeded with: Beneficio, Bodega, Patio. |
| 3 | Correlatives | Four-layer system: UUID7 (DB), CFO ref (existing `contractNumber`), COO contract name (new), official correlative (auto `HC-{YEAR}-{SEQ}`). |
| 4 | Yield tolerance | Default +/- 0.01. COO has inline update ability from quality lab UI. |
| 5 | Cupping protocol | Full SCA 10-attribute protocol. All physical analysis fields included. |
| 6 | Subproducto transition | Mandatory migration to `MillingOutput`. Existing records converted, `Subproducto` table archived. |
| 7 | Inventory valuation | At cost. Cost flows through transformations proportionally. |

### Open — Requires User Input

8. **Report priority**: Which specific reports does Héctor need first? The interview emphasizes: inventory by beneficio, sales by month, and yield variance. **Action**: Ask Héctor directly.

---

## 10. Success Criteria

The refactor is complete when:

- [ ] Héctor can enter a cupping record and see the yield adjustment flow to the payment system
- [ ] Any user can view real-time inventory by beneficio, supplier, and quality
- [ ] Milling orders consume pergamino inventory and produce oro + subproducts with full traceability
- [ ] Sales contracts show broker, importer, and end client distinctly
- [ ] Every contract has an auto-generated internal correlative
- [ ] The dashboard shows both financial (CFO) and operational (COO) KPIs
- [ ] A lot of coffee can be traced from supplier receipt through processing to export container
- [ ] The board can see: total sold vs. bought vs. remaining, by quality, at any time

---

## Implementation Status (Updated 2026-04-10)

All phases (5-11) remain unimplemented. The RBAC prerequisite (splitting OPERATOR into FIELD_OPERATOR and FINANCIAL_OPERATOR) has been completed — see [09-RBAC-REFACTOR-PLAN.md](09-RBAC-REFACTOR-PLAN.md).

**All phases from this document have been consolidated into [10-CATCH-UP-PLAN.md](10-CATCH-UP-PLAN.md)** as Waves B through H, organized with verified dependency ordering and integrated with pending items from docs 06 and 07. This document remains as the authoritative reference for domain decisions, entity specifications, and business rules. The catch-up plan governs execution order.
