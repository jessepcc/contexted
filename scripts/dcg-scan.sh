#!/usr/bin/env bash
set -euo pipefail

# Basic destructive command guard for automation/docs paths.
# Mirrors high-risk patterns until external guard is wired in deployment environments.

PATTERNS=(
  "git reset --hard"
  "git checkout --"
  "rm -rf /"
  "drop database"
  "truncate table"
  "delete from .*;"
  "terraform destroy"
  "supabase db reset"
  "wrangler.*delete"
)

SCAN_PATHS=("scripts" ".github" "docs")

fail=0
for pattern in "${PATTERNS[@]}"; do
  if rg -n --ignore-case \
    --glob '*.sh' \
    --glob '*.md' \
    --glob '*.yml' \
    --glob '*.yaml' \
    --glob '*.sql' \
    --glob '!scripts/dcg-scan.sh' \
    "$pattern" "${SCAN_PATHS[@]}" >/tmp/contexted-dcg-hit.txt 2>/dev/null; then
    echo "[dcg-scan] blocked pattern: $pattern"
    cat /tmp/contexted-dcg-hit.txt
    fail=1
  fi
done

if [[ "$fail" -eq 1 ]]; then
  echo "[dcg-scan] unsafe command patterns detected."
  exit 1
fi

echo "[dcg-scan] no blocked patterns detected."
