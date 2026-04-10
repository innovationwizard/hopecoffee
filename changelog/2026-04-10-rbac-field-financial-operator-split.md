# Changelog — 2026-04-10: RBAC Refactor — Field / Financial Operator Split

## Summary

Replaced the monolithic `OPERATOR` role with two domain-specific roles: `FIELD_OPERATOR` (COO/Sales — Hector) and `FINANCIAL_OPERATOR` (CFO — Octavio). Authorization system migrated from linear hierarchy (`requireRole`) to permission-based (`requirePermission`). Both operators see all pages but have different navigation ordering and write access scoped to their domain. Build: 0 errors. Tests: 24/24 passing. DB schema pushed to production.

---

## 1. Permission Infrastructure (New)

Created a permission-based authorization system replacing the old linear role hierarchy.

### New file:

| File | Purpose |
|------|---------|
| `src/lib/services/permissions.ts` | `Permission` type (20 permissions), `ROLE_PERMISSIONS` map per role, `hasPermission()` pure function |

### Permission domains:

- **Field** (FIELD_OPERATOR): `contract:create`, `materia_prima:write`, `subproducto:write`, `container:write`, `purchase_order:write`, `supplier_account:write`, `farm:write`
- **Financial** (FINANCIAL_OPERATOR): `contract:update_financial`, `exchange_rate:write`, `export_cost:write`
- **Shared** (both operators): `contract:update`, `contract:change_status`, `shipment:write`, `shipment:assign_contract`, `audit_log:view`
- **Admin only**: `contract:delete`, `shipment:delete`, `purchase_order:delete`, `user:manage`, `import:execute`

---

## 2. Auth Service Refactor

### File modified: `src/lib/services/auth.ts`

| Change | Detail |
|--------|--------|
| Added `requirePermission(permission)` | Async — validates session then checks permission. Throws `AuthorizationError` on denial. |
| Added `requirePermissionSync(role, permission)` | Sync — for use inside actions that already have a session (e.g., `updateContract` field-level check). |
| Added `AuthorizationError` class | Structured error for permission denials (not a redirect). |
| Added JWT backward compat | `verifyToken` maps legacy `OPERATOR` tokens to `FIELD_OPERATOR` for 24h transition. |
| Removed `requireRole()` | Fully replaced by `requirePermission()` across all server actions. |
| Removed `ROLE_HIERARCHY` | Linear hierarchy no longer applicable — two operator roles are peers. |

---

## 3. Prisma Schema — UserRole Enum

### File modified: `prisma/schema.prisma`

```
Old:  ADMIN | OPERATOR | VIEWER
New:  ADMIN | FIELD_OPERATOR | FINANCIAL_OPERATOR | VIEWER
```

Schema pushed to production via `prisma db push` (session pooler, port 5432). No data loss — zero users had `OPERATOR` role at time of migration.

---

## 4. Server Action Migration (11 files)

Every `requireRole("OPERATOR")` and `requireRole("ADMIN")` call replaced with specific `requirePermission(...)`.

### Files modified:

| File | Changes |
|------|---------|
| `contracts/actions.ts` | `createContract` → `contract:create` (field only). `updateContract` → inspects changed fields: financial fields require `contract:update_financial`, otherwise `contract:update`. `deleteContract` → `contract:delete`. `changeContractStatus` → `contract:change_status`. |
| `shipments/actions.ts` | `createShipment`/`updateShipment` → `shipment:write`. `deleteShipment` → `shipment:delete`. `assignContract`/`unassignContract` → `shipment:assign_contract`. |
| `shipments/mp-actions.ts` | All 3 actions → `materia_prima:write` |
| `shipments/sub-actions.ts` | Both actions → `subproducto:write` |
| `shipments/container-actions.ts` | Both actions → `container:write` |
| `inventory/actions.ts` | Create/update → `purchase_order:write`. Delete → `purchase_order:delete`. |
| `suppliers/actions.ts` | Both actions → `supplier_account:write` |
| `farms/actions.ts` | `updateFarm` → `farm:write` |
| `settings/actions.ts` | Exchange rate → `exchange_rate:write`. Export cost → `export_cost:write`. Users → `user:manage`. Audit logs → `audit_log:view` (opened to both operators). |

