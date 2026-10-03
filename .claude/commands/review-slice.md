---
description: Review one plugin or module and file code-review issues by hand — the no-credit route for the code-review sweep.
---

Do the job of `.github/workflows/code-review-sweep.yml` (`ctf/scripts/reviewCodebaseSlice.mjs`)
from this session: review ONE slice of the codebase and file a GitHub issue per finding, in the same
shape the sweep files, so `/cr` and the implement workflow can work them later. This creates
findings; `/cr` works them. `$ARGUMENTS` may name a slice (a plugin slug such as `lighthouse`, or a
standalone module such as `auth`); if it is empty, pick the slice the sweep would pick.

## 1. Pick the slice

Read `ctf/config/code-review-ledger.json`. The sweep's order is: a slice with `partial: true` first,
then any slice with `lastReviewedAt: null`, then the one with the oldest `lastReviewedAt`. A slice is
every folder with that name across `ctf/packages/web/app/api`, `ctf/packages/web/components`,
`ctf/packages/web/lib` and `ctf/packages/mobile/src/features`, reviewed together.

## 2. Review it

Read the slice's source, its contracts under `ctf/docs/contracts/` (the `<PLUGIN>_PLUGIN_*` files),
and the code it imports from outside itself. Look for concrete, high-signal defects: a route that
breaks its declared contract, a mismatch between the API and the screen that calls it, an access
check missing where the access policy contract requires one, a silent catch (rule 137), data a
deletion contract says is removed but a query still joins to. Do not file style notes. Hand the
reading of a large slice to a helper agent and keep only its findings.

## 3. Dedupe against what is already filed

List issues labeled `code-review` in this repo, open and closed, whose title starts with
`Code review (<slice>):`. Do not file a finding that an existing issue already describes, in any
wording. A closed one is durable: dismissed stays dismissed.

## 4. File each finding

One issue per finding. Title: `Code review (<slice>): <short finding title>`. Labels: `code-review`,
plus `code-review:actionable` only when the fix is small, local and safe enough for an automatic PR.
Body, in this order: an HTML comment `<!-- code-review-fingerprint: <sha1 of "<slice>|<title>" in lowercase hex> -->`,
one line `Automated code review of the <plugin|module> \`<slice>\` (<n> folder(s)).`, then
`**Severity:**`, `**Category:**`, `**Files:**`, a `## What` section, a `## Suggested fix` section,
and the same closing note the sweep writes (filed by the sweep; remove the actionable label to keep
it as a tracking note; closing is durable). Copy that closing note from `buildIssueBody` in the
script so the wording matches.

## 5. Advance the ledger

On a branch per `/br`, set the slice's `lastReviewedAt` to now (ISO), `lastRunIssues` to the number
filed, `cursor` to 0 and `partial` to false, and open a `chore:` PR on the auto-merge lane. Without
this the next funded run reviews the same slice again.

## 6. Report

The slice name, how many issues were filed with their numbers, and the ledger PR link.
