#!/usr/bin/env bash
# Creates the FreshRSS service on Render, once.
#
# Why this is a script rather than a dashboard click
# ───────────────────────────────
# The owner works from a phone and prefers the API over a web dashboard. This
# runs in GitHub Actions, where RENDER_API_KEY already lives, so creating the
# service costs one press of "Run workflow" and no terminal.
#
# What it creates
# ───────────────────────────────
# A web service running the official FreshRSS image, with a persistent disk. The
# disk is the part that matters: a reader only holds what it has fetched since
# the day it was subscribed, so the disk IS the archive. Losing it loses
# everything anybody has collected, which is why this is not on a free instance
# — free instances get no disk and spin down after fifteen minutes idle, and a
# reader that only polls while somebody is watching it does not poll.
#
# Idempotent. If a service with this name already exists it reports that and
# changes nothing, so a second run cannot create a duplicate or overwrite
# settings somebody adjusted in the dashboard afterwards.
#
# What it deliberately does NOT do
# ───────────────────────────────
# It creates no admin account. FreshRSS can install itself from environment
# variables, but that means an admin password passing through a CI job in a
# public repository, and a password that reaches a log cannot be un-leaked. The
# first visit to the address runs the browser installer instead, where the
# password is typed by the person who will use it and goes nowhere else.
#
# It sets up no sign-in with the app either. That needs an OAuth application at
# the auth provider, whose redirect address has to be the service's final
# hostname — which is not known until a custom domain is attached. So it waits
# for the domain rather than being wired to an address that is about to change.
#
# Inputs (environment variables)
#   RENDER_API_KEY   required — Render API key (rnd_…)
#   SERVICE_NAME     optional — defaults to ctf-freshrss
#   DISK_GB          optional — defaults to 1
#   PLAN             optional — defaults to starter
#
# Nothing secret is ever printed: not the key, not the service id. The address
# is printed, because that is the thing somebody needs next.
set -uo pipefail

name="${SERVICE_NAME:-ctf-freshrss}"
disk_gb="${DISK_GB:-1}"
plan="${PLAN:-starter}"

# Render's port. The FreshRSS image runs Apache on 80 by default; LISTEN below
# rebinds it, because a service that does not answer on Render's port never
# becomes healthy and the deploy fails with nothing obviously wrong in the log.
port=10000

fail() { echo "::error title=FreshRSS service not created::$1"; exit 1; }

if [ -z "${RENDER_API_KEY:-}" ]; then
  fail "RENDER_API_KEY is not set on this workflow run, so the Render API cannot be called."
fi

api() {
  # $1 = method, $2 = path, $3 = optional body. Writes the response to
  # /tmp/render-api.json and echoes the HTTP status.
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -s -o /tmp/render-api.json -w '%{http_code}' -X "$method" \
      -H "Authorization: Bearer $RENDER_API_KEY" \
      -H 'Content-Type: application/json' \
      -d "$body" \
      "https://api.render.com/v1${path}"
  else
    curl -s -o /tmp/render-api.json -w '%{http_code}' -X "$method" \
      -H "Authorization: Bearer $RENDER_API_KEY" \
      "https://api.render.com/v1${path}"
  fi
}

# ── Already there? ────────────────────────────────────────────────────────────
status=$(api GET "/services?name=${name}&limit=100" || true)
case "$status" in
  2*) ;;
  401|403) fail "Render refused the API key (HTTP ${status}). Check RENDER_API_KEY is the raw rnd_… value." ;;
  *) fail "Could not list Render services (HTTP ${status:-none})." ;;
esac

existing=$(jq -r --arg n "$name" 'map(.service) | map(select(.name == $n)) | .[0].serviceDetails.url // empty' /tmp/render-api.json 2>/dev/null || true)
if [ -n "$existing" ]; then
  echo "A service named '${name}' already exists. Nothing changed."
  echo "Address: ${existing}"
  {
    echo "### FreshRSS already exists"
    echo ""
    echo "Nothing was changed. Its address is ${existing}"
  } >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
  exit 0
fi

# ── Where to put it ───────────────────────────────────────────────────────────
# Same region and owner as the web app, so the two sit together rather than in
# whatever region happens to be the API default.
status=$(api GET "/services?name=ctf-web&limit=10" || true)
owner_id=$(jq -r 'map(.service) | .[0].ownerId // empty' /tmp/render-api.json 2>/dev/null || true)
region=$(jq -r 'map(.service) | .[0].serviceDetails.region // empty' /tmp/render-api.json 2>/dev/null || true)

if [ -z "$owner_id" ]; then
  status=$(api GET "/owners?limit=10" || true)
  owner_id=$(jq -r 'map(.owner) | .[0].id // empty' /tmp/render-api.json 2>/dev/null || true)
fi
[ -n "$owner_id" ] || fail "Could not work out which Render account to create the service under."
region="${region:-oregon}"

echo "Creating '${name}' in ${region} on the ${plan} plan, with a ${disk_gb}GB disk…"

# ── Create ────────────────────────────────────────────────────────────────────
# CRON_MIN is what makes this a reader rather than a web page: the image's own
# scheduler fetches every feed on that minute of the hour. Without it nothing is
# ever collected and every account stays empty.
#
# TZ matches the owner's clock so a date filter in the reader means the day they
# actually mean.
payload=$(jq -n \
  --arg name "$name" \
  --arg ownerId "$owner_id" \
  --arg region "$region" \
  --arg plan "$plan" \
  --arg port "$port" \
  --argjson diskGB "$disk_gb" \
  '{
    type: "web_service",
    name: $name,
    ownerId: $ownerId,
    image: { ownerId: $ownerId, imagePath: "docker.io/freshrss/freshrss:latest" },
    serviceDetails: {
      env: "image",
      region: $region,
      plan: $plan,
      disk: { name: "freshrss-data", mountPath: "/var/www/FreshRSS/data", sizeGB: $diskGB },
      envSpecificDetails: {}
    },
    envVars: [
      { key: "PORT",     value: $port },
      { key: "LISTEN",   value: ("0.0.0.0:" + $port) },
      { key: "CRON_MIN", value: "7,37" },
      { key: "TZ",       value: "America/New_York" }
    ]
  }')

status=$(api POST "/services" "$payload" || true)
case "$status" in
  2*) ;;
  401|403) fail "Render refused to create the service (HTTP ${status}). The API key may be scoped to deploys only, in which case it needs replacing with one that can create services." ;;
  *)
    detail=$(jq -r '.message // empty' /tmp/render-api.json 2>/dev/null || true)
    fail "Render rejected the create (HTTP ${status:-none})${detail:+ — ${detail}}."
    ;;
esac

url=$(jq -r '.service.serviceDetails.url // empty' /tmp/render-api.json 2>/dev/null || true)
[ -n "$url" ] || fail "Render created something but returned no address, so the result cannot be confirmed."

echo "Created. Address: ${url}"
{
  echo "### FreshRSS created"
  echo ""
  echo "Address: ${url}"
  echo ""
  echo "Next, in order:"
  echo ""
  echo "1. Open that address and complete the installer. Pick the admin password there — it is never sent through this workflow."
  echo "2. Attach the custom domain in the Render dashboard."
  echo "3. Come back for sign-in with the app: the OAuth application needs the final hostname, so it waits for the domain."
} >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
