# CafeMargen

**Coffee Export Contract & Margin Management System**

A full-stack web application replacing the `Control_Contratos_y_Margenes.xlsx` workbook used to manage Guatemalan specialty coffee export operations — from raw material procurement through export billing and margin analysis.

---

## Why This Exists

The Excel file tracked 14 interconnected sheets with fragile cross-references (`#REF!` errors on PROMEDIO), manual calculations prone to drift, no audit trail, no concurrent access, and no role-based permissions. CafeMargen replaces every sheet with a purpose-built module while adding real-time dashboards, historical audit logs, and team collaboration.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                          │
│  Next.js 15 (App Router) + React 19 + Tailwind CSS  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │Dashboard │ │Contracts │ │Shipments │  ...more    │
│  └──────────┘ └──────────┘ └──────────┘            │
│         │            │            │                  │
│         ▼            ▼            ▼                  │
│  ┌─────────────────────────────────────┐            │
│  │   Server Actions + API Routes       │            │
│  │   (Zod validation at every gate)    │            │
│  └─────────────────────────────────────┘            │
└─────────────────────┬───────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────┐
│                 BUSINESS LOGIC                       │
│  ┌────────────────────┐  ┌────────────────────────┐ │
│  │  Calculation Engine │  │  Shipment Aggregation  │ │
│  │  (Decimal.js)       │  │  Service               │ │
│  └────────────────────┘  └────────────────────────┘ │
└─────────────────────┬───────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────┐
│                 DATA LAYER                           │
│  Prisma ORM → PostgreSQL (Supabase)                  │
│  17 models · Full audit log · Decimal precision      │
└─────────────────────────────────────────────────────┘
```

---

## Module Map (Excel Sheet → App Module)

| Excel Sheet              | App Module         | Route                    | Description                                             |
| ------------------------ | ------------------ | ------------------------ | ------------------------------------------------------- |
| SERENGETTI               | Contracts          | `/contracts`             | All client contracts in one filterable table             |
| SUCAFINA SPECIALTY       | Contracts          | `/contracts`             | Same module, filtered by client                         |
| onyx                     | Contracts          | `/contracts`             | Same module, filtered by client                         |
| Enero–Mayo               | Shipments          | `/shipments`             | Monthly container groupings with full P&L               |
| Negociacion              | Shipments          | `/shipments?status=NEG`  | Filtered view of shipments under negotiation             |
| Hoja3 (Inventario)       | Inventory          | `/inventory`             | Purchase orders + export cost breakdown                  |
| Hoja3 (Costo Export.)    | Export Costs       | `/settings/export-costs` | Configurable export cost templates                       |
| Hoja2 (Fincas)           | Farm Financing     | `/farms`                 | Brisas/San Emiliano loan calculations                    |
| PROMEDIO                 | Dashboard          | `/dashboard`             | Auto-computed consolidated view (no more #REF!)          |
| Hoja1 (Órdenes)          | Inventory          | `/inventory`             | Purchase order summary                                   |
| ESTADO CUENTA KFINOS     | Supplier Accounts  | `/suppliers/[id]`        | Per-supplier account statement                           |

---

## Tech Stack

| Layer      | Technology                    | Why                                                     |
| ---------- | ----------------------------- | ------------------------------------------------------- |
| Framework  | Next.js 15 (App Router)       | SSR + Server Actions                                    |
| UI         | Tailwind CSS + cva            | Plain utility-first CSS with component variants          |
| Tables     | TanStack Table v8             | Excel-like sorting, filtering, column resizing           |
| Forms      | React Hook Form + Zod         | Performant forms with runtime type validation            |
| ORM        | Prisma 6                      | Type-safe DB access, studio                              |
| Database   | PostgreSQL (Supabase)          | Financial-grade ACID, managed PostgreSQL                 |
| Auth       | Custom JWT (jose + bcryptjs)  | Simple, no external deps, role-based                     |
| Math       | Decimal.js                    | No floating-point errors in financial calcs              |
| Testing    | Vitest                        | Fast unit tests for calculation engine                   |

---

## Data Model Summary

**17 Prisma models** organized into 5 domains:

1. **Auth**: `User`, `AuditLog`
2. **Config**: `ExchangeRate`, `ExportCostConfig`
3. **Commercial**: `Client`, `Supplier`
4. **Core**: `Contract`, `Shipment`, `MateriaPrima`, `MateriaPrimaAllocation`, `Subproducto`
5. **Operations**: `PurchaseOrder`, `SupplierAccountEntry`, `Farm`

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your Supabase DATABASE_URL and JWT_SECRET

# 3. Generate Prisma client
npx prisma generate

# 4. Push schema to database
npx prisma db push

# 5. Seed initial data (admin user, clients, suppliers, config)
npm run db:seed

# 6. Run development server
npm run dev
# → http://localhost:3000
```

