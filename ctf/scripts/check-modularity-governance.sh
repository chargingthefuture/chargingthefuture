#!/usr/bin/env bash
set -euo pipefail

CTF_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$CTF_ROOT"

if ! ESLINT_USE_FLAT_CONFIG=false pnpm exec eslint --version >/dev/null 2>&1; then
  echo "❌ Modularity/complexity governance check failed: eslint is not available via pnpm exec."
  echo "Install dependencies in ctf first (for example: pnpm install)."
  exit 1
fi

echo "🔍 Running modularity/complexity governance checks on ctf/packages..."

# The files a PR (or local branch) changes, relative to ctf/ so they can be passed straight to eslint.
#
# History: this used to diff `git diff HEAD`, which on a clean CI checkout is EMPTY — so the gate found
# no files and passed trivially on every PR. That no-op let a large backlog of rule-116 debt accumulate
# before anyone noticed. It now diffs against the PR's base branch (the merge base), so a PR that adds or
# edits a file with a complexity / function-length violation actually fails. Requires full history — the
# workflow checks this job out with fetch-depth: 0.
collect_changed_files() {
  local base merge_base
  if [ -n "${MODULARITY_DIFF_BASE:-}" ]; then
    base="$MODULARITY_DIFF_BASE"
  elif [ -n "${GITHUB_BASE_REF:-}" ] && git rev-parse --verify "origin/${GITHUB_BASE_REF}" >/dev/null 2>&1; then
    # Pull requests: GITHUB_BASE_REF is the target branch (e.g. main).
    base="origin/${GITHUB_BASE_REF}"
  elif git rev-parse --verify origin/main >/dev/null 2>&1; then
    base="origin/main"
  elif git rev-parse --verify HEAD~1 >/dev/null 2>&1; then
    base="HEAD~1"
  else
    base=""
  fi

  if [ -n "$base" ]; then
    merge_base="$(git merge-base "$base" HEAD 2>/dev/null || echo "$base")"
    # Committed changes since the base (relative to cwd so paths match the eslint invocation below).
    git diff --name-only --relative --diff-filter=ACMRTUXB "${merge_base}...HEAD" 2>/dev/null || true
  fi

  # Also include any uncommitted / untracked working-tree changes so the gate is useful locally too.
  git diff --name-only --relative --diff-filter=ACMRTUXB HEAD 2>/dev/null || true
  git ls-files --others --exclude-standard -- packages 2>/dev/null || true
}

mapfile -t target_files < <(
  collect_changed_files \
    | grep -E '^packages/.+\.(ts|tsx|js|jsx)$' \
    | grep -Ev '\.(test|spec|stories)\.(ts|tsx|js|jsx)$' \
    | sort -u
)

if [ "${#target_files[@]}" -eq 0 ]; then
  echo "✅ No changed package source files detected for modularity governance checks."
  exit 0
fi

echo "Checking ${#target_files[@]} changed file(s):"
printf '  %s\n' "${target_files[@]}"

# --no-inline-config: this gate runs eslint with ONLY the complexity + max-lines rules loaded, so an
# `// eslint-disable-next-line <plugin>/<rule>` comment in a changed file (e.g. jsx-a11y/*, which lives
# in the separate a11y-audit config, not the base lint config) would otherwise error as "Definition for
# rule ... was not found" and fail the gate for an unrelated reason. Ignoring inline config also means a
# function can't dodge this gate with `// eslint-disable complexity` — which is exactly what we want.
if ESLINT_USE_FLAT_CONFIG=false pnpm exec eslint \
  --quiet \
  --no-inline-config \
  --no-error-on-unmatched-pattern \
  --rule 'complexity:["error",10]' \
  --rule 'max-lines-per-function:["error",{"max":200,"skipBlankLines":true,"skipComments":true,"IIFEs":true}]' \
  "${target_files[@]}"; then
  echo "✅ Modularity/complexity governance check passed."
else
  echo "❌ Modularity/complexity governance check failed. A changed file has a function over the"
  echo "   complexity (10) or length (200-line) limit — see .claude/rules/116. Split it into smaller"
  echo "   helpers/components before merging."
  exit 1
fi
