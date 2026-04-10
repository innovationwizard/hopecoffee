# Changelog — 2026-04-10: Operations Refactor Catch-Up (Waves A-H)

## Summary

Implemented the full operations refactor consolidation plan (doc 10) in a single session. This is the largest single deployment in the project's history. Added 11 new Prisma models, 7 new enums, 11 new routes (42 total, was 31), 8 new permissions, 9 new Zod schemas, and 3 new operational reports. Migrated 22 subproducto records to milling outputs. Refactored inventory from PO-focused to lot-based with POs moved to `/purchase-orders`. Backfilled 46 contracts with official correlatives. Seeded 3 facilities and yield tolerance config.

**Build**: 0 errors, 42 routes compiled. **Tests**: 24/24 passing. **Production DB**: schema pushed, data migrated, verified.

**Total files affected**: ~57 (23 new + 34 modified)

---

## Wave A: Quick Database Fixes

### A1. GIN Index on Regions Array

**Source**: Doc 06 Issue 7 / Doc 07 Wave 1B

Created a GIN index on `contracts.regions` to enable efficient array containment queries (`@>` operator). Without this, region-based filtering required sequential scans.

```sql
CREATE INDEX IF NOT EXISTS idx_contracts_regions ON contracts USING GIN (regions);
```

Applied directly to production via `prisma db execute`. No `schema.prisma` change needed (Prisma does not support GIN index declarations natively).

### A2. DB-Level Aggregate in recalculateShipment

**Source**: Doc 06 Issue 3 / Doc 07 Wave 4C

**File modified**: `src/lib/services/shipment-aggregation.ts`

The `recalculateShipment()` function previously loaded all MateriaPrima and Subproducto records into Node.js memory and computed sums via `.reduce()`. This transferred unnecessary data over the wire.

**Before** (JS reduce):
```typescript
const shipment = await prisma.shipment.findUniqueOrThrow({
  include: { contracts: true, materiaPrima: true, subproductos: true },
});
const totalMateriaPrima = shipment.materiaPrima.reduce(
  (sum, mp) => sum.plus(new Decimal(toNum(mp.totalMP))), new Decimal(0)
);
```

**After** (DB aggregate):
```typescript
const [shipment, mpAgg, subAgg] = await Promise.all([
  prisma.shipment.findUniqueOrThrow({ include: { contracts: true } }),
  prisma.materiaPrima.aggregate({ where: { shipmentId }, _sum: { totalMP: true } }),
  prisma.subproducto.aggregate({ where: { shipmentId }, _sum: { totalPerga: true } }),
]);
const totalMateriaPrima = new Decimal(toNum(mpAgg._sum.totalMP));
```

Contract-level calculation loop remains in JS because it requires the full Decimal.js calculation engine (`calculateContract` per contract). Only the simple MP/subproducto sums moved to DB.

---

## Wave B: Operations Foundation — Data Models, Correlatives, Seeds, Schemas, Permissions

This wave creates the foundation for all subsequent modules. Nothing in Phases 6-11 can function without these models.

### B1. Prisma Schema — New Enums (7)

**File modified**: `prisma/schema.prisma`

| Enum | Values | Used By |
|------|--------|---------|
| `FacilityType` | BENEFICIO, BODEGA, PATIO | Facility model |
| `LotStage` | PERGAMINO_BODEGA, EN_PROCESO, ORO_EXPORTABLE, EXPORTADO, SUBPRODUCTO | Lot model |
| `MillingOrderStatus` | PENDIENTE, EN_PROCESO, COMPLETADO | MillingOrder model |
| `MillingOutputType` | ORO_EXPORTABLE, SEGUNDA, CASCARILLA, MERMA | MillingOutput model |
| `ShipmentPartyRole` | BROKER, IMPORTER, BUYER | ShipmentParty model |
| `YieldAdjustmentStatus` | PENDIENTE, APLICADO, RECHAZADO | YieldAdjustment model |

### B2. Prisma Schema — New Models (11)

**File modified**: `prisma/schema.prisma`

#### Facility (`facilities` table)
Physical location within La Joya. Tracks beneficio (dry mill), bodega (warehouse), and patio (drying yard).

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| name | String (unique) | "Beneficio", "Bodega", "Patio" |
| code | String (unique) | "BEN", "BOD", "PAT" |
| type | FacilityType | BENEFICIO, BODEGA, PATIO |
| capacity | Decimal? | Max QQ capacity |
| isActive | Boolean | Soft delete flag |

Relations: `lots[]`, `millingOrders[]`, `supplierAccountEntries[]`

#### Lot (`lots` table)
Trackable unit of coffee through the processing lifecycle. Every receipt creates a lot; every milling output creates child lots.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| lotNumber | String (unique) | Auto: LOT-{YEAR}-{SEQ} |
| supplierId | String? | Source supplier |
| facilityId | String? | Current location |
| purchaseOrderId | String? | Originating PO |
| stage | LotStage | Current processing stage |
| quantityQQ | Decimal(10,2) | Current quantity in quintales |
| qualityGrade | String? | Preliminary grade |
| cuppingScore | Decimal?(5,2) | SCA total (set after cupping) |
| receptionDate | DateTime? | When received |
| sourceAccountEntryId | String? | Linked SupplierAccountEntry |
| contractedYield | Decimal?(8,6) | Expected rendimiento from PO |
| actualYield | Decimal?(8,6) | Measured rendimiento from cupping |
| costPerQQ | Decimal?(10,2) | Cost-based inventory valuation |
| parentLotId | String? | Traceability chain (self-relation) |

Relations: `supplier`, `facility`, `parentLot`, `childLots[]` (self-relation "LotLineage"), `cuppingRecords[]`, `millingInputs[]`, `millingOutputs[]`, `contractLotAllocations[]`, `containerLots[]`, `sourceAccountEntries[]`

