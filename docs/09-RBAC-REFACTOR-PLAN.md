# RBAC Refactor Plan: Field Operator / Financial Operator Separation

> Splitting the monolithic `OPERATOR` role into two domain-specific roles that reflect how HopeCoffee actually operates.
> Integrated with Phase 5A of the Operations Refactor (doc 08).
> Date: 2026-04-10

---

## 1. Problem Statement

The current `OPERATOR` role conflates two fundamentally different jobs:

| Concern | Field Operator (Hector — COO & Sales Manager) | Financial Operator (Octavio — CFO) |
|---------|-----------------------------------------------|-------------------------------------|
| **Primary focus** | Sourcing coffee, validating quality, assembling batches, managing suppliers, creating sales contracts | Pricing contracts, managing margins, optimizing financial costs, exchange rates, P&L |
| **Daily tools** | Inventory, purchase orders, cupping lab, milling orders, supplier accounts, contract creation | Contract pricing, export cost configs, exchange rates, P&L preview, margin reports |
| **Cares most about** | "Does this coffee match what we contracted?" | "Are we making money on this container?" |
| **Touches money** | Purchase prices (cost side) | Sales prices, margins, financial costs (revenue side) |

A single `OPERATOR` role cannot express these boundaries. Both users currently see the same navigation, the same dashboard, and have identical write permissions — forcing each to mentally filter what's relevant. Worse, there is no guardrail preventing a field user from accidentally modifying financial parameters or vice versa.

---

## 2. Design Principles

1. **Both roles see everything — but their surfaces differ.** Primary pages are front-and-center in navigation. Secondary pages require deliberate navigation. Nothing is hidden.
2. **Permission is per-action, not per-page.** A page can be read by both roles but have write actions gated to one.
3. **No linear hierarchy for operators.** `FIELD_OPERATOR` and `FINANCIAL_OPERATOR` are peers, not ranked. Only `ADMIN` outranks both; only `VIEWER` sits below both.
4. **Authorization is declarative.** Every server action declares *what* permission it requires, not *which role number* is needed. The mapping from permission to role lives in one file.
5. **Principle of least privilege with maximum visibility.** Write access is scoped to domain; read access is universal.

---

## 3. New Role Architecture

### 3.1 Prisma Enum Change

```prisma
enum UserRole {
  ADMIN               // Full access: CRUD all entities, manage users, system settings
  FIELD_OPERATOR      // COO/Sales: sourcing, quality, inventory, contract creation
  FINANCIAL_OPERATOR  // CFO: pricing, margins, financial costs, P&L optimization
  VIEWER              // Read-only access: dashboards, reports, exports
}
```

The old `OPERATOR` value is removed. A data migration converts existing `OPERATOR` users.

### 3.2 Permission Model

Replace the linear `ROLE_HIERARCHY` with a **permission-based authorization system**.

#### Permission Enum

Permissions are grouped by domain. Each server action requires exactly one permission.

```typescript
// src/lib/services/permissions.ts

export type Permission =
  // ── Field Domain (FIELD_OPERATOR primary) ──────────────────────
  | "contract:create"           // Only field operator creates contracts
  | "materia_prima:write"       // CRUD raw material lots
  | "subproducto:write"         // CRUD subproductos / milling outputs
  | "container:write"           // CRUD shipping containers
  | "purchase_order:write"      // CRUD purchase orders
  | "supplier_account:write"    // CRUD supplier account entries
  | "farm:write"                // Update farm financing
  | "lot:write"                 // CRUD lots (Phase 5+)
  | "cupping:write"             // CRUD cupping records (Phase 6+)
  | "milling:write"             // CRUD milling orders (Phase 8+)
  | "yield_adjustment:write"    // Approve/reject yield adjustments (Phase 6+)

  // ── Financial Domain (FINANCIAL_OPERATOR primary) ──────────────
  | "contract:update_financial" // Edit pricing, diferencial, costo financiero, comisiones
  | "exchange_rate:write"       // CRUD exchange rates
  | "export_cost:write"         // CRUD export cost configs

  // ── Shared Domain (both operators) ─────────────────────────────
  | "contract:update"           // Edit non-financial contract fields (regions, lote, notes, cosecha)
  | "contract:change_status"    // Transition contract state machine
  | "contract:delete"           // Delete contract (ADMIN only)
  | "shipment:write"            // CRUD shipments
  | "shipment:assign_contract"  // Link/unlink contracts to shipments

  // ── Admin Domain ───────────────────────────────────────────────
  | "user:manage"               // CRUD users, toggle active
  | "audit_log:view"            // View full audit log (both operators + admin)
  | "import:execute"            // Run Excel import
  ;
```

