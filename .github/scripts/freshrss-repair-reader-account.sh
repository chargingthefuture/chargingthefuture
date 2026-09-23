#!/usr/bin/env bash
# Gives the reader an account that matches what the identity provider sends,
# and makes it the administrator. Once.
#
# What went wrong
# ───────────────────────────────
# FreshRSS keeps each account in a folder named after the account and looks it
# up by the exact name. The provider sends the address in lower case, so an
# account whose folder carries a capital letter never matches: sign-in succeeds
# at the provider, FreshRSS finds no such account, and the reader answers 403.
# It also refuses to make the lower-case one, because it rejects a new name that
# differs from an existing one only by case. The settings screen sits behind the
# same check, so none of this can be fixed from inside the reader.
#
# Why this is built out of single commands
# ───────────────────────────────
# Render is the only way in, through the service's start command, and it expands
# anything beginning with a dollar sign before the container sees it while
# leaving quote characters in place as ordinary text. A shell one-liner sent
# that way arrives with every variable blanked and the rest treated as one
# command name; the first attempt exited 127 without running. So each step here
# is one plain command with no variables and no quotes, and the service is
# started once per step.
#
# Those boots end with the container exiting rather than serving, which Render
# reports as a failed deploy. That is the expected shape of this and not an
# error — the work happens on the disk, which outlives the container, and the
# last step hands the service back its own start command and waits for it to be
# live again.
#
# What each step does
# ───────────────────────────────
# 1. FRESHRSS_USER, which the image's own start-up reads, so the account is
#    created if it is missing. It reports "already exists" and changes nothing
#    when it is there, in any capitalization, so it is safe on every boot.
# 2. Rename the mis-capitalized folder onto the lower-case name, which keeps
#    whatever was in it. Fails harmlessly when there is nothing to rename.
# 3. Make that account the default user, which is what makes it the
#    administrator. Without this, an account created in step 1 could sign in
#    and never reach the settings screen.
# 4. Hand the start command back and take FRESHRSS_USER off again, so nothing
#    one-off is left on the service.
#
# Inputs (environment variables)
#   RENDER_API_KEY   required — Render API key (rnd_…)
#   ADMIN_USER       required — the address the provider sends, as a secret
#   SERVICE_NAME     optional — defaults to ctf-freshrss
#   MODE             optional — diagnose reads and changes nothing; repair runs
#
# The address is a secret rather than something typed at the run, because a
# workflow log in this repository is public. It is masked here as well, and
# every line of the service's own log that this prints has addresses replaced
# before it is shown.
#
# Delete this script and the workflow that runs it once the reader lets somebody
# in. It does one thing once.
set -uo pipefail

service="${SERVICE_NAME:-ctf-freshrss}"
mode="${MODE:-diagnose}"
users_path=/var/www/FreshRSS/data/users

fail() { echo "::error title=Reader account not repaired::$1"; exit 1; }

# Every line that reaches this log or the job summary goes through here first.
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
report() {
  echo "── The last lines the container printed ──"
  local logs_status
  logs_status=$(api GET "/logs?ownerId=${owner_id}&resource=${service_id}&limit=40&direction=backward" || true)
  case "$logs_status" in
    2*) jq -r '.logs[]? | "\(.timestamp)  \(.message)"' /tmp/render.json 2>/dev/null | redact || true ;;
    404|403) echo "(Render did not serve the log over the API — HTTP ${logs_status})" ;;
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
    echo "Addresses read \`[address]\` above, because this log is public."
  } >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
  exit 0
fi