Indexes: `supplierId`, `facilityId`, `stage`, `receptionDate`

#### CuppingRecord (`cupping_records` table)
Full SCA 10-attribute cupping protocol. Attached to lots at reception or pre-mill stages.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| lotId | String | The lot being cupped |
| catadorUserId | String? | Who performed the cupping |
| date | DateTime | Cupping date |
| fragrance | Decimal(4,2) | SCA: 6.00-10.00 |
| flavor | Decimal(4,2) | SCA: 6.00-10.00 |
| aftertaste | Decimal(4,2) | SCA: 6.00-10.00 |
| acidity | Decimal(4,2) | SCA: 6.00-10.00 |
| body | Decimal(4,2) | SCA: 6.00-10.00 |
| balance | Decimal(4,2) | SCA: 6.00-10.00 |
| uniformity | Decimal(4,2) | SCA: 6.00-10.00 |
| cleanCup | Decimal(4,2) | SCA: 6.00-10.00 |
| sweetness | Decimal(4,2) | SCA: 6.00-10.00 |
| overall | Decimal(4,2) | SCA: 6.00-10.00 |
| totalScore | Decimal(5,2) | Computed sum of 10 attributes |
| moisturePercent | Decimal?(4,2) | Target 10.5-12.5% |
| defectCount | Int? | Per 350g sample |
| screenSize | String? | e.g., "15/16", "17/18" |
| waterActivity | Decimal?(3,2) | Target <0.65 aw |
| yieldMeasured | Decimal?(8,6) | Rendimiento real |
| purchaseOrderId | String? | For PO reconciliation |
| notes | String? | Free text |

Relations: `lot`, `yieldAdjustments[]`

#### YieldAdjustment (`yield_adjustments` table)
Auto-created when cupping reveals yield outside tolerance. Requires COO approval before affecting supplier payments.

| Field | Type | Description |
|-------|------|-------------|
| contractedYield | Decimal(8,6) | From lot/PO |
| actualYield | Decimal(8,6) | From cupping |
| toleranceApplied | Decimal(8,6) | Threshold used (default 0.01) |
| priceAdjustmentPerQQ | Decimal(10,2) | Computed price delta |
| totalAdjustment | Decimal(14,2) | priceAdjustmentPerQQ * quantityQQ |
| status | YieldAdjustmentStatus | PENDIENTE → APLICADO or RECHAZADO |
| appliedAt | DateTime? | When approved |
| appliedByUserId | String? | Who approved |

#### YieldToleranceConfig (`yield_tolerance_config` table)
System-level setting for the yield variance threshold. COO can update inline from quality lab.

| Field | Type | Description |
|-------|------|-------------|
| toleranceValue | Decimal(8,6) | Default 0.01 (+/- 1%) |

#### MillingOrder (`milling_orders` table)
Inventory transformation event. Consumes pergamino lots, produces oro + subproduct lots.

| Field | Type | Description |
|-------|------|-------------|
| orderNumber | String (unique) | Auto: TRIA-{YEAR}-{SEQ} |
| facilityId | String? | Where milling occurs |
| date | DateTime | Milling date |
| operatorUserId | String? | Who operated |
| status | MillingOrderStatus | PENDIENTE → EN_PROCESO → COMPLETADO |

Relations: `facility`, `inputs[]`, `outputs[]`

#### MillingInput (`milling_inputs` table)
Lots consumed by a milling order. On input, lot stage transitions PERGAMINO_BODEGA → EN_PROCESO.

| Field | Type | Description |
|-------|------|-------------|
| millingOrderId | String | Parent order |
| lotId | String | Input lot |
| quantityQQ | Decimal(10,2) | QQ consumed |

Cascade: deletes when parent MillingOrder is deleted.

#### MillingOutput (`milling_outputs` table)
Lots produced by a milling order. Creates new child lots with appropriate stages.

| Field | Type | Description |
|-------|------|-------------|
| millingOrderId | String | Parent order |
| lotId | String? | Output lot (null for MERMA) |
| quantityQQ | Decimal(10,2) | QQ produced |
| outputType | MillingOutputType | ORO_EXPORTABLE, SEGUNDA, CASCARILLA, MERMA |
| qualityGrade | String? | Output quality |
| costPerQQ | Decimal?(10,2) | Allocated from inputs |

Cascade: deletes when parent MillingOrder is deleted.

#### ShipmentParty (`shipment_parties` table)
Per-shipment client role assignment. Same client can be broker on one shipment and importer on another.

| Field | Type | Description |
|-------|------|-------------|
| shipmentId | String | Parent shipment |
| clientId | String | Client entity |
| role | ShipmentPartyRole | BROKER, IMPORTER, BUYER |
| notes | String? | Optional context |

Unique constraint: `[shipmentId, clientId, role]`
Cascade: deletes when parent Shipment is deleted.

#### ContractLotAllocation (`contract_lot_allocations` table)
Assigns oro lots to sales contracts. Replaces MateriaPrimaAllocation for lot-level granularity.

| Field | Type | Description |
|-------|------|-------------|
| contractId | String | Sales contract |
| lotId | String | Allocated oro lot |
| quantityQQ | Decimal(10,2) | QQ assigned |

Unique constraint: `[contractId, lotId]`

#### ContainerLot (`container_lots` table)
Tracks which lots are loaded into which containers for export. Enables per-lot export tracking.

| Field | Type | Description |
|-------|------|-------------|
| containerId | String | Shipping container |
| lotId | String | Lot loaded |
| quantityQQ | Decimal(10,2) | QQ loaded |

Unique constraint: `[containerId, lotId]`
Cascade: deletes when parent Container is deleted.

### B3. Existing Model Extensions

