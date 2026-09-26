#!/usr/bin/env bash
# Sets how long a sign-in to the reader lasts, from ctf/ops/freshrss/sign-in.env.
#
# Why
# ───────────────────────────────
# Sign-in to the reader is FreshRSS's OpenID Connect module asking the auth
# provider. Left on the image's defaults, that module:
#   - forgets a sign-in after 5 minutes without a page load,
#   - keeps it in a cookie that is dropped when the phone closes the browser
#     or the home-screen app, and
#   - holds it in the server's memory, so every restart or deploy signs
#     everybody out.
# Together that reads as a sign-in on nearly every reload. The file sets all
# three, and the repository records what the service runs.
#
# It also turns off the provider's consent screen for the reader's OAuth
# application. The reader is this project's own service, and asking a member
# to approve it on each sign-in adds a screen with nothing to decide.
#
# This is not a one-shot. It is the control for any later change to the
# numbers, the same way the image pin is, so it stays in the Actions list.
#
# Inputs (environment variables)
#   RENDER_API_KEY    required — Render API key (rnd_…)
#   CLERK_SECRET_KEY  optional — the auth provider's backend key (sk_…); without
#                     it the consent screen is left as it is
#   SERVICE_NAME      optional — defaults to ctf-freshrss
#   SETTINGS_FILE     optional — defaults to ctf/ops/freshrss/sign-in.env
#
# Nothing secret is printed. The service's other variables are read and written
# back but never echoed.
set -uo pipefail

service="${SERVICE_NAME:-ctf-freshrss}"
settings_file="${SETTINGS_FILE:-ctf/ops/freshrss/sign-in.env}"
app_name="FreshRSS reader"

fail() { echo "::error title=Sign-in length not set::$1"; exit 1; }

[ -n "${RENDER_API_KEY:-}" ] || fail "RENDER_API_KEY is not set on this run, so the Render API cannot be called."
[ -f "$settings_file" ] || fail "No settings file at ${settings_file}, so there is nothing to apply."

# ── The settings, as KEY=VALUE lines ──────────────────────────────────────────
new_vars=$(grep -E '^OIDC_[A-Z_]+=' "$settings_file" \
  | jq -R 'split("=") | { key: .[0], value: (.[1:] | join("=")) }' | jq -s '.')
count=$(jq 'length' <<<"$new_vars")
[ "$count" -gt 0 ] || fail "${settings_file} has no OIDC_ lines."
jq -r '.[] | "  \(.key)=\(.value)"' <<<"$new_vars"

inactivity=$(jq -r 'map(select(.key == "OIDC_SESSION_INACTIVITY_TIMEOUT")) | .[0].value // empty' <<<"$new_vars")
max=$(jq -r 'map(select(.key == "OIDC_SESSION_MAX_DURATION")) | .[0].value // empty' <<<"$new_vars")
if [ -n "$inactivity" ] && [ -n "$max" ] && [ "$inactivity" -gt "$max" ]; then
  fail "The idle limit (${inactivity}s) is longer than the most a sign-in can last (${max}s), so it would never apply."
fi

render() {
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -s -o /tmp/render.json -w '%{http_code}' -X "$method" \
      -H "Authorization: Bearer $RENDER_API_KEY" -H 'Content-Type: application/json' \
      -d "$body" "https://api.render.com/v1${path}"
  else
    curl -s -o /tmp/render.json -w '%{http_code}' -X "$method" \
      -H "Authorization: Bearer $RENDER_API_KEY" "https://api.render.com/v1${path}"
  fi
}

# ── The consent screen at the auth provider ───────────────────────────────────
consent="left as it was (CLERK_SECRET_KEY is not set on this run)"
# A failure here is a warning, not a stop: the sign-in length is the larger
# part of the fix and does not depend on it.
warn_consent() {
  consent="left as it was ($1)"
  echo "::warning title=Consent screen not changed::$1"
}
if [ -n "${CLERK_SECRET_KEY:-}" ]; then
  status=$(curl -s -o /tmp/clerk.json -w '%{http_code}' \
    -H "Authorization: Bearer $CLERK_SECRET_KEY" \
    "https://api.clerk.com/v1/oauth_applications?limit=100" || true)
  app_id=""
  case "$status" in
    2*) app_id=$(jq -r --arg n "$app_name" '(.data // .) | map(select(.name == $n)) | .[0].id // empty' /tmp/clerk.json 2>/dev/null || true)
        [ -n "$app_id" ] || warn_consent "no OAuth application named '${app_name}' at the auth provider" ;;
    401|403) warn_consent "the auth provider refused CLERK_SECRET_KEY (HTTP ${status})" ;;
    *) warn_consent "could not list OAuth applications (HTTP ${status:-none})" ;;
  esac
  if [ -n "$app_id" ]; then
    status=$(curl -s -o /tmp/clerk.json -w '%{http_code}' -X PATCH \
      -H "Authorization: Bearer $CLERK_SECRET_KEY" -H 'Content-Type: application/json' \
      -d '{"consent_screen_enabled":false}' \
      "https://api.clerk.com/v1/oauth_applications/${app_id}" || true)
    case "$status" in
      2*) consent="turned off" ;;
      *) warn_consent "the auth provider would not change it (HTTP ${status:-none}): $(jq -r '.errors[0].long_message // .errors[0].message // empty' /tmp/clerk.json 2>/dev/null)" ;;
    esac
  fi
