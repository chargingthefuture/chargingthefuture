#!/usr/bin/env bash
# render-debug-agent.sh
# Autonomously fetches Render service logs, detects known error patterns,
# creates a fix branch, commits fixes, and opens a PR.
#
# Run inside GitHub Actions. Required env vars:
#   RENDER_API_KEY        – Render API key
#   RENDER_SERVICE_ID     – Render service ID to inspect (e.g. srv-xxx)
#   GH_TOKEN              – GitHub token (use secrets.GITHUB_TOKEN in Actions)
#   GITHUB_REPOSITORY     – owner/repo (auto-set in Actions)
#   GITHUB_SHA            – base commit SHA (auto-set in Actions)

set -euo pipefail

RENDER_API="https://api.render.com/v1"
GH_API="https://api.github.com"
REPO="${GITHUB_REPOSITORY}"
BASE_SHA="${GITHUB_SHA}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
FIX_BRANCH="fix/render-auto-${TIMESTAMP}"

# ── helpers ──────────────────────────────────────────────────────────────────

gh_get() {
  curl -sf \
    -H "Authorization: Bearer ${GH_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "$@"
}

gh_put() {
  curl -sf -X PUT \
    -H "Authorization: Bearer ${GH_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    -H "Content-Type: application/json" \
    "$@"
}

gh_post() {
  curl -sf -X POST \
    -H "Authorization: Bearer ${GH_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    -H "Content-Type: application/json" \
    "$@"
}

# ── 1. Fetch Render logs ──────────────────────────────────────────────────────

echo "==> Resolving owner for Render service ${RENDER_SERVICE_ID}..."
# Render's Logs API requires the owner id. Read it from the service object.
SERVICE_RESP=$(curl -s "${RENDER_API}/services/${RENDER_SERVICE_ID}" \
  -H "Authorization: Bearer ${RENDER_API_KEY}")
OWNER_ID=$(echo "$SERVICE_RESP" | jq -r '.ownerId // .service.ownerId // empty' 2>/dev/null || true)

if [[ -z "$OWNER_ID" ]]; then
  echo "==> Could not resolve ownerId for ${RENDER_SERVICE_ID}. The service id may be wrong"
  echo "    or the API key lacks access. Service API response was:"
  echo "$SERVICE_RESP" | head -c 500
  exit 0
fi

echo "==> Fetching logs for Render service ${RENDER_SERVICE_ID} (owner ${OWNER_ID})..."
# Render has no per-service /services/{id}/logs endpoint; the Logs API is a
# top-level GET /v1/logs filtered by ownerId + resource. Response: { "logs": [ { message, ... } ] }.
LOG_RESP=$(curl -s -G "${RENDER_API}/logs" \
  -H "Authorization: Bearer ${RENDER_API_KEY}" \
  --data-urlencode "ownerId=${OWNER_ID}" \
  --data-urlencode "resource=${RENDER_SERVICE_ID}" \
  --data-urlencode "limit=200")

LOGS=$(echo "$LOG_RESP" | jq -r '.logs[]?.message // empty' 2>/dev/null || true)

if [[ -z "$LOGS" ]]; then
  echo "==> No logs returned. Logs API response was:"
  echo "$LOG_RESP" | head -c 500
  exit 0
fi

echo "==> $(echo "$LOGS" | wc -l) log lines fetched. Scanning for errors..."

# ── 2. Detect known error patterns ───────────────────────────────────────────

FIXES=()
DIAGNOSIS=""

if echo "$LOGS" | grep -q "Out of memory"; then
  FIXES+=("oom")
  DIAGNOSIS+=$'\n- **Out of memory** — service exceeded its 512 MB starter plan limit during database migrations. Fix: upgrade plan to `standard` (2 GB).'
fi

if echo "$LOGS" | grep -q "Migration table is already locked"; then
  FIXES+=("migration_lock")
  DIAGNOSIS+=$'\n- **Migration lock stuck** — a previous crash left the knex migration lock held. Fix: `knex migrate:unlock` script added.'
fi

if echo "$LOGS" | grep -qP '\w+ is required'; then
  MISSING=$(echo "$LOGS" | grep -oP '\w+(?= is required)' | sort -u | head -5 | tr '\n' ' ' || true)
  if [[ -n "$MISSING" ]]; then
    FIXES+=("missing_env")
    DIAGNOSIS+=$'\n- **Missing env vars** — the following vars are required but not set: `'"${MISSING}"'`. Check the workflow `env:` block and GitHub secrets.'
  fi
fi

if echo "$LOGS" | grep -q "No open ports detected"; then
  FIXES+=("no_port")
  DIAGNOSIS+=$'\n- **No open ports** — service started but did not bind to the expected port. Verify the `PORT` env var is set to `8080` in the Render service env vars.'
fi