### Contract update field-level authorization:

`updateContract` now detects whether the payload touches financial fields (`precioBolsa`, `diferencial`, `comisionCompra`, `tipoCambio`, export cost overrides, etc.) and requires `contract:update_financial` if so. Otherwise, `contract:update` suffices. This enforces the domain boundary at the action level without splitting into two separate update functions.

---

## 5. Middleware Update

### File modified: `src/middleware.ts`

Simplified. Only validates authentication and blocks ADMIN-only routes (`/settings/users`, `/import`). No operator sub-type checks — all route access is open to authenticated users. Write permissions enforced at action level.

---

## 6. UI Updates

### Navigation — Role-Aware Ordering

File: `src/components/layout/app-shell.tsx`

- **Field Operator** nav order: Dashboard, Contratos, Inventario, Proveedores, Embarques, Fincas, Reportes
- **Financial Operator** nav order: Dashboard, Contratos, Embarques, Reportes, Inventario, Proveedores, Fincas
- All items visible to both — only order changes
- Audit log added as sidebar nav item (visible to all except VIEWER)
- Audit log removed from settings submenu

### Role Badge Colors & Labels

| Role | Color | Label |
|------|-------|-------|
| ADMIN | Orion purple | Administrador |
| FIELD_OPERATOR | Emerald green | Operaciones |
| FINANCIAL_OPERATOR | Blue | Finanzas |
| VIEWER | Slate | Consulta |

### Dashboard Section Ordering

File: `src/app/(dashboard)/dashboard/page.tsx`

- Financial Operator sees: Embarques Recientes first, then Contratos Recientes
- Field Operator / Admin / Viewer sees: Contratos Recientes first, then Embarques Recientes
- KPI cards unchanged — shared across all roles

### Audit Log Route

| File | Change |
|------|--------|
| `src/app/(dashboard)/audit-log/page.tsx` | **NEW** — Top-level audit log page, accessible to both operators + admin |
| `src/app/(dashboard)/settings/audit-log/page.tsx` | Replaced with redirect to `/audit-log` |

### User Management

| File | Change |
|------|--------|
| `settings/users/_components/user-create-form.tsx` | Role dropdown updated: Consulta, Operaciones, Finanzas, Administrador |
| `settings/users/page.tsx` | Role badge colors and labels updated for 4 roles |

---

## 7. Validation Schema Update

### File modified: `src/lib/validations/schemas.ts`

`UserRoleEnum` updated from `["ADMIN", "OPERATOR", "VIEWER"]` to `["ADMIN", "FIELD_OPERATOR", "FINANCIAL_OPERATOR", "VIEWER"]`.

---

## 8. Seed Script Update

### File modified: `prisma/seed.ts`

Admin user name updated from "Administrador" to "Octavio".

---

## 9. Production Database Changes

| Action | Detail |
|--------|--------|
| Schema push | `UserRole` enum updated via `prisma db push` (session pooler port 5432) |
| Hector seeded | `hector@hopecoffee.com` / `FIELD_OPERATOR` / active |
| Octavio role | Provided SQL to update to `FINANCIAL_OPERATOR` |

---

## 10. Planning Document

### New file: `docs/09-RBAC-REFACTOR-PLAN.md`

19-section comprehensive plan covering: problem statement, design principles, permission model, server action migration map, database migration, middleware refactoring, UI refactoring (nav, dashboard, forms, badges), audit log access, Zod schema updates, session type, error handling, Phase 5A integration, complete file inventory, implementation order, risks, JWT backward compatibility, success criteria, and decisions log.

---

## Verification

- `prisma generate` — Prisma client regenerated
- `next build` — 0 errors, 31 routes compiled
- `vitest run` — 24/24 tests passing
- `prisma db push` — Schema synced to production
