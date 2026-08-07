#!/usr/bin/env bash
# Validates supabase/migrations/*.sql against a throwaway local Postgres
# database, then runs the RLS test suite against it.
#
# This catches syntax errors, bad references and broken policies without
# needing Docker or a live Supabase project. It is not a substitute for
# `supabase db push` — storage/auth here are shims (supabase/tests/_shim.sql).
#
#   ./scripts/db-verify.sh            # migrations only
#   ./scripts/db-verify.sh --tests    # migrations + seed + RLS tests
#   ./scripts/db-verify.sh --keep     # leave the database behind for psql

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="kigyo_verify_$$"
RUN_TESTS=0
KEEP=0

for arg in "$@"; do
  case "$arg" in
    --tests) RUN_TESTS=1 ;;
    --keep)  KEEP=1 ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

cleanup() {
  if [ "$KEEP" -eq 0 ]; then
    dropdb --if-exists "$DB" 2>/dev/null || true
  else
    echo "kept database: $DB"
  fi
}
trap cleanup EXIT

if ! pg_isready -q; then
  echo "no local postgres on \$PGHOST/\$PGPORT — start one, or run 'supabase db push' instead" >&2
  exit 1
fi

echo "→ creating $DB"
createdb "$DB"

PSQL=(psql --quiet --no-psqlrc --set ON_ERROR_STOP=1 --dbname "$DB")

echo "→ loading supabase shim"
"${PSQL[@]}" --set DBNAME="$DB" --file "$ROOT/supabase/tests/_shim.sql" >/dev/null

for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ $(basename "$f")"
  "${PSQL[@]}" --file "$f" >/dev/null
done

if [ "$RUN_TESTS" -eq 1 ]; then
  if [ -f "$ROOT/supabase/seed.sql" ]; then
    echo "→ seed.sql"
    "${PSQL[@]}" --file "$ROOT/supabase/seed.sql" >/dev/null
  fi
  for f in "$ROOT"/supabase/tests/rls/*.sql; do
    [ -e "$f" ] || continue
    echo "→ test $(basename "$f")"
    "${PSQL[@]}" --file "$f"
  done
fi

echo "✓ migrations applied cleanly"
