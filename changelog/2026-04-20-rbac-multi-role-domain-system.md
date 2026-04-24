# Changelog — 2026-04-20: RBAC Refactor — Multi-Role Domain System

## Summary

Replaced the 4-role single-field RBAC (`ADMIN`, `FIELD_OPERATOR`, `FINANCIAL_OPERATOR`, `VIEWER`) with a 10-role domain-specific multi-role system backed by a `UserRoleAssignment` join table. Each user now holds N roles; effective permissions are the union of all assignments. Permission catalog expanded from 24 to ~90 permissions across 15 domains. Refactor designed against `hopecoffee-rbac-proposal.md`, applied to prod via hand-written SQL migration with full backup, verified, and deployed. Build: 0 errors. Tests: 29/29 passing. Smoke test: all three users log in with correct badges and access.

---

## 1. Design Alignment

Before implementation, three decisions were resolved with the user:

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Multi-role storage | `UserRoleAssignment` join table (not Postgres array) | Auditability, data integrity, complex authorization logic — enterprise-grade. |
| `materia_prima:write` / `subproducto:write` | Keep existing permission strings, map to new roles | Existing server actions already reference them; migration per proposal §6 step 4 ("add new permissions as new features ship"). |
| Future roles in enum | Include `LOGISTICA` and `LAB_ASISTENTE` from day one | Per proposal §2.9 — prevents scope creep on existing roles. |

Source of truth: `hopecoffee-rbac-proposal.md` (reference design document, pending José Herrera interview).

---

## 2. Prisma Schema — New UserRole Enum + Join Table

### File modified: `prisma/schema.prisma`

```
Old UserRole:  ADMIN | FIELD_OPERATOR | FINANCIAL_OPERATOR | VIEWER
New UserRole:  MASTER | GERENCIA | FINANCIERO | COMPRAS | VENTAS
               | LAB | ANALISIS | CONTABILIDAD | LOGISTICA | LAB_ASISTENTE
```

### New model: `UserRoleAssignment`

```prisma
model UserRoleAssignment {
  id         String   @id @default(cuid())
  userId     String
  role       UserRole
  assignedBy String?  // userId who granted this role (null = system/seed)
  assignedAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, role])
  @@index([userId])
  @@map("user_role_assignments")
}
```

### Removed:

- `User.role` column — replaced by `User.roleAssignments` relation (many-to-many via join table)

---

## 3. Permission Catalog Rewrite

### File modified: `src/lib/services/permissions.ts` (432 line rewrite)

Expanded from 24 permissions in 4 domains to ~90 permissions in 15 domains. Permissions marked `(★)` are in active use by existing server actions; the rest are defined for features shipping in future phases.

### Permission domains:

- **Dashboard & Reports** — `dashboard:read`, `report:create`, `report:read`
- **Sales Contracts** — `contract:create`, `contract:write`, `contract:update_financial`, `contract:change_status`, `contract:read`, `contract:lot_allocate`, `contract:delete`
- **Purchase Orders** — `purchase_order:create/write/close/read/delete/version_history`
- **Receipts** — `receipt:create/read/assign_to_oc/split/reassign`
- **Quality & Lab** — `cupping:create/write/read`, `sample:create/write/read`, `yield_adjustment:create/write/read`
- **Milling** — `milling:create/write/read/result_write`
- **Inventory** — `inventory:read`, `inventory:update_quality`
- **Lots & Containers** — `lot:create/write/read`, `container:write/lot_assign/read`
- **Shipments & Logistics** — `shipment:write/read/assign_contract/party_write/delete`, `booking:write/read`, `sack_design:write/approve/read`
- **Financial & Cost** — `materia_prima:write`, `subproducto:write`, `cost:read/write/prorate/exclude_oc`, `margin:read/write/configure`, `exchange_rate:write`, `export_cost:write`
- **Payments & Accounting** — `payment:write/read/reconcile`, `accounting:write/read`, `export_document:write/read`
- **Entities** — `supplier:write/read`, `supplier_account:write`, `farm:write/read`, `fiscal_entity:write/read`, `crm:write/read`
- **Market** — `market:write/read`
- **Delivery** — `delivery:write/read`
- **System Administration** — `user:manage`, `audit_log:view`, `import:execute`, `facility:manage`, `system:configure`

### Role → Permission mappings:

