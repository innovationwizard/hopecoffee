# HOPE COFFEE — Database Enhancement Implementation Plan

> Implementation plan for the 10 enhancements identified in `06-DATABASE-DESIGN-REVIEW.md`.
> Organized into 5 waves by dependency and effort. Each wave is independently deployable.

---

## Wave 1: Quick Wins (Schema-Only, No Code Changes)

**Estimated time: 15 minutes. Zero application code changes.**

### 1A. Add Missing Indexes

**File:** `prisma/schema.prisma`

```prisma
// Contract model — replace existing @@index([status]) with:
@@index([status, createdAt])
@@index([createdAt])

// PurchaseOrder model — add:
@@index([date])
```

**Steps:**
1. Edit `prisma/schema.prisma`: remove `@@index([status])` from Contract, add two new indexes
2. Add `@@index([date])` to PurchaseOrder
3. Run `npx prisma db push`
4. Verify with `EXPLAIN ANALYZE` on monthly context query

### 1B. GIN Index for Regions Array

This requires a raw SQL migration since Prisma doesn't support GIN indexes natively.

**Steps:**
1. Create `prisma/migrations/add_gin_regions/migration.sql`:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_contracts_regions ON contracts USING GIN (regions);
   ```
2. Run `npx prisma migrate deploy` (or apply manually)

### 1C. Export Cost Config Snapshot on Contract

**File:** `prisma/schema.prisma`

```prisma
// Contract model — add:
exportCostConfigId  String?
exportCostConfig    ExportCostConfig? @relation(fields: [exportCostConfigId], references: [id])
```

**File:** `src/app/(dashboard)/contracts/actions.ts`
- In `createContract`: look up default ExportCostConfig, store its ID on the new contract
- In `updateContract`: no change (config is locked at creation)

**Verification:**
- `npx prisma db push` succeeds
- New contracts get `exportCostConfigId` populated
- Old contracts have `null` (acceptable — config wasn't tracked before)

---

## Wave 2: Enum Tightening + Cosecha Field

**Estimated time: 30 minutes. Minor code changes in actions + forms.**

### 2A. PurchaseOrder Status Enum

**File:** `prisma/schema.prisma`

```prisma
enum POStatus {
  PENDIENTE
  RECIBIDO
  LIQUIDADO
}

// PurchaseOrder model — change:
// FROM: status String @default("PENDIENTE")
// TO:
status POStatus @default(PENDIENTE)
```

**Files to update:**
- `src/app/(dashboard)/inventory/actions.ts` — remove string casting, use `POStatus` type
- `src/app/(dashboard)/inventory/_components/po-form.tsx` — ensure dropdown values match enum

**Migration:** Safe — all existing values are already PENDIENTE/RECIBIDO/LIQUIDADO.

### 2B. Shipment Status Enum

**File:** `prisma/schema.prisma`

```prisma
enum ShipmentStatus {
  PREPARACION
  EMBARCADO
  LIQUIDADO
}

// Shipment model — change:
// FROM: status ContractStatus @default(NEGOCIACION)
// TO:
status ShipmentStatus @default(PREPARACION)
```

**Migration SQL needed:**
```sql
UPDATE shipments SET status = 'PREPARACION' WHERE status IN ('NEGOCIACION', 'CONFIRMADO', 'FIJADO', 'NO_FIJADO');
-- EMBARCADO and LIQUIDADO map directly
```

**Files to update:**
- `src/app/(dashboard)/shipments/actions.ts` — use `ShipmentStatus` type
- `src/app/(dashboard)/shipments/_components/shipment-form.tsx` — update status options
- `src/components/ui/status-badge.tsx` — add PREPARACION variant
- `src/lib/utils/format.ts` — add `formatShipmentStatus()` or extend existing

### 2C. Cosecha (Harvest Year) Field

**File:** `prisma/schema.prisma`

```prisma
// Contract model — add:
cosecha String? // "25/26", "26/27"

// PurchaseOrder model — add:
cosecha String? // "25/26", "26/27"
```

**Files to update:**
- `src/lib/validations/schemas.ts` — add `cosecha: z.string().regex(/^\d{2}\/\d{2}$/).optional()` to ContractCreateSchema and PurchaseOrderSchema
- `src/app/(dashboard)/contracts/_components/contract-form.tsx` — add cosecha input field
- `src/app/(dashboard)/contracts/_components/contract-table.tsx` — add cosecha column
- `src/app/(dashboard)/contracts/_components/contract-filters.tsx` — add cosecha dropdown filter
- `src/app/(dashboard)/contracts/actions.ts` — accept `cosecha` in filters, persist on create/update
- `src/app/(dashboard)/contracts/[id]/page.tsx` — show cosecha in detail view
- `src/app/(dashboard)/inventory/_components/po-form.tsx` — add cosecha input
- `src/app/(dashboard)/inventory/actions.ts` — persist cosecha on PO create/update

**Default value logic:**
- Oct-Dec: current year / next year (e.g., Oct 2025 → "25/26")
- Jan-Sep: previous year / current year (e.g., Mar 2026 → "25/26")
- Expose as editable default, not forced

**Verification:**
- New contracts show cosecha field
- Filter by cosecha works on list page
- Old contracts show "—" for cosecha

---

## Wave 3: Data Integrity + Staleness Detection

**Estimated time: 30 minutes.**

### 3A. Staleness Detection (computedAt)

**File:** `prisma/schema.prisma`

```prisma
// Contract model — add:
computedAt DateTime?