if [[ ${#FIXES[@]} -eq 0 ]]; then
  echo "==> No known error patterns found. Nothing to fix."
  exit 0
fi

echo "==> Issues detected: ${FIXES[*]}"

# ── 3. Create fix branch ──────────────────────────────────────────────────────

echo "==> Creating branch ${FIX_BRANCH} from ${BASE_SHA}..."
gh_post "${GH_API}/repos/${REPO}/git/refs" \
  -d "{\"ref\":\"refs/heads/${FIX_BRANCH}\",\"sha\":\"${BASE_SHA}\"}" > /dev/null
echo "==> Branch created."

CHANGED_FILES=()

# ── 4a. Fix: OOM — upgrade plan starter → standard ───────────────────────────

apply_oom_fix() {
  local FILE_PATH="ctf/scripts/deploy-infisical-render.sh"
  echo "==> Applying OOM fix (plan: starter → standard)..."

  local RESP SHA CONTENT FIXED ENCODED
  RESP=$(gh_get "${GH_API}/repos/${REPO}/contents/${FILE_PATH}?ref=${FIX_BRANCH}")
  SHA=$(echo "$RESP" | jq -r '.sha')
  CONTENT=$(echo "$RESP" | jq -r '.content' | base64 -d)

  if ! echo "$CONTENT" | grep -q 'plan: "starter"'; then
    echo "==> Plan is already not 'starter'. Skipping OOM fix."
    return
  fi

  FIXED=$(echo "$CONTENT" | sed 's/plan: "starter"/plan: "standard"/')
  ENCODED=$(printf '%s' "$FIXED" | base64 -w0)

  gh_put "${GH_API}/repos/${REPO}/contents/${FILE_PATH}" \
    -d "$(jq -n \
      --arg msg "fix: upgrade Render plan starter→standard to resolve OOM during migrations" \
      --arg content "$ENCODED" \
      --arg sha "$SHA" \
      --arg branch "$FIX_BRANCH" \
      '{message:$msg,content:$content,sha:$sha,branch:$branch}')" > /dev/null

  CHANGED_FILES+=("$FILE_PATH")
  echo "==> OOM fix committed."
}

# ── 4b. Fix: migration lock — add unlock script ───────────────────────────────

apply_migration_lock_fix() {
  local FILE_PATH="ctf/scripts/render-unlock-migrations.sh"
  echo "==> Adding migration unlock script..."

  local SCRIPT ENCODED
  SCRIPT='#!/usr/bin/env bash
# render-unlock-migrations.sh
# Run this once after a crash that left the knex migration lock held.
# It directly clears the lock in Postgres so Infisical can start again.
#
# Required env: INFISICAL_DB_URI
set -euo pipefail
: "${INFISICAL_DB_URI:?INFISICAL_DB_URI is required}"
echo "==> Unlocking knex migration table..."
psql "${INFISICAL_DB_URI}" \
  -c "UPDATE knex_migrations_lock SET is_locked = 0 WHERE is_locked = 1;"
echo "==> Done. Re-deploy Infisical to resume."
'
  ENCODED=$(printf '%s' "$SCRIPT" | base64 -w0)

  # Check if file already exists
  local EXISTING_SHA=""
  EXISTING_SHA=$(gh_get "${GH_API}/repos/${REPO}/contents/${FILE_PATH}?ref=${FIX_BRANCH}" 2>/dev/null | jq -r '.sha // empty' || true)

  local PAYLOAD
  if [[ -n "$EXISTING_SHA" ]]; then
    PAYLOAD=$(jq -n \
      --arg msg "fix: add migration unlock script for stuck knex lock" \
      --arg content "$ENCODED" \
      --arg sha "$EXISTING_SHA" \
      --arg branch "$FIX_BRANCH" \
      '{message:$msg,content:$content,sha:$sha,branch:$branch}')
  else
    PAYLOAD=$(jq -n \
      --arg msg "fix: add migration unlock script for stuck knex lock" \
      --arg content "$ENCODED" \
      --arg branch "$FIX_BRANCH" \
      '{message:$msg,content:$content,branch:$branch}')
  fi

  gh_put "${GH_API}/repos/${REPO}/contents/${FILE_PATH}" -d "$PAYLOAD" > /dev/null
  CHANGED_FILES+=("$FILE_PATH")
  echo "==> Migration lock fix committed."
}

# ── 4c. Run fixes ─────────────────────────────────────────────────────────────

for FIX in "${FIXES[@]}"; do
  case "$FIX" in
    oom)             apply_oom_fix ;;
    migration_lock)  apply_migration_lock_fix ;;
    missing_env)     echo "==> Missing env vars noted in PR description." ;;
    no_port)         echo "==> Port binding issue noted in PR description." ;;
  esac
done

# ── 5. Open PR ────────────────────────────────────────────────────────────────

echo "==> Opening pull request..."

CHANGED_LIST=$(printf -- '- `%s`\n' "${CHANGED_FILES[@]}")

PR_BODY=$(cat <<EOF
## Render Auto-Debug Report

**Service ID:** \`${RENDER_SERVICE_ID}\`
**Detected at:** $(date -u +"%Y-%m-%d %H:%M UTC")

### Issues detected
${DIAGNOSIS}

### Files changed
${CHANGED_LIST}

---
> Opened automatically by the [Render Debug Agent](.github/workflows/render-debug-agent.yml).
> Review changes before merging. Re-run the deploy workflow after merge.
EOF
)

PR_RESP=$(gh_post "${GH_API}/repos/${REPO}/pulls" \
  -d "$(jq -n \
    --arg title "fix(render): auto-fix detected deployment errors on ${RENDER_SERVICE_ID}" \
    --arg body "$PR_BODY" \
    --arg head "$FIX_BRANCH" \
    --arg base "main" \
    '{title:$title,body:$body,head:$head,base:$base}')")

PR_URL=$(echo "$PR_RESP" | jq -r '.html_url // empty')
echo "==> PR opened: ${PR_URL}"
echo "PR_URL=${PR_URL}" >> "${GITHUB_OUTPUT:-/dev/null}" 2>/dev/null || true