else
  warn_consent "CLERK_SECRET_KEY is not set on this run"
fi
echo "Consent screen: ${consent}"

# ── The service's variables ───────────────────────────────────────────────────
status=$(render GET "/services?name=${service}&limit=100" || true)
case "$status" in
  2*) ;;
  401|403) fail "Render refused the API key (HTTP ${status}). Check RENDER_API_KEY is the raw rnd_… value." ;;
  *) fail "Could not list Render services (HTTP ${status:-none})." ;;
esac
service_id=$(jq -r --arg n "$service" 'map(.service) | map(select(.name == $n)) | .[0].id // empty' /tmp/render.json 2>/dev/null || true)
[ -n "$service_id" ] || fail "No Render service named '${service}'."

# Render replaces the entire set on a PUT, so the existing variables are read
# and merged. Dropping the OIDC client pair, LISTEN or CRON_MIN here would lock
# everybody out, take the service down, or quietly stop it fetching.
status=$(curl -s -o /tmp/render-env.json -w '%{http_code}' \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  "https://api.render.com/v1/services/${service_id}/env-vars?limit=100" || true)
case "$status" in
  2*) ;;
  *) fail "Could not read the service's existing variables (HTTP ${status:-none}), and writing without them would drop the rest." ;;
esac
existing=$(jq '[.[] | .envVar | {key, value}]' /tmp/render-env.json)
jq -e 'map(.key) | index("OIDC_ENABLED")' <<<"$existing" >/dev/null \
  || fail "The service has no OIDC_ENABLED variable, so sign-in with the app is not wired and these settings would do nothing."

merged=$(jq -n --argjson existing "$existing" --argjson new "$new_vars" \
  '($new | map(.key)) as $keys | ($existing | map(select(.key as $k | $keys | index($k) | not))) + $new')

status=$(render PUT "/services/${service_id}/env-vars" "$merged" || true)
case "$status" in
  2*) ;;
  *) fail "Render refused the variables (HTTP ${status:-none}). $(jq -r '.message // empty' /tmp/render.json 2>/dev/null)" ;;
esac

# ── Deploy, because a variable is only read at start ──────────────────────────
render POST "/services/${service_id}/deploys" '{"clearCache":"do_not_clear"}' >/dev/null || true
deploy_id=$(jq -r '.id // empty' /tmp/render.json 2>/dev/null || true)
[ -n "$deploy_id" ] || fail "The variables were written but no deploy started, so the reader still runs the old settings. Deploy it from Render and it picks them up."

live=no
waited=0
while [ "$waited" -lt 600 ]; do
  sleep 15
  waited=$((waited + 15))
  render GET "/services/${service_id}/deploys/${deploy_id}" >/dev/null || true
  state=$(jq -r '.status // empty' /tmp/render.json 2>/dev/null || true)
  case "$state" in
    live) echo "  went live after ${waited}s."; live=yes; break ;;
    build_failed|update_failed|canceled|pre_deploy_failed) echo "  ended as ${state} after ${waited}s."; break ;;
    *) echo "  ${state:-unknown} (${waited}s)…" ;;
  esac
done

{
  echo "### How long a reader sign-in lasts"
  echo ""
  echo "| Setting | Value |"
  echo "|---|---|"
  jq -r '.[] | "| `\(.key)` | `\(.value)` |"' <<<"$new_vars"
  echo ""
  echo "Consent screen: ${consent}."
  echo ""
  if [ "$live" = yes ]; then
    echo "Serving. Everybody signs in once more, because the old sign-ins were held in the server's memory; after that a sign-in lasts as set above."
  else
    echo "The deploy did not come up, so the reader is down or rolled back. Check the deploy log on Render."
  fi
} >> "${GITHUB_STEP_SUMMARY:-/dev/null}"

[ "$live" = yes ] || exit 1
echo "Done."
