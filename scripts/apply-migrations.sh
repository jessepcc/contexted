#!/usr/bin/env bash
set -euo pipefail

# Apply all SQL migrations to a Supabase database.
# Usage:
#   ./scripts/apply-migrations.sh                  # uses .env (default / memory)
#   ./scripts/apply-migrations.sh .env.test        # uses test database
#   ./scripts/apply-migrations.sh .env.production   # uses production database

ENV_FILE="${1:-.env}"
MIGRATIONS_DIR="packages/db/migrations"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found" >&2
  exit 1
fi

# Source the env file to get DATABASE_URL
set -a
source "$ENV_FILE"
set +a

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Error: DATABASE_URL is not set in $ENV_FILE" >&2
  exit 1
fi

echo "Applying migrations from $MIGRATIONS_DIR to database ($ENV_FILE)..."

for migration in "$MIGRATIONS_DIR"/*.sql; do
  echo "  -> $(basename "$migration")"
  psql "$DATABASE_URL" -f "$migration" -v ON_ERROR_STOP=1
done

echo "Done."