**Default admin login:** `admin@cafemargen.com` / `CafeMargen2026!`

---

## Project Structure

```
├── prisma/
│   ├── schema.prisma              # 17 models, full domain
│   └── seed.ts                    # Admin user, clients, suppliers, config
├── src/
│   ├── app/
│   │   ├── api/auth/              # Login, logout, me API routes
│   │   ├── (auth)/                # Login page (minimal layout)
│   │   └── (dashboard)/           # Main app layout (protected)
│   │       ├── dashboard/         # KPI cards, recent activity
│   │       ├── contracts/         # Contract CRUD + live calc preview
│   │       ├── shipments/         # P&L view, MP, subproductos
│   │       ├── inventory/         # Purchase orders + cost preview
│   │       ├── suppliers/         # Supplier list + account statements
│   │       ├── farms/             # Farm financing (Brisas, San Emiliano)
│   │       └── settings/          # Exchange rates, users, audit log, export costs
│   ├── components/
│   │   ├── layout/                # AppShell, SidebarLink
│   │   └── ui/                    # Button, Input, Select, Card, DataTable, etc.
│   ├── lib/
│   │   ├── db/                    # Prisma client singleton
│   │   ├── providers/             # React Query provider
│   │   ├── services/              # Business logic
│   │   │   ├── calculations.ts        # All formulas (Decimal.js, 6 functions)
│   │   │   ├── shipment-aggregation.ts # Recalculates shipment totals
│   │   │   ├── auth.ts                # JWT + bcrypt + session management
│   │   │   ├── audit.ts               # Audit log writer
│   │   │   └── excel-import.ts        # XLSX parser (partial)
│   │   ├── utils/
│   │   │   └── format.ts             # Currency, date, status formatters
│   │   └── validations/
│   │       └── schemas.ts             # All Zod schemas
│   └── middleware.ts              # Route protection + role guards
├── docs/                          # Domain model, roadmap, UI patterns, etc.
├── next.config.ts
├── tailwind.config.ts
├── vitest.config.ts
└── package.json
```

---

## Key Patterns

- **Server Actions** for all CRUD — not REST API routes (API only for auth)
- **Server Components by default** — `"use client"` only for forms, tables, interactivity
- **Every mutation**: validate → authorize → compute → persist → audit → revalidate
- **Calculation consistency**: same `calculateContract()` runs client-side (preview) and server-side (persist)
- **Shipment aggregation**: child entity mutations (contract assign, MP add, subproducto add) trigger `recalculateShipment()`
- **Contract state machine**: NEGOCIACION → CONFIRMADO → FIJADO → EMBARCADO → LIQUIDADO (with branches to NO_FIJADO and CANCELADO)

---

## Tests

```bash
npm run test:calcs    # 19 calculation tests against Excel fixture values
npm run typecheck     # Full TypeScript verification
```

---

## Implementation Status

| Phase | Focus | Status |
|-------|-------|--------|
| 0 | Project bootstrap, config | Done |
| 1 | Auth + Layout + Contracts | Done |
| 2 | Shipments + P&L + Aggregation | Done |
| 3 | Inventory + Suppliers | Done |
| 4 | Dashboard + Settings + Farms | Done |
| — | Excel import wizard | Pending (low priority) |