**Contract** — 2 new fields:
- `officialCorrelative String? @unique` — auto-generated `HC-{YEAR}-{SEQ}`, immutable, canonical company-wide ID
- `cooContractName String?` — Hector's field reference (e.g., "Serengeti Enero EP"), editable by FIELD_OPERATOR

**SupplierAccountEntry** — 3 new fields:
- `lotId String?` — links receipt to auto-created lot
- `facilityId String?` — receiving facility
- `qualityGrade String?` — preliminary grade before cupping

New relations added: `Lot` and `Facility` on SupplierAccountEntry. `lotAllocations` on Contract. `parties` on Shipment. `shipmentParties` on Client. `lots` on Supplier. `containerLots` on Container. `sourceAccountEntries` on Lot.

### B4. Auto-Correlative Service

**New file**: `src/lib/services/correlatives.ts`

Generates sequential correlative IDs using the database to determine the next sequence number.

| Function | Pattern | Table/Field |
|----------|---------|-------------|
| `generateContractCorrelative()` | HC-{YEAR}-{SEQ} | contracts.officialCorrelative |
| `generateLotNumber()` | LOT-{YEAR}-{SEQ} | lots.lotNumber |
| `generateMillingOrderNumber()` | TRIA-{YEAR}-{SEQ} | milling_orders.orderNumber |

Implementation: `SELECT MAX(field) FROM table WHERE field LIKE 'PREFIX-YEAR-%'`, parse the sequence, increment, zero-pad to 4 digits.

### B5. Permissions Updated

**File modified**: `src/lib/services/permissions.ts`

8 new permissions added:

| Permission | Granted To | Purpose |
|-----------|-----------|---------|
| `lot:write` | FIELD_OPERATOR, ADMIN | CRUD lots |
| `cupping:write` | FIELD_OPERATOR, ADMIN | CRUD cupping records |
| `milling:write` | FIELD_OPERATOR, ADMIN | CRUD milling orders |
| `yield_adjustment:write` | FIELD_OPERATOR, ADMIN | Approve/reject yield adjustments |
| `shipment:party_write` | FIELD_OPERATOR, FINANCIAL_OPERATOR, ADMIN | Manage shipment parties |
| `contract:lot_allocate` | FIELD_OPERATOR, ADMIN | Assign oro lots to contracts |
| `container:lot_assign` | FIELD_OPERATOR, ADMIN | Assign lots to containers, ship |
| `facility:manage` | ADMIN | CRUD facilities |

### B6. Zod Schemas Added

**File modified**: `src/lib/validations/schemas.ts`

9 new schemas: `FacilityCreateSchema`, `LotCreateSchema`, `CuppingRecordCreateSchema`, `MillingOrderCreateSchema`, `MillingInputSchema`, `MillingOutputSchema`, `ShipmentPartyCreateSchema`, `ContractLotAllocationSchema`, `ContainerLotSchema`

6 new enum schemas: `FacilityTypeEnum`, `LotStageEnum`, `MillingOrderStatusEnum`, `MillingOutputTypeEnum`, `ShipmentPartyRoleEnum`, `YieldAdjustmentStatusEnum`

`ContractCreateSchema` extended with `cooContractName` field.

### B7. Production Data Operations

**Correlative backfill**: 46 existing contracts assigned `officialCorrelative` values HC-2026-0001 through HC-2026-0046, ordered by `createdAt`. Executed via SQL:
```sql
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) as seq
  FROM contracts WHERE "officialCorrelative" IS NULL
)
UPDATE contracts
SET "officialCorrelative" = 'HC-2026-' || LPAD(numbered.seq::text, 4, '0')
FROM numbered WHERE contracts.id = numbered.id;
```

**Facility seed**: 3 records inserted into `facilities` table:
- Beneficio (code: BEN, type: BENEFICIO)
- Bodega (code: BOD, type: BODEGA)
- Patio (code: PAT, type: PATIO)

**Yield tolerance seed**: 1 record inserted into `yield_tolerance_config` with `toleranceValue = 0.01`.

### B8. Contract Action Updates

**File modified**: `src/app/(dashboard)/contracts/actions.ts`

- `createContract()`: now calls `generateContractCorrelative()` and persists `officialCorrelative` and `cooContractName`
- `updateContract()`: allows `cooContractName` edits (field domain)
- `getContracts()` search filter: now uses `OR` across `contractNumber`, `officialCorrelative`, and `cooContractName` (all case-insensitive)

---

## Wave C: Sales Contract Enhancements + Shipment Parties

### C1. Shipment Party Server Actions

**New file**: `src/app/(dashboard)/shipments/party-actions.ts`

| Function | Permission | Description |
|----------|-----------|-------------|
| `getShipmentParties(shipmentId)` | requireAuth | Returns parties with client name |
| `createShipmentParty(data)` | shipment:party_write | Validates via ShipmentPartyCreateSchema, audit log, revalidates shipment path |
| `deleteShipmentParty(id)` | shipment:party_write | Deletes party assignment, audit log |

### C2. Shipment Party UI

**New file**: `src/app/(dashboard)/shipments/_components/parties-section.tsx`

"use client" component integrated into shipment detail page:
- Table of parties: client name, role badge (BROKER=purple, IMPORTER=blue, BUYER=emerald), notes, delete button
- Inline add form: client dropdown, role dropdown, notes input, add button
- Uses sonner toast for feedback
- Props: `shipmentId`, `clients`, `parties` (server-provided, no client fetch)

**File modified**: `src/app/(dashboard)/shipments/[id]/page.tsx` — added PartiesSection below containers section, fetches parties and clients via `Promise.all`.

### C3. Contract Identifier Display

**File modified**: `src/app/(dashboard)/contracts/_components/contract-table.tsx`
- Added `officialCorrelative` as bold "Correlativo" column before `contractNumber`
- `contractNumber` moved to secondary position

