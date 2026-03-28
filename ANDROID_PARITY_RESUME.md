# Android Parity — Resume Instructions

Purpose: capture the exact steps and context to continue Android parity work so the next Codespace can pick up without confusion.

Quick resume checklist

1. Start Codespace and authenticate with GitHub (gh auth login or set GITHUB_TOKEN).
2. Fetch branches: git fetch --all && git switch v3 && git pull
3. List WIP parity PRs: gh pr list --state open --search "ctf/android-parity"
4. Pick the next branch (smallest pending todo). Example: git switch ctf/android-parity-mood
5. Install & build: pnpm install && pnpm --prefix ctf/packages/mobile run build
6. Run linters/tests: pnpm --prefix ctf/packages/mobile run lint || pnpm test
7. When ready to request review: ensure CI & Codacy pass. Update PR: gh pr edit <num> --remove-label WIP; gh api -X PATCH repos/chargingthefuture/chargingthefuture/pulls/<num> -f draft=false
8. Update session TODOs: session DB stored under Codespace. Use provided tooling or ask the Copilot agent to mark the active todo as in_progress.

Notes:
- PRs were marked DRAFT and labeled WIP before suspend. Use gh pr view <num> to inspect.
- Avoid re-opening merged PRs; recreate new PRs if needed from branches with additional commits.
- If secrets or environment variables are required (Play Store, Clerk keys), document them in the PR body and do not commit credentials.

Paths of interest:
- Session plan: /home/codespace/.copilot/session-state/*/plan.md
- Repo root: this file (ANDROID_PARITY_RESUME.md)

If anything is unclear on resume, start by running: gh pr list --state open --search "ctf/android-parity" and ask the Copilot agent to continue from the top of the todo list.