#### Role-to-Permission Map

```typescript
const ROLE_PERMISSIONS: Record<UserRole, Set<Permission>> = {
  ADMIN: new Set([/* all permissions */]),

  FIELD_OPERATOR: new Set([
    // Field domain — full write
    "contract:create",
    "materia_prima:write",
    "subproducto:write",
    "container:write",
    "purchase_order:write",
    "supplier_account:write",
    "farm:write",
    "lot:write",
    "cupping:write",
    "milling:write",
    "yield_adjustment:write",
    // Shared domain
    "contract:update",
    "contract:change_status",
    "shipment:write",
    "shipment:assign_contract",
    // Visibility
    "audit_log:view",
  ]),

  FINANCIAL_OPERATOR: new Set([
    // Financial domain — full write
    "contract:update_financial",
    "exchange_rate:write",
    "export_cost:write",
    // Shared domain
    "contract:update",
    "contract:change_status",
    "shipment:write",
    "shipment:assign_contract",
    // Visibility
    "audit_log:view",
  ]),

  VIEWER: new Set([
    // Read-only — no write permissions
    // All read operations require only requireAuth()
  ]),
};
```

#### Authorization Functions

```typescript
// src/lib/services/auth.ts — revised API

// Unchanged: validates JWT, returns session or redirects
export async function requireAuth(): Promise<Session>;

// NEW: replaces requireRole() — checks a specific permission
export async function requirePermission(permission: Permission): Promise<Session> {
  const session = await requireAuth();
  if (!hasPermission(session.role, permission)) {
    throw new AuthorizationError(
      `Role ${session.role} lacks permission: ${permission}`
    );
  }
  return session;
}

// Pure function for UI-level checks (no redirect, no throw)
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

// DEPRECATED — remove after migration. Callers switch to requirePermission().
export async function requireRole(minimumRole: UserRole): Promise<Session>;
```

**Why `requirePermission` throws instead of redirecting**: Server actions should return structured errors to the client, not trigger navigation. The redirect pattern in `requireRole` was designed for page-level guards; permission checks happen at the action level where a `403` response is more appropriate. A global error boundary or action wrapper catches `AuthorizationError` and returns `{ error: "No tienes permiso para esta accion" }`.

---

## 4. Server Action Migration

Every server action that currently calls `requireRole("OPERATOR")` or `requireRole("ADMIN")` must be migrated to `requirePermission(...)`. Below is the complete mapping.

### 4.1 Contract Actions (`src/app/(dashboard)/contracts/actions.ts`)

| Current Call | Action | New Permission | Rationale |
|---|---|---|---|
| `requireRole("OPERATOR")` | `createContract()` | `requirePermission("contract:create")` | Field operator is Sales Manager — only they create contracts |
| `requireRole("OPERATOR")` | `updateContract()` | Split into two checks (see below) | Financial fields vs. operational fields require different permissions |
| `requireRole("OPERATOR")` | `changeContractStatus()` | `requirePermission("contract:change_status")` | Both operators can transition status |
| `requireRole("ADMIN")` | `deleteContract()` | `requirePermission("contract:delete")` | Stays ADMIN-only |

**`updateContract()` split logic:**

The current `updateContract` accepts all contract fields in a single payload. After refactoring, the function inspects *which fields changed* and requires the appropriate permission:

```typescript
export async function updateContract(id: string, data: ContractUpdateInput) {
  const session = await requireAuth();
  const existing = await prisma.contract.findUniqueOrThrow({ where: { id } });

  // Financial fields: pricing, diferencial, comisiones, costo financiero, tipo cambio
  const FINANCIAL_FIELDS = [
    "precioBolsa", "diferencial", "comisionCompra", "comisionVenta",
    "montoCredito", "cfTasaAnual", "cfMeses", "tipoCambio",
    "gastosPerSaco", "exportTrillaPerQQ", "exportSacoYute", "exportEstampado",
    "exportBolsaGrainPro", "exportFitoSanitario", "exportImpuestoAnacafe1",
    "exportImpuestoAnacafe2", "exportInspeccionOirsa", "exportFumigacion",
    "exportEmisionDocumento", "exportFletePuerto", "exportSeguro",
    "exportCustodio", "exportAgenteAduanal", "exportComisionOrganico",
    "tipoFacturacion", "posicionBolsa",
  ] as const;

  const touchesFinancial = FINANCIAL_FIELDS.some(
    (f) => data[f] !== undefined && data[f] !== toNum(existing[f])
  );

  if (touchesFinancial) {
    requirePermissionSync(session.role, "contract:update_financial");
  } else {
    requirePermissionSync(session.role, "contract:update");
  }

  // ... existing update logic
}
```