**File modified**: `src/app/(dashboard)/contracts/[id]/page.tsx`
- Shows all 3 identifiers: Correlativo Oficial, Numero de Contrato (CFO ref), Nombre COO
- Page header uses `officialCorrelative` as primary title

### C4. Contract Search Update

**File modified**: `src/app/(dashboard)/contracts/actions.ts`

Search filter changed from single-field `contractNumber` match to multi-field OR:
```typescript
where.OR = [
  { contractNumber: { contains: filters.search, mode: "insensitive" } },
  { officialCorrelative: { contains: filters.search, mode: "insensitive" } },
  { cooContractName: { contains: filters.search, mode: "insensitive" } },
];
```

---

## Wave D: Facilities + Lots + Inventory Refactor + PO Route Move

### D1. Facility Management

**New files**:
- `src/app/(dashboard)/settings/facilities/actions.ts` — `getFacilities()`, `createFacility()`, `updateFacility()`, `deleteFacility()` with `facility:manage` permission
- `src/app/(dashboard)/settings/facilities/page.tsx` — server component with facility table (name, code, type badge, capacity, active status) and create form sidebar
- `src/app/(dashboard)/settings/facilities/_components/facility-form.tsx` — "use client" form with react-hook-form + zod validation. Type badge colors: BENEFICIO=amber, BODEGA=blue, PATIO=emerald
- `src/app/(dashboard)/settings/facilities/_components/facility-delete-button.tsx` — "use client" delete button with confirmation

**File modified**: `src/components/layout/app-shell.tsx` — added "Instalaciones" to SETTINGS_ITEMS (visible to all roles, not admin-only).

### D2. Lot Server Actions

**New file**: `src/app/(dashboard)/inventory/lot-actions.ts`

| Function | Permission | Description |
|----------|-----------|-------------|
| `getLots(filters?)` | requireAuth | Filterable by facilityId, supplierId, stage, search. Includes supplier and facility names |
| `getLot(id)` | requireAuth | Single lot with cupping records and allocations |
| `getLotBalances()` | requireAuth | `prisma.lot.groupBy` on stage for inventory KPI cards |
| `createLot(data)` | lot:write | Validates via LotCreateSchema, auto-generates lotNumber |
| `updateLot(data)` | lot:write | Updates lot fields |

### D3. Lot Reception — Supplier Account Entry Integration

**File modified**: `src/app/(dashboard)/suppliers/actions.ts`

`createAccountEntry()` now performs a transactional creation of both the account entry and a Lot:

1. Finds the default receiving facility (first active BODEGA)
2. Generates lot number via `generateLotNumber()`
3. Creates Lot in transaction: stage=PERGAMINO_BODEGA, supplierId from entry, facilityId from default facility, quantityQQ from entry.pergamino, costPerQQ from entry.precio, receptionDate from entry.date
4. Creates SupplierAccountEntry in transaction: links via lotId and facilityId
5. Audit logs both entity creations

### D4. Inventory Page Refactor

The current inventory page was PO-focused. After refactoring:

**Refactored file**: `src/app/(dashboard)/inventory/page.tsx`
- Now shows lot-based inventory with 3 balance cards at top: Pergamino en Bodega (QQ, amber), En Proceso (QQ, blue), Oro Exportable (QQ, emerald)
- Lot table: lotNumber, supplier, facility, stage badge, quantityQQ, qualityGrade, receptionDate
- Stage badge colors: PERGAMINO_BODEGA=amber, EN_PROCESO=blue, ORO_EXPORTABLE=emerald, EXPORTADO=slate, SUBPRODUCTO=purple
- Filter dropdowns: stage, facility, supplier

**New file**: `src/app/(dashboard)/inventory/_components/inventory-filters.tsx` — "use client" filter component with stage/facility/supplier dropdowns

**Refactored files**: `inventory/[id]/page.tsx` and `inventory/new/page.tsx` now redirect to `/purchase-orders/*`

### D5. Purchase Orders Route Move

POs moved from `/inventory` to `/purchase-orders` as a dedicated route:

**New files**:
- `src/app/(dashboard)/purchase-orders/page.tsx` — PO list with supplier, date, status, quantity
- `src/app/(dashboard)/purchase-orders/new/page.tsx` — PO creation form (imports existing po-form component)
- `src/app/(dashboard)/purchase-orders/[id]/page.tsx` — PO detail page

**File modified**: `src/app/(dashboard)/inventory/actions.ts` — all `revalidatePath` calls updated from `/inventory` to `/purchase-orders`

**File modified**: `src/app/(dashboard)/inventory/_components/po-form.tsx` — `router.push` updated to `/purchase-orders`

**File modified**: `src/components/layout/app-shell.tsx` — added "Ordenes de Compra" nav item with `ShoppingCart` icon. Positioned after Inventario for FIELD_OPERATOR, after Proveedores for FINANCIAL_OPERATOR.

---

## Wave E: Quality Lab Module

### E1. Quality Lab Server Actions

**New file**: `src/app/(dashboard)/quality-lab/actions.ts`