// Shipment model — add:
aggregatedAt DateTime?
```

**Files to update:**

`src/app/(dashboard)/contracts/actions.ts`:
- In `computeContractFields` return object: add `computedAt: new Date()`
- Both `createContract` and `updateContract` persist `computedAt`

`src/lib/services/shipment-aggregation.ts`:
- In `recalculateShipment`, set `aggregatedAt: new Date()` in the update

**Optional admin action:**
```typescript
export async function getStaleContracts() {
  return prisma.$queryRaw`
    SELECT id, "contractNumber", "updatedAt", "computedAt"
    FROM contracts
    WHERE "updatedAt" > "computedAt" OR "computedAt" IS NULL
  `;
}
```

### 3B. MateriaPrimaAllocation Quantity

**File:** `prisma/schema.prisma`

```prisma
model MateriaPrimaAllocation {
  id                 String  @id @default(cuid())
  materiaPrimaId     String
  contractId         String
  quintalesAllocated Decimal? @db.Decimal(10, 2) // NEW: null = full allocation (backward compat)
  // ... existing relations and constraints
}
```

**Files to update:**
- `src/app/(dashboard)/shipments/mp-actions.ts` — accept `quintalesAllocated` when creating allocation
- MP allocation UI (if exists) — add quantity input
- `src/app/(dashboard)/contracts/actions.ts` — FIJADO check could optionally verify total allocation >= contract sacos

**Backward compatibility:** `null` means "entire batch allocated" (matches current binary behavior). New allocations can specify exact quantity.

---

## Wave 4: DB-Level Aggregation

**Estimated time: 1 hour. Significant code refactoring but no schema changes.**

### 4A. Dashboard Stats — Use Aggregate

**File:** `src/app/(dashboard)/dashboard/actions.ts`

Replace JS-side aggregation with Prisma aggregate:

```typescript
// BEFORE: fetch all shipments, reduce in JS
const shipments = await prisma.shipment.findMany({ ... });
const totalRevenue = shipments.reduce((s, sh) => s + toNum(sh.totalPagoQTZ), 0);