This means:
- **Field Operator** can edit: `clientId`, `regions`, `sacos69kg`, `rendimiento`, `puntaje`, `lote`, `cosecha`, `fechaEmbarque`, `notes`, `cooContractName` (Phase 9B)
- **Financial Operator** can edit: all pricing, comisiones, financial cost params, export cost overrides, `tipoCambio`, `posicionBolsa`, `tipoFacturacion`
- **Both** can edit shared fields and transition status

### 4.2 Shipment Actions (`src/app/(dashboard)/shipments/actions.ts`)

| Current Call | Action | New Permission |
|---|---|---|
| `requireRole("OPERATOR")` | `createShipment()` | `requirePermission("shipment:write")` |
| `requireRole("OPERATOR")` | `updateShipment()` | `requirePermission("shipment:write")` |
| `requireRole("ADMIN")` | `deleteShipment()` | `requirePermission("contract:delete")` — reuse admin-only pattern |
| `requireRole("OPERATOR")` | `assignContractToShipment()` | `requirePermission("shipment:assign_contract")` |
| `requireRole("OPERATOR")` | `unassignContractFromShipment()` | `requirePermission("shipment:assign_contract")` |

### 4.3 Materia Prima Actions (`src/app/(dashboard)/shipments/mp-actions.ts`)

| Current Call | Action | New Permission |
|---|---|---|
| `requireRole("OPERATOR")` | `createMateriaPrima()` | `requirePermission("materia_prima:write")` |
| `requireRole("OPERATOR")` | `updateMateriaPrima()` | `requirePermission("materia_prima:write")` |
| `requireRole("OPERATOR")` | `deleteMateriaPrima()` | `requirePermission("materia_prima:write")` |

### 4.4 Subproducto Actions (`src/app/(dashboard)/shipments/sub-actions.ts`)

| Current Call | Action | New Permission |
|---|---|---|
| `requireRole("OPERATOR")` | `createSubproducto()` | `requirePermission("subproducto:write")` |
| `requireRole("OPERATOR")` | `deleteSubproducto()` | `requirePermission("subproducto:write")` |

### 4.5 Container Actions (`src/app/(dashboard)/shipments/container-actions.ts`)

| Current Call | Action | New Permission |
|---|---|---|
| `requireRole("OPERATOR")` | `createContainer()` | `requirePermission("container:write")` |
| `requireRole("OPERATOR")` | `deleteContainer()` | `requirePermission("container:write")` |

### 4.6 Inventory Actions (`src/app/(dashboard)/inventory/actions.ts`)

| Current Call | Action | New Permission |
|---|---|---|
| `requireRole("OPERATOR")` | `createPurchaseOrder()` | `requirePermission("purchase_order:write")` |
| `requireRole("OPERATOR")` | `updatePurchaseOrder()` | `requirePermission("purchase_order:write")` |
| `requireRole("OPERATOR")` | `deletePurchaseOrder()` | `requirePermission("purchase_order:write")` |

### 4.7 Supplier Actions (`src/app/(dashboard)/suppliers/actions.ts`)

| Current Call | Action | New Permission |
|---|---|---|
| `requireRole("OPERATOR")` | `createAccountEntry()` | `requirePermission("supplier_account:write")` |
| `requireRole("OPERATOR")` | `deleteAccountEntry()` | `requirePermission("supplier_account:write")` |

### 4.8 Farm Actions (`src/app/(dashboard)/farms/actions.ts`)

| Current Call | Action | New Permission |
|---|---|---|
| `requireRole("OPERATOR")` | `updateFarm()` | `requirePermission("farm:write")` |

### 4.9 Settings Actions (`src/app/(dashboard)/settings/actions.ts`)

| Current Call | Action | New Permission |
|---|---|---|
| `requireRole("OPERATOR")` | `createExchangeRate()` | `requirePermission("exchange_rate:write")` |
| `requireRole("OPERATOR")` | `createExportCostConfig()` | `requirePermission("export_cost:write")` |
| `requireRole("OPERATOR")` | `updateExportCostConfig()` | `requirePermission("export_cost:write")` |
| `requireRole("ADMIN")` | `getUsers()` | `requirePermission("user:manage")` |
| `requireRole("ADMIN")` | `createUser()` | `requirePermission("user:manage")` |
| `requireRole("ADMIN")` | `toggleUserActive()` | `requirePermission("user:manage")` |
| `requireRole("ADMIN")` | `getAuditLogs()` | `requirePermission("audit_log:view")` |

