#!/usr/bin/env bash
# Turns on "sign in with the Skills Economy account" for the FreshRSS service.
#
# Two systems have to agree, and this sets both sides so neither can be half
# configured: an OAuth application at the auth provider that knows FreshRSS's
# callback address, and the OIDC_* variables on the Render service that tell
# FreshRSS which provider to ask.
#
# Why it is a workflow and not a dashboard visit
# ───────────────────────────────
# The owner works from a phone and prefers an API. Both credentials already
# live in GitHub Actions, so this is one press of "Run workflow".
#
# The issuer is not a secret and not an input
# ───────────────────────────────
# The provider's issuer address is encoded inside the publishable key, which
# this repository already has as a GitHub Actions secret. Decoding it there
# means one fewer thing to type and one fewer thing to get wrong — a wrong
# issuer fails at sign-in time with an error that looks like a FreshRSS
# problem rather than a configuration one.
#
# Re-running is safe
# ───────────────────────────────
# The provider returns a client secret once, at creation. So a second run does
# not create a second application: it finds the existing one by name and
# rotates its secret, then writes the new secret to Render. Anybody signed in
# stays signed in; the rotation only affects the next sign-in handshake.
#
# Inputs (environment variables)
#   CLERK_SECRET_KEY    required — the auth provider's backend key (sk_…)
#   PUBLISHABLE_KEY     required — pk_… , used only to derive the issuer
#   RENDER_API_KEY      required — Render API key (rnd_…)
#   READER_HOST         required — e.g. rss.chargingthefuture.com
#   SERVICE_NAME        optional — defaults to ctf-freshrss
#
# Nothing secret is printed. The client secret, the crypto key and both API
# keys are masked before they can reach the log, and the job summary carries
# only the client id, which is public by design.
set -uo pipefail

service="${SERVICE_NAME:-ctf-freshrss}"
host="${READER_HOST:-}"
app_name="FreshRSS reader"

fail() { echo "::error title=Sign-in not wired::$1"; exit 1; }

[ -n "${CLERK_SECRET_KEY:-}" ] || fail "CLERK_SECRET_KEY is not set on this run. Add it as a GitHub Actions secret — it is the only credential this needs that the repository does not already hold."
[ -n "${PUBLISHABLE_KEY:-}" ] || fail "NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY is not set, so the issuer address cannot be derived."
[ -n "${RENDER_API_KEY:-}" ] || fail "RENDER_API_KEY is not set, so the service's variables cannot be written."
[ -n "$host" ] || fail "READER_HOST is empty."

# ── The issuer, decoded from the publishable key ──────────────────────────────
# A publishable key is pk_live_<base64 of the frontend host, with a trailing $>.
encoded="${PUBLISHABLE_KEY#pk_live_}"
encoded="${encoded#pk_test_}"
issuer_host=$(printf '%s' "$encoded" | base64 -d 2>/dev/null | tr -d '$' | tr -d '\n' || true)
case "$issuer_host" in
  *.*) ;;
  *) fail "The publishable key did not decode to a hostname, so the issuer cannot be derived. Expected pk_live_… or pk_test_…" ;;
esac
metadata_url="https://${issuer_host}/.well-known/openid-configuration"
redirect_uri="https://${host}/i/oidc/"
echo "Issuer: https://${issuer_host}"
echo "Callback: ${redirect_uri}"

clerk() {
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -s -o /tmp/clerk.json -w '%{http_code}' -X "$method" \
      -H "Authorization: Bearer $CLERK_SECRET_KEY" -H 'Content-Type: application/json' \
      -d "$body" "https://api.clerk.com/v1${path}"
  else
    curl -s -o /tmp/clerk.json -w '%{http_code}' -X "$method" \
      -H "Authorization: Bearer $CLERK_SECRET_KEY" "https://api.clerk.com/v1${path}"
  fi
}

# ── The OAuth application ─────────────────────────────────────────────────────
status=$(clerk GET "/oauth_applications?limit=100" || true)
case "$status" in
  2*) ;;
  401|403) fail "The auth provider refused the secret key (HTTP ${status}). Check CLERK_SECRET_KEY is the raw sk_… value." ;;
  *) fail "Could not list OAuth applications (HTTP ${status:-none}). $(jq -r '.errors[0].long_message // .errors[0].message // empty' /tmp/clerk.json 2>/dev/null)" ;;
esac

app_id=$(jq -r --arg n "$app_name" '(.data // .) | map(select(.name == $n)) | .[0].id // empty' /tmp/clerk.json 2>/dev/null || true)

if [ -n "$app_id" ]; then
  echo "An application named '${app_name}' already exists. Rotating its secret so this run can write a working pair."
  status=$(clerk POST "/oauth_applications/${app_id}/rotate_secret" || true)
  case "$status" in
    2*) ;;
    *) fail "Could not rotate the existing application's secret (HTTP ${status:-none}). $(jq -r '.errors[0].long_message // .errors[0].message // empty' /tmp/clerk.json 2>/dev/null)" ;;
  esac