| Role | Permission count | Domain focus |
|------|------------------|--------------|
| `MASTER` | ~90 (union of all) | Developer / system owner |
| `GERENCIA` | 18 read-only | CEO dashboards with full drill-down |
| `FINANCIERO` | 5 | CFO active financial controls |
| `COMPRAS` | 19 | Sourcing & purchasing lifecycle |
| `VENTAS` | 23 | Sales & CRM |
| `LAB` | 17 | Quality lab & milling |
| `ANALISIS` | 24 | Financial analysis & reporting |
| `CONTABILIDAD` | 14 | Payments, journal entries, fiscal |
| `LOGISTICA` | 11 | Shipment logistics (future) |
| `LAB_ASISTENTE` | 9 | Lab data entry & QC (future) |

### API changes:

| Before | After |
|--------|-------|
| `hasPermission(role: UserRole, permission)` | `hasPermission(roles: UserRole[], permission)` — checks union |
| *(no single-role helper)* | `roleHasPermission(role, permission)` — for UI role-specific rendering |

---

## 4. Auth Service Refactor

### File modified: `src/lib/services/auth.ts`

| Change | Detail |
|--------|--------|
| `Session` interface | `role: UserRole` → `roles: UserRole[]` |
| `signToken` / `verifyToken` | JWT payload carries `roles` array |
| `requirePermission(permission)` | Throws with role list in message on denial |
| `requirePermissionSync(roles, permission)` | Takes `UserRole[]` instead of single role |
| Removed legacy OPERATOR shim | 2026-04-12 transition window expired |

---

## 5. Login Route — Query Assignments into JWT

### File modified: `src/app/api/auth/login/route.ts`

Login now includes role assignments in the user query and maps them into the JWT:

```ts
const user = await prisma.user.findUnique({
  where: { email },
  include: { roleAssignments: { select: { role: true } } },
});
const roles = user.roleAssignments.map((ra) => ra.role);
const token = await signToken({ userId, email, roles, name });
```

---

## 6. Middleware — Permission-Based Route Guarding

### File modified: `src/middleware.ts`

Replaced `session.role !== "ADMIN"` string comparison with `!hasPermission(session.roles, "user:manage")`. Headers updated: `x-user-roles` (comma-joined) replaces `x-user-role`.

---

## 7. Contracts Server Action — Multi-Role Sync Checks

### File modified: `src/app/(dashboard)/contracts/actions.ts`

Field-level authorization in `updateContract`:

```ts
if (touchesFinancial) {
  requirePermissionSync(session.roles, "contract:update_financial");
} else {
  requirePermissionSync(session.roles, "contract:write");
}
```

Rename `contract:update` → `contract:write` aligned with proposal catalog §3.2.

---

## 8. App Shell — Multi-Role UI

### File modified: `src/components/layout/app-shell.tsx` (full rewrite of role logic)

| Change | Detail |
|--------|--------|
| `ROLE_LABELS` | Updated for all 10 new roles with Spanish labels |
| Navigation | Single list for all roles (no role-specific ordering yet) |
| Role badge | Multi-role display — joins labels with ` / ` (e.g., "Gerencia / Finanzas") |
| Badge color | Picks highest-priority role (MASTER > GERENCIA/FINANCIERO > VENTAS/LAB > COMPRAS > ANALISIS/CONTABILIDAD > other) |
| Audit log link | `hasPermission(session.roles, "audit_log:view")` instead of `role !== "VIEWER"` |
| Settings users link | `hasPermission(session.roles, "user:manage")` instead of `role === "ADMIN"` |
| Import link | Gated by `import:execute` permission |

---

## 9. Dashboard — Role-Aware Section Ordering

### File modified: `src/app/(dashboard)/dashboard/page.tsx`

```ts
const isFinancial =
  session.roles.includes("FINANCIERO") ||
  session.roles.includes("ANALISIS") ||
  session.roles.includes("GERENCIA");
```

Financial-leaning users (any of 3 roles) see Embarques first; everyone else sees Contratos first.

---

## 10. Settings — User Management with Join Table

### Files modified:

| File | Change |
|------|--------|
| `settings/actions.ts` | `getUsers` now includes `roleAssignments`. `createUser` creates assignments via nested `roleAssignments.create: roles.map(...)` |
| `settings/users/page.tsx` | Displays multi-role badges; updated labels + colors for all 10 roles |
| `settings/users/_components/user-create-form.tsx` | Replaced single-select dropdown with multi-select checkboxes for 10 roles |

