-- =========================================================================
-- RBAC MULTI-ROLE MIGRATION — FORWARD
-- Date: 2026-04-20
-- =========================================================================
-- Transforms:
--   UserRole enum (ADMIN, FIELD_OPERATOR, FINANCIAL_OPERATOR, VIEWER)
--          → (MASTER, GERENCIA, FINANCIERO, COMPRAS, VENTAS, LAB,
--             ANALISIS, CONTABILIDAD, LOGISTICA, LAB_ASISTENTE)
--
--   users.role (scalar column, 1 role per user)
--          → user_role_assignments (join table, N roles per user)
--
-- Backfill mapping (legacy → new roles):
--   FINANCIAL_OPERATOR → GERENCIA + FINANCIERO   (Octavio)
--   FIELD_OPERATOR     → VENTAS + LAB            (Hector)
--   ADMIN              → MASTER                  (jorge, created in Step 4)
--   VIEWER             → GERENCIA                (no current users)
--
-- Also creates a new MASTER user:
--   jorgeluiscontrerasherrera@gmail.com — Jorge — temp password "Hope"
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- Preflight: abort if migration appears already applied
-- -------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'UserRole' AND e.enumlabel = 'MASTER'
  ) THEN
    RAISE EXCEPTION 'Migration aborted: UserRole enum already contains MASTER (appears to be post-migration).';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
  ) THEN
    RAISE EXCEPTION 'Migration aborted: users.role column missing (appears to be post-migration).';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_role_assignments'
  ) THEN
    RAISE EXCEPTION 'Migration aborted: user_role_assignments table already exists.';
  END IF;
END $$;

-- -------------------------------------------------------------------------
-- Step 1: Rename legacy UserRole type (users.role still references it)
-- -------------------------------------------------------------------------
ALTER TYPE "UserRole" RENAME TO "UserRole_legacy";

-- -------------------------------------------------------------------------
-- Step 2: Create new UserRole enum with 10 domain-specific roles
-- -------------------------------------------------------------------------
CREATE TYPE "UserRole" AS ENUM (
  'MASTER',
  'GERENCIA',
  'FINANCIERO',
  'COMPRAS',
  'VENTAS',
  'LAB',
  'ANALISIS',
  'CONTABILIDAD',
  'LOGISTICA',
  'LAB_ASISTENTE'
);

-- -------------------------------------------------------------------------
-- Step 3: Create user_role_assignments join table
-- -------------------------------------------------------------------------
CREATE TABLE "user_role_assignments" (
  "id"         TEXT        NOT NULL,
  "userId"     TEXT        NOT NULL,
  "role"       "UserRole"  NOT NULL,
  "assignedBy" TEXT,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_role_assignments_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "user_role_assignments_userId_role_key"
  ON "user_role_assignments" ("userId", "role");
CREATE INDEX "user_role_assignments_userId_idx"
  ON "user_role_assignments" ("userId");

-- -------------------------------------------------------------------------
-- Step 4: Create MASTER user (jorge) with legacy role=ADMIN
-- The ADMIN legacy role cleanly maps to MASTER in Step 5's backfill.
-- Temp password "Hope" (bcrypt cost 12) — ROTATE ON FIRST LOGIN.
-- -------------------------------------------------------------------------
INSERT INTO "users" (
  "id", "email", "name", "passwordHash", "role", "isActive",
  "createdAt", "updatedAt"
) VALUES (
  'cmmo7risjn5e9f1863138d16',
  'jorgeluiscontrerasherrera@gmail.com',
  'Jorge',
  '$2a$12$.l3DJCeGfEFgdv0aYD9gSubjwarTjS2uXxz1wTtUWSBtjaEhVqW1e',
  'ADMIN'::"UserRole_legacy",
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------------------
-- Step 5: Backfill user_role_assignments from legacy users.role
-- -------------------------------------------------------------------------

-- FINANCIAL_OPERATOR → GERENCIA + FINANCIERO
INSERT INTO "user_role_assignments" ("id", "userId", "role")
SELECT gen_random_uuid()::text, u."id", 'GERENCIA'::"UserRole"
FROM "users" u WHERE u."role"::text = 'FINANCIAL_OPERATOR';

INSERT INTO "user_role_assignments" ("id", "userId", "role")
SELECT gen_random_uuid()::text, u."id", 'FINANCIERO'::"UserRole"
FROM "users" u WHERE u."role"::text = 'FINANCIAL_OPERATOR';

-- FIELD_OPERATOR → VENTAS + LAB
INSERT INTO "user_role_assignments" ("id", "userId", "role")
SELECT gen_random_uuid()::text, u."id", 'VENTAS'::"UserRole"
FROM "users" u WHERE u."role"::text = 'FIELD_OPERATOR';

INSERT INTO "user_role_assignments" ("id", "userId", "role")
SELECT gen_random_uuid()::text, u."id", 'LAB'::"UserRole"
FROM "users" u WHERE u."role"::text = 'FIELD_OPERATOR';

-- ADMIN → MASTER
INSERT INTO "user_role_assignments" ("id", "userId", "role")
SELECT gen_random_uuid()::text, u."id", 'MASTER'::"UserRole"
FROM "users" u WHERE u."role"::text = 'ADMIN';

-- VIEWER → GERENCIA (read-only analog)
INSERT INTO "user_role_assignments" ("id", "userId", "role")
SELECT gen_random_uuid()::text, u."id", 'GERENCIA'::"UserRole"
FROM "users" u WHERE u."role"::text = 'VIEWER';

-- -------------------------------------------------------------------------
-- Step 6: Verify every user received at least one role assignment
-- -------------------------------------------------------------------------
DO $$
DECLARE
  orphan_count int;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM "users" u
  LEFT JOIN "user_role_assignments" ura ON ura."userId" = u."id"
  WHERE ura."id" IS NULL;

  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Migration aborted: % user(s) have no role assignment after backfill.', orphan_count;
  END IF;
END $$;

-- -------------------------------------------------------------------------
-- Step 7: Drop the legacy users.role column
-- -------------------------------------------------------------------------
ALTER TABLE "users" DROP COLUMN "role";

-- -------------------------------------------------------------------------
-- Step 8: Drop the legacy enum type (no remaining references)
-- -------------------------------------------------------------------------
DROP TYPE "UserRole_legacy";

COMMIT;
