-- =========================================================================
-- RBAC MULTI-ROLE MIGRATION — VERIFICATION
-- =========================================================================
-- Run AFTER migration.sql applies successfully.
-- All five queries must return the expected results.
-- =========================================================================

-- 1) Orphan check — must return 0
SELECT COUNT(*) AS orphan_users
FROM "users" u
LEFT JOIN "user_role_assignments" ura ON ura."userId" = u."id"
WHERE ura."id" IS NULL;

-- 2) User → role assignment pairs — must match expected set
-- Expected:
--   hector@hopecoffee.com                  → {LAB, VENTAS}
--   jorgeluiscontrerasherrera@gmail.com    → {MASTER}
--   octavio@hopecoffee.com                 → {FINANCIERO, GERENCIA}
SELECT
  u."email",
  array_agg(ura."role"::text ORDER BY ura."role"::text) AS roles
FROM "users" u
JOIN "user_role_assignments" ura ON ura."userId" = u."id"
GROUP BY u."email"
ORDER BY u."email";

-- 3) users.role column must be gone — must return 0 rows
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role';

-- 4) UserRole enum must have exactly 10 values
SELECT e.enumlabel
FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
WHERE t.typname = 'UserRole'
ORDER BY e.enumsortorder;

-- 5) Legacy type must be gone — must return 0 rows
SELECT typname FROM pg_type WHERE typname = 'UserRole_legacy';

-- 6) Row count sanity — user_role_assignments should have 5 rows
--    (Octavio: 2, Hector: 2, Jorge: 1)
SELECT COUNT(*) AS total_assignments FROM "user_role_assignments";