| Function | Permission | Description |
|----------|-----------|-------------|
| `getCuppingRecords(filters?)` | requireAuth | List with lot/supplier/facility info, filterable by lotId, supplierId, date range, score range |
| `getCuppingRecord(id)` | requireAuth | Single record with yield adjustments |
| `createCuppingRecord(data)` | cupping:write | Validates via CuppingRecordCreateSchema. Computes totalScore (sum of 10 SCA attributes). Updates lot's cuppingScore and actualYield. If `|yieldMeasured - contractedYield| > tolerance`, auto-creates YieldAdjustment with status PENDIENTE. Tolerance fetched from YieldToleranceConfig. Adjustment: priceAdjustmentPerQQ = (actual - contracted) * 50 Q/point, totalAdjustment = priceAdjustmentPerQQ * lot.quantityQQ |
| `deleteCuppingRecord(id)` | cupping:write | Deletes record + PENDIENTE yield adjustments linked to it |
| `getYieldAdjustments(status?)` | requireAuth | Lists adjustments with cupping/lot/supplier info |
| `applyYieldAdjustment(id)` | yield_adjustment:write | Sets APLICADO, appliedAt, appliedByUserId |
| `rejectYieldAdjustment(id)` | yield_adjustment:write | Sets RECHAZADO |
| `getYieldTolerance()` | requireAuth | Returns current tolerance config |
| `updateYieldTolerance(value)` | yield_adjustment:write | Updates tolerance, sets updatedByUserId |
| `getLotsForCupping()` | requireAuth | Returns lots with stage PERGAMINO_BODEGA or EN_PROCESO |
| `getCuppingStats()` | requireAuth | Aggregate: count, avg totalScore, pending lots |

### E2. Quality Lab List Page

**New file**: `src/app/(dashboard)/quality-lab/page.tsx`

Server component showing:
1. PageHeader: "Laboratorio de Calidad"
2. 3 summary cards: Total cataciones, Promedio SCA score, Lotes pendientes de catacion
3. Table: date, lot number, supplier, totalScore (color-coded: >=85 emerald, >=80 blue, <80 amber), yield measured, notes
4. Link to create new cupping record, link to adjustments page

### E3. Cupping Record Create Page

**New files**:
- `src/app/(dashboard)/quality-lab/new/page.tsx` — server wrapper that fetches lots for cupping
- `src/app/(dashboard)/quality-lab/_components/cupping-form.tsx` — "use client" form with:
  - Lot selector (filtered to PERGAMINO_BODEGA/EN_PROCESO)
  - Date picker
  - 10 SCA attribute inputs in 2 columns (min 6, max 10, step 0.25): fragrance/aroma, flavor, aftertaste, acidity, body (left); balance, uniformity, clean cup, sweetness, overall (right)
  - Live auto-computed total score
  - Physical analysis section: moisture %, defect count, screen size, water activity
  - Yield measured input
  - Notes textarea

### E4. Yield Adjustments Page

**New files**:
- `src/app/(dashboard)/quality-lab/adjustments/page.tsx` — server component with adjustments table: lot number, supplier, contracted yield, actual yield, variance (color-coded), price adjustment/QQ, total adjustment, status badge (PENDIENTE=amber, APLICADO=emerald, RECHAZADO=red), inline action buttons for PENDIENTE items
- `src/app/(dashboard)/quality-lab/adjustments/_components/adjustment-actions.tsx` — "use client" component with "Aplicar" and "Rechazar" buttons using `useTransition` and sonner toast

### E5. Navigation

**File modified**: `src/components/layout/app-shell.tsx` — added `FlaskConical` icon import, added `{ href: "/quality-lab", label: "Laboratorio", icon: FlaskConical }` to both FIELD_PRIMARY (after Proveedores) and FINANCIAL_PRIMARY navigation arrays.

---

## Wave F: Milling Module + Subproducto Migration

### F1. Milling Server Actions

**New file**: `src/app/(dashboard)/milling/actions.ts`

| Function | Permission | Description |
|----------|-----------|-------------|
| `getMillingOrders()` | requireAuth | All orders with input/output counts and QQ totals |
| `getMillingOrder(id)` | requireAuth | Single order with full input/output lot details |
| `getAvailableLots()` | requireAuth | Lots with stage=PERGAMINO_BODEGA |
| `getFacilities()` | requireAuth | Active facilities for dropdown |
| `createMillingOrder(data, inputs, outputs)` | milling:write | **Transactional** (`prisma.$transaction`): validates balance (outputs must equal inputs within 1% tolerance), generates TRIA-{YEAR}-{SEQ} order number, creates MillingInput records (updates lot stages to EN_PROCESO), creates output Lots (ORO_EXPORTABLE or SUBPRODUCTO stage) and MillingOutput records, MERMA outputs get no lot (lotId=null) |
| `completeMillingOrder(id)` | milling:write | Sets status=COMPLETADO |
| `deleteMillingOrder(id)` | milling:write | Only PENDIENTE orders. Reverts input lot stages to PERGAMINO_BODEGA, deletes output lots, cascade deletes inputs/outputs |

### F2. Milling List Page

**New file**: `src/app/(dashboard)/milling/page.tsx`

Server component with:
- PageHeader: "Ordenes de Tria" with "Nueva Orden" button
- 3 summary cards: Total ordenes, Pendientes, Completadas
- Table: orderNumber, date, facility, status badge (PENDIENTE=amber, EN_PROCESO=blue, COMPLETADO=emerald), input QQ total, output QQ total, yield percentage (oro output / pergamino input)

### F3. Milling Order Create Page

**New files**:
- `src/app/(dashboard)/milling/new/page.tsx` — server wrapper fetching available lots and facilities
- `src/app/(dashboard)/milling/_components/milling-form.tsx` — "use client" form with:
  - Order details: date picker, facility dropdown, notes
  - Dynamic inputs section: add/remove input lot rows (lot selector filtered to PERGAMINO_BODEGA, auto-fills QQ, prevents duplicate lot selection)
  - Dynamic outputs section: add/remove output rows (output type dropdown, quantity, quality grade)
  - Live balance sidebar: total input QQ vs total output QQ with green/red indicator and 1% tolerance validation
  - Submit creates the milling order transactionally

### F4. Milling Order Detail Page

