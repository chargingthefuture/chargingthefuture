#!/usr/bin/env bash
set -euo pipefail

# Creates the named Formance ledger book(s) on a Formance instance. This is the
# step the ledger container itself does NOT do: AUTO_UPGRADE in Dockerfile.ledger
# brings up the Formance system schema, but the named ledgers (e.g. ctf-main,
# ctf-demo) must be created via the API before any transaction can post. Run this
# once when spinning up a NEW environment (after the ledger service is reachable),
# or any time after; it is idempotent.
#
# FORMANCE_API_URL is the ledger's address. On Render it is the internal service
# address (e.g. http://ctf-formance-ledger:3068), reachable only from inside the
# Render private network — run this from a Render service shell, not a laptop.

required_env=("FORMANCE_API_URL" "FORMANCE_LEDGER" "FORMANCE_API_TOKEN")
for key in "${required_env[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    echo "Missing required env var: $key"
    echo "Example: export FORMANCE_API_URL=http://ctf-formance-ledger:3068"
    exit 1
  fi
done

BASE_URL="${FORMANCE_API_URL%/}"
AUTH_HEADER="Authorization: Bearer ${FORMANCE_API_TOKEN}"

# Idempotently create a ledger book: 201 (created), 409, or 400 LEDGER_ALREADY_EXISTS
# are all treated as success so re-runs are safe.
create_ledger() {
  local ledger="$1"
  echo "[ledger] ensuring '${ledger}' exists"
  local status body
  status="$(curl -sS -o /tmp/formance-bootstrap-response.json -w "%{http_code}" \
    -X POST -H "$AUTH_HEADER" "${BASE_URL}/v2/${ledger}")"
  body="$(cat /tmp/formance-bootstrap-response.json 2>/dev/null || true)"
  if [[ "$status" == "201" ]]; then
    echo "  created."
  elif [[ "$status" == "409" ]] || { [[ "$status" == "400" ]] && [[ "$body" == *"LEDGER_ALREADY_EXISTS"* ]]; }; then
    echo "  already exists."
  else
    echo "  failed with HTTP ${status}"
    cat /tmp/formance-bootstrap-response.json
    exit 1
  fi
}

# Production ledger (e.g. ctf-main).
create_ledger "${FORMANCE_LEDGER}"

# Demo ledger (e.g. ctf-demo) used by demo mode — same instance, separate book.
# Without it, service-credit calls under demo mode fail with external_ledger_not_configured.
if [[ -n "${FORMANCE_LEDGER_STAGING:-}" ]]; then
  create_ledger "${FORMANCE_LEDGER_STAGING}"
else
  echo "[ledger] FORMANCE_LEDGER_STAGING not set; skipping demo ledger creation."
fi

echo "[ledgers] current list:"
curl -sS -H "$AUTH_HEADER" "${BASE_URL}/v2" || true
echo

# Optional smoke test — OFF by default. It NEVER posts to the production ledger;
# it targets the demo ledger only, so the real financial book is never polluted
# with test entries (ledger postings are immutable and cannot be cleanly removed).
if [[ "${FORMANCE_BOOTSTRAP_SMOKE:-0}" == "1" ]]; then
  smoke_ledger="${FORMANCE_LEDGER_STAGING:-}"
  if [[ -z "$smoke_ledger" ]]; then
    echo "[smoke] FORMANCE_LEDGER_STAGING not set; refusing to smoke-test the production ledger. Skipping."
  else
    echo "[smoke] posting test transaction to demo ledger '${smoke_ledger}'"
    req_id="$(date +%s)"
    smoke_status="$(curl -sS -o /tmp/formance-smoke-response.json -w "%{http_code}" \
      -X POST -H "$AUTH_HEADER" -H "Content-Type: application/json" \
      "${BASE_URL}/v2/${smoke_ledger}/transactions" \
      -d "{\"reference\":\"bootstrap-smoke-${req_id}\",\"postings\":[{\"source\":\"world\",\"destination\":\"wallet:test-user\",\"amount\":100,\"asset\":\"SERVICE_CREDITS\"}],\"metadata\":{\"plugin\":\"service-credits\",\"flow\":\"bootstrap_smoke\"}}")"
    if [[ "$smoke_status" != "200" && "$smoke_status" != "201" ]]; then
      echo "  smoke failed with HTTP ${smoke_status}"
      cat /tmp/formance-smoke-response.json
      exit 1
    fi
    echo "  smoke ok."
  fi
fi

echo "Formance bootstrap completed successfully."
