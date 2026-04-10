# HOPE COFFEE — Database Design Review

> Reference document. Produced 2026-03-06 by analyzing the full Prisma schema (430 lines, 17 models), all 50+ Prisma queries across 13 action files, `docs/COFFEE.md` stakeholder requirements, and `docs/01-DOMAIN-MODEL.md`.

---

## Current Schema Overview

| Domain | Models | Key Relationships |
|--------|--------|-------------------|
| Auth | User, AuditLog | AuditLog → User |
| Config | ExchangeRate, ExportCostConfig | ExportCostConfig → Shipment |
| Commercial | Client, Supplier | Client → Contract, Supplier → PurchaseOrder |
| Contract | Contract (25 fields) | Contract → Client, Shipment; Contract ← MateriaPrimaAllocation |
| Shipment | Shipment (13 aggregated fields) | Shipment ← Contract, MateriaPrima, Subproducto |
| Raw Material | MateriaPrima, MateriaPrimaAllocation, Subproducto | MP → Shipment; Allocation → MP + Contract |
| Inventory | PurchaseOrder | PurchaseOrder → Supplier |
| Supplier Accounts | SupplierAccountEntry | Entry → Supplier |
| Farm | Farm | Standalone |

### Existing Indexes

```
AuditLog:     @@index([entity, entityId]), @@index([userId, createdAt])
ExchangeRate: @@index([validFrom, validTo])
Contract:     @@index([clientId]), @@index([shipmentId]), @@index([status]), @@index([fechaEmbarque])
Shipment:     @@unique([month, year, name]), @@index([year, month])
MateriaPrima: @@index([shipmentId])
MateriaPrimaAllocation: @@unique([materiaPrimaId, contractId])
PurchaseOrder: @@index([supplierId])
SupplierAccountEntry: @@index([supplierId, orderCode]), @@index([date])
Subproducto:  @@index([shipmentId])
```

---

## Issue 1: Missing Indexes

### Problem
`Contract.createdAt` is filtered in `getMonthlyContext` and the month filter on `getContracts`, but has no index. Same for the common pattern of `status + createdAt` used by the dashboard and monthly context queries. `PurchaseOrder.date` is used in `ORDER BY` on every PO listing.

### Impact
Every monthly view and dashboard load does a sequential scan on the contracts table. With 50-200 contracts per year this is fine, but performance degrades linearly.

### Recommendation
```prisma
// Contract — replace existing @@index([status]) with composite
@@index([status, createdAt])   // Covers both status-only and status+date queries
@@index([createdAt])           // Covers month-only filter

// PurchaseOrder
@@index([date])
```

### Queries Affected
- `getMonthlyContext()` — `createdAt: { gte, lte }` + `status: { not: "CANCELADO" }`
- `getContracts(month)` — `createdAt: { gte, lt }`
- `getDashboardStats()` — `status: { notIn: [...] }`
- `getPurchaseOrders()` — `orderBy: { date: "desc" }`

---

## Issue 2: String Fields That Should Be Enums

### Problem
`PurchaseOrder.status` is `String @default("PENDIENTE")` — no DB-level constraint. Typos or invalid values can be inserted without error. `Shipment.status` reuses `ContractStatus` but shipments never go through NEGOCIACION/CONFIRMADO/NO_FIJADO.

### Recommendation
```prisma
enum POStatus {
  PENDIENTE
  RECIBIDO
  LIQUIDADO
}

enum ShipmentStatus {
  PREPARACION  // Being assembled
  EMBARCADO    // Shipped
  LIQUIDADO    // Settled
}
```

### Migration Notes
- PurchaseOrder: All existing rows should already be PENDIENTE/RECIBIDO/LIQUIDADO, so conversion is safe
- Shipment: Current status values need mapping. NEGOCIACION → PREPARACION; FIJADO → PREPARACION; EMBARCADO → EMBARCADO; LIQUIDADO → LIQUIDADO

---

## Issue 3: Aggregation Done in JavaScript, Not Database

### Problem
Most aggregation loads full result sets into Node.js and uses `.reduce()`:

| Function | Pattern | Rows Transferred |
|----------|---------|-----------------|
| `getMonthlyContext()` | `findMany` + JS reduce | All contracts in month |
| `getDashboardStats()` | `findMany` all shipments, slice in JS | All shipments |
| `recalculateShipment()` | `findMany` all contracts/MP/sub, aggregate in JS | All children of shipment |

