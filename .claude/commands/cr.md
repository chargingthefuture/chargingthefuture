---
description: Work the open code-review issues end to end — verify, fix on a descriptive branch, open the PR, drive it to merge.
---

Work the repository's open code-review findings from start to finish. Do the whole routine below
without asking me to confirm each step. `$ARGUMENTS` may name a specific issue number, plugin, or
slice — if it is empty, take whatever is open.

## 1. Find the work

List open issues labeled `code-review:actionable`, then any other open issue labeled
`code-review` that is not already labeled `code-review:built`. Skip anything that already has an
open PR against it (the auto-PR ones carry the `code-review:auto-pr` label).

If nothing is open and actionable, say exactly that and stop. Do not invent work, and do not open a
PR just to have opened one.

## 2. Verify every finding before you act on it

**Findings are often wrong.** A meaningful share of them describe a bug that the code does not
actually have, or give the right fix for the wrong reason. Read the current code before writing
anything.

For each finding, decide one of three things and act:

- **Real.** Fix it.
- **Real, but the stated reasoning is wrong.** Fix it, and write in the PR body what is actually
  load-bearing — so the next reader does not "fix" it back.
- **Not real.** Do not change the code to satisfy it. Close the issue with a one-paragraph
  explanation of why the claim does not hold, remove the `code-review:actionable` label, and move
  on. Say so in your summary to me too.

Never apply a finding you have not checked against the code.

## 3. Branch and fix

- Descriptive branch off latest `main`: Conventional-Commit prefix plus a kebab-case summary
  (`fix/foundation-instant-call-id`, not the session's `claude/<slug>` branch — never develop on
  that).
- Keep the change minimal and surgical. Fix the finding, not the surrounding file.
- Never overwrite shipped design or copy to satisfy a review finding. If a finding asks for that,
  surface it to me instead.
- Update whatever the drift gates require in the same commit: the plugin feature inventory, the
  manual test script, contracts, the parity contract entry. A change is not done until those match.
- Commit messages end with the session URL on its own line, per `CLAUDE.md`. Never put a model
  identifier in any repo artifact.

## 4. Verify locally before pushing

Run the gates that would fail in CI: typecheck, lint, build, `check-eof-format.sh`, and whichever
drift checks your change touches (`check-test-script-drift.mjs`, `check-inventory-drift.mjs`,
`check-schema-drift.sh`). Fix what they find. Do not push red.

When you edit a document to satisfy a drift gate, confirm the edit actually applied — a string
replacement that silently matches nothing passes the local check for the wrong reason, because
"nothing changed" is a passing state.

## 5. Open the PR correctly the first time

Set the title and body **at creation** so no check goes red and needs re-triggering:

- Title: Conventional Commit (`fix:`, `feat:`, `refactor:`, `docs:`, `chore:`, …).
- Body: the line `Parity Status: web + mobile-responsive + android complete`, plus
  `Android: out of scope (web-only per rule 105)` when the change has no Android keep-list surface.
- Body: `Closes #<issue>` for every finding the PR resolves.
- Say what changed and why, and name any finding whose stated reasoning was wrong.
- Open ready for review, never as a draft.

## 6. Pick the lane

- **Low-risk** — copy, styling, responsive layout, types, refactors, docs, dead code, test-only
  changes: enable auto-merge (SQUASH) right after opening. It merges itself.
- **Risky** — ServiceCredits/ledger, auth or access gates, CSRF, data deletion, schema or
  migrations, new or changed API contracts, a whole new plugin: open it ready but do **not** enable
  auto-merge. Say in the body that it is waiting on my review, and tell me in your summary.

## 7. Drive it to merge — do not stop at "opened"

Watch the PR until it is merged or genuinely stuck:

- **A branch behind `main` stalls auto-merge silently.** This repo requires branches be up to date,
  and every sibling merge pushes the others behind. When a PR reads `behind`, update its branch.
  Expect to do this more than once when several PRs are open.
- A failing check is either a real defect (fix it and push) or environmental (a rate limit, a repo
  setting). Say which. Re-run the environmental ones; do not push commits to paper over them.
- `mergeable_state: blocked` means checks, not conflicts. `dirty` means real conflicts — resolve
  them by rebasing onto `main`.

Keep going until every PR you opened is merged. If one is genuinely stuck, say where and why rather
than going quiet.

## 8. Report back

One short summary: what merged, what you closed as not-real and why, what is waiting on my review,
and anything you deliberately left alone. Plain language, no jargon, no pleasantries.
