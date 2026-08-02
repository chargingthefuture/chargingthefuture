---
description: Do the task on a descriptive branch and open the PR correctly the first time — title, parity line, and lane set at creation.
---

Do the work described in `$ARGUMENTS` on a properly named branch and open its PR so that every
metadata check passes on the first run. This is the default workflow this repo already mandates —
this command exists because sessions keep ignoring it and developing on the auto-generated
`claude/<slug>` branch. If `$ARGUMENTS` is empty, apply this routine to the work already done in
this session: move any commits off the session branch onto a descriptive branch and open the PR
from there.

## 1. Branch first, before any code

- Create a descriptive branch off the latest `main`: a Conventional-Commit-style prefix plus a
  short kebab-case summary of the task (`feat/lighthouse-listing-filters`,
  `fix/feed-csrf-dedup`, `docs/brand-voice-lexicon`).
- Never develop on, commit to, or open a PR from the session's auto-generated `claude/<slug>`
  branch. If commits already exist there, move them: branch off `main` with the descriptive name,
  cherry-pick or rebase the commits onto it, and abandon the session branch.

## 2. Do the task

- Keep the change minimal and surgical — change only what the task requires.
- Never overwrite approved production design or copy without explicit owner approval.
- Update whatever the drift gates require in the same commit: the plugin feature inventory, the
  manual test script, contracts, the parity contract entry. A change is not done until those match.
- Commit messages end with the session URL on its own line, per `CLAUDE.md`. Never put a model
  identifier in any repo artifact.

## 3. Verify locally before pushing

Run the gates that would fail in CI: typecheck, lint, build, `check-eof-format.sh`, and whichever
drift checks the change touches (`check-inventory-drift.mjs`, `check-test-script-drift.mjs`,
`check-schema-drift.sh`). Fix what they find. Do not push red.

## 4. Open the PR correctly the first time

Set the title and body **at creation** so no check goes red and needs re-triggering:

- Title: Conventional Commit (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `ci:`, `perf:`,
  `test:`, `build:`, `style:`, `revert:`).
- Body: the exact line `Parity Status: web + mobile-responsive + android complete`, plus
  `Android: out of scope (web-only per rule 105)` when the change has no Android keep-list surface
  (Clerk auth, Chyme, bug reporting, settings). Use `Parity Ticket: #<issue>` instead only when
  Android work on a keep-list surface is genuinely deferred.
- Body: say what changed and why, and `Closes #<issue>` for any issue it resolves.
- Open ready for review, never as a draft.

## 5. Pick the lane

- **Low-risk** — copy, styling, responsive layout, types, refactors, docs, dead code, test-only
  changes: enable auto-merge (SQUASH) right after opening.
- **Risky** — ServiceCredits/ledger, auth or access gates, CSRF, data deletion, schema or
  migrations, new or changed API contracts, a whole new plugin: open it ready but do **not** enable
  auto-merge. Say in the body that it is waiting on my review, and tell me in your summary.

## 6. Do not stop at "opened"

Watch the PR: keep the branch up to date when it falls behind `main`, fix any check that goes red,
and confirm it merged (low-risk) or is green and waiting on my review (risky). Then report back in
one short summary: branch name, PR number, lane, and current state. Plain language, no jargon, no
pleasantries.
