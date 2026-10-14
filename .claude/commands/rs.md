---
description: Review one plugin or module and file code-review issues by hand — the no-credit route for the code-review sweep.
---

Do the job of `.github/workflows/code-review-sweep.yml` (`ctf/scripts/reviewCodebaseSlice.mjs`)
from this session: review ONE slice of the codebase and file a GitHub issue per finding, in the same
shape the sweep files, so `/cr` and the implement workflow can work them later. This creates
findings; `/cr` works them. `$ARGUMENTS` may name a slice (a plugin slug such as `lighthouse`, a
standalone module such as `auth`, or a catch-all such as `web-pages`); if it is empty, pick the
slice the sweep would pick.

## 1. Pick the slice with the script, not by reading the ledger

The ledger has two copies: the scheduled sweep keeps its own on the `code-review-ledger` branch and
this route stamps the copy on `main`. Read both, or the pick is wrong. Fetch the branch copy, then
let the script discover the slices and choose:

```
git fetch --depth=1 origin code-review-ledger
git show FETCH_HEAD:ctf/config/code-review-ledger.json > /tmp/code-review-ledger.branch.json
CODE_REVIEW_LEDGER_MERGE_PATHS=/tmp/code-review-ledger.branch.json \
  node ctf/scripts/reviewCodebaseSlice.mjs --pick [slice]
```

If the branch does not exist yet, skip the first two lines and run `--pick` on its own. The output
names the slice and why it was chosen, lists its folders and every file in it, its contracts, any
findings left over from a capped scheduled run (file those first — they were already reviewed and
deduped once, so only check they still hold), and which slices are new or never reviewed. It runs
the same discovery as the sweep, so a folder added since the ledger was last written is seen; the
ledger file alone does not list it. Add `--json` for machine-readable output.

The sweep's order is: a slice with `partial: true` first, then one with leftover findings, then any
with `lastReviewedAt: null`, then the oldest `lastReviewedAt`. A slice is every folder with that name
across `ctf/packages/web/app/api`, `components`, `lib` and `ctf/packages/mobile/src/features`, plus
the page folder of that name under `app/` or `app/apps/`, reviewed together. The catch-all slices
(`web-pages`, `web-shell`, `mobile-shell`, `<name>-package`, `scripts`, `ops`, `sql`, `ctf-root`)
hold everything no named slice claims; a page folder named differently from its plugin is declared
under `extraPaths` in `ctf/config/code-review-slice-manifest.json`.

## 2. Review it

Read the slice's source, its contracts under `ctf/docs/contracts/` (the `<PLUGIN>_PLUGIN_*` files
the pick output names), and the code it imports from outside itself. There is no byte budget by
hand: review the entire slice, however many scheduled runs the pick output says it would take. Look
for concrete, high-signal defects: a route that breaks its declared contract, a mismatch between
the API and the screen that calls it, an access check missing where the access policy contract
requires one, a silent catch (rule 137), data a deletion contract says is removed but a query still
joins to. Do not file style notes. Hand the reading of a large slice to a helper agent and keep only
its findings.

## 3. Dedupe against what is already filed

List issues labeled `code-review` in this repo, open and closed, whose title starts with
`Code review (<slice>):` — and with any former name the slice declares under `aliases` in
`ctf/config/code-review-slice-manifest.json`. Do not file a finding that an existing issue already
describes, in any wording. A closed one is durable: dismissed stays dismissed.

## 4. File each finding

One issue per finding. Title: `Code review (<slice>): <short finding title>`. Labels: `code-review`,
plus `code-review:actionable` only when the fix is small, local and safe enough for an automatic PR.
Body, in this order: an HTML comment `<!-- code-review-fingerprint: <fp> -->` where `<fp>` comes from
`node ctf/scripts/reviewCodebaseSlice.mjs --fingerprint "<slice>" "<title>"` (the same function the
sweep uses — do not compute it another way), one line
`Automated code review of the <plugin|module> \`<slice>\` (<n> folder(s)).`, then
`**Severity:**`, `**Category:**`, `**Files:**`, a `## What` section, a `## Suggested fix` section,
and the same closing note the sweep writes (filed by the sweep; remove the actionable label to keep
it as a tracking note; closing is durable). Copy that closing note from `buildIssueBody` in the
script so the wording matches.

## 5. Stamp the ledger with the script

On a branch per `/br`, run the stamp with the same merge path as the pick, then commit the ledger
and open a `chore:` PR on the auto-merge lane:

```
CODE_REVIEW_LEDGER_MERGE_PATHS=/tmp/code-review-ledger.branch.json \
  node ctf/scripts/reviewCodebaseSlice.mjs --stamp <slice> --issues <number filed>
```

This sets the slice's `lastReviewedAt` to now, clears its partial state and leftover findings, and
saves the reconciled ledger — new slices added as never reviewed, gone ones dropped, and for every
other slice the copy written most recently kept. Do not edit the JSON by hand. The next scheduled run merges
this copy with the branch copy the same way, so the slice is not reviewed twice.

## 6. Report

The slice name, how many issues were filed with their numbers, and the ledger PR link.
