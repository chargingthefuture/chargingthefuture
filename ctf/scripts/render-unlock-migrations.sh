#!/usr/bin/env bash
  # render-unlock-migrations.sh
  # Run this ONCE after a Render crash that left the knex migration lock held.
  # It clears the lock directly in Postgres so Infisical can start on the next deploy.
  #
  # Required env: INFISICAL_DB_URI
  set -euo pipefail
  : "${INFISICAL_DB_URI:?INFISICAL_DB_URI is required}"
  echo "==> Unlocking knex migration table..."
  psql "${INFISICAL_DB_URI}" \
    -c "UPDATE knex_migrations_lock SET is_locked = 0 WHERE is_locked = 1;"
  echo "==> Done. Re-deploy Infisical to resume."
  