Only `getAccumulatedPOStats()` correctly uses `prisma.purchaseOrder.aggregate()`.

### Impact
Transfers unnecessary data over the wire. As contracts grow to 500+/year, the monthly context query alone transfers ~500 full contract objects when it only needs 5 numeric sums.

### Recommendation
Use `prisma.contract.aggregate()` for sums and `prisma.contract.groupBy()` for per-month breakdowns. Keep `findMany` only when you need the individual records (like the peer contract list in monthly context).

Example for dashboard weighted margin:
```typescript
const agg = await prisma.contract.aggregate({
  where: { status: { notIn: ["CANCELADO"] } },
  _sum: { utilidadSinCF: true, facturacionKgs: true, totalPagoQTZ: true },
  _count: true,
});
```

---

## Issue 4: Missing Harvest Year (Cosecha) Dimension

### Problem
The business operates on crop years (cosecha 25/26, 26/27). Currently there is no way to group, filter, or compare data by harvest season. All date-based queries use `createdAt` as a proxy.

### Impact
- Can't answer: "What was our margin for cosecha 25/26?"
- Can't compare performance across harvest years
- When Phase 2 (Odoo integration) arrives, cosecha will be a required field for ERP sync

### Recommendation
```prisma
// Add to Contract and PurchaseOrder
cosecha  String?  // "25/26", "26/27"
```

Alternatively use `cosechaYear Int` (e.g., 2025 = cosecha starting Oct 2025). The slash format is more natural for the domain.

---

## Issue 5: MateriaPrimaAllocation Missing Quantity

### Problem
The junction table `MateriaPrimaAllocation` is binary — it links MP to Contract with no quantity. This means:
- Can't partially allocate raw material across multiple contracts
- Can't track "275 quintales from batch X went to contract Y"
- The FIJADO check only verifies existence, not adequacy

### Impact
One MP batch commonly serves multiple contracts. Without quantity, the app can't answer: "How much of OC-2526-01's pergamino was allocated to P40129?"

### Recommendation
```prisma
model MateriaPrimaAllocation {
  id                 String  @id @default(cuid())
  materiaPrimaId     String
  contractId         String
  quintalesAllocated Decimal? @db.Decimal(10, 2)
  // ... existing relations
}
```

---

## Issue 6: Stale Computed / Aggregated Fields

### Problem
Contract stores 8 computed columns. Shipment stores 13 aggregated columns. These are recalculated by application code, but there's no mechanism to detect staleness if data is modified outside the normal flow (direct DB edits, migration scripts, failed partial updates).

### Impact
If `precioBolsa` is updated but `computeContractFields()` isn't called, all downstream values (facturacionLbs, utilidadSinGE, totalPagoQTZ) are wrong. The shipment aggregates compound the error.

### Recommendation
Add a `computedAt` timestamp:
```prisma
// Contract
computedAt  DateTime?  // Set by computeContractFields()

// Shipment
aggregatedAt DateTime?  // Set by recalculateShipment()
```

Application code can then detect `updatedAt > computedAt` as a staleness signal. A periodic job or admin action can recompute stale records.

Long-term: use Postgres generated columns for trivial derivations:
- `sacos46kg` = `sacos69kg * 1.5` (always true, no business logic variation)
- `precioBolsaDif` = `precioBolsa + diferencial`

---

## Issue 7: CoffeeRegion[] Array Not Queryable

### Problem
`Contract.regions CoffeeRegion[]` uses a Postgres array. Querying "all contracts containing HUEHUETENANGO" requires `@> ARRAY['HUEHUETENANGO']::text[]` which can't use a standard B-tree index.

### Impact
Low at current scale (~100 contracts). At 1000+ contracts with frequent region-based dashboards, this becomes a bottleneck.

### Recommendation
For now, add a GIN index (via raw SQL migration):
```sql
CREATE INDEX idx_contracts_regions ON contracts USING GIN (regions);
```

Long-term, if region-based aggregation becomes a core feature, migrate to a junction table `ContractRegion`.

---

## Issue 8: No Container-Level Tracking

### Problem
`Shipment.numContainers` is an integer count. No individual container records exist. As the business grows, per-container tracking is needed for:
- Container numbers (MSKU1234567)
- Bill of Lading numbers
- Per-container weight and lot assignment
- Vessel, port, ETA tracking