---

## 5. Database Migration

### 5.1 Prisma Schema Change

```prisma
enum UserRole {
  ADMIN
  FIELD_OPERATOR
  FINANCIAL_OPERATOR
  VIEWER
}
```

### 5.2 Data Migration

```sql
-- Migration: rename OPERATOR to FIELD_OPERATOR for existing users
-- Octavio (octavio@hopecoffee.com) is the CFO — reassign manually after migration
-- All other existing OPERATOR users become FIELD_OPERATOR by default

ALTER TYPE "UserRole" ADD VALUE 'FIELD_OPERATOR';
ALTER TYPE "UserRole" ADD VALUE 'FINANCIAL_OPERATOR';

-- Reassign existing operators (default to FIELD_OPERATOR, then fix Octavio)
UPDATE users SET role = 'FIELD_OPERATOR' WHERE role = 'OPERATOR';

-- After verifying: remove old value
-- Note: PostgreSQL does not support DROP VALUE from enums directly.
-- Prisma handles this via a full enum recreation in the migration.
```

Octavio's role must be updated to `FINANCIAL_OPERATOR` via a separate migration step or seed script after the enum change is applied. This is a one-time manual operation since there are only 2 operator users.

### 5.3 Seed Script Update

```typescript
// prisma/seed.ts — update default admin and add operator seeds
const users = [
  { email: "octavio@hopecoffee.com", name: "Octavio", role: "ADMIN" },
  // Future seeds when creating test/staging environments:
  // { email: "hector@hopecoffee.com", name: "Hector", role: "FIELD_OPERATOR" },
  // { email: "cfo@hopecoffee.com", name: "CFO", role: "FINANCIAL_OPERATOR" },
];
```

---

## 6. Middleware Refactoring

### Current State

```typescript
const ADMIN_ROUTES = ["/settings/users", "/import"];
// Simple role === "ADMIN" check
```

### New State

The middleware remains thin — it only validates authentication and blocks clearly admin-only routes. Fine-grained permission checks happen at the server action level, not in middleware.

```typescript
// src/middleware.ts

const PUBLIC_ROUTES = ["/login"];
const ADMIN_ONLY_ROUTES = ["/settings/users", "/import"];

// Middleware does NOT check operator sub-types.
// Route access is open to all authenticated users.
// Write permissions are enforced at the action level.
```

**Rationale**: Since both operators can *see* everything (per requirement), middleware should not block route access based on operator type. The action-level `requirePermission()` handles write authorization. This keeps middleware simple and avoids duplicating permission logic.

---

## 7. UI Refactoring

### 7.1 Navigation — Role-Aware Ordering

Both operators see all nav items. The difference is **order and grouping** — each role's primary tools appear first.

```typescript
// src/components/layout/app-shell.tsx

function getNavItems(role: UserRole) {
  const FIELD_PRIMARY = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/contracts", label: "Contratos", icon: FileText },
    { href: "/inventory", label: "Inventario", icon: Package },
    { href: "/suppliers", label: "Proveedores", icon: Users },
    { href: "/shipments", label: "Embarques", icon: Ship },
    { href: "/farms", label: "Fincas", icon: TreePine },
    { href: "/reports", label: "Reportes", icon: BarChart3 },
    // Phase 6+: { href: "/quality-lab", label: "Laboratorio", icon: FlaskConical },
    // Phase 8+: { href: "/milling", label: "Tria", icon: Factory },
  ];

  const FINANCIAL_PRIMARY = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/contracts", label: "Contratos", icon: FileText },
    { href: "/shipments", label: "Embarques", icon: Ship },
    { href: "/reports", label: "Reportes", icon: BarChart3 },
    { href: "/inventory", label: "Inventario", icon: Package },
    { href: "/suppliers", label: "Proveedores", icon: Users },
    { href: "/farms", label: "Fincas", icon: TreePine },
  ];

  switch (role) {
    case "FIELD_OPERATOR":
      return FIELD_PRIMARY;
    case "FINANCIAL_OPERATOR":
      return FINANCIAL_PRIMARY;
    default:
      return FIELD_PRIMARY; // ADMIN and VIEWER use field order (superset)
  }
}
```

### 7.2 Settings Navigation — Domain-Specific Access

