#!/usr/bin/env bash
# sync-design.sh — Advance the pinned `design/` submodule to the design-repo remote HEAD.
#
# Submodule-pin model (see .claude/rules/128-design-sync-workflow-rules.mdc):
#   A "design sync" in the app repo only bumps the pinned design SHA. It copies no mockup
#   files into the app tree and deletes nothing. It is strictly read-only against the design
#   repo — it never writes to or pushes to the design remote (the design→app flow is one-way).
#
# Usage:
#   ctf/scripts/sync-design.sh           # fetch, show new design commits, advance pointer, stage
#   ctf/scripts/sync-design.sh --dry-run # fetch + show what WOULD change; do not advance pointer
#
# After running, review the staged submodule bump and commit it with a message naming the
# adopted design commits, then implement/update production shells per rule 126.
set -euo pipefail

DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

if [[ ! -e design/.git ]]; then
  echo "design/ submodule is not initialized. Run: git submodule update --init --remote design"
  exit 1
fi

echo "Fetching design repo..."
git -C design fetch --quiet origin

current="$(git -C design rev-parse HEAD)"
remote="$(git -C design rev-parse origin/HEAD 2>/dev/null || git -C design rev-parse FETCH_HEAD)"

if [[ "$current" == "$remote" ]]; then
  echo "Already at the latest design HEAD ($current). Nothing to sync."
  exit 0
fi

echo
echo "New design commits ($current..$remote):"
git -C design log --oneline "$current..$remote"
echo

if [[ "$DRY_RUN" == "1" ]]; then
  echo "(dry run) Pointer NOT advanced. Re-run without --dry-run to adopt these commits."
  exit 0
fi

echo "Advancing submodule pointer to design remote HEAD..."
git submodule update --remote design
git add design

echo
echo "Staged design pointer bump to $remote."
echo "Next: commit it (name the adopted design commits in the message), then implement shells per rule 126."
