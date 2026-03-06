# Guide 02 — Implementation Roadmap

> **Goal**: Build HOPE COFFEE in 4 phases over ~6 weeks. Each phase delivers a usable increment. No big-bang launch — each phase replaces specific Excel sheets.

---

## Phase Overview

```
Phase 1 (Week 1–2)     Foundation + Contracts         Replaces: SERENGETTI, SUCAFINA, Onyx sheets
Phase 2 (Week 2–3)     Shipments + P&L                Replaces: Enero–Mayo, Negociacion sheets
Phase 3 (Week 3–4)     Inventory + Suppliers           Replaces: Hoja3, Hoja1, ESTADO CUENTA KFINOS
Phase 4 (Week 5–6)     Dashboard + Import + Polish     Replaces: PROMEDIO, Hoja2 + Excel import wizard
```

Each phase ends with a deployable, testable increment.

---

## Phase 1: Foundation + Contracts

### Objective
Set up the entire project infrastructure and build the contract management module — the single most-used feature.

### Tasks

**1.1 — Project Setup** (~2 hours)

```bash
npx create-next-app@latest hopecoffee --typescript --tailwind --eslint --app --src-dir
cd hopecoffee
npm install @prisma/client @tanstack/react-query @tanstack/react-table \
  bcryptjs class-variance-authority clsx date-fns decimal.js jose \
  lucide-react next-themes react-hook-form recharts sonner \
  tailwind-merge xlsx zod zustand
npm install -D prisma tsx vitest @types/bcryptjs
npx prisma init
```

Copy the schema from `prisma/schema.prisma` in this scaffold.

```bash
npx prisma migrate dev --name init
npx prisma generate
```

**1.2 — Auth System** (~4 hours)

Minimal but secure. No NextAuth (overkill for 2–5 users).

Implementation plan:
- `src/lib/services/auth.ts` — password hashing (bcryptjs), JWT sign/verify (jose)
- `src/middleware.ts` — route protection, role extraction from JWT
- `src/app/(auth)/login/page.tsx` — login form
- `src/app/api/auth/login/route.ts` — POST endpoint, returns JWT in httpOnly cookie

Role guard pattern:
```typescript
// src/lib/services/auth.ts
export function requireRole(role: UserRole) {
  return async function guard() {
    const session = await getSession();
    if (!session || !hasRole(session.user.role, role)) {
      redirect("/login");
    }
    return session;
  };
}
```

**1.3 — Prisma Client Singleton** (~30 min)

```typescript
// src/lib/db/index.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query"] : [],
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

**1.4 — Dashboard Layout** (~3 hours)

Build the app shell:
- Sidebar with navigation (Contracts, Shipments, Inventory, Suppliers, Farms, Dashboard, Settings)
- Top bar with user info, role badge, logout
- Responsive: collapsible sidebar on mobile
- Dark/light theme toggle (next-themes)

**1.5 — Contract CRUD** (~8 hours)

This is the big deliverable. Build it right — every other module follows this pattern.

Pages:
- `/contracts` — paginated table with sorting, filtering, search
- `/contracts/new` — creation form
- `/contracts/[id]` — detail view with inline editing
- `/contracts/[id]/edit` — full edit form

Table columns (matching Excel):
```
Cliente | Contrato | Status | Puntaje | Sacos 69kg | Sacos 46kg | Bolsa | Dif | 
Bolsa+Dif | Fact. Lbs | Fact. Kgs | Gastos Export | Utilidad | Costo Fin | 
Utilidad s/CF | T.C. | Total Pago Q
```

Key behaviors:
- **Auto-calculation**: When user enters `sacos69kg`, `precioBolsa`, `diferencial`, all downstream fields auto-compute using the calculation engine. This is the "Excel feel" — instant feedback.
- **Status badge**: Color-coded pill (green=FIJADO, yellow=CONFIRMADO, red=NEGOCIACION, blue=EMBARCADO, gray=LIQUIDADO).
- **Filters**: By client, status, date range, region, puntaje range.
- **Bulk actions**: Change status, assign to shipment.

Server actions:
```typescript
// src/app/(dashboard)/contracts/actions.ts
"use server";

export async function createContract(data: ContractFormData) {
  const session = await requireRole("OPERATOR")();
  const validated = ContractSchema.parse(data);
  const calcs = calculateContract({ ... });
  
  const contract = await prisma.contract.create({
    data: { ...validated, ...calcs, /* spread computed fields */ },
  });
  
  await auditLog(session.user.id, "CREATE", "Contract", contract.id, null, contract);
  revalidatePath("/contracts");
  return contract;
}
```

**1.6 — Calculation Engine Tests** (~2 hours)

Write vitest tests for EVERY formula using known values from the Excel:

```typescript
// src/lib/services/__tests__/calculations.test.ts
import { describe, it, expect } from "vitest";
import { calculateContract } from "../calculations";

