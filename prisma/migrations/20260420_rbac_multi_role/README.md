# RBAC Multi-Role Migration — Runbook

**Date:** 2026-04-20
**Impact:** users table schema change, 1 new user created, all sessions invalidated
**Downtime:** maintenance window required (~10 min recommended)
**Reversibility:** rollback script available, snapshot restore is the fallback

## What this migration does

Transforms the single-role RBAC (`users.role` column, 4 legacy roles) into a multi-role system (`user_role_assignments` join table, 10 domain roles).

**Role mapping (legacy → new):**
- `FINANCIAL_OPERATOR` → `GERENCIA` + `FINANCIERO` (Octavio)
- `FIELD_OPERATOR` → `VENTAS` + `LAB` (Hector)
- `ADMIN` → `MASTER`
- `VIEWER` → `GERENCIA`

**New user created:** `jorgeluiscontrerasherrera@gmail.com` (Jorge) with role `MASTER`.

## SENSITIVE CONTENT WARNING

`migration.sql` contains a bcrypt hash of the temporary password `"Hope"`. The hash is the only barrier between this value and plaintext in the DB. After Jorge's first login rotates the password, consider:
- redacting the hash from this SQL file before long-term archival, **or**
- moving this migration folder out of the active code tree

Treat the committed hash as a secret until the password is rotated.

## Prerequisites

1. Supabase project access with SQL execution rights
2. Maintenance window announced to Octavio and Hector
3. `DATABASE_URL` available (prefer **session pooler** on port 5432 or direct DB URL; transaction pooler on 6543 can misbehave with DDL)
4. `pgcrypto` extension enabled on Supabase (default: yes — provides `gen_random_uuid()`)
5. Vercel CLI or dashboard access (for maintenance mode toggle and deployment trigger)

## Execution checklist

### Phase A — Pre-migration

- [ ] **A.1** Announce maintenance window start to Octavio and Hector
- [ ] **A.2** Take logical dump of the `users` domain (minimum):
  ```bash
  pg_dump "$DATABASE_URL" \
    --schema=public \
    --table=users \
    --table=audit_logs \
    --no-owner --no-acl \
    --file=backups/pre_rbac_$(date -u +%Y%m%dT%H%M%SZ).sql
  ```
  Or take full DB dump if preferred.
- [ ] **A.3** Enable maintenance mode on Vercel (env var flag or Vercel-level routing)
- [ ] **A.4** Confirm no in-flight writes:
  ```sql
  SELECT MAX("createdAt") FROM audit_logs;  -- should be stable
  ```

### Phase B — Migration

- [ ] **B.1** Apply `migration.sql` via Supabase SQL editor or `psql "$DATABASE_URL" -f migration.sql`
- [ ] **B.2** Confirm success message (no errors, single transaction committed)

### Phase C — Verification

- [ ] **C.1** Run every query in `verify.sql` and compare to expected results inline in the file
- [ ] **C.2** If any verification fails, execute Phase E (rollback) — do NOT deploy new code

### Phase D — Deploy & Smoke Test

- [ ] **D.1** `git push` to trigger Vercel deploy of the new RBAC code
- [ ] **D.2** Wait for build to complete (Prisma client regenerates during build)
- [ ] **D.3** Smoke test — log in as:
  - `octavio@hopecoffee.com` → should see dashboard with GERENCIA+FINANCIERO UI
  - `hector@hopecoffee.com` → should see contract/lab flows with VENTAS+LAB UI
  - `jorgeluiscontrerasherrera@gmail.com` (password: `Hope`) → should see everything (MASTER)
- [ ] **D.4** **ROTATE JORGE'S PASSWORD** immediately via whatever flow exists (or direct DB update with a new bcrypt hash)
- [ ] **D.5** Disable maintenance mode on Vercel

### Phase E — Rollback (if needed)

Two options, in order of preference:

**E.1 — Snapshot restore (preferred, lossless):**
```bash
# Restore the table-level dump taken in A.2
psql "$DATABASE_URL" -f backups/pre_rbac_<timestamp>.sql
# Redeploy the previous Vercel production deployment
```

**E.2 — SQL rollback script (documentation-grade):**
```bash
psql "$DATABASE_URL" -f rollback.sql
```
Note: `rollback.sql` aborts if any user has a role combination that does not cleanly reverse-map (e.g., a new user created between migration and rollback). In that case, use E.1.

## Post-migration cleanup (within 7 days)

- [ ] Discard the pre-migration backup if no issues surfaced
- [ ] Rotate Jorge's temporary password if not already done
- [ ] Update memory/docs to mark migration as applied
- [ ] Consider baselining `prisma migrate` going forward so future schema changes have proper migration history

## Files in this folder

- `migration.sql` — forward migration (atomic transaction)
- `rollback.sql` — inverse migration (abort-safe, lossy on unmapped combos)
- `verify.sql` — post-condition checks
- `README.md` — this runbook
