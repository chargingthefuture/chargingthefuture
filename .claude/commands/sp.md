---
description: Place proposed skills by hand — sector, occupation, and a promote-or-close call on each skill-proposal issue — when the scheduled placement has no API credit.
---

Do the placement step of `.github/workflows/skills-proposal-issues.yml`
(`ctf/scripts/proposeSkillPromotions.mjs`) from this session. That workflow runs every 6 hours and
pays for one model call per proposed skill to pick its sector and occupation; when the account has
no credit it is red on purpose and nothing is filed. Its manual twin,
`skills-proposal-issues-manual.yml`, files the same `skill-proposal` issues with the placement left
open ("Placement pending"). You are the model now: fill that placement in.

`$ARGUMENTS` may name issue numbers. If it is empty, work every open `skill-proposal` issue whose
body still reads "Placement pending". If it says to file new ones, do step 1 first.

## 1. File the queue (only when asked, or when nothing is pending and the owner wants new ones)

Start `skills-proposal-issues-manual.yml` on `main` with `actions_run_trigger` (optional
`proposal_limit` input; blank means 10). It reads the database, which this session cannot, and
writes the same dedupe row a funded run writes, so no skill is filed twice. Check the run with
`actions_get` until it has finished, then read its new issues. A run that finds no candidates files
nothing; say so and stop.

## 2. Place each issue

Read the issue body. The **Allowed placements** section lists every active occupation by sector,
read from the live database when the issue was filed. Pick from that list only: a sector or
occupation name that is not on it does not exist. Older issues filed before that section existed
have no list; for those, take names from `ctf/scripts/lib/taxonomyChange.mjs` and say in the reason
which part could not be confirmed.

Before suggesting a placement, check that the proposal is really a new skill. Most bad proposals
are one of three things, and the right answer for each is to recommend closing the issue:

- **A job title, not a skill** ("Taxi Driver", "Graphic Design" as the name of the designer's
  occupation). The fix is the member's job title on their Directory profile, or an
  `addOccupation` op, never a skill named after the job.
- **A near-duplicate of a skill that already exists** ("Business Management" beside "Business
  Administration"). Two labels for one skill split its holders in half; changes 35–38 in
  `taxonomyChange.mjs` had to clean that up once already.
- **Too broad to be one skill** (a field rather than something a person can do).

## 3. Write it into the issue body

Edit the issue body in place with `issue_write`, so it reads exactly as a funded run's issue does
and nobody has to look in two places:

- Replace the "Placement pending" line with
  `- Suggested sector: **<sector>**` and `- Suggested occupation: **<occupation>**`.
- Replace the `> Why:` line with one sentence: why this occupation, and, when the proposal should
  not be promoted, `Recommend closing:` and the reason from step 2.

Change nothing else in the body. Do not close the issue and do not write the taxonomy: the owner
decides from the issue, and promoting is an `addSkill` op in a PR, as the issue's own "How to
promote" section says.

## 4. Report

One line per issue: number, skill, the placement, and promote or close. No other text.