else
  echo "Creating the OAuth application…"
  payload=$(jq -n --arg n "$app_name" --arg r "$redirect_uri" \
    '{ name: $n, redirect_uris: [$r], scopes: "openid email profile", public: false }')
  status=$(clerk POST "/oauth_applications" "$payload" || true)
  case "$status" in
    2*) ;;
    *) fail "The auth provider rejected the new application (HTTP ${status:-none}). $(jq -r '.errors[0].long_message // .errors[0].message // empty' /tmp/clerk.json 2>/dev/null)" ;;
  esac
fi

client_id=$(jq -r '.client_id // .data.client_id // empty' /tmp/clerk.json 2>/dev/null || true)
client_secret=$(jq -r '.client_secret // .data.client_secret // empty' /tmp/clerk.json 2>/dev/null || true)
[ -n "$client_id" ] || fail "The provider returned no client id, so there is nothing to configure FreshRSS with."
[ -n "$client_secret" ] || fail "The provider returned no client secret. It is shown only once, at creation or rotation — delete the '${app_name}' application and run this again to get a fresh pair."
echo "::add-mask::$client_secret"

# An opaque key FreshRSS uses to encrypt its own session state. Generated here
# rather than stored anywhere: nothing else needs to know it, and a new one on
# each run only signs people out of the reader.
crypto_key=$(openssl rand -hex 32)
echo "::add-mask::$crypto_key"

# ── The service's variables ───────────────────────────────────────────────────
status=$(curl -s -o /tmp/render.json -w '%{http_code}' \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  "https://api.render.com/v1/services?name=${service}&limit=100" || true)
case "$status" in
  2*) ;;
  *) fail "Could not find the '${service}' service on Render (HTTP ${status:-none})." ;;
esac
service_id=$(jq -r --arg n "$service" 'map(.service) | map(select(.name == $n)) | .[0].id // empty' /tmp/render.json 2>/dev/null || true)
[ -n "$service_id" ] || fail "No Render service named '${service}'. Create it first with the FreshRSS create workflow."

# Render replaces the entire set on a PUT, so the existing variables are read
# and merged rather than overwritten — dropping LISTEN or CRON_MIN here would
# take the service down or quietly stop it fetching anything.
status=$(curl -s -o /tmp/render-env.json -w '%{http_code}' \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  "https://api.render.com/v1/services/${service_id}/env-vars?limit=100" || true)
case "$status" in
  2*) ;;
  *) fail "Could not read the service's existing variables (HTTP ${status:-none}), and writing without them would drop LISTEN and CRON_MIN." ;;
esac

new_vars=$(jq -n \
  --arg metadata "$metadata_url" \
  --arg cid "$client_id" \
  --arg csecret "$client_secret" \
  --arg ckey "$crypto_key" \
  '[
     { key: "OIDC_ENABLED",              value: "1" },
     { key: "OIDC_PROVIDER_METADATA_URL", value: $metadata },
     { key: "OIDC_CLIENT_ID",            value: $cid },
     { key: "OIDC_CLIENT_SECRET",        value: $csecret },
     { key: "OIDC_CLIENT_CRYPTO_KEY",    value: $ckey },
     { key: "OIDC_X_FORWARDED_HEADERS",  value: "X-Forwarded-Host X-Forwarded-Port X-Forwarded-Proto" },
     { key: "OIDC_SCOPES",               value: "openid email profile" },
     { key: "OIDC_REMOTE_USER_CLAIM",    value: "email" }
   ]')

merged=$(jq -n --argjson existing "$(jq '[.[] | .envVar | {key, value}]' /tmp/render-env.json)" --argjson new "$new_vars" \
  '($new | map(.key)) as $keys | ($existing | map(select(.key as $k | $keys | index($k) | not))) + $new')

status=$(curl -s -o /tmp/render-put.json -w '%{http_code}' -X PUT \
  -H "Authorization: Bearer $RENDER_API_KEY" -H 'Content-Type: application/json' \
  -d "$merged" "https://api.render.com/v1/services/${service_id}/env-vars" || true)
case "$status" in
  2*) ;;
  *) fail "Render refused the variables (HTTP ${status:-none}). $(jq -r '.message // empty' /tmp/render-put.json 2>/dev/null)" ;;
esac

# A variable change needs a deploy before FreshRSS reads it.
curl -s -o /dev/null -X POST -H "Authorization: Bearer $RENDER_API_KEY" \
  -H 'Content-Type: application/json' -d '{"clearCache":"do_not_clear"}' \
  "https://api.render.com/v1/services/${service_id}/deploys" || true

echo "Wired. A deploy is running; sign-in works once it finishes."
{
  echo "### Sign in with the Skills Economy account is wired"
  echo ""
  echo "| | |"
  echo "|---|---|"
  echo "| Issuer | https://${issuer_host} |"
  echo "| Callback | ${redirect_uri} |"
  echo "| Client id | ${client_id} |"
  echo ""
  echo "A deploy is running. Sign-in works once it finishes."
  echo ""
  echo "The username is taken from the email claim, so an account with no username still resolves."
  echo "Anyone with an account can sign in — a ban at the auth provider is what keeps somebody out."
} >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
