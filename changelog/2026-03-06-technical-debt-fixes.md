# Changelog — 2026-03-06: Technical Debt Fixes

## Summary

Resolved all technical debt identified during codebase audit: missing UI surfaces for new schema fields, type safety violations, unsafe audit logging casts, i18n inconsistency, and missing CRUD components. TypeScript: 0 errors. Tests: 24/24 passing.

---

## 1. Cosecha Field — Full UI Wiring

The `cosecha` field (harvest year, format `YY/YY`) was added to the schema in the DB enhancement waves but never surfaced in the UI.

### Files modified:

| File | Change |
|------|--------|
| `contracts/_components/contract-form.tsx` | Added cosecha Input field + defaultValue |
| `contracts/_components/contract-table.tsx` | Added cosecha column (after posicionBolsa) |
| `contracts/_components/contract-filters.tsx` | Added cosecha text filter input |
| `contracts/[id]/page.tsx` | Added cosecha to detail fields array |
| `contracts/page.tsx` | Added `cosecha` to searchParams type and getContracts call |
| `contracts/actions.ts` | Added `cosecha` filter to getContracts where clause |
| `inventory/_components/po-form.tsx` | Added cosecha Input field + defaultValue |
| `lib/validations/schemas.ts` | Added `cosecha` to `ContractFilterSchema` |

---

## 2. Shipment Status Dropdown

Shipment form lacked a status selector — shipments were stuck at `PREPARACION`.

### Files modified:

| File | Change |
|------|--------|
| `shipments/_components/shipment-form.tsx` | Added `STATUS_OPTIONS` array, `status` defaultValue, and `<Select>` field |

---

## 3. ContainersSection Component (NEW)

Container CRUD actions existed (`container-actions.ts`) but had no UI.

### Files created/modified:

| File | Change |
|------|--------|
| `shipments/_components/containers-section.tsx` | **NEW** — Table display + inline create form for containers |
| `shipments/[id]/page.tsx` | Integrated `ContainersSection` in CollapsibleSection |
| `shipments/actions.ts` | Added `containers` to `getShipment` include |

---

## 4. Price History Section (NEW)

`ContractPriceSnapshot` records were created on updates/status changes but never displayed.

### Files created/modified:

| File | Change |
|------|--------|
| `contracts/_components/price-history.tsx` | **NEW** — Table showing snapshot date, reason, status, bolsa, dif, T.C., posicion |
| `contracts/[id]/page.tsx` | Integrated `PriceHistory` below contract details (conditional on snapshots existing) |
| `contracts/actions.ts` | Added `priceSnapshots` to `getContract` include (desc by snapshotAt, take 20) |

---

## 5. PO Form Type Safety

The PO form had `@ts-expect-error` for date coercion and `eslint-disable` + `as any` on `onSubmit`.

### Root cause:
`z.coerce.date()` makes `z.input` produce `unknown` for the date field, conflicting with HTML date inputs (strings).

### Fix:
- Defined `POFormValues` as `Omit<z.infer<...>, "date"> & { date: string }`
- Cast resolver: `zodResolver(schema) as unknown as Resolver<POFormValues>`
- Typed `onSubmit(data: POFormValues)` — no more `any`

### Files modified:

| File | Change |
|------|--------|
| `inventory/_components/po-form.tsx` | Removed `@ts-expect-error`, `eslint-disable`, and `as any`. Proper type definitions. |

---

## 6. PurchaseOrderUpdateSchema + updatePurchaseOrder Fix

`updatePurchaseOrder` used `PurchaseOrderCreateSchema` (requiring all fields) and returned `void`.

### Fix:
- Added `PurchaseOrderUpdateSchema = PurchaseOrderCreateSchema.partial().extend({ id: z.string().cuid() })`
- Added `PurchaseOrderUpdateInput` type export
- Rewrote `updatePurchaseOrder` to use partial schema with field merging from existing record
- Now returns the updated PO

### Files modified:

| File | Change |
|------|--------|
| `lib/validations/schemas.ts` | Added `PurchaseOrderUpdateSchema` + `PurchaseOrderUpdateInput` type |
| `inventory/actions.ts` | Rewrote `updatePurchaseOrder` with proper partial update + return |

---

## 7. Audit Logging — Eliminated `as object` Casts

18 occurrences of `as object` across 8 action files, caused by `createAuditLog` accepting `object | null` while callers passed Prisma model instances (with `Decimal` fields) or Zod outputs.

### Root fix:
Changed `createAuditLog` signature from `(... oldValue?: object | null, newValue?: object | null)` to `(... oldValue?: unknown, newValue?: unknown)` with internal `JSON.parse(JSON.stringify())` serialization to safely convert Decimals and other non-JSON types.

### Files modified:

| File | `as object` removed |
|------|---------------------|
| `lib/services/audit.ts` | Rewritten — `unknown` params + `toJsonSafe()` helper |
| `shipments/actions.ts` | 3 casts removed |
| `shipments/container-actions.ts` | 1 cast removed |
| `shipments/mp-actions.ts` | 3 casts removed |
| `shipments/sub-actions.ts` | 1 cast removed |
| `inventory/actions.ts` | 3 casts removed |
| `suppliers/actions.ts` | 1 cast removed |
| `farms/actions.ts` | 2 casts removed |
| `settings/actions.ts` | 4 casts removed |

---

## 8. i18n Inconsistency

`changeContractStatus` threw English error `"Cannot transition from X to Y"` while all other messages were Spanish.

### Fix:
Changed to `"No se puede cambiar de ${existing.status} a ${newStatus}."` in `contracts/actions.ts`.

---

## Verification

- **TypeScript**: 0 errors (`npx tsc --noEmit`)
- **Tests**: 24/24 passing (`npx vitest run`)
- **No breaking changes**: All new fields optional, all schema changes additive
- **No `as object`**: 0 occurrences remaining in `src/`
- **No `@ts-expect-error`**: 0 occurrences remaining in `src/`
- **No `eslint-disable`**: 0 occurrences remaining in form files