**New files**:
- `src/app/(dashboard)/milling/[id]/page.tsx` — server component showing order info cards (date, facility, status, yield), inputs table (lot number, supplier, QQ), outputs table (lot number or "Merma", output type badge, QQ, quality grade). OutputType badges: ORO_EXPORTABLE=emerald, SEGUNDA=blue, CASCARILLA=amber, MERMA=red
- `src/app/(dashboard)/milling/[id]/client-actions.tsx` — "use client" component with "Completar" and "Eliminar" buttons with confirmation

### F5. Subproducto Migration Script

**New file**: `scripts/migrate-subproductos.ts`

Runnable via `npx tsx scripts/migrate-subproductos.ts`. Uses `require("@prisma/client")` (CommonJS) to avoid `@/` path issues.

For each of the 22 existing Subproducto records:
1. Creates a synthetic `MillingOrder` with status=COMPLETADO, date=subproducto.createdAt, orderNumber=TRIA-MIGR-{SEQ}
2. Creates a `Lot` with stage=SUBPRODUCTO, lotNumber=LOT-MIGR-{SEQ}, quantityQQ=totalOro, costPerQQ=precioSinIVA
3. Creates a `MillingOutput` with outputType=SEGUNDA linking the order and lot

**Production execution results**:
```
Found 22 Subproducto records to migrate.
  [1/22] TRIA-MIGR-0001 — 33 QQ (LOT-MIGR-0001)
  [2/22] TRIA-MIGR-0002 — 0 QQ (LOT-MIGR-0002)
  ...
  [22/22] TRIA-MIGR-0022 — 25 QQ (LOT-MIGR-0022)

Migration complete.
  Subproductos processed: 22
  MillingOrders created:  22
  MillingOutputs created: 22
  Counts verified OK.
```

### F6. Navigation

**File modified**: `src/components/layout/app-shell.tsx` — added `Factory` icon import, added `{ href: "/milling", label: "Tria", icon: Factory }` after Laboratorio in both FIELD_PRIMARY and FINANCIAL_PRIMARY nav arrays.

---

## Wave G: Contract-to-Lot Allocation + Container Export + Carta de Porte

### G1. Contract Lot Allocation Server Actions

**New file**: `src/app/(dashboard)/contracts/lot-actions.ts`

| Function | Permission | Description |
|----------|-----------|-------------|
| `getContractLotAllocations(contractId)` | requireAuth | Returns allocations with lot details (lotNumber, stage, quantityQQ, supplier name) |
| `getAvailableOroLots()` | requireAuth | Returns lots with stage=ORO_EXPORTABLE and quantityQQ > 0 |
| `allocateLotToContract(data)` | contract:lot_allocate | Validates via ContractLotAllocationSchema, creates allocation, audit, revalidate |
| `deallocateLotFromContract(id)` | contract:lot_allocate | Deletes allocation, audit, revalidate |

### G2. Contract Lot Allocation UI

**New file**: `src/app/(dashboard)/contracts/_components/lot-allocations-section.tsx`

"use client" component on contract detail page:
- Table of allocated lots: lotNumber, supplier, stage badge, available QQ, assigned QQ, deallocate button
- Footer row with total allocated QQ
- Inline form: select from available oro lots, quantity input, allocate button

**File modified**: `src/app/(dashboard)/contracts/[id]/page.tsx` — integrated LotAllocationsSection after price history, fetches allocations and available lots via `Promise.all`.

### G3. Container Lot Assignment Server Actions

**New file**: `src/app/(dashboard)/shipments/container-lot-actions.ts`

| Function | Permission | Description |
|----------|-----------|-------------|
| `getContainerLots(containerId)` | requireAuth | Returns container-lot links with lot details |
| `assignLotToContainer(data)` | container:lot_assign | Validates via ContainerLotSchema, creates link, audit |
| `unassignLotFromContainer(id)` | container:lot_assign | Deletes link, audit |
| `shipContainer(containerId)` | container:lot_assign | **Carta de Porte trigger**: transitions ALL linked lots to stage=EXPORTADO. Audit logs each lot stage change individually. Revalidates shipment |

### G4. Container Lot Assignment UI

**New file**: `src/app/(dashboard)/shipments/_components/container-lots-section.tsx`

"use client" component per container:
- Expandable section showing assigned lots with stage badges
- Add lot form: select from ORO_EXPORTABLE lots, specify QQ
- "Despachar" button calls `shipContainer()` — transitions all linked lots to EXPORTADO
- Hides mutation controls when all lots are already exported
- Unassign button per lot (only when not yet exported)

**File modified**: `src/app/(dashboard)/shipments/[id]/page.tsx` — fetches `getAvailableOroLots()` in parallel, passes serialized lots to containers section.

**File modified**: `src/app/(dashboard)/shipments/actions.ts` — `getShipment()` now includes `containerLots` with lot details in the containers include query.

**File modified**: `src/app/(dashboard)/shipments/_components/containers-section.tsx` — refactored from table layout to card-per-container layout to accommodate ContainerLotsSection inline. Updated types to include `ContainerWithLots` type. Decimal values serialized to `Number()` at page boundary.

---

## Wave H: Dual-Perspective Dashboard + Operational Reports

### H1. Dashboard Actions Extended

**File modified**: `src/app/(dashboard)/dashboard/actions.ts`

Added 6 new queries to the existing `Promise.all` in `getDashboardStats()`:

| Query | Method | Returns |
|-------|--------|---------|
| Inventory by stage | `prisma.lot.groupBy({ by: ['stage'] })` | Stage → QQ sums and lot counts |
| Quality stats | `prisma.cuppingRecord.aggregate()` | Avg totalScore, count |
| Pending cupping | `prisma.lot.count({ where: { cuppingRecords: { none: {} } } })` | Lots needing cupping |
| Yield stats | `prisma.lot.aggregate({ where: { actualYield: { not: null } } })` | Avg actual/contracted yield |
| Pending adjustments | `prisma.yieldAdjustment.count({ where: { status: 'PENDIENTE' } })` | Count awaiting COO review |
| Milling stats | `prisma.millingOrder.aggregate({ where: { status: 'COMPLETADO' } })` | Count of completed orders |

