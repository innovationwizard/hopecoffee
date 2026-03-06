# Changelog — 2026-03-06: Database Enhancement Plan (5 Waves)

## Summary

Implemented all 10 database enhancements from `docs/06-DATABASE-DESIGN-REVIEW.md`, organized into 5 independently-deployable waves per `docs/07-DB-ENHANCEMENT-PLAN.md`. TypeScript: 0 errors. Tests: 24/24 passing.

---

## Wave 1: Quick Wins (Schema-Only)

### Missing Indexes (`prisma/schema.prisma`)
- Replaced `@@index([status])` on Contract with composite `@@index([status, createdAt])` — covers both status-only and status+date queries
- Added `@@index([createdAt])` on Contract — covers month-only filters (`getMonthlyContext`, `getContracts(month)`)
- Added `@@index([date])` on PurchaseOrder — covers `ORDER BY date` on PO listings

### Export Cost Config FK (`prisma/schema.prisma`, `contracts/actions.ts`)
- Added `exportCostConfigId String?` on Contract with relation to ExportCostConfig
- Added named relation `@relation("ContractExportCostConfig")` to avoid ambiguity with Shipment's existing relation
- `createContract` now looks up the default ExportCostConfig and stores its ID on new contracts
- Old contracts have `null` (acceptable — config wasn't tracked before)

### GIN Index
- Noted for raw SQL migration (`CREATE INDEX ... USING GIN (regions)`) — not applied via Prisma schema as Prisma doesn't support GIN natively

---

## Wave 2: Enum Tightening + Cosecha Field

### POStatus Enum (`prisma/schema.prisma`, `schemas.ts`)
- New enum: `POStatus { PENDIENTE, RECIBIDO, LIQUIDADO }`
- PurchaseOrder.status changed from `String @default("PENDIENTE")` to `POStatus @default(PENDIENTE)`
- `PurchaseOrderCreateSchema` updated to use `POStatusEnum`
- Safe migration: all existing values already match enum members

### ShipmentStatus Enum (`prisma/schema.prisma`, `schemas.ts`)
- New enum: `ShipmentStatus { PREPARACION, EMBARCADO, LIQUIDADO }`
- Shipment.status changed from `ContractStatus @default(NEGOCIACION)` to `ShipmentStatus @default(PREPARACION)`
- `ShipmentCreateSchema` updated to use `ShipmentStatusEnum`
- Data migration needed: `NEGOCIACION/CONFIRMADO/FIJADO/NO_FIJADO` → `PREPARACION`

### Cosecha (Harvest Year) Field
- Added `cosecha String?` to Contract and PurchaseOrder models
- Validation: `z.string().regex(/^\d{2}\/\d{2}$/)` — format "25/26"
- `createContract` and `updateContract` persist cosecha
- `PurchaseOrderCreateSchema` includes cosecha

### Supporting Changes
- `format.ts` — Added `formatShipmentStatus()` and `formatPOStatus()`
- `status-badge.tsx` — Extended to support `type: "contract" | "shipment" | "po"` with PREPARACION/PENDIENTE/RECIBIDO variants
- `excel-import.ts` — Changed shipment status from `ContractStatus.CONFIRMADO` to `"PREPARACION"`

---

## Wave 3: Data Integrity + Staleness Detection

### computedAt / aggregatedAt
- Added `computedAt DateTime?` on Contract — set by `computeContractFields()` on every create/update
- Added `aggregatedAt DateTime?` on Shipment — set by `recalculateShipment()` on every recalculation
- Staleness detection: `updatedAt > computedAt` signals stale computed fields

### MateriaPrimaAllocation Quantity
- Added `quintalesAllocated Decimal? @db.Decimal(10, 2)` to MateriaPrimaAllocation
- `null` = full allocation (backward compatible with current binary behavior)
- New allocations can specify exact quantity for partial allocation across contracts

---

## Wave 4: DB-Level Aggregation

### Dashboard Stats (`dashboard/actions.ts`)
- Replaced `shipments.reduce()` with `prisma.shipment.aggregate()` for totalRevenue and totalUtilidadBruta
- Added separate YTD aggregate query for break-even calculation
- Reduced `recentShipments` query from 12 to 6 rows (only shown in table)

### Monthly Context (`contracts/actions.ts`)
- Split into hybrid approach: `prisma.contract.aggregate()` for KPIs + `findMany` for peer list (capped at 20)
- Eliminates transferring full contract objects just for 4 numeric sums

### Shipment Recalculation
- MP and subproducto sums still use JS reduce (necessary because they feed into the contract calculation loop)
- `aggregatedAt` timestamp added per Wave 3

---

## Wave 5: New Models

### Container Model (`prisma/schema.prisma`)
- Fields: containerNum, blNumber, sealNumber, weightKg, vessel, port, eta, notes
- Relation: Container → Shipment (with `@@index([shipmentId])`)
- Reverse relation added on Shipment: `containers Container[]`
- `Shipment.numContainers` kept as source of truth; container records are optional enrichment

### Container CRUD (`shipments/container-actions.ts` — NEW)
- `getContainers(shipmentId)` — list containers for a shipment
- `createContainer(data)` — validated with `ContainerCreateSchema`
- `deleteContainer(id)` — with audit log

### ContractPriceSnapshot Model (`prisma/schema.prisma`)
- Fields: precioBolsa, diferencial, tipoCambio, posicionBolsa, status, triggeredBy, reason, snapshotAt
- Relation: ContractPriceSnapshot → Contract (with `@@index([contractId, snapshotAt])`)
- Reverse relation added on Contract: `priceSnapshots ContractPriceSnapshot[]`

### Price Snapshot Integration (`contracts/actions.ts`)
- `updateContract` — creates snapshot of current values before updating (reason: "price_update")
- `changeContractStatus` — creates snapshot before status transition (reason: "status_change")
- No backfill needed — snapshots accumulate from deployment forward

### Validation Schema (`schemas.ts`)
- Added `ContainerCreateSchema` with all container fields
- Added `ContainerCreateInput` type export

---

## Files Modified

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | 2 new enums, 2 new models, 7 new fields, 3 new indexes, 2 new relations |
| `src/lib/validations/schemas.ts` | 4 new enums, 1 new schema, cosecha field, status enum swaps |
| `src/app/(dashboard)/contracts/actions.ts` | computedAt, cosecha, exportCostConfigId, price snapshots, DB aggregate |
| `src/app/(dashboard)/dashboard/actions.ts` | Full rewrite to use prisma.aggregate |
| `src/lib/services/shipment-aggregation.ts` | aggregatedAt timestamp |
| `src/lib/services/excel-import.ts` | ShipmentStatus fix |
| `src/lib/utils/format.ts` | formatShipmentStatus, formatPOStatus |
| `src/components/ui/status-badge.tsx` | Multi-type support (contract/shipment/po) |
| `src/app/(dashboard)/shipments/container-actions.ts` | NEW — Container CRUD |

## Verification

- **TypeScript**: 0 errors (`npx tsc --noEmit`)
- **Tests**: 24/24 passing (`npx vitest run`)
- **Prisma**: Client regenerated successfully
- **Backward compatibility**: All new fields are optional with safe defaults (null)
- **Data migration**: Required for Wave 2B (ShipmentStatus) before schema push on existing DB

## Migration Notes

Before running `prisma db push` on an existing database with data:

```sql
-- Wave 2B: Map existing shipment statuses to new ShipmentStatus enum
UPDATE shipments SET status = 'PREPARACION' WHERE status IN ('NEGOCIACION', 'CONFIRMADO', 'FIJADO', 'NO_FIJADO');
-- EMBARCADO and LIQUIDADO map directly
```
