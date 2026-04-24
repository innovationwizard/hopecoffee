#!/usr/bin/env bash
# ============================================================================
# ⚠️  JAN-SCOPED FROZEN REFERENCE — 2026-04-23
# ============================================================================
# Per RECONCILIATION_PLAN_2026_JAN_MAY.md §1.2, Jan prod DB is frozen and
# scripts/import-excel-january.ts now throws on startup. This orchestrator
# was formerly scripts/validate-importer.sh; it is renamed to
# scripts/validate-importer-january.sh and references updated. The disposable
# Postgres cluster pattern is preserved as reference for building future
# per-month validator orchestrators — but this shell script will exit at the
# tsx invocation below because the imported Jan script is decommissioned.
#
# Do not run. Reference only.
# ============================================================================
# Importer fix validation — end-to-end against a disposable Postgres
# ============================================================================
# Spins up a temporary local Postgres cluster via brew's postgres binaries,
# pushes the Prisma schema, runs scripts/import-excel-january.ts against
# docs/hopecoffee.xlsx, then runs scripts/validate-importer-assertions-january.ts
# to verify the three structural fixes from commit 3554d2b:
#
#   (1) MateriaPrimaAllocation rows are created linking contracts to MP.
#   (2) Contract.rendimiento is sourced from the paired MP row.
#   (3) Contract.gastosPerSaco is persisted.
#
# The temp cluster is torn down on exit (EXIT trap) regardless of success or
# failure. This does NOT touch Supabase prod or the developer's local
# environment — everything lives in a mktemp directory.
#
# Prerequisites:
#   - Homebrew Postgres binaries on PATH (initdb, pg_ctl, createdb, pg_isready)
#   - docs/hopecoffee.xlsx present (gitignored; must be supplied locally)
#   - Node modules installed
#
# Usage:
#   ./scripts/validate-importer.sh
# ============================================================================

set -euo pipefail

# --- Prereqs ---------------------------------------------------------------

for bin in initdb pg_ctl createdb pg_isready npx; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "✗ required binary not found on PATH: $bin" >&2
    exit 1
  fi
done

if [[ ! -f docs/hopecoffee.xlsx ]]; then
  echo "✗ docs/hopecoffee.xlsx not found (gitignored; supply it locally)" >&2
  exit 1
fi

# --- Temp cluster ----------------------------------------------------------

TMPDIR_ROOT=$(mktemp -d -t hopecoffee-validate.XXXXXX)
PGDATA="$TMPDIR_ROOT/pgdata"
PGLOG="$TMPDIR_ROOT/pg.log"
PORT=55432
DBNAME=hopecoffee_validate

cleanup() {
  set +e
  if [[ -d "$PGDATA" ]]; then
    pg_ctl -D "$PGDATA" stop -m immediate >/dev/null 2>&1
  fi
  rm -rf "$TMPDIR_ROOT"
  set -e
}
trap cleanup EXIT INT TERM

echo ""
echo "=============================================================================="
echo " Importer fix validation — end-to-end against disposable Postgres"
echo "=============================================================================="
echo ""
echo " Temp dir: $TMPDIR_ROOT"
echo " Port:     $PORT"
echo ""

echo "→ initdb"
initdb -D "$PGDATA" --auth=trust --no-locale --encoding=UTF8 >/dev/null

echo "→ Starting Postgres"
# -k sets the unix socket directory so it doesn't collide with system postgres
pg_ctl -D "$PGDATA" -l "$PGLOG" -o "-p $PORT -k $TMPDIR_ROOT -c listen_addresses=localhost" -w start >/dev/null

# Wait for readiness (pg_ctl -w already waits, but double-check)
until pg_isready -h localhost -p "$PORT" -q; do sleep 0.2; done

echo "→ createdb $DBNAME"
createdb -h localhost -p "$PORT" "$DBNAME"

# Prisma reads DATABASE_URL + DIRECT_URL from env; shell exports override .env
export DATABASE_URL="postgresql://$USER@localhost:$PORT/$DBNAME?schema=public"
export DIRECT_URL="$DATABASE_URL"

echo "→ prisma db push"
if ! npx prisma db push --skip-generate --accept-data-loss >"$TMPDIR_ROOT/prisma-push.log" 2>&1; then
  echo "✗ prisma db push failed:"
  cat "$TMPDIR_ROOT/prisma-push.log"
  exit 1
fi

echo "→ running importer against docs/hopecoffee.xlsx"
if ! npx tsx scripts/import-excel-january.ts >"$TMPDIR_ROOT/import.log" 2>&1; then
  echo "✗ importer failed:"
  tail -40 "$TMPDIR_ROOT/import.log"
  exit 1
fi

# Show importer's own summary
echo ""
echo "→ importer output (last 20 lines):"
tail -20 "$TMPDIR_ROOT/import.log" | sed 's/^/    /'

echo ""
echo "→ running assertions"
npx tsx scripts/validate-importer-assertions-january.ts
