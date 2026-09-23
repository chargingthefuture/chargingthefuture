#!/usr/bin/env bash
# Makes every FreshRSS account folder name lower case, once.
#
# What went wrong
# ───────────────────────────────
# FreshRSS keeps each account in a folder named after the account, and it looks
# that folder up by exact name. The identity provider sends the address in lower
# case. An account created with a capital letter therefore never matches: the
# sign-in succeeds at the provider, FreshRSS finds no such account, and the
# reader answers 403 with the name it was handed printed in the message.
#
# It cannot be fixed from inside the reader, because the same mismatch is what
# locks everybody out of the reader's own settings. So it is fixed from the
# outside, here.
#
# How
# ───────────────────────────────
# Render lets a service's start command be set through the API. This sets it to
# a command that renames any folder that is not already lower case, fixes the
# file ownership afterwards, and then starts Apache exactly the way the image's
# own command does — including the flag that switches sign-in on, which a
# start command that forgot it would silently disable.
#
# A folder is left alone when a lower-case one of the same name already exists,
# so this can never merge two accounts into one or delete anything.
#
# It also makes sure the reader is set to create an account for anybody the
# provider vouches for. That is the setting's own default and it is what makes
# the reader hands-off, but it is not reachable from the settings screen, so a
# reader that had it turned off could only ever be opened by an account that
# already existed — and if the mismatch above deleted the last one, that is
# nobody. The edit only changes the word false to true on that one line, so it
# does nothing when the setting is already on or absent.
#
# Then it puts the start command back to the image's own, so the service is not
# left carrying a repair it no longer needs.
#
# Inputs (environment variables)
#   RENDER_API_KEY   required — Render API key (rnd_…)
#   SERVICE_NAME     optional — defaults to ctf-freshrss
#
# Nothing secret is printed, and no account name is printed by this script. The
# renames are named in the service's own log, which only the owner can read.
#
# Delete this script and the workflow that runs it once the reader lets somebody
# in. It does one thing once.
set -uo pipefail

service="${SERVICE_NAME:-ctf-freshrss}"
mode="${MODE:-repair}"

fail() { echo "::error title=Account names not repaired::$1"; exit 1; }

# Every line that reaches the job summary or the run log goes through this
# first. A workflow log in this repository is public, and an account name here
# is somebody's email address. The service's own log, which only the owner can
# read, keeps the names; this does not.
redact() { sed -E 's/[^[:space:]]*@[^[:space:]]*/[address]/g'; }

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

# ── What the service said ─────────────────────────────────────────────────────
# A start command that the container refuses shows up here as a deploy that
# ended, with nothing to say why. The reason is in the service's own events and
# log, and reading them is the difference between fixing the command and
# guessing at it. Read-only: this changes nothing.
report() {
  echo "── The service's recent events ──"
  if [ -n "$owner_id" ]; then
    api GET "/events?serviceId=${service_id}&limit=15" >/dev/null || true
    jq -r '[.[] | .event] | sort_by(.timestamp) | reverse | .[] |
      "\(.timestamp)  \(.type)  \(.details.reason.reasonText // .details.status // .details.exitCode // "" | tostring)"' \
      /tmp/render.json 2>/dev/null | redact || echo "(events could not be read)"
  fi

  echo ""
  echo "── The last lines the container printed ──"
  local logs_status
  logs_status=$(api GET "/logs?ownerId=${owner_id}&resource=${service_id}&limit=60&direction=backward" || true)
  case "$logs_status" in
    2*) jq -r '.logs[]? | "\(.timestamp)  \(.message)"' /tmp/render.json 2>/dev/null | redact || true ;;
    404|403) echo "(Render did not serve the log over the API on this plan — HTTP ${logs_status})" ;;
    *) echo "(the log could not be read — HTTP ${logs_status:-none})" ;;
  esac
}

if [ "$mode" = diagnose ]; then
  echo "Reading only. Nothing is changed."
  report | tee /tmp/report.txt
  {
    echo "### What the reader said"
    echo ""
    echo '```'
    cat /tmp/report.txt
    echo '```'
    echo ""
    echo "Account names are replaced with \`[address]\` above, because this log is public. The service's own log keeps them."
  } >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
  exit 0
fi