```typescript
const SETTINGS_ITEMS = [
  { href: "/settings/export-costs", label: "Costos Exportacion", financialOnly: true },
  { href: "/settings/exchange-rates", label: "Tipo de Cambio", financialOnly: true },
  { href: "/settings/audit-log", label: "Auditoria" },  // Both operators + admin
  { href: "/settings/users", label: "Usuarios", adminOnly: true },
  // Phase 7A: { href: "/settings/facilities", label: "Instalaciones", fieldOnly: true },
];

// Filter logic:
SETTINGS_ITEMS.filter((item) => {
  if (item.adminOnly && role !== "ADMIN") return false;
  // Financial-only items: visible to FINANCIAL_OPERATOR and ADMIN
  // Field operators see them in a secondary position (still accessible via URL)
  // No items are truly hidden — just ordered by relevance
  return true;
});
```

**Note**: Nothing is removed from the sidebar. `financialOnly` and `fieldOnly` are used for **ordering within the settings group**, not for hiding. Both operators can always navigate directly to any settings page.

### 7.3 Role Badge Colors

```typescript
const roleBadgeColor: Record<UserRole, string> = {
  ADMIN: "bg-orion-100 text-orion-700 dark:bg-orion-800/50 dark:text-orion-300",
  FIELD_OPERATOR: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  FINANCIAL_OPERATOR: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  VIEWER: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};
```

- **Field Operator**: Emerald green (earth, agriculture, field work)
- **Financial Operator**: Blue (finance, trust, precision — keeps current OPERATOR color)

### 7.4 Role Display Labels

```typescript
const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrador",
  FIELD_OPERATOR: "Operaciones",
  FINANCIAL_OPERATOR: "Finanzas",
  VIEWER: "Consulta",
};
```

### 7.5 Conditional Action Buttons

On pages where both operators have read access but only one can write, action buttons are conditionally rendered using the `hasPermission` helper:

```tsx
// Example: Contract detail page
// "Nuevo Contrato" button — only field operator
{hasPermission(session.role, "contract:create") && (
  <Link href="/contracts/new">Nuevo Contrato</Link>
)}

// "Editar Precio" button — only financial operator
{hasPermission(session.role, "contract:update_financial") && (
  <Button onClick={openPricingModal}>Editar Precio</Button>
)}

// "Cambiar Estado" button — both operators
{hasPermission(session.role, "contract:change_status") && (
  <StatusTransitionButton contract={contract} />
)}
```

The `hasPermission` function is a pure synchronous check — safe to use in client components since the session is passed from the server layout.

### 7.6 Contract Form Split

The current contract form presents all fields at once. After this refactoring:

**Contract creation form** (Field Operator only):
- Client, regions, sacos69kg, rendimiento, puntaje, lote, cosecha, notes
- COO contract name (Phase 9B)
- Financial fields are **present but read-only** with placeholder defaults from ExportCostConfig

**Contract pricing form** (Financial Operator primary):
- precioBolsa, diferencial, posicionBolsa, tipoFacturacion
- comisionCompra, comisionVenta
- montoCredito, cfTasaAnual, cfMeses, tipoCambio
- Export cost overrides (all 15 line items)
- P&L preview (live calculations)

**Implementation**: The existing single form component is refactored into two tab panels or sections. The server action checks which fields changed and requires the appropriate permission. The form itself disables fields the current user cannot edit (using `hasPermission` checks) but still displays them read-only for context.

---

## 8. Dashboard Refactoring

### 8.1 Shared Top-Level KPIs (All Roles)

Always visible at the top of the dashboard for everyone:

| KPI | Source | Description |
|-----|--------|-------------|
| Contratos Activos | Contract count (not CANCELADO/LIQUIDADO) | Pipeline health |
| Contenedores Embarcados | Shipment container sum | Volume throughput |
| Margen Ponderado | `totalUtilidadBruta / totalRevenueQTZ` | Overall profitability |
| Break-even Progress | YTD `utilidadBruta / Q2.5M target` | Annual target tracking |

### 8.2 Role-Prioritized Sections

Below the shared KPIs, the dashboard renders sections **ordered by role relevance**:

#### Field Operator sees first:
1. **Inventario Rapido** — QQ pergamino en bodega, en proceso, oro exportable (Phase 7+)
2. **Contratos Recientes** — contracts they created, status pipeline
3. **Ordenes de Compra Activas** — open POs, pending receipts
4. **Lotes Pendientes de Catacion** — lots awaiting cupping (Phase 6+)
5. *Below the fold*: Recent shipments with financial summaries (read-only context)

