# Changelog — 2026-03-06: COFFEE.md Integration + UX Enhancements

## Summary

Incorporated stakeholder requirements from `docs/COFFEE.md` into the running app (8 batches), added ACTION vs ANALYSIS UX distinction, and added data source visibility indicators. TypeScript: 0 errors. Tests: 24/24 passing.

---

## Batch 1-8: COFFEE.md Feature Incorporation

### Schema Changes (`prisma/schema.prisma`)
- Added enums: `TipoFacturacion` (LIBRAS_GUATEMALTECAS, LIBRAS_ESPANOLAS), `PosicionBolsa` (MAR, MAY, JUL, SEP, DEC)
- Added to `Contract`: `tipoFacturacion`, `posicionBolsa`, `comisionCompra`, `comisionVenta`, `montoCredito`
- Added to `ExportCostConfig`: `comisionExportadorOrganico`

### Billing Formula — Libras Españolas (`src/lib/services/calculations.ts`)
- Extended `ContractInput` with `tipoFacturacion?` and `montoCredito?`
- Extended `ContractCalculation` with `comisionCompra`, `comisionVenta`, `totalComision`
- LIBRAS_ESPANOLAS formula: `sacos69 × 69 × 2.2046 × (precioBolsaDif / 100)` — ~$2,000 more per container
- Commission: `sacos46kg × 1.50 USD/quintal` each for buy/sell
- Auto financial cost: `montoCredito × (8%/12) × 2 months / tipoCambio`
- Added `calculateFinancialCost()` standalone function
- Updated `aggregateContracts` to accumulate `totalComision`

### Shipment Aggregation Fix (`src/lib/services/shipment-aggregation.ts`)
- Now passes `tipoFacturacion` and `montoCredito` from each contract to `calculateContract`
- Replaced hardcoded-zero commissions with actual aggregated commission values

### Tests (`src/lib/services/__tests__/calculations.test.ts`)
- 5 new tests (24 total): commissions, LIBRAS_ESPANOLAS billing, default regression, auto financial cost, standalone calculateFinancialCost

### Contract Form & Preview
- `contract-form.tsx` — Added selects for tipoFacturacion, posicionBolsa; input for montoCredito; FIJADO disables price fields
- `calculation-preview.tsx` — Billing type badge, commission rows, ICE placeholder for NEGOCIACION
- `contract-table.tsx` — New columns: tipoFacturacion, posicionBolsa

### Contract Business Rules (`contracts/actions.ts`)
- `changeContractStatus` → FIJADO requires `materiaPrimaAllocations.length > 0`
- `updateContract` → FIJADO blocks changes to precioBolsa, diferencial, posicionBolsa

### Export Cost CRUD (`settings/export-costs/`)
- `export-cost-form.tsx` (NEW) — Create/edit form for all 16 config fields
- `export-costs-client.tsx` (NEW) — Client wrapper with create/edit state management
- `page.tsx` — Rewritten from read-only to fully interactive

### Inventory Weighted Average (`inventory/`)
- `actions.ts` — Added `getAccumulatedPOStats()` using Prisma aggregate
- `page.tsx` — Added 3 summary cards: Total QQ, Costo Acumulado, Precio Promedio Ponderado

### Dashboard Enhancements (`dashboard/`)
- `actions.ts` — Weighted margin (`SUM(utilidadBruta) / SUM(totalRevenue)`), break-even progress (Q2.5M target), `marginAlert` flag
- `page.tsx` — 5 KPI cards (was 4), margin alert banner, break-even progress bar, color-coded margin

### Contract Progress Tracker (NEW)
- `contract-progress.tsx` — 5-step pipeline bar (Negociación → Liquidado), requirements checklist pre-FIJADO, post-fix status messages

### ICE Placeholder
- `calculation-preview.tsx` — "Precio ICE [MES]: -- (integración pendiente Fase 3)" on NEGOCIACION contracts
- `contracts/[id]/page.tsx` — Info banner for NEGOCIACION contracts with posicionBolsa

---

## ACTION vs ANALYSIS UX Distinction

### Problem
Creating a contract felt like "just another line" — no contextual awareness of how it compares to peer contracts in the same time period.

### Solution

#### Monthly Context Panel (`monthly-context.tsx` — NEW)
- 3 KPI cards: contract count, weighted margin, total revenue for current calendar month
- Live delta indicator: "Este contrato supera/está debajo del margen del mes por X%"
- Peer contract list with contract number, client, sacos, margin (color-coded), status badge
- Monthly total sacos for capacity planning

#### Server Action (`getMonthlyContext` in `contracts/actions.ts`)
- Fetches contracts in same calendar month, excludes current contract (via `excludeId`)
- Computes weighted margin, total revenue, total sacos
- Filters out CANCELADO contracts

#### Integration Points
- `contracts/new/page.tsx` — Fetches monthly context for current month
- `contracts/[id]/edit/page.tsx` — Uses contract's `createdAt` month, excludes self
- `contracts/[id]/page.tsx` — Detail view sidebar shows monthly context
- `contract-form.tsx` — Live margin delta updates as user types prices

#### Month Filter (`contract-filters.tsx`)
- Added `<input type="month">` picker to contracts list page
- `getContracts` action accepts `month` filter param (YYYY-MM → date range)
- `contracts/page.tsx` passes month param through

---

## Data Source Visibility Indicators

### Problem
No visual distinction between numbers typed in by humans from external sources vs numbers computed/integrated from other app modules.

### Solution
Added `source` prop to calculation preview rows and contract detail fields:

| Indicator | Meaning | Examples |
|-----------|---------|----------|
| Amber left border | **Input externo** — typed by user, source lives outside app | Precio Bolsa, Diferencial, Sacos 69kg, Tipo de Cambio |
| Blue left border | **Dato del sistema** — computed from another app module | Gastos Export (ExportCostConfig), Comisiones (formula), Costo Financiero |
| No border | **Calculado** — derived from other values on same form | Sacos 46kg, Bolsa+Dif, Facturaciones, Utilidades, Total Pago |

#### Modified Files
- `calculation-preview.tsx` — `Row` component accepts `source?: "external" | "app"`; legend at bottom
- `contracts/[id]/page.tsx` — Each field in detail grid tagged with `source`; legend at bottom

---

## Bug Fixes

1. **Badge variant error** — `calculation-preview.tsx` used `variant="info"` / `variant="default"` but Badge only supports named colors. Fixed to `"blue"` / `"gray"`.
2. **ExportCostForm TypeScript** — `Object.fromEntries()` returns `Record<string, unknown>`. Fixed with `as ExportCostConfigInput` cast.

---

## Final Verification

- **TypeScript**: 0 errors
- **Tests**: 24/24 passing
- **New files**: 5 (`contract-progress.tsx`, `monthly-context.tsx`, `export-cost-form.tsx`, `export-costs-client.tsx`, this changelog)
- **Modified files**: ~20
