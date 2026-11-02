---
description: Work the next open issue in the private chargingthefuture/prompts repository, end to end.
---

The owner writes requests as issues in the private repository `chargingthefuture/prompts`, from a
phone, and types `/q` to have the next one done (owner directive, 2026-11-02). `$ARGUMENTS` may
name an issue number; if it is empty, take the **oldest open issue**. One issue per `/q`.

The prompts live there so they are never saved in a public repository. That is the rule this
command exists to keep.

## 1. Read the issue

- Attach `chargingthefuture/prompts` (`add_repo`) if the session does not have it, and read the
  issue with its comments. Screenshots in the body are part of the request: open each one and look
  at it. If an image cannot be opened from the session, say so in the reply rather than guessing
  what it shows.
- Read the request for intent, the way `CLAUDE.md` says the owner writes: terse is compression,
  not tone. Pick the reading that fits everything else they have said. Ask only when the meaning
  genuinely forks into different work.
- Work out which repository the change lands in. Most land in this one; posts and blog machinery in
  `wiki-site`; the landing page in `landing-page-v4`. Attach it if needed and read its `CLAUDE.md`.

## 2. Do the work

- Changes to files follow `/br` exactly: a descriptive branch off the latest `main`, surgical
  change, the checks CI runs run locally and passing before the push, the PR opened ready with its
  title and body set at creation, and the lane picked by risk.
- A question, a review or an idea with nothing to build: answer it in the issue (step 3) and in the
  reply. Do not invent a change to have something to show.
- A new capability is still the owner's call under the feature freeze. If the issue asks for one
  and nothing in `CLAUDE.md` records the decision, say what building it would take in the issue and
  leave it open with the `needs-owner` label.

## 3. Keep the prompt out of public repositories

- Never copy the issue's text, title or screenshots into a commit message, PR title or body, code
  comment, document, inventory or test script in a public repository. Describe what changed and why
  in your own words, the same rule as "Never Quote the Owner in Repo Artifacts" in `CLAUDE.md`.
  `Owner report:` or `Owner request:` followed by your own description is the house style.
- Do not link the prompts issue from a public PR or commit (no `Closes chargingthefuture/prompts#N`).
  The link runs the other way: the issue gets the PR links.

## 4. Close the loop in the prompts issue

Comment once on the issue, ending with the attribution footer from the session's GitHub rules:

- What was done, in plain words, with every PR link and its lane (auto-merge, or waiting on owner
  review).
- Anything still needed from the owner (a setting only they can change, a decision), stated as the
  exact step.

Then close the issue as completed when the work is done or the question is answered, even if a PR
is still open: the PR carries it from there. Leave it open, labeled `needs-owner`, only when it
cannot go further without the owner, and say why in the comment.

## 5. Reply and stop

A few lines: the issue number and title, what was done, the PR links, and anything the owner has to
do. No PR watching (`CLAUDE.md`, "No PR watching"). The owner types `/q` again for the next one.
