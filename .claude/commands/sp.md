---
description: Skill proposals by hand — run the filing workflow, place every pending proposal, and open one PR with the taxonomy changes worth making.
---

Do the job of `.github/workflows/skills-proposal-issues.yml` (`ctf/scripts/proposeSkillPromotions.mjs`)
from this session, and carry it one step further, to the PR. That workflow runs every 6 hours and
pays for one model call per proposed skill to pick its sector and occupation; when the account has
no credit it is red on purpose and nothing is filed. You are the model now.

The owner types `/sp` and nothing else. That one command does all of the steps below, in order, and
ends with a PR. `$ARGUMENTS` may name issue numbers to limit the run to those; otherwise take every
pending proposal.

## 1. File the queue

Start `skills-proposal-issues-manual.yml` on `main` with `actions_run_trigger` (leave
`proposal_limit` blank; it means 10). It reads the database, which this session cannot, files one
`skill-proposal` issue per new proposed skill with "Placement pending", and writes the same dedupe
row a funded run writes, so no skill is filed twice. Check the run with `actions_get` until it has
finished. A failed run is reported with the failing step and the work goes on with the issues
already open.

## 2. Collect the pending issues

Every open `skill-proposal` issue whose body still reads "Placement pending": the ones just filed
and any older ones nobody placed. If there are none, say so in one line and stop.

## 3. Place each issue

The **Allowed placements** section in the body lists every active occupation by sector, read from
the live database when the issue was filed. Pick from that list only: a name that is not on it does
not exist. Older issues filed before that section existed have no list; for those, take names from
`ctf/scripts/lib/taxonomyChange.mjs` and say in the reason which part could not be confirmed.

Then decide **promote** or **close**. Most bad proposals are one of three things, and each is a
close:

- **A job title, not a skill** ("Taxi Driver", "Graphic Design" as the name of the designer's
  occupation). The member's job title on their Directory profile is the fix, not a skill named
  after the job.
- **A near-duplicate of a skill that already exists** ("Business Management" beside "Business
  Administration"). Two labels for one skill split its holders in half; changes 35–38 in
  `taxonomyChange.mjs` had to clean that up once already.
- **Too broad to be one skill** (a field rather than something a person can do).

Write the decision into the issue body in place with `issue_write`, so it reads as a funded run's
issue does: replace the "Placement pending" line with `- Suggested sector: **<sector>**` and
`- Suggested occupation: **<occupation>**`, and replace the `> Why:` line with one sentence — why
this occupation, and for a close, `Recommend closing:` and the reason. Change nothing else in the
body, and do not close any issue yourself.

## 4. Open one PR with the promotions

Follow `/br`: a descriptive branch off the latest `main` (`feat/taxonomy-skill-proposals-<date>`).
For each **promote**, append one `addSkill` op to `TAXONOMY_CHANGES` in
`ctf/scripts/lib/taxonomyChange.mjs`, with the next free id, `occupationExisting: true` when the
occupation is already live, and `proposalNormalizedSkills` naming the proposal's label in lowercase,
so the apply run marks the proposal promoted and gives the skill to the members who proposed it.
Never edit or reorder an existing op. Add a one-line comment above the new ops naming the issues.
Run `pnpm --dir ctf run check:taxonomy-changes` and add the change-log line to the Skills Taxonomy
inventory, as every earlier taxonomy change did.

PR title `feat: promote proposed skills from #<n>, #<n>`. The body lists every issue from this
run in two groups:

- **Promoted** — skill, sector, occupation, one-line reason, and `Closes #<n>`.
- **Recommend closing** — skill and the one-line reason. These issues stay open for the owner to
  close; the PR does not close them.

Owner-review lane: open it ready, do **not** enable auto-merge. After it merges, the owner runs
`Skills Taxonomy — Apply Changes (production)` to put the skills into the live database.

If nothing is worth promoting, open no PR.

## 5. Report

One line per issue (number, skill, promote or close), then the PR number, or "no PR: nothing to
promote". No other text.