describe("calculateContract", () => {
  it("matches SERENGETTI P40129 row exactly", () => {
    const result = calculateContract({
      sacos69kg: 275,
      puntaje: 82,
      precioBolsa: 376,
      diferencial: 40,
      gastosExportPerSaco: 9487.5 / 275, // Back-calculate from Excel
      tipoCambio: 7.65,
    });
    
    expect(result.sacos46kg.toNumber()).toBe(412.5);
    expect(result.precioBolsaDif.toNumber()).toBe(416);
    expect(result.facturacionLbs.toNumber()).toBe(171600);
    // Allow small tolerance for kgs conversion factor
    expect(result.facturacionKgs.toNumber()).toBeCloseTo(174022.31, 0);
  });
});
```

### Milestone Checkpoint
At the end of Phase 1, you should be able to:
- Log in with admin credentials
- Create, view, edit, and list contracts
- See all computed fields update in real-time as you type
- Filter and sort the contract table
- Verify calculations match the Excel exactly

---

## Phase 2: Shipments + P&L

### Objective
Build the monthly shipment grouping system with full profit & loss calculation. This replaces the Enero–Mayo and Negociacion sheets.

### Tasks

**2.1 — Shipment CRUD** (~6 hours)

Pages:
- `/shipments` — card grid or table of all shipments by month/year
- `/shipments/new` — create shipment (month, year, containers, region, export cost config)
- `/shipments/[id]` — the big one: full P&L view

The shipment detail page is the most complex screen. It mirrors the Excel monthly sheet layout:

```
┌─────────────────────────────────────────────────────────┐
│  SHIPMENT: Enero 2026                                    │
│  Status: CONFIRMADO    Containers: 3    Region: Mixed    │
├─────────────────────────────────────────────────────────┤
│  CONTRACTS                                               │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Swiss Water  P30172  82pts  290 sacos  $387 ...  │    │
│  │ Serengetti   P40028  82pts  275 sacos  $373 ...  │    │
│  │ Serengetti   P40022  83pts  275 sacos  $386 ...  │    │
│  ├─────────────────────────────────────────────────┤    │
│  │ TOTALS       840 sacos  Q3,497,659              │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  MATERIA PRIMA                                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │ José David  82pts  412.5 oro  1.32  Q2,005 ...   │    │
│  │ José David  82pts   22.5 oro  1.32  Q2,005 ...   │    │
│  │ José David  82pts  412.5 oro  1.32  Q2,005 ...   │    │
│  │ K-Finos     83pts  412.5 oro  1.32  Q2,005 ...   │    │
│  ├─────────────────────────────────────────────────┤    │
│  │ TOTAL MP    1260 oro    Q3,338,117              │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  MARGIN ANALYSIS                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Materia Prima:        -Q3,338,117               │    │
│  │ Comisión:                -Q28,917               │    │
│  │ Subproducto:                  Q0                │    │
│  │ ─────────────────────────────────                │    │
│  │ UTILIDAD BRUTA:         Q130,625                │    │
│  │ MARGEN BRUTO:              3.50%                │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

**2.2 — Contract ↔ Shipment Assignment** (~3 hours)

- Drag-and-drop or multi-select to assign contracts to shipments
- When a contract is assigned, the shipment auto-recalculates all aggregates
- Unassigned contracts appear in a "pipeline" sidebar

**2.3 — Materia Prima Management** (~4 hours)

- Add/edit/remove MP entries per shipment
- Link MP entries to suppliers
- Auto-compute `pergamino` and `totalMP` fields
- Supplier allocation tracking (which MP goes to which contract)

**2.4 — Subproducto Entries** (~2 hours)

- Simple form per shipment: containers, oro/container, price
- Auto-compute totals

**2.5 — Shipment Aggregation Engine** (~3 hours)

Server-side function that recalculates ALL shipment totals whenever any child entity changes:

```typescript
export async function recalculateShipment(shipmentId: string) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: { contracts: true, materiaPrima: true, subproductos: true },
  });
  
  // Aggregate contracts
  // Sum materia prima
  // Sum subproductos
  // Calculate margin
  // Update shipment record
}
```

This must be called after: contract create/update/delete, MP create/update/delete, subproducto changes.

### Milestone Checkpoint
At the end of Phase 2:
- Create monthly shipments and assign contracts to them
- See the full P&L per shipment, exactly matching the Excel
- Add materia prima lots with supplier attribution
- See gross margin calculated automatically