---

## 11. Validation Schema Update

### File modified: `src/lib/validations/schemas.ts`

```ts
// Old
UserRoleEnum = z.enum(["ADMIN", "FIELD_OPERATOR", "FINANCIAL_OPERATOR", "VIEWER"])
UserCreateSchema: { ..., role: UserRoleEnum.default("VIEWER") }

// New
UserRoleEnum = z.enum(["MASTER", "GERENCIA", "FINANCIERO", "COMPRAS", "VENTAS",
                       "LAB", "ANALISIS", "CONTABILIDAD", "LOGISTICA", "LAB_ASISTENTE"])
UserCreateSchema: { ..., roles: z.array(UserRoleEnum).min(1, "At least one role is required") }
```

---

## 12. Seed Script Update

### File modified: `prisma/seed.ts`

```ts
create: {
  email: "octavio@hopecoffee.com",
  name: "Octavio",
  passwordHash: defaultPassword,
  roleAssignments: {
    create: [
      { role: "GERENCIA" },
      { role: "FINANCIERO" },
    ],
  },
},
```

---

## 13. Production Migration Artifacts

### New directory: `prisma/migrations/20260420_rbac_multi_role/`

| File | Purpose |
|------|---------|
| `migration.sql` | Forward migration — atomic transaction, idempotency preflight guards, backfill, orphan verification, MASTER user creation, column drop, legacy type drop |
| `rollback.sql` | Inverse migration — preflight abort on non-reversible role combos, inverse-backfill, NOT NULL restoration |
| `verify.sql` | 6 post-condition checks with expected results |
| `README.md` | Phase-by-phase runbook with checkboxes and rollback procedures |

### Migration design properties:

- **Atomic** — single `BEGIN … COMMIT`, auto-rolls back on any failure
- **Idempotent** — preflight checks abort with clear message if migration already applied or post-state detected
- **Verified mid-flight** — orphan check (`RAISE EXCEPTION` if any user has 0 role assignments) before destructive column drop
- **Lossy-safe rollback** — `rollback.sql` aborts if it encounters any role combination that did not originate from the forward migration's backfill (new users created mid-flight)

### Role backfill mapping:

| Legacy role | New roles |
|-------------|-----------|
| `FINANCIAL_OPERATOR` (Octavio) | `GERENCIA` + `FINANCIERO` |
| `FIELD_OPERATOR` (Hector) | `VENTAS` + `LAB` |
| `ADMIN` (Jorge, created in-migration) | `MASTER` |
| `VIEWER` | `GERENCIA` (read-only analog) |

---

## 14. Production Execution

### Phase A — Pre-migration

| Step | Detail |
|------|--------|
| A.1 Maintenance window | Announced to Octavio and Hector by user |
| A.2 Logical backup | `pg_dump 17.9` against `DIRECT_URL` (session pooler, port 5432) → `backups/pre_rbac_20260420T223122Z.sql` (113 KB, 27 COPY statements, all public-schema tables captured) |
| A.2 Backup verification | Confirmed both users' bcrypt hashes and legacy roles preserved in dump |

### Phase B — Migration

Applied via `psql 17.9 --single-transaction --set ON_ERROR_STOP=1 -f migration.sql` against `DIRECT_URL`:

```
BEGIN
DO                      -- preflight passed
ALTER TYPE              -- UserRole → UserRole_legacy
CREATE TYPE             -- new UserRole with 10 values
CREATE TABLE            -- user_role_assignments
CREATE INDEX x2         -- unique + lookup
INSERT 0 1              -- jorge user created
INSERT 0 1 x5           -- role assignments backfilled
INSERT 0 0              -- VIEWER → GERENCIA (no rows, as expected)
DO                      -- orphan check passed
ALTER TABLE             -- users.role column dropped
DROP TYPE               -- UserRole_legacy removed
COMMIT
```

### Phase C — Verification

All 6 `verify.sql` queries returned expected results:

