#!/usr/bin/env bash
# Puts two feeds in every reader account that gets made from now on: this blog
# and the owner's demo-video channel. Once.
#
# Why
# ───────────────────────────────
# FreshRSS gives a brand-new account whatever sits in its own default list,
# which is that project's release notes. Somebody who wanted a reader rather
# than a reader project arrives at an empty-looking screen with one feed in it
# that has nothing to do with why they came.
#
# FreshRSS reads data/opml.xml first and only falls back to its own list when
# that file is absent. So one small file on the disk changes what everybody
# gets, and nothing in the app has to know about it. The first run of this
# (2026-09-23) wrote the blog alone; this rewrites the same file with two
# entries, and the copy overwrites what is there.
#
# How the file gets there
# ───────────────────────────────
# The reader's image carries no download tool — no curl, no wget — and Render
# expands anything beginning with a dollar sign in a start command while leaving
# quotes as ordinary text, so a shell one-liner that writes the file cannot be
# sent either. What Render does have is secret files: content set through the
# API and mounted into the container as a real file. So the file is written
# there, copied into place by a start command that is one plain copy and
# nothing else, and the secret removed again afterwards.
#
# The mount path differs between Render's service kinds, so both known paths are
# tried, one service start each. A copy from a path that is not there fails and
# changes nothing, which is why trying both costs only time.
#
# Those starts end with the container exiting rather than serving, which Render
# reports as a failed deploy. That is the expected shape of this. The last step
# hands the start command back and waits for the service to be live again.
#
# What it does not do
# ───────────────────────────────
# It changes nothing for an account that already exists. Anybody already signed
# in adds the feed themselves, in one step, and the announcement post carries a
# link that does it.
#
# Inputs (environment variables)
#   RENDER_API_KEY   required — Render API key (rnd_…)
#   SERVICE_NAME     optional — defaults to ctf-freshrss
#
# Delete this script and the workflow that runs it once a new account arrives
# with both feeds in it. It does one thing once.
set -uo pipefail

service="${SERVICE_NAME:-ctf-freshrss}"
feed="https://chargingthefuture.github.io/chargingthefuture/feed.xml"
site="https://chargingthefuture.github.io/chargingthefuture/"
# The owner's own channel, collected by the blog repository's YouTube workflow.
# Only demo videos of the app go up there; the handle is a random one.
demo_feed="https://chargingthefuture.github.io/chargingthefuture/feeds/youtube/mutilpe.xml"
demo_site="https://www.youtube.com/@mutilpe"
target=/var/www/FreshRSS/data/opml.xml

fail() { echo "::error title=Default feed not set::$1"; exit 1; }

[ -n "${RENDER_API_KEY:-}" ] || fail "RENDER_API_KEY is not set on this run, so the Render API cannot be called."

api() {
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

# ── The service ───────────────────────────────────────────────────────────────
status=$(api GET "/services?name=${service}&limit=100" || true)
case "$status" in
  2*) ;;
  401|403) fail "Render refused the API key (HTTP ${status}). Check RENDER_API_KEY is the raw rnd_… value." ;;
  *) fail "Could not list Render services (HTTP ${status:-none})." ;;
esac
service_id=$(jq -r --arg n "$service" 'map(.service) | map(select(.name == $n)) | .[0].id // empty' /tmp/render.json 2>/dev/null || true)
[ -n "$service_id" ] || fail "No Render service named '${service}'."
owner_id=$(jq -r --arg n "$service" 'map(.service) | map(select(.name == $n)) | .[0].ownerId // empty' /tmp/render.json 2>/dev/null || true)

report() {
  echo "── The last lines the container printed ──"
  local logs_status
  logs_status=$(api GET "/logs?ownerId=${owner_id}&resource=${service_id}&limit=30&direction=backward" || true)
  case "$logs_status" in
    2*) jq -r '.logs[]? | "\(.timestamp)  \(.message)"' /tmp/render.json 2>/dev/null |
          sed -E 's/[^[:space:]]*@[^[:space:]]*/[address]/g' || true ;;
    *) echo "(the log could not be read — HTTP ${logs_status:-none})" ;;
  esac
}

# ── The file ──────────────────────────────────────────────────────────────────
# Two feeds, each named the way it will appear in somebody's list.
opml=$(printf '%s\n' \
  '<?xml version="1.0" encoding="UTF-8"?>' \
  '<opml version="2.0">' \
  '  <head><title>Charging The Future</title></head>' \
  '  <body>' \
  "    <outline text=\"Charging The Future\" type=\"rss\" xmlUrl=\"${feed}\" htmlUrl=\"${site}\"/>" \
  "    <outline text=\"Charging The Future — demo videos\" type=\"rss\" xmlUrl=\"${demo_feed}\" htmlUrl=\"${demo_site}\"/>" \
  '  </body>' \
  '</opml>')

