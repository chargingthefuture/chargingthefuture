---
description: Build the owner-approved bug fix and open its PR by hand — the no-credit route for the bug-reports build workflow.
---

Do the job of `.github/workflows/bug-reports-build.yml` from this session: turn one owner-approved
triage issue into a pull request. `$ARGUMENTS` may name the issue number in the triage repo; if it
is empty, take the oldest open issue labeled `approved-to-build`.

The triage repo is the PRIVATE `chargingthefuture/bug-reports`. Attach it with `add_repo` first.
Never copy its contents into this public repo, and never quote the reporter in a PR, commit or
comment; describe the problem in your own words.

## 1. Read the agreed plan

Read the issue and all its comments. The latest "Automated triage proposal" comment holds the plan
the owner approved. If the plan is ambiguous, or the fix would be large or risky (schema, auth,
credits, deletion), do not guess: comment on the triage issue saying what blocks you and stop
without opening a PR.

## 2. Build it with `/br`

Follow `.claude/commands/br.md` exactly: a descriptive `fix/<short-kebab-summary>` branch off the
latest `main`, the smallest change that fixes the reported problem, the checks CI would run
(`pnpm --filter @ctf/web typecheck` at minimum, plus lint and the gates touching the files you
changed), the inventory update if a route, table or contract changed, then the PR with a `fix:`
title and the `Parity Status:` line set at creation. Pick the lane by risk as `br.md` says. Link
the triage issue in the PR body by its number and repo, not by quoting it.

## 3. Close the loop on the triage issue

Comment the PR URL on the triage issue, then relabel it: add `built`, remove `approved-to-build`.

## 4. Report

Two lines: the PR link and the lane (auto-merge or owner review). Do not watch the PR.