| Check | Expected | Actual |
|-------|----------|--------|
| Orphan users | 0 | 0 |
| User → roles pairs | 3 users, expected assignments | `hector: {LAB, VENTAS}`, `jorge: {MASTER}`, `octavio: {FINANCIERO, GERENCIA}` |
| `users.role` column | 0 rows | 0 rows |
| `UserRole` enum values | 10 | 10 |
| `UserRole_legacy` type | 0 rows | 0 rows |
| Total assignments | 5 (2+2+1) | 5 |

### Phase D — Deploy & Smoke Test

- Commit `af6858c` — RBAC refactor code (14 files modified + migration directory + proposal doc)
- Commit `baa7743` — `.gitignore` adds `backups/` and `RobertoFULL.txt`
- Vercel auto-deploy triggered on push
- All 3 users logged in successfully with correct role badges and access scope

---

## 15. Issues Encountered & Resolutions

### Issue 1: `pg_dump` version mismatch

`pg_dump 14.19` (from system default) refuses to dump from Postgres 17.6 server. Resolved by using `/opt/homebrew/opt/postgresql@17/bin/pg_dump` (17.9), which is already installed via Homebrew alongside the older version.

### Issue 2: Temporary password failed client-side validation

Initial temp password `Hope` (4 chars) was rejected by the browser's HTML5 `minlength="8"` attribute on the login form before it could reach the backend. The `LoginSchema.password.min(8)` in `schemas.ts` drives this. Resolved by updating Jorge's `passwordHash` in the DB to a bcrypt hash of `HopeCoffee` (10 chars) via a one-shot Prisma script.

**Note:** `migration.sql` still contains the original `Hope` bcrypt hash. The file is now historically inaccurate but harmless (the committed hash doesn't match any live credential). Left as-is per user acknowledgment — "rotate on first login" flow supersedes it.

### Issue 3: IDE TS-server cache showed stale errors

After `prisma generate` regenerated the client with the new `UserRole` enum, the IDE's in-memory TS server continued to emit errors referencing old role names for several minutes. `npx tsc --noEmit` (fresh process) consistently showed 0 errors — confirmed the regenerated types were correct. No code action needed.

### Issue 4: Project uses `db push`, not `prisma migrate`

`prisma/migrations/` directory did not exist prior to this session. The project has been using `prisma db push` (schema-first, no migration history). This session's migration was hand-written SQL applied via `psql` — the new `prisma/migrations/20260420_rbac_multi_role/` directory is a documentation artifact, not a Prisma Migrate artifact. Future consideration: baseline `prisma migrate` so subsequent schema changes have proper migration history.

---

## 16. Memory Updates

Updated auto-memory files:

| File | Change |
|------|--------|
| `MEMORY.md` | Project overview updated; RBAC memory index entry renamed to "Multi-Role Domain System" |
| `project_rbac_refactor.md` | Full rewrite — 10 roles, join table architecture, user mappings, pending migration note (now resolved) |
| `user_roles.md` | Replaced 2-user summary with 5-user table including Jorge (MASTER), José Herrera (COMPRAS, not interviewed), Evelyn + Douglas (future) |

---

## 17. Open Items

- **José Herrera interview** — `COMPRAS` permission set is inferred from Roberto's and Hector's transcripts. Must be validated after his interview.
- **Jorge's password rotation** — `HopeCoffee` is temporary. User to rotate via settings UI on next login.
- **`migration.sql` hash cleanup** — optional: amend commit to replace the outdated `Hope` bcrypt hash with a placeholder comment, or archive the migration folder after stabilization.
- **`prisma migrate` baseline** — consider converting from `db push` to `migrate` for future schema change history.
- **Logistics / Lab-Asistente users** — `LOGISTICA` and `LAB_ASISTENTE` roles exist in the enum but are unassigned. When Evelyn and Douglas get logins, they'll be assigned these roles.
- **New feature permissions** — ~60 of the ~90 permissions in the catalog are not yet enforced by any server action (CRM, market, sack design, booking, samples, payments, accounting, fiscal entities, delivery, reports). They'll be wired up as features ship per proposal §6 step 4.

---

## Verification

- `npx prisma generate` — Prisma client regenerated successfully
- `npx tsc --noEmit` — 0 errors
- `npx vitest run` — 29/29 tests passing
- `psql -f migration.sql` — applied to prod, COMMIT successful, all DDL/DML confirmed
- `psql -f verify.sql` — all 6 post-conditions pass
- Smoke test in prod — 3 users log in with correct roles, badges, and access scope