### Recommendation
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
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  shipment Shipment @relation(fields: [shipmentId], references: [id])

  @@index([shipmentId])
  @@map("containers")
}
```

`Shipment.numContainers` becomes derived from `containers.count()`.

---

## Issue 9: No Price / Rate History

### Problem
When a contract's `precioBolsa` or `tipoCambio` changes, the previous value is only preserved in `AuditLog.oldValue` as unstructured JSON — not queryable, not indexable.

### Impact
- Can't build price movement charts
- Can't answer "what was the bolsa price when we confirmed this contract?"
- Financial auditing requires parsing JSON blobs

### Recommendation
```prisma
model ContractPriceSnapshot {
  id            String   @id @default(cuid())
  contractId    String
  precioBolsa   Decimal  @db.Decimal(10, 2)
  diferencial   Decimal  @db.Decimal(10, 2)
  tipoCambio    Decimal  @db.Decimal(10, 4)
  posicionBolsa PosicionBolsa?
  status        ContractStatus
  snapshotAt    DateTime @default(now())
  triggeredBy   String?  // userId or "system"

  contract Contract @relation(fields: [contractId], references: [id])

  @@index([contractId, snapshotAt])
  @@map("contract_price_snapshots")
}
```

Insert a snapshot on every `updateContract` or `changeContractStatus` call.

---

## Issue 10: ExportCostConfig Not Snapshot Per Contract

### Problem
ExportCostConfig is linked to Shipment (via `exportCostConfigId`), not Contract. The contract stores `gastosExport` (the computed total) but not which config produced it.

If export costs change and the config is updated, recalculating an old contract would produce different results than the original.

### Impact
Low — `gastosExport` is already persisted on the contract. But for audit/traceability, there's no record of which config version was used.

### Recommendation
Add to Contract:
```prisma
exportCostConfigId  String?  // Snapshot: which config was active at calculation time
```

This is a simple FK that preserves the lineage without duplicating the full config.

---

## Priority Matrix

| # | Enhancement | Effort | Impact | Risk if Deferred |
|---|------------|--------|--------|------------------|
| 1 | Missing indexes | 5 min | High | Slow queries as data grows |
| 2 | Enum for PO/Shipment status | 15 min | Medium | Data integrity issues |
| 3 | DB-level aggregation | 1 hr | High | Excessive data transfer |
| 4 | Cosecha field | 10 min | High | Can't do crop-year analysis |
| 5 | MP allocation quantity | 10 min | Medium | Inaccurate allocation tracking |
| 6 | computedAt staleness detection | 10 min | Medium | Silent data corruption |
| 7 | GIN index on regions | 5 min | Low-Medium | Slow region queries at scale |
| 8 | Container model | 30 min | Medium | Blocks logistics tracking |
| 9 | Price history table | 30 min | Medium | Blocks price movement analysis |
| 10 | Export cost config snapshot | 5 min | Low | Minor audit gap |

---

## Dependency Graph

```
1 (Indexes) ─── standalone, do first
2 (Enums) ───── standalone
3 (DB aggregation) ─── depends on 1 for optimal performance
4 (Cosecha) ──── standalone, add to schema + forms
5 (MP quantity) ── standalone
6 (computedAt) ── standalone
7 (GIN index) ─── standalone (raw SQL migration)
8 (Container) ─── standalone, but informs Shipment changes
9 (Price history) ── standalone
10 (Config snapshot) ── standalone
```

All items are independent and can be implemented in any order. Items 1-2 should go first as they're the fastest wins with the highest impact-to-effort ratio.

---

## Implementation Status (Updated 2026-04-10)

| # | Enhancement | Status |
|---|------------|--------|
| 1 | Missing indexes | DONE |
| 2 | PO/Shipment status enums | DONE |
| 3 | DB-level aggregation | PARTIALLY DONE — dashboard and monthly context use aggregate; `recalculateShipment()` MP/subproducto sums still use JS `.reduce()` |
| 4 | Cosecha field | DONE |
| 5 | MP allocation quantity | DONE — `quintalesAllocated` field exists on MateriaPrimaAllocation |
| 6 | computedAt staleness detection | DONE |
| 7 | GIN index on regions | NOT DONE |
| 8 | Container model | DONE |
| 9 | Price history table | DONE — ContractPriceSnapshot created on both updateContract and changeContractStatus |
| 10 | Export cost config snapshot | DONE |

**Remaining items (3 and 7) have been consolidated into [10-CATCH-UP-PLAN.md](10-CATCH-UP-PLAN.md) as Wave A (items A1 and A2).** This document remains as reference for the original analysis.
