# Scheduled "fix failing workflows" agent prompt

This is the prompt to paste into a **Claude Code on the web scheduled trigger** (your account
feature: set a cadence, e.g. every few hours, scoped to `chargingthefuture/chargingthefuture`).
It pairs with the always-on visibility job in `.github/workflows/workflow-health-check.yml`: that
job *surfaces* failures in a triage issue; this agent *fixes* the tractable ones.

The agent can't schedule itself — each session is ephemeral — so the cadence comes from the web
trigger. Keep the prompt scoped and conservative so it never guesses on risky changes.

---

## Prompt

```
Survey this repository's GitHub Actions workflows and fix what is safely fixable.

1. List the active workflows. For each, check its most recent run on `main` and note any whose
   latest run failed or timed out. (The "Workflow Health Check" job's triage issue is a good
   starting list, but verify against the API — it may be stale.)
2. For each failing workflow, read the failing job's logs and find the root cause.
3. Fix only changes that are small and unambiguous — for example: a stale `pnpm-lock.yaml`
   (`pnpm install` then commit the lockfile), a renamed/missing script, a missing env-var guard,
   an EOF/formatting check, or a `--frozen-lockfile` drift. For each fix: work on a descriptive
   branch, open a PR with a Conventional-Commit title and a `Parity Status:` line, and — only for
   low-risk infra/CI changes — enable auto-merge.
4. Do NOT guess on anything that is ambiguous, touches secrets/credentials, changes money/ledger
   or auth/CSRF/schema, or needs a product decision. For those, open or update a single triage
   issue describing the failure and what you suspect, then stop.
5. Never print, commit, or rotate secrets. Don't re-run a flaky workflow more than twice.
6. Finish by replying with a short list: what you fixed (with PR links) and what you left for a
   human and why.

Scope: only the chargingthefuture/chargingthefuture repository.
```

---

## Notes

- The health-check workflow opens/updates one issue labelled `ci-health` and closes it when all
  workflows are green again — so the agent and a human share the same live list.
- Most "silent" failures are the same root cause hitting many scheduled jobs at once (e.g. a stale
  lockfile breaks every `pnpm install --frozen-lockfile` job). Fix the shared cause first.