# ── The repair command ────────────────────────────────────────────────────────
# Written without any quote characters of its own, because Render splits this
# string into arguments the way a shell would: the double quotes below are
# Render's, and a quote inside them would end the argument early.
#
# The tail of it is the image's own command, reproduced. Losing the OIDC flag
# there would turn sign-in off while looking like it had worked.
repair='/bin/sh -c "u=/var/www/FreshRSS/data/users; for d in $u/*/; do n=$(basename $d); l=$(basename $d | tr A-Z a-z); if [ $n != $l ] && [ ! -e $u/$l ]; then mv $d $u/$l; echo FreshRSS renamed account folder $n to $l; fi; done; sed -i /http_auth_auto_register/s/false/true/ /var/www/FreshRSS/data/config.php; ./cli/access-permissions.sh --only-userdirs; ([ -z $CRON_MIN ] || cron) && . /etc/apache2/envvars && exec apache2 -D FOREGROUND $([ -n $OIDC_ENABLED ] && [ $OIDC_ENABLED -ne 0 ] && echo -D OIDC_ENABLED)"'

set_command() {
  # $1 = the start command, or an empty string to hand the service back to the
  # image's own command.
  local cmd="$1"
  local payload
  payload=$(jq -n --arg c "$cmd" '{ serviceDetails: { envSpecificDetails: { dockerCommand: $c } } }')
  api PATCH "/services/${service_id}" "$payload"
}

wait_for_deploy() {
  # $1 = deploy id. Polls until the deploy is live or has failed. Render reports
  # a failed deploy as a status rather than an error, so a run that did not
  # check would report success while the service was down.
  local deploy_id="$1" waited=0 state=''
  while [ "$waited" -lt 900 ]; do
    sleep 15
    waited=$((waited + 15))
    api GET "/services/${service_id}/deploys/${deploy_id}" >/dev/null || true
    state=$(jq -r '.status // empty' /tmp/render.json 2>/dev/null || true)
    case "$state" in
      live) echo "Deploy finished after ${waited}s."; return 0 ;;
      build_failed|update_failed|canceled|pre_deploy_failed) echo "Deploy ended as ${state}."; return 1 ;;
      *) echo "Deploy is ${state:-unknown} (${waited}s)…" ;;
    esac
  done
  echo "Deploy did not finish within ${waited}s."
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

# ── Run the repair ────────────────────────────────────────────────────────────
echo "Setting the repair start command…"
status=$(set_command "$repair" || true)
case "$status" in
  2*) ;;
  *) fail "Render refused the start command (HTTP ${status:-none}). $(jq -r '.message // empty' /tmp/render.json 2>/dev/null)" ;;
esac

deploy_id=$(deploy || true)
[ -n "$deploy_id" ] || fail "Render accepted the start command but started no deploy, so the repair has not run. The service is now carrying the repair command and needs putting back."

repaired=yes
if ! wait_for_deploy "$deploy_id"; then
  repaired=no
  # Read why before putting the command back, while the failed start is still
  # the most recent thing the service has to say about itself.
  report | tee /tmp/report.txt
fi

# ── Put the start command back ────────────────────────────────────────────────
# Done whether or not the repair worked. Leaving a one-off command on a service
# is how a service ends up doing something nobody can explain a year later, and
# this one pins today's version of the image's command.
echo "Putting the image's own start command back…"
restored=yes
status=$(set_command "" || true)
case "$status" in
  2*) ;;
  *) restored=no; echo "::warning title=Start command not restored::Render refused to clear the start command (HTTP ${status:-none}). The service still works — it is carrying the repair command, which does nothing on a second run." ;;
esac

if [ "$restored" = yes ]; then
  deploy_id=$(deploy || true)
  if [ -n "$deploy_id" ]; then
    wait_for_deploy "$deploy_id" || restored=no
  else
    restored=no
  fi
fi

{
  echo "### FreshRSS account names"
  echo ""
  if [ "$repaired" = yes ]; then
    echo "Ran. Any account folder with a capital letter in it now has a lower-case name, which is the form the identity provider sends, and the reader is set to create an account for anybody the provider vouches for."
    echo ""
    echo "Open the reader and sign in. Either an account was there under the corrected name, or one is made on arrival."
    echo ""
    echo "An account made on arrival is an ordinary one, so the settings screen will not be reachable from it. Say so if that happens: granting it takes another run of this, once the account exists to grant it to."
  else
    echo "The repair deploy did not finish. The reader is unchanged and still refuses sign-in."
    if [ -s /tmp/report.txt ]; then
      echo ""
      echo "What the service said:"
      echo ""
      echo '```'
      cat /tmp/report.txt
      echo '```'
      echo ""
      echo "Account names are replaced with \`[address]\` above, because this log is public."
    fi
  fi
  echo ""
  if [ "$restored" = yes ]; then
    echo "The start command has been put back to the image's own."
  else
    echo "The start command could not be put back. Nothing is broken — it repeats the same repair on each restart and does nothing when there is nothing to rename — but it should be cleared before the reader is left alone."
  fi
} >> "${GITHUB_STEP_SUMMARY:-/dev/null}"

[ "$repaired" = yes ] || exit 1
echo "Done."