echo "Writing the file Render will mount…"
payload=$(jq -n --arg c "$opml" '{ content: $c }')
status=$(api PUT "/services/${service_id}/secret-files/opml.xml" "$payload" || true)
case "$status" in
  2*) ;;
  *)
    # Older shape: the whole set is replaced at once. Read what is there and
    # add to it rather than writing over somebody else's file.
    echo "  the per-file write was refused (HTTP ${status:-none}); trying the whole-set write."
    status=$(api GET "/services/${service_id}/secret-files?limit=100" || true)
    case "$status" in
      2*) ;;
      *) fail "Could not read the service's secret files (HTTP ${status:-none}), and writing without them would drop any that are there." ;;
    esac
    existing=$(jq '[.[] | .secretFile | {name, content}] | map(select(.name != "opml.xml"))' /tmp/render.json 2>/dev/null || echo '[]')
    merged=$(jq -n --argjson e "$existing" --arg c "$opml" '$e + [{ name: "opml.xml", content: $c }]')
    status=$(api PUT "/services/${service_id}/secret-files" "$merged" || true)
    case "$status" in
      2*) ;;
      *) fail "Render refused the file (HTTP ${status:-none}). $(jq -r '.message // empty' /tmp/render.json 2>/dev/null)" ;;
    esac
    ;;
esac

set_command() {
  local payload
  payload=$(jq -n --arg c "$1" '{ serviceDetails: { envSpecificDetails: { dockerCommand: $c } } }')
  api PATCH "/services/${service_id}" "$payload"
}

wait_for_deploy() {
  local deploy_id="$1" waited=0 state=''
  while [ "$waited" -lt 600 ]; do
    sleep 15
    waited=$((waited + 15))
    api GET "/services/${service_id}/deploys/${deploy_id}" >/dev/null || true
    state=$(jq -r '.status // empty' /tmp/render.json 2>/dev/null || true)
    case "$state" in
      live) echo "  went live after ${waited}s."; return 0 ;;
      build_failed|update_failed|canceled|pre_deploy_failed) echo "  ended as ${state} after ${waited}s."; return 1 ;;
      *) echo "  ${state:-unknown} (${waited}s)…" ;;
    esac
  done
  echo "  did not finish within ${waited}s."
  return 1
}

deploy() {
  local id
  api POST "/services/${service_id}/deploys" '{"clearCache":"do_not_clear"}' >/dev/null || true
  id=$(jq -r '.id // empty' /tmp/render.json 2>/dev/null || true)
  if [ -z "$id" ]; then
    api GET "/services/${service_id}/deploys?limit=1" >/dev/null || true
    id=$(jq -r '.[0].deploy.id // empty' /tmp/render.json 2>/dev/null || true)
  fi
  [ -n "$id" ] || return 1
  printf '%s' "$id"
}

run_step() {
  local label="$1" command="$2" id
  echo "${label}…"
  status=$(set_command "$command" || true)
  case "$status" in
    2*) ;;
    *) fail "Render refused the start command (HTTP ${status:-none}). $(jq -r '.message // empty' /tmp/render.json 2>/dev/null)" ;;
  esac
  id=$(deploy || true)
  [ -n "$id" ] || fail "Render accepted the start command but started no deploy, so '${label}' has not run. The service is carrying a one-off start command and needs putting back."
  wait_for_deploy "$id" || true
}

# ── Copy it into place ────────────────────────────────────────────────────────
run_step "Copying from the container secrets path" "cp /etc/secrets/opml.xml ${target}"
run_step "Copying from the project secrets path" "cp /opt/render/project/src/opml.xml ${target}"

echo "Putting the image's own start command back…"
status=$(set_command "" || true)
case "$status" in
  2*) ;;
  *) fail "Render refused to clear the start command (HTTP ${status:-none}). The service is carrying a one-off command and is not serving. $(jq -r '.message // empty' /tmp/render.json 2>/dev/null)" ;;
esac
deploy_id=$(deploy || true)
[ -n "$deploy_id" ] || fail "The start command was cleared but no deploy started, so the reader is still down. Deploy it from Render and it comes back."

live=yes
wait_for_deploy "$deploy_id" || live=no

# ── Take the secret away again ────────────────────────────────────────────────
# The copy is done and the file on the disk is what FreshRSS reads. Leaving the
# secret mounted would be one more thing on the service that nothing uses.
if [ "$live" = yes ]; then
  api DELETE "/services/${service_id}/secret-files/opml.xml" >/dev/null || true
fi

report | tee /tmp/report.txt

{
  echo "### The reader's starting feed"
  echo ""
  if [ "$live" = yes ]; then
    echo "Done, and the reader is serving again. An account made from now on arrives with this blog and the demo-video channel in it, and nothing else."
    echo ""
    echo "One of the two copy steps was expected to fail — only one of those paths exists. The lines below say which."
    echo ""
    echo "An account that already exists is unchanged; add the channel feed there by hand."
  else
    echo "The last step did not come back up, so the reader is down."
  fi
  echo ""
  echo "What the service said:"
  echo ""
  echo '```'
  cat /tmp/report.txt
  echo '```'
} >> "${GITHUB_STEP_SUMMARY:-/dev/null}"

[ "$live" = yes ] || exit 1
echo "Done."