// AFTER: aggregate at DB level
const shipmentAgg = await prisma.shipment.aggregate({
  _sum: { totalPagoQTZ: true, utilidadBruta: true, numContainers: true },
  _count: true,
});
```

Keep the `findMany` for recent shipments table (needs individual rows), but limit it properly:
```typescript
const recentShipments = await prisma.shipment.findMany({
  orderBy: [{ year: "desc" }, { month: "desc" }],
  take: 6, // Only show 6 in the table anyway
  select: { id: true, name: true, numContainers: true, totalPagoQTZ: true, margenBruto: true },
});
```

### 4B. Monthly Context — Hybrid Approach

**File:** `src/app/(dashboard)/contracts/actions.ts`

Split `getMonthlyContext` into two queries:
1. Aggregate query for KPIs (no row transfer)
2. `findMany` for peer list (only needed fields, limited rows)

```typescript
const [agg, peers] = await Promise.all([
  prisma.contract.aggregate({
    where: monthWhere,
    _sum: { sacos69kg: true, totalPagoQTZ: true, facturacionKgs: true, utilidadSinCF: true },
    _count: true,
  }),
  prisma.contract.findMany({
    where: monthWhere,
    select: {
      id: true, contractNumber: true, sacos69kg: true,
      totalPagoQTZ: true, facturacionKgs: true, utilidadSinCF: true,
      status: true, client: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20, // Cap peer list
  }),
]);
```

### 4C. Shipment Recalculation — Partial DB Aggregation

**File:** `src/lib/services/shipment-aggregation.ts`

The current approach loads all contracts to run `calculateContract()` on each. This is necessary because the computation uses the full calculation engine. However, the MP and subproducto sums can be DB-aggregated:

```typescript
const [mpSum, subSum] = await Promise.all([
  prisma.materiaPrima.aggregate({
    where: { shipmentId },
    _sum: { totalMP: true },
  }),
  prisma.subproducto.aggregate({
    where: { shipmentId },
    _sum: { totalPerga: true },
  }),
]);
```

Keep `calculateContract` loop for the contract-level waterfall calculations.

---

## Wave 5: New Models (Container + Price History)

**Estimated time: 1 hour. New tables, new CRUD, new UI sections.**

### 5A. Container Model

**File:** `prisma/schema.prisma`

```prisma
model Container {
  id            String    @id @default(cuid())
  shipmentId    String
  containerNum  String?   // MSKU1234567
  blNumber      String?   // Bill of Lading
  sealNumber    String?
  weightKg      Decimal?  @db.Decimal(10, 2)
  vessel        String?
  port          String?
  eta           DateTime?
  notes         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  shipment Shipment @relation(fields: [shipmentId], references: [id])

  @@index([shipmentId])
  @@map("containers")
}

// Shipment — add:
containers Container[]
```

**New files:**
- `src/app/(dashboard)/shipments/container-actions.ts` — CRUD for containers
- `src/app/(dashboard)/shipments/_components/containers-section.tsx` — Table within shipment detail
- `src/lib/validations/schemas.ts` — `ContainerSchema`

**Behavioral change:**
- `Shipment.numContainers` becomes derived: `containers.length` (or keep as manual override with container list as optional detail)
- Phase this in: keep `numContainers` as the source of truth initially, add container records as optional enrichment

### 5B. Contract Price History

**File:** `prisma/schema.prisma`

```prisma
model ContractPriceSnapshot {
  id            String         @id @default(cuid())
  contractId    String
  precioBolsa   Decimal?       @db.Decimal(10, 2)
  diferencial   Decimal?       @db.Decimal(10, 2)
  tipoCambio    Decimal?       @db.Decimal(10, 4)
  posicionBolsa PosicionBolsa?
  status        ContractStatus
  triggeredBy   String?        // userId
  reason        String?        // "price_update", "status_change", "manual"
  snapshotAt    DateTime       @default(now())

  contract Contract @relation(fields: [contractId], references: [id])

  @@index([contractId, snapshotAt])
  @@map("contract_price_snapshots")
}

// Contract — add:
priceSnapshots ContractPriceSnapshot[]
```

**Files to update:**
- `src/app/(dashboard)/contracts/actions.ts`:
  - `updateContract` — before updating, create a snapshot of current values
  - `changeContractStatus` — create a snapshot on status change
- `src/app/(dashboard)/contracts/[id]/page.tsx` — add "Historial de Precios" collapsible section showing snapshots in chronological order

**No backfill needed** — snapshots start accumulating from the moment this is deployed. Historical data is preserved in AuditLog JSON (not ideal but exists).

---

## Wave Summary

| Wave | Items | Effort | Schema Migration | Code Changes |
|------|-------|--------|-----------------|--------------|
| 1 | Indexes + GIN + Config FK | 15 min | `db push` + raw SQL | 2 files |
| 2 | PO enum + Shipment enum + Cosecha | 30 min | `db push` + data migration | ~10 files |
| 3 | computedAt + MP quantity | 30 min | `db push` | ~4 files |
| 4 | DB aggregation | 1 hr | None | ~3 files |
| 5 | Container + Price History | 1 hr | `db push` | ~8 new files |

**Total: ~3 hours of implementation across all 5 waves.**

---

## Verification Checklist (Per Wave)

- [ ] `npx prisma db push` succeeds (no data loss warnings)
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npx vitest run` — all tests pass
- [ ] Existing data unchanged (verify a known contract's totalPagoQTZ)
- [ ] New fields have safe defaults (null or explicit default)
- [ ] Create + edit + delete flows work for affected entities

---

## Risk Notes

- **Wave 2B (ShipmentStatus enum)** is the riskiest change — it alters existing data. Must run data migration SQL before schema push. Back up DB first.
- **Wave 4 (DB aggregation)** changes return value shapes. Any code that depends on the raw Prisma objects (not just the returned stats) must be updated.
- **Wave 5 (Container model)** adds a new relation to Shipment. The existing `numContainers` field must remain functional during transition.

---

## Implementation Status (Updated 2026-04-10)

| Wave | Status |
|------|--------|
| Wave 1A — Missing indexes | DONE |
| Wave 1B — GIN index on regions | NOT DONE |
| Wave 1C — Export cost config FK | DONE |
| Wave 2A — PO status enum | DONE |
| Wave 2B — Shipment status enum | DONE |
| Wave 2C — Cosecha field | DONE |
| Wave 3A — computedAt staleness | DONE |
| Wave 3B — MP allocation quantity | DONE |
| Wave 4A — Dashboard aggregate | DONE |
| Wave 4B — Monthly context aggregate | DONE |
| Wave 4C — Shipment recalculation aggregate | NOT DONE — MP/subproducto sums still use JS `.reduce()` |
| Wave 5A — Container model | DONE |
| Wave 5B — Price history | DONE |

**Remaining items (1B and 4C) have been consolidated into [10-CATCH-UP-PLAN.md](10-CATCH-UP-PLAN.md) as Wave A (items A1 and A2).** This document remains as reference for the original wave structure.