New return values: `inventoryMap`, `avgCuppingScore`, `lotsWithoutCupping`, `yieldIndex`, `pendingAdjustments`, `completedMillingOrders`

### H2. Dashboard Page — Operational Sections

**File modified**: `src/app/(dashboard)/dashboard/page.tsx`

Added "Operaciones" section below existing tables:

1. **Inventario por Estado** — 3 color-coded cards:
   - Pergamino en Bodega (amber): QQ total + lot count
   - En Proceso (blue): QQ total + lot count
   - Oro Exportable (emerald): QQ total + lot count

2. **Calidad SCA** — average cupping score + lots pending cupping count

3. **Indice de Rendimiento** — yield performance index: avg(contractedYield / actualYield) as percentage

4. **Ajustes Pendientes** — amber warning card shown only when pendingAdjustments > 0, with count and link to `/quality-lab/adjustments`

5. **Ordenes de Tria Completadas** — completed milling orders count

Section ordering: FIELD_OPERATOR sees operations section right after the shared KPI cards. FINANCIAL_OPERATOR sees it below the financial tables (still visible, just lower priority).

### H3. Operational Report Actions

**File modified**: `src/app/(dashboard)/reports/actions.ts`

3 new server action functions:

| Function | Description |
|----------|-------------|
| `getInventoryReport()` | Groups lots by facility (name → stages → QQ/count), by supplier (name → stages → QQ/count), and by stage (stage → QQ/count). Uses `prisma.lot.findMany()` with includes and JS grouping. |
| `getYieldVarianceReport()` | Returns lots where both contractedYield and actualYield exist. Computes variance = (actual - contracted) / contracted * 100. Includes linked YieldAdjustment status if one exists. |
| `getMillingEfficiencyReport()` | Returns completed milling orders. Computes per-order: total input QQ, oro output QQ, segunda QQ, merma QQ, yield = oro/input as percentage. |

### H4. Operational Report Pages

**New file**: `src/app/(dashboard)/reports/inventory/page.tsx`
- 3 summary KPI cards (total lots, total QQ, facilities)
- 3 tables: by stage (with QQ totals), by facility (with QQ per stage), by supplier (with QQ per stage)

**New file**: `src/app/(dashboard)/reports/yield/page.tsx`
- Yield variance table: lotNumber, supplier, contracted yield, actual yield, variance %
- Color coding: variance > 1% tolerance highlighted red, within tolerance green
- Shows linked adjustment status badge if one exists

**New file**: `src/app/(dashboard)/reports/milling/page.tsx`
- Milling efficiency table: orderNumber, date, facility, input QQ, oro output QQ, segunda QQ, merma QQ, yield %
- Yield column color: >= 80% green, >= 70% amber, < 70% red

**File modified**: `src/app/(dashboard)/reports/page.tsx` — added 3 new link cards to reports hub: Inventario (Package icon), Varianza de Rendimiento (Scale icon), Eficiencia de Trilla (Factory icon)

---

## Navigation — Final State

**File modified**: `src/components/layout/app-shell.tsx`

### FIELD_OPERATOR nav order:
1. Dashboard
2. Contratos
3. Inventario
4. Ordenes de Compra
5. Proveedores
6. Laboratorio (new)
7. Tria (new)
8. Embarques
9. Fincas
10. Reportes
11. Auditoria

### FINANCIAL_OPERATOR nav order:
1. Dashboard
2. Contratos
3. Embarques
4. Reportes
5. Inventario
6. Ordenes de Compra
7. Proveedores
8. Laboratorio (new)
9. Tria (new)
10. Fincas
11. Auditoria

### Settings submenu:
- Costos Exportacion
- Tipo de Cambio
- Instalaciones (new)
- Usuarios (admin only)

---

## Files Changed — Complete Inventory

### New Files (23)

| File | Wave | Purpose |
|------|------|---------|
| `src/lib/services/correlatives.ts` | B | Auto-correlative generation |
| `src/app/(dashboard)/settings/facilities/actions.ts` | D | Facility CRUD actions |
| `src/app/(dashboard)/settings/facilities/page.tsx` | D | Facility list + create |
| `src/app/(dashboard)/settings/facilities/_components/facility-form.tsx` | D | Facility creation form |
| `src/app/(dashboard)/settings/facilities/_components/facility-delete-button.tsx` | D | Facility delete button |
| `src/app/(dashboard)/inventory/lot-actions.ts` | D | Lot CRUD actions |
| `src/app/(dashboard)/inventory/_components/inventory-filters.tsx` | D | Lot filter dropdowns |
| `src/app/(dashboard)/purchase-orders/page.tsx` | D | PO list (moved) |
| `src/app/(dashboard)/purchase-orders/new/page.tsx` | D | PO create (moved) |
| `src/app/(dashboard)/purchase-orders/[id]/page.tsx` | D | PO detail (moved) |
| `src/app/(dashboard)/quality-lab/actions.ts` | E | Cupping + yield actions |
| `src/app/(dashboard)/quality-lab/page.tsx` | E | Cupping records list |
| `src/app/(dashboard)/quality-lab/new/page.tsx` | E | Cupping create page |
| `src/app/(dashboard)/quality-lab/_components/cupping-form.tsx` | E | SCA 10-attribute form |
| `src/app/(dashboard)/quality-lab/adjustments/page.tsx` | E | Yield adjustments list |
| `src/app/(dashboard)/quality-lab/adjustments/_components/adjustment-actions.tsx` | E | Approve/reject buttons |
| `src/app/(dashboard)/milling/actions.ts` | F | Milling CRUD actions |
| `src/app/(dashboard)/milling/page.tsx` | F | Milling orders list |
| `src/app/(dashboard)/milling/new/page.tsx` | F | Milling create page |
| `src/app/(dashboard)/milling/[id]/page.tsx` | F | Milling detail page |
| `src/app/(dashboard)/milling/_components/milling-form.tsx` | F | Milling order form |
| `src/app/(dashboard)/contracts/lot-actions.ts` | G | Contract-lot allocation actions |
| `src/app/(dashboard)/contracts/_components/lot-allocations-section.tsx` | G | Lot allocation inline UI |
| `src/app/(dashboard)/shipments/party-actions.ts` | C | Shipment party CRUD |
| `src/app/(dashboard)/shipments/_components/parties-section.tsx` | C | Shipment party inline UI |
| `src/app/(dashboard)/shipments/container-lot-actions.ts` | G | Container-lot + ship actions |
| `src/app/(dashboard)/shipments/_components/container-lots-section.tsx` | G | Container-lot inline UI |
| `src/app/(dashboard)/reports/inventory/page.tsx` | H | Inventory report |
| `src/app/(dashboard)/reports/yield/page.tsx` | H | Yield variance report |
| `src/app/(dashboard)/reports/milling/page.tsx` | H | Milling efficiency report |
| `scripts/migrate-subproductos.ts` | F | Subproducto data migration |