# ── The two spellings of the account ──────────────────────────────────────────
[ -n "${ADMIN_USER:-}" ] || fail "ADMIN_USER is not set. Add the address the provider signs you in as, as a repository secret, and give it to this workflow."
lower=$(printf '%s' "$ADMIN_USER" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')
# The spelling to look for on disk. The account was made by hand, and a phone
# capitalizes the first letter of a field on its own, which is how the mismatch
# happened in the first place. Nothing is lost if this is not what is there —
# the rename simply finds nothing.
capital=$(printf '%s' "$lower" | sed -E 's/^(.)/\U\1/')
echo "::add-mask::$lower"
echo "::add-mask::$capital"
case "$lower" in
  *@*.*) ;;
  *) fail "ADMIN_USER does not look like an address. It must be exactly what the provider sends, which the reader prints in its 403." ;;
esac

set_command() {
  local payload
  payload=$(jq -n --arg c "$1" '{ serviceDetails: { envSpecificDetails: { dockerCommand: $c } } }')
  api PATCH "/services/${service_id}" "$payload"
}

# Render replaces the entire set on a PUT, so the existing variables are read
# and merged. Dropping LISTEN or CRON_MIN here would take the service down or
# quietly stop it fetching anything, and dropping an OIDC_ one would turn
# sign-in off.
set_env() {
  # $1 = the value for FRESHRSS_USER, or an empty string to remove it.
  local value="$1" existing merged
  status=$(api GET "/services/${service_id}/env-vars?limit=100" || true)
  case "$status" in
    2*) ;;
    *) fail "Could not read the service's existing variables (HTTP ${status:-none}), and writing without them would drop LISTEN and CRON_MIN." ;;
  esac
  existing=$(jq '[.[] | .envVar | {key, value}] | map(select(.key != "FRESHRSS_USER"))' /tmp/render.json)
  if [ -n "$value" ]; then
    merged=$(jq -n --argjson e "$existing" --arg v "$value" '$e + [{ key: "FRESHRSS_USER", value: $v }]')
  else
    merged="$existing"
  fi
  status=$(api PUT "/services/${service_id}/env-vars" "$merged")
  case "$status" in
    2*) ;;
    *) fail "Render refused the variables (HTTP ${status:-none}). $(jq -r '.message // empty' /tmp/render.json 2>/dev/null)" ;;
  esac
}

wait_for_deploy() {
  # $1 = deploy id. Returns 0 only when the deploy went live. A step whose
  # command exits instead of serving ends as update_failed, which is expected
  # for every step but the last.
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
  # $1 = what to call it in the log, $2 = the start command.
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

# ── Run it ────────────────────────────────────────────────────────────────────
echo "Setting the account the reader should make if it is missing…"
set_env "--user ${lower}"

run_step "Renaming the mis-capitalized account folder" \
  "mv -T ${users_path}/${capital} ${users_path}/${lower}"

run_step "Making that account the administrator" \
  "php -f /var/www/FreshRSS/cli/reconfigure.php -- --default-user ${lower}"

echo "Putting the image's own start command back…"
set_env ""
status=$(set_command "" || true)
case "$status" in
  2*) ;;
  *) fail "Render refused to clear the start command (HTTP ${status:-none}). The service is carrying a one-off command and is not serving. $(jq -r '.message // empty' /tmp/render.json 2>/dev/null)" ;;
esac
deploy_id=$(deploy || true)
[ -n "$deploy_id" ] || fail "The start command was cleared but no deploy started, so the reader is still down. Deploy it from Render and it comes back."

live=yes
wait_for_deploy "$deploy_id" || live=no
if [ "$live" = no ]; then
  report | tee /tmp/report.txt
fi

{
  echo "### The reader's account"
  echo ""
  if [ "$live" = yes ]; then
    echo "Done, and the reader is serving again."
    echo ""
    echo "Open it and sign in. The account now carries the address the provider sends, and it is the default user, which is what makes it the administrator."
  else
    echo "The last step did not come back up, so the reader is down."
    echo ""
    echo "What the service said:"
    echo ""
    echo '```'
    cat /tmp/report.txt
    echo '```'
    echo ""
    echo "Addresses read \`[address]\` above, because this log is public."
  fi
} >> "${GITHUB_STEP_SUMMARY:-/dev/null}"

[ "$live" = yes ] || exit 1
echo "Done."
