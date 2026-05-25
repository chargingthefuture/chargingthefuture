#!/usr/bin/env bash
# ctf/scripts/cleanup-old-workflow-runs.sh
#
# Deletes all GitHub Actions runs for workflows that no longer have an active
# .yml file, removing them from the Actions sidebar.
#
# Requirements: gh CLI authenticated (`gh auth login`) with repo scope.
# Usage: ./ctf/scripts/cleanup-old-workflow-runs.sh
#
# Safe to re-run. Does NOT delete any active workflow files.

set -euo pipefail

OWNER="chargingthefuture"
REPO="chargingthefuture"

# Active workflow paths — runs for these are preserved
ACTIVE_PATHS=(
  ".github/workflows/backup-formance-supabase.yml"
  ".github/workflows/build-images.yml"
  ".github/workflows/ci.yml"
  ".github/workflows/cleanup-artifacts.yml"
  ".github/workflows/coderabbit-review.yml"
  ".github/workflows/generate-product-update.yml"
  ".github/workflows/github-actions-billing-token-reminder.yml"
  ".github/workflows/github-actions-budget-monitor.yml"
  ".github/workflows/pr-title-semantic.yml"
  ".github/workflows/render-debug-agent.yml"
  ".github/workflows/security-compliance.yml"
  ".github/workflows/update-neon-db.yml"
)

delete_runs_for_workflow() {
  local wf_id="$1"
  local wf_name="$2"
  local page=1
  local total=0

  while true; do
    run_ids=$(gh api \
      "/repos/$OWNER/$REPO/actions/workflows/$wf_id/runs?per_page=100&page=$page" \
      --jq '.workflow_runs[].id' 2>/dev/null || true)

    [ -z "$run_ids" ] && break

    while IFS= read -r run_id; do
      [ -z "$run_id" ] && continue
      if gh api --method DELETE \
        "/repos/$OWNER/$REPO/actions/runs/$run_id" >/dev/null 2>&1; then
        echo "    deleted run $run_id"
        ((total++)) || true
      fi
    done <<< "$run_ids"

    ((page++))
  done

  echo "  $total run(s) deleted for: $wf_name"
}

echo "Fetching all workflows for $OWNER/$REPO..."
wf_list=$(gh api \
  "/repos/$OWNER/$REPO/actions/workflows?per_page=100" \
  --jq '.workflows[] | [(.id | tostring), .name, .path] | @tsv')

while IFS=$'\t' read -r wf_id wf_name wf_path; do
  if [[ -z "$wf_path" || "$wf_path" != .github/workflows/* ]]; then
    echo "SKIP (managed): $wf_name"
    continue
  fi

  keep=false
  for active in "${ACTIVE_PATHS[@]}"; do
    if [[ "$wf_path" == "$active" ]]; then
      keep=true
      break
    fi
  done

  if $keep; then
    echo "KEEP: $wf_name ($wf_path)"
    continue
  fi

  echo "CLEAN: $wf_name ($wf_path, id=$wf_id)"
  delete_runs_for_workflow "$wf_id" "$wf_name"

done <<< "$wf_list"

echo ""
echo "Done. Workflows with all runs removed will no longer appear in the sidebar."