#### Financial Operator sees first:
1. **P&L Resumen** — revenue, costs, margin by month (chart)
2. **Embarques Recientes** — shipments with totalPagoQTZ, margenBruto, utilidadBruta
3. **Contratos sin Fijar** — unfixed contracts (price exposure)
4. **Tipo de Cambio Vigente** — current exchange rate + trend
5. *Below the fold*: Inventory summary, purchase order totals (read-only context)

**Implementation**: The dashboard page reads `session.role` and renders sections in role-appropriate order. All sections are always rendered — only the order changes. No tabs, no hidden content.

```tsx
// src/app/(dashboard)/dashboard/page.tsx
const sections = role === "FINANCIAL_OPERATOR"
  ? [PnLSummary, RecentShipments, UnfixedContracts, ExchangeRateWidget, InventorySummary, PurchaseOrderSummary]
  : [InventoryQuick, RecentContracts, ActivePOs, PendingCupping, RecentShipments, PnLSummary];
```

---

## 9. Audit Log Access Refactoring

### Current State

- `getAuditLogs()` requires `requireRole("ADMIN")`
- Audit log page at `/settings/audit-log`

### New State

- `getAuditLogs()` requires `requirePermission("audit_log:view")`
- Both operators and admin have `audit_log:view` permission
- Move audit log to its own top-level route: `/audit-log` (out of settings, since it's not a "setting")
- Add a nav item under a "secondary" section or at the bottom of the sidebar for all roles except VIEWER

```typescript
// Audit log nav item — visible to both operators and admin
{ href: "/audit-log", label: "Auditoria", icon: ScrollText }
```

No domain filtering on the audit log — both operators see all audit entries. The audit log is an accountability tool, not a daily workflow. It should be comprehensive.

---

## 10. Zod Schema Updates

### 10.1 UserRoleEnum

```typescript
// src/lib/validations/schemas.ts
export const UserRoleEnum = z.enum([
  "ADMIN",
  "FIELD_OPERATOR",
  "FINANCIAL_OPERATOR",
  "VIEWER",
]);
```

### 10.2 UserCreateSchema

```typescript
export const UserCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(8),
  role: UserRoleEnum.default("VIEWER"),
});
```

### 10.3 Contract Schemas — No Split

The `ContractCreateSchema` and `ContractUpdateSchema` remain unified. Field/financial separation is enforced at the **action level** (which fields changed), not at the schema level. This avoids schema explosion and keeps validation simple.

---

## 11. Session Type Update

```typescript
// src/lib/services/auth.ts
import type { UserRole } from "@prisma/client";

export interface Session {
  userId: string;
  email: string;
  role: UserRole;  // Now includes FIELD_OPERATOR | FINANCIAL_OPERATOR
  name: string;
}
```

The JWT payload structure is unchanged — only the possible `role` values expand.

---

## 12. Error Handling for Permission Denials

### 12.1 AuthorizationError

```typescript
// src/lib/services/auth.ts
export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}
```

### 12.2 Action-Level Error Handling Pattern

```typescript
// Pattern for every server action with permission checks
export async function createExchangeRate(data: ExchangeRateInput) {
  const session = await requirePermission("exchange_rate:write");
  // ... business logic
}
```

If `requirePermission` throws `AuthorizationError`, the calling form/component receives a structured error. The UI displays a toast or inline message: *"No tienes permiso para esta accion."*

### 12.3 Global Action Wrapper (Optional Enhancement)

A utility wrapper that catches `AuthorizationError` and returns a standardized result:

```typescript
type ActionResult<T> = { data: T } | { error: string };

export function withPermission<T>(
  permission: Permission,
  fn: (session: Session) => Promise<T>
): () => Promise<ActionResult<T>> {
  return async () => {
    try {
      const session = await requirePermission(permission);
      const data = await fn(session);
      return { data };
    } catch (e) {
      if (e instanceof AuthorizationError) {
        return { error: "No tienes permiso para esta accion" };
      }
      throw e;
    }
  };
}
```

---

## 13. Integration with Phase 5A (Operations Refactor)

This RBAC refactor is designed to be implemented as part of Phase 5A from doc 08. The following entities from the operations refactor inherit permissions naturally:

| Phase 5+ Entity | Permission | Granted To |
|---|---|---|
| `Lot` | `lot:write` | FIELD_OPERATOR, ADMIN |
| `CuppingRecord` | `cupping:write` | FIELD_OPERATOR, ADMIN |
| `MillingOrder` | `milling:write` | FIELD_OPERATOR, ADMIN |
| `YieldAdjustment` | `yield_adjustment:write` | FIELD_OPERATOR, ADMIN |
| `Facility` | (managed under settings) | ADMIN |
| `ShipmentParty` | `shipment:write` | FIELD_OPERATOR, FINANCIAL_OPERATOR, ADMIN |

The permission system is designed to be **additive** — new permissions are added to the `Permission` type and mapped to roles without changing existing infrastructure.

---

## 14. Files Changed — Complete Inventory

### Schema & Database
| File | Change |
|---|---|
| `prisma/schema.prisma` | `UserRole` enum: remove `OPERATOR`, add `FIELD_OPERATOR` + `FINANCIAL_OPERATOR` |
| `prisma/migrations/NNNN_rbac_split/` | Enum migration + data migration (OPERATOR -> FIELD_OPERATOR) |
| `prisma/seed.ts` | Update role values in seed data |

### Auth & Permissions (new + modified)
| File | Change |
|---|---|
| `src/lib/services/permissions.ts` | **NEW**: Permission type, ROLE_PERMISSIONS map, hasPermission() |
| `src/lib/services/auth.ts` | Add `requirePermission()`, `AuthorizationError`. Deprecate `requireRole()`. Update Session type. |
| `src/middleware.ts` | Remove `ADMIN_ROUTES` role check for operator sub-types (keep ADMIN-only). Update `x-user-role` header values. |

### Validation Schemas
| File | Change |
|---|---|
| `src/lib/validations/schemas.ts` | Update `UserRoleEnum` values |

### Server Actions (all files under `src/app/(dashboard)/`)
| File | Change |
|---|---|
| `contracts/actions.ts` | `requireRole` -> `requirePermission` for all mutations. Split `updateContract` financial field check. |
| `shipments/actions.ts` | `requireRole` -> `requirePermission` for all mutations |
| `shipments/mp-actions.ts` | `requireRole` -> `requirePermission` |
| `shipments/sub-actions.ts` | `requireRole` -> `requirePermission` |
| `shipments/container-actions.ts` | `requireRole` -> `requirePermission` |
| `inventory/actions.ts` | `requireRole` -> `requirePermission` |
| `suppliers/actions.ts` | `requireRole` -> `requirePermission` |
| `farms/actions.ts` | `requireRole` -> `requirePermission` |
| `settings/actions.ts` | `requireRole` -> `requirePermission`. `getAuditLogs` opens to operators. |
| `dashboard/actions.ts` | No auth change (already `requireAuth`). Add role-specific data queries. |
| `reports/actions.ts` | No auth change (already `requireAuth`). |

### UI Components
| File | Change |
|---|---|
| `src/components/layout/app-shell.tsx` | Role-aware nav ordering, new role badge colors/labels, updated SETTINGS_ITEMS |
| `src/app/(dashboard)/dashboard/page.tsx` | Role-prioritized section ordering |
| `src/app/(dashboard)/contracts/[id]/page.tsx` | Conditional action buttons per permission |
| `src/app/(dashboard)/contracts/new/page.tsx` | Gate with `contract:create` permission |
| `src/app/(dashboard)/contracts/[id]/edit/page.tsx` | Split form sections (field vs. financial), disable fields per role |
| `src/app/(dashboard)/settings/users/page.tsx` | Updated role selector dropdown (4 roles) |
| `src/app/(dashboard)/settings/audit-log/page.tsx` | Move to `/audit-log` route, open to both operators |

### Tests
| File | Change |
|---|---|
| `src/__tests__/` or `tests/` | Add permission unit tests: verify each role's permission set. Test `hasPermission` for all combinations. |

---

## 15. Implementation Order

```
Step 1: Permission Infrastructure
  ├─ Create src/lib/services/permissions.ts (Permission type, ROLE_PERMISSIONS, hasPermission)
  ├─ Update src/lib/services/auth.ts (requirePermission, AuthorizationError, deprecate requireRole)
  └─ Update src/lib/validations/schemas.ts (UserRoleEnum)

Step 2: Prisma Schema + Migration
  ├─ Update UserRole enum in schema.prisma
  ├─ Generate migration (prisma migrate dev)
  └─ Data migration: OPERATOR -> FIELD_OPERATOR, then manually set Octavio to FINANCIAL_OPERATOR

Step 3: Server Action Migration (one file at a time, test after each)
  ├─ contracts/actions.ts (most complex — includes updateContract split)
  ├─ shipments/actions.ts
  ├─ shipments/mp-actions.ts + sub-actions.ts + container-actions.ts
  ├─ inventory/actions.ts
  ├─ suppliers/actions.ts
  ├─ farms/actions.ts
  └─ settings/actions.ts

Step 4: Middleware Update
  └─ Simplify to auth-only + ADMIN route guard

Step 5: UI Updates
  ├─ app-shell.tsx (nav ordering, badge colors, labels)
  ├─ Contract form split (field section vs. financial section)
  ├─ Conditional action buttons across all pages
  ├─ Dashboard section reordering
  ├─ Settings user form (4-role dropdown)
  └─ Audit log route move

Step 6: Seed + Tests
  ├─ Update seed.ts
  ├─ Permission matrix unit tests
  └─ Integration tests for key action+role combinations
```

---

## 16. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Prisma enum migration on live database | High — `ALTER TYPE` can lock the table | Run during low-traffic window. Prisma handles enum recreation gracefully with additive migrations. Test on staging first. |
| Existing JWT tokens contain `role: "OPERATOR"` | Medium — active sessions break after migration | `verifyToken` must handle `OPERATOR` as a legacy value during transition. Map `OPERATOR` -> `FIELD_OPERATOR` in token verification for 24h (one JWT expiry cycle). |
| `updateContract` field-level permission check adds complexity | Medium | The FINANCIAL_FIELDS array is defined once and reused. Unit test covers edge cases (e.g., updating both field and financial data simultaneously — require both permissions). |
| UI conditionals increase component complexity | Low | `hasPermission` is a pure function — easy to test, easy to read. Avoids deeply nested role checks. |
| Future role additions | Low | Permission-based system is additive. New role = new entry in ROLE_PERMISSIONS map. No code changes needed in actions or UI. |

---

## 17. Backward Compatibility — JWT Transition

During the 24-hour window after migration, active sessions will carry `role: "OPERATOR"` in their JWT. The `verifyToken` function must handle this:

```typescript
export async function verifyToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    let role = payload.role as UserRole;

    // Transition: map legacy OPERATOR to FIELD_OPERATOR
    if (role === ("OPERATOR" as string)) {
      role = "FIELD_OPERATOR";
    }

    return {
      userId: payload.userId as string,
      email: payload.email as string,
      role,
      name: payload.name as string,
    };
  } catch {
    return null;
  }
}
```

This fallback can be removed after one JWT expiry cycle (24h). Add a `// REMOVE AFTER 2026-04-12` comment.

---

## 18. Success Criteria

The RBAC refactor is complete when:

- [ ] `OPERATOR` role no longer exists in the database or codebase
- [ ] `FIELD_OPERATOR` can create contracts but cannot modify pricing, diferencial, or financial cost parameters
- [ ] `FINANCIAL_OPERATOR` can modify pricing and financial parameters but cannot create new contracts
- [ ] Both operators can read all pages, edit shipments, and transition contract status
- [ ] Dashboard renders sections in role-prioritized order without hiding any content
- [ ] Navigation order reflects each role's primary workflow
- [ ] Audit log is accessible to both operators on a dedicated page
- [ ] `hasPermission` is the single source of truth for UI conditional rendering
- [ ] `requirePermission` is the single source of truth for server-side authorization
- [ ] All existing tests pass with the new role values
- [ ] New permission matrix tests cover every role+permission combination
- [ ] JWT backward compatibility handles `OPERATOR` tokens for 24h after migration
- [ ] User management page offers all 4 roles in the creation form

---

## 19. Decisions Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Permission-based (not hierarchy-based) RBAC | Two operator roles are peers, not ranked. Linear hierarchy cannot express "FIELD can do X but not Y, FINANCIAL can do Y but not X." |
| 2 | Permissions checked at action level, not middleware | Both roles can see all pages. Write authorization is per-action. Middleware only validates auth + admin routes. |
| 3 | Contract update uses field-level permission check | Avoids splitting into two separate update actions (which would duplicate validation and audit logic). Single action, inspects which fields changed, requires appropriate permission. |
| 4 | Navigation reordering (not hiding) | User requirement: "both can see everything; difference is what they see up front." Hiding creates confusion; ordering creates focus. |
| 5 | Audit log moved out of settings | It is not a configuration page. Both operators + admin access it. Separate route reduces cognitive load. |
| 6 | `hasPermission` as pure function | Usable in both server and client contexts. No async, no side effects. Enables UI conditional rendering without server round-trips. |
| 7 | JWT backward compat with timed removal | Avoids force-logout of all users during migration. Self-cleaning after 24h. |
| 8 | `OPERATOR` fully removed (not aliased) | Clean break. Aliases and backwards-compat shims create confusion. Migration converts all data. |
