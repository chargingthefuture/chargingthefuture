#!/usr/bin/env bash
# check-lockfile-sync.sh
# Fails if pnpm-lock.yaml is out of sync with any package.json in the monorepo.
# Usage: bash ctf/scripts/check-lockfile-sync.sh

set -euo pipefail

cd "$(dirname "$0")/.."

if ! pnpm install --frozen-lockfile --ignore-scripts --prefer-offline --lockfile-only > /dev/null 2>&1; then
  echo "\nERROR: pnpm-lock.yaml is out of sync with one or more package.json files.\n"
  echo "Run 'pnpm install' and commit the updated lockfile."
  exit 1
fi

echo "Lockfile is in sync with all package.json files."
