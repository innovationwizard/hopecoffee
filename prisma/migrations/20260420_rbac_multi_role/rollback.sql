-- =========================================================================
-- RBAC MULTI-ROLE MIGRATION — ROLLBACK
-- =========================================================================
-- Reverts the forward migration. Restores the single-role schema.
--
-- IMPORTANT: Rollback is LOSSY for users with role combinations that did
-- not originate from the forward migration's backfill. This script aborts
-- if any user has a combination that doesn't cleanly reverse-map.
--
-- Inverse mapping (new roles → legacy):
--   {GERENCIA, FINANCIERO} → FINANCIAL_OPERATOR
--   {VENTAS, LAB}          → FIELD_OPERATOR
--   {MASTER}               → ADMIN
--   {GERENCIA}             → VIEWER
--
-- Any other combination causes the rollback to abort. If that happens,
-- restore from the pre-migration snapshot instead.
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- Preflight: abort if migration appears NOT applied
-- -------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_role_assignments'
  ) THEN
    RAISE EXCEPTION 'Rollback aborted: user_role_assignments table missing (migration not applied).';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
  ) THEN
    RAISE EXCEPTION 'Rollback aborted: users.role column still present (unexpected state).';
  END IF;
END $$;

-- -------------------------------------------------------------------------
-- Preflight: verify every user has a reversible role combination
-- -------------------------------------------------------------------------
DO $$
DECLARE
  bad_user record;
  role_set text[];
BEGIN
  FOR bad_user IN
    SELECT u."id", u."email", array_agg(ura."role"::text ORDER BY ura."role"::text) AS roles
    FROM "users" u
    LEFT JOIN "user_role_assignments" ura ON ura."userId" = u."id"
    GROUP BY u."id", u."email"
  LOOP
    role_set := bad_user.roles;
    IF NOT (
      role_set = ARRAY['FINANCIERO','GERENCIA']
      OR role_set = ARRAY['LAB','VENTAS']
      OR role_set = ARRAY['MASTER']
      OR role_set = ARRAY['GERENCIA']
      OR role_set = ARRAY[NULL]::text[]
    ) THEN
      RAISE EXCEPTION 'Rollback aborted: user % has non-reversible role combination %. Use snapshot restore.',
        bad_user.email, role_set;
    END IF;
  END LOOP;
END $$;

-- -------------------------------------------------------------------------
-- Step 1: Rename new UserRole type out of the way
-- -------------------------------------------------------------------------
ALTER TYPE "UserRole" RENAME TO "UserRole_new";

-- -------------------------------------------------------------------------
-- Step 2: Recreate legacy UserRole enum
-- -------------------------------------------------------------------------
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'FIELD_OPERATOR', 'FINANCIAL_OPERATOR', 'VIEWER');

-- -------------------------------------------------------------------------
-- Step 3: Add users.role column back (nullable temporarily for backfill)
-- -------------------------------------------------------------------------
ALTER TABLE "users" ADD COLUMN "role" "UserRole";

-- -------------------------------------------------------------------------
-- Step 4: Inverse-backfill users.role from user_role_assignments
-- -------------------------------------------------------------------------
UPDATE "users" u SET "role" = 'FINANCIAL_OPERATOR'::"UserRole"
WHERE EXISTS (SELECT 1 FROM "user_role_assignments" ura
              WHERE ura."userId" = u."id" AND ura."role"::text = 'GERENCIA')
  AND EXISTS (SELECT 1 FROM "user_role_assignments" ura
              WHERE ura."userId" = u."id" AND ura."role"::text = 'FINANCIERO');

UPDATE "users" u SET "role" = 'FIELD_OPERATOR'::"UserRole"
WHERE EXISTS (SELECT 1 FROM "user_role_assignments" ura
              WHERE ura."userId" = u."id" AND ura."role"::text = 'VENTAS')
  AND EXISTS (SELECT 1 FROM "user_role_assignments" ura
              WHERE ura."userId" = u."id" AND ura."role"::text = 'LAB');

UPDATE "users" u SET "role" = 'ADMIN'::"UserRole"
WHERE EXISTS (SELECT 1 FROM "user_role_assignments" ura
              WHERE ura."userId" = u."id" AND ura."role"::text = 'MASTER')
  AND u."role" IS NULL;

UPDATE "users" u SET "role" = 'VIEWER'::"UserRole"
WHERE u."role" IS NULL
  AND EXISTS (SELECT 1 FROM "user_role_assignments" ura
              WHERE ura."userId" = u."id" AND ura."role"::text = 'GERENCIA')
  AND NOT EXISTS (SELECT 1 FROM "user_role_assignments" ura
                  WHERE ura."userId" = u."id" AND ura."role"::text = 'FINANCIERO');

-- -------------------------------------------------------------------------
-- Step 5: Verify no user is left without a legacy role
-- -------------------------------------------------------------------------
DO $$
DECLARE
  null_count int;
BEGIN
  SELECT COUNT(*) INTO null_count FROM "users" WHERE "role" IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Rollback aborted: % user(s) still have NULL role after inverse backfill.', null_count;
  END IF;
END $$;

-- -------------------------------------------------------------------------
-- Step 6: Reapply NOT NULL + DEFAULT on users.role
-- -------------------------------------------------------------------------
ALTER TABLE "users" ALTER COLUMN "role" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'VIEWER'::"UserRole";

-- -------------------------------------------------------------------------
-- Step 7: Drop join table and new enum type
-- -------------------------------------------------------------------------
DROP TABLE "user_role_assignments";
DROP TYPE "UserRole_new";

COMMIT;