---

## Phase 3: Inventory + Suppliers

### Objective
Replace Hoja3 (inventory + export costs), Hoja1 (purchase order summary), and ESTADO CUENTA KFINOS.

### Tasks

**3.1 — Purchase Order Management** (~5 hours)

Pages:
- `/inventory` — table of all purchase orders
- `/inventory/new` — create PO form
- `/inventory/[id]` — detail with cost breakdown

Fields matching Hoja3:
```
Order # | Quintales Perg. | Precio | Total Café | Flete/QQ | Total Flete | 
Seguridad | Seguro | Cadena | Cargas | Descargas | Costo Total | Precio Promedio
```

**3.2 — Export Cost Configuration** (~3 hours)

Pages:
- `/settings/export-costs` — list of templates
- Create/edit templates with all 15+ cost items
- Assign default template to new shipments
- Override per shipment

**3.3 — Supplier Management** (~3 hours)

Pages:
- `/suppliers` — list of all suppliers
- `/suppliers/[id]` — detail + account statement

**3.4 — Supplier Account Statement (Estado de Cuenta)** (~4 hours)

The K-Finos sheet has a specific structure: 3 parallel columns of delivery entries.

Build as:
- Filterable table: date, order code, ingreso #, pergamino weight, price, total
- Summary row per order code
- Grand total
- Date range filter
- Export to CSV/PDF (future)

**3.5 — Inventory Dashboard Widget** (~2 hours)

- Total pergamino in inventory
- Weighted average cost
- Committed vs. available stock

### Milestone Checkpoint
At the end of Phase 3:
- Full purchase order tracking with all-in cost calculation
- Configurable export cost templates
- Supplier account statements matching K-Finos Excel exactly
- Inventory overview

---

## Phase 4: Dashboard + Import + Polish

### Objective
Build the consolidated dashboard (replaces broken PROMEDIO sheet), the Excel import wizard, farm financing, and polish everything for production.

### Tasks

**4.1 — Consolidated Dashboard** (~6 hours)

Route: `/dashboard`

This replaces PROMEDIO but actually works (no #REF! errors). Auto-computed from live data.

Widgets:
- **Pipeline Summary**: contracts by status (donut chart)
- **Monthly Revenue**: bar chart of total_pago_qtz by month
- **Margin Trend**: line chart of gross margin % by shipment
- **Top Clients**: ranked by revenue
- **Active Contracts Table**: filtered to CONFIRMADO + FIJADO
- **KPI Cards**: Total revenue YTD, avg margin, containers shipped, active contracts

**4.2 — Excel Import Wizard** (~5 hours)

Route: `/import`

Step-by-step wizard:
1. Upload `.xlsx` file
2. Preview detected sheets and data counts
3. Map/confirm field mappings
4. Dry run — show what will be created (counts + sample rows)
5. Execute import with progress bar
6. Show results: created, skipped, errors

Use the `excel-import.ts` service as the backend.

**4.3 — Farm Financing Module** (~3 hours)

Route: `/farms`

Simple CRUD for the two farms (Brisas, San Emiliano) with the financing calculations. This is a small module — a single page with editable rows and computed columns.

**4.4 — Audit Log Viewer** (~2 hours)

Route: `/settings/audit-log`

Filterable table showing who changed what, when. Essential for a multi-user system.

**4.5 — Exchange Rate Management** (~2 hours)

Route: `/settings/exchange-rates`

- Set current rate
- History of past rates
- Each rate has a valid date range
- Contracts reference the rate at time of creation/fixing

**4.6 — Polish & Testing** (~4 hours)

- Responsive layout testing (mobile, tablet)
- Error boundaries on all pages
- Loading skeletons (not spinners)
- Empty states with helpful CTAs
- Keyboard shortcuts (Ctrl+N for new contract, etc.)
- Toast notifications for all CRUD operations
- Final calculation verification against Excel values

### Milestone Checkpoint
At the end of Phase 4:
- Dashboard shows real-time consolidated metrics
- Historical data imported from Excel
- All 14 Excel sheets fully replaced
- Multi-user access with audit trail
- Production-ready

---

## Deployment Checklist

```
□ PostgreSQL on AWS RDS/Aurora provisioned
□ DATABASE_URL set in Vercel environment variables
□ prisma migrate deploy run against production DB
□ JWT_SECRET generated and set
□ Admin user seeded
□ Historical Excel data imported
□ DNS configured (e.g., hopecoffee.yourdomain.com)
□ Vercel deployment verified
□ Team users created with appropriate roles
□ Quick training session with team (30 min max — it should be intuitive)
```
