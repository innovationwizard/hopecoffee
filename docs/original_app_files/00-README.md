# HOPE COFFEE

**Coffee Export Contract & Margin Management System**

A full-stack web application replacing the `Control_Contratos_y_Margenes.xlsx` workbook used to manage Guatemalan specialty coffee export operations — from raw material procurement through export billing and margin analysis.

---

## Why This Exists

The Excel file tracked 14 interconnected sheets with fragile cross-references (`#REF!` errors on PROMEDIO), manual calculations prone to drift, no audit trail, no concurrent access, and no role-based permissions. HOPE COFFEE replaces every sheet with a purpose-built module while adding real-time dashboards, historical audit logs, and team collaboration.

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
│  │  Calculation Engine │  │  Excel Import Service  │ │
│  │  (Decimal.js)       │  │  (XLSX parser)         │ │
│  └────────────────────┘  └────────────────────────┘ │
└─────────────────────┬───────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────┐
│                 DATA LAYER                           │
│  Prisma ORM → PostgreSQL (AWS RDS/Aurora)            │
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
| Hoja3 (Costo Export.)    | Export Costs       | `/inventory/export`      | Configurable export cost templates                       |
| Hoja2 (Fincas)           | Farm Financing     | `/farms`                 | Brisas/San Emiliano loan calculations                    |
| PROMEDIO                 | Dashboard          | `/dashboard`             | Auto-computed consolidated view (no more #REF!)          |
| Hoja1 (Órdenes)          | Inventory          | `/inventory`             | Purchase order summary                                   |
| ESTADO CUENTA KFINOS     | Supplier Accounts  | `/suppliers/[id]/account`| Per-supplier account statement                           |

---

## Tech Stack

| Layer      | Technology                    | Why                                                     |
| ---------- | ----------------------------- | ------------------------------------------------------- |
| Framework  | Next.js 15 (App Router)       | SSR + Server Actions, your existing stack                |
| UI         | Tailwind CSS + shadcn/ui      | Rapid, consistent, enterprise-grade components           |
| Tables     | TanStack Table v8             | Excel-like sorting, filtering, column resizing           |
| Charts     | Recharts                      | Composable chart library for margin dashboards           |
| State      | Zustand + React Query         | Lightweight global state + server state caching          |
| Forms      | React Hook Form + Zod         | Performant forms with runtime type validation            |
| ORM        | Prisma 6                      | Type-safe DB access, migrations, studio                  |
| Database   | PostgreSQL (Aurora)            | Financial-grade ACID, your existing infra                |
| Auth       | Custom JWT (jose + bcrypt)    | Simple, no external deps, role-based                     |
| Math       | Decimal.js                    | No floating-point errors in financial calcs              |
| Deploy     | Vercel (frontend) + AWS (DB)  | Your existing deployment pipeline                        |

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
# 1. Clone and install
git clone <repo-url> hopecoffee && cd hopecoffee
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your PostgreSQL connection string

# 3. Initialize database
npx prisma migrate dev --name init
npx prisma generate

# 4. Import historical data (optional)
# Place Control_Contratos_y_Margenes.xlsx in project root
npm run import:excel

# 5. Seed admin user
npm run db:seed

# 6. Run development server
npm run dev
# → http://localhost:3000
```

---

## Project Structure

```
hopecoffee/
├── prisma/
│   ├── schema.prisma          # 17 models, full domain
│   ├── seed.ts                # Default users + config
│   └── migrations/
├── src/
│   ├── app/
│   │   ├── api/               # API routes (import, export, webhooks)
│   │   ├── (auth)/            # Login, register pages
│   │   └── (dashboard)/       # Main app layout
│   │       ├── dashboard/     # Consolidated overview (replaces PROMEDIO)
│   │       ├── contracts/     # Contract CRUD + margin calcs
│   │       ├── shipments/     # Monthly container management
│   │       ├── inventory/     # Purchase orders + export costs
│   │       ├── suppliers/     # Supplier management + account statements
│   │       ├── farms/         # Farm financing module
│   │       ├── import/        # Excel import wizard
│   │       └── settings/      # Exchange rates, users, export cost configs
│   ├── lib/
│   │   ├── db/                # Prisma client singleton
│   │   ├── services/          # Business logic
│   │   │   ├── calculations.ts    # ALL Excel formulas (Decimal.js)
│   │   │   ├── excel-import.ts    # XLSX parser + migration
│   │   │   ├── contracts.ts       # Contract CRUD + recalc triggers
│   │   │   ├── shipments.ts       # Shipment aggregation
│   │   │   └── audit.ts           # Audit log writer
│   │   ├── utils/             # Formatters, helpers
│   │   ├── validations/       # Zod schemas
│   │   └── types/             # Shared TypeScript types
│   ├── hooks/                 # React hooks (useContracts, useShipments, etc.)
│   └── middleware/            # Auth middleware, role guards
├── package.json
├── .env.example
├── tsconfig.json
└── tailwind.config.ts
```
