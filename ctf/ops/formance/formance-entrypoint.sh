#!/bin/sh
# Formance ledger entrypoint (issue #106).
#
# Starts `ledger serve` and, once the API is reachable, idempotently ensures the
# named ledger book(s) exist — so a freshly deployed environment is ready with NO
# manual operator step (no SSH + bootstrap script). The bootstrap is best-effort
# and runs in the background: it must NEVER prevent the ledger from serving.
#
# Requires (injected via Infisical -> Render Sync on the ledger service):
#   FORMANCE_API_TOKEN       bearer token the ledger API expects
#   FORMANCE_LEDGER          production ledger book name (e.g. ctf-main)
#   FORMANCE_LEDGER_STAGING  demo ledger book name (e.g. ctf-demo)  [optional]
# If curl is unavailable or the names are unset, the ledger still serves; create
# the books once with `pnpm formance:bootstrap`.
set -eu

PORT="${PORT:-3068}"
API="http://127.0.0.1:${PORT}"

# Preserve the previous CMD's POSTGRES_URI mapping, then start the server.
export POSTGRES_URI="${FORMANCE_POSTGRES_URI:-${POSTGRES_URI:-}}"
ledger serve --bind="0.0.0.0:${PORT}" --worker=true --worker-grpc-address=127.0.0.1:8081 &
LEDGER_PID=$!

# Idempotently create a ledger book once the API is up. Retries through the
# server's warm-up (connection refused / 5xx); treats 201 as created and 400/409
# as already-exists. Always returns 0 so a hiccup never crashes the container.
ensure_ledger() {
  name="$1"
  [ -n "$name" ] || return 0
  attempt=0
  while [ "$attempt" -lt 40 ]; do
    code="$(curl -s -o /dev/null -w '%{http_code}' -X POST \
      -H "Authorization: Bearer ${FORMANCE_API_TOKEN:-}" "${API}/v2/${name}" 2>/dev/null || echo 000)"
    case "$code" in
      201) echo "[entrypoint] created ledger '${name}'"; return 0 ;;
      400|409) echo "[entrypoint] ledger '${name}' already exists (HTTP ${code})"; return 0 ;;
      000|5??) attempt=$((attempt + 1)); sleep 3 ;;
      *) echo "[entrypoint] WARN: create '${name}' returned HTTP ${code} (non-fatal)"; return 0 ;;
    esac
  done
  echo "[entrypoint] WARN: gave up ensuring ledger '${name}'; run 'pnpm formance:bootstrap' manually."
  return 0
}

if command -v curl >/dev/null 2>&1; then
  ( ensure_ledger "${FORMANCE_LEDGER:-}"; ensure_ledger "${FORMANCE_LEDGER_STAGING:-}" ) &
else
  echo "[entrypoint] curl not found in image; skipping auto-bootstrap. Run 'pnpm formance:bootstrap' once."
fi

# Keep the ledger in the foreground so the container stays up.
wait "$LEDGER_PID"