### Modified Files (34)

| File | Wave | Changes |
|------|------|---------|
| `prisma/schema.prisma` | B | 11 new models, 7 new enums, 3 model extensions |
| `prisma/seed.ts` | B | Admin user name updated |
| `src/lib/services/auth.ts` | RBAC | requirePermission, AuthorizationError, JWT compat |
| `src/lib/services/permissions.ts` | B | 8 new permissions added |
| `src/lib/services/shipment-aggregation.ts` | A | DB aggregate for MP/sub sums |
| `src/lib/validations/schemas.ts` | B | 9 new schemas, 6 enum schemas, cooContractName |
| `src/middleware.ts` | RBAC | Simplified to auth + admin-only |
| `src/components/layout/app-shell.tsx` | C/D/E/F | 4 new nav items, role ordering, ShoppingCart/FlaskConical/Factory icons |
| `src/app/(dashboard)/contracts/actions.ts` | B/C | officialCorrelative generation, cooContractName, multi-field search |
| `src/app/(dashboard)/contracts/_components/contract-table.tsx` | C | officialCorrelative as primary column |
| `src/app/(dashboard)/contracts/[id]/page.tsx` | C/G | 3 identifiers display, lot allocations section |
| `src/app/(dashboard)/shipments/actions.ts` | G | containerLots in getShipment include |
| `src/app/(dashboard)/shipments/[id]/page.tsx` | C/G | Parties section, container-lots integration |
| `src/app/(dashboard)/shipments/_components/containers-section.tsx` | G | Card layout, ContainerLotsSection |
| `src/app/(dashboard)/shipments/container-actions.ts` | RBAC | Permission update |
| `src/app/(dashboard)/shipments/mp-actions.ts` | RBAC | Permission update |
| `src/app/(dashboard)/shipments/sub-actions.ts` | RBAC | Permission update |
| `src/app/(dashboard)/inventory/actions.ts` | D | revalidatePath → /purchase-orders |
| `src/app/(dashboard)/inventory/page.tsx` | D | Lot-based inventory with balance cards |
| `src/app/(dashboard)/inventory/[id]/page.tsx` | D | Redirect to /purchase-orders |
| `src/app/(dashboard)/inventory/new/page.tsx` | D | Redirect to /purchase-orders |
| `src/app/(dashboard)/inventory/_components/po-form.tsx` | D | router.push → /purchase-orders |
| `src/app/(dashboard)/suppliers/actions.ts` | D | Lot auto-creation on account entry |
| `src/app/(dashboard)/farms/actions.ts` | RBAC | Permission update |
| `src/app/(dashboard)/dashboard/actions.ts` | H | 6 operational KPI queries |
| `src/app/(dashboard)/dashboard/page.tsx` | H | Operations section with 5 KPI cards |
| `src/app/(dashboard)/reports/actions.ts` | H | 3 operational report functions |
| `src/app/(dashboard)/reports/page.tsx` | H | 3 new report links |
| `src/app/(dashboard)/settings/actions.ts` | RBAC | Permission updates |
| `src/app/(dashboard)/settings/audit-log/page.tsx` | RBAC | Redirect to /audit-log |
| `src/app/(dashboard)/settings/users/_components/user-create-form.tsx` | RBAC | 4-role dropdown |
| `src/app/(dashboard)/settings/users/page.tsx` | RBAC | Role badge updates |
| `docs/06-DATABASE-DESIGN-REVIEW.md` | — | Implementation status table |
| `docs/07-DB-ENHANCEMENT-PLAN.md` | — | Implementation status table |
| `docs/08-OPERATIONS-REFACTOR-PLAN.md` | — | Consolidation reference |

---

## Verification

| Check | Result |
|-------|--------|
| `prisma validate` | Schema valid |
| `prisma db push` (session pooler port 5432) | Schema synced to production |
| `prisma generate` | Client regenerated with all new models |
| `next build` | 0 errors, 42 routes compiled (was 31) |
| `vitest run` | 24/24 tests passing |
| Correlative backfill | 46 contracts → HC-2026-0001 through HC-2026-0046 |
| Facility seed | 3 facilities (Beneficio, Bodega, Patio) |
| Yield tolerance seed | 1 config record (tolerance = 0.01) |
| Subproducto migration | 22/22 records migrated, counts verified OK |
| GIN index | idx_contracts_regions created on production |
