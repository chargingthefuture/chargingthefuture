---
description: Bring this repository's agent rules, hook and shared commands in line with the agents baseline.
---

`chargingthefuture/agents` is the baseline every repository's agent rules start from. Over time a
repository falls behind it. This routine brings one repository back in line, as a single pull
request, without touching anything that belongs to that repository alone.

Run it in each repository attached to the session, unless the owner named one. Never in `agents`
itself, and never edit `agents` from here.

## 1. Get the baseline

Read `AGENTS.md`, `hooks/check-no-pleasantries.mjs`, `settings.example.json` and `commands/` from
the latest `main` of `chargingthefuture/agents`. If the repository is not in the session, attach it
with `add_repo` (read access) and clone it. Do not copy the baseline's own `CLAUDE.md`; it describes
the template repo.

## 2. Compare, and change only what the baseline covers

Work on a descriptive branch off the latest default branch, per `/br`.

1. **Rules file** (`CLAUDE.md`, or `AGENTS.md` where that is the repo's rules file). For each section
   of the baseline above its `<PROJECT-SPECIFIC RULES>` placeholder, find the matching section here.
   - Missing here: add it, in the same place relative to its neighbours.
   - Present and different: take the baseline wording, but keep anything this repository adds to it
     (its own paths, owner decisions, stricter limits). Where this repository's version is stricter,
     keep it.
   - Sections the baseline does not have are this repository's own. Leave them exactly as they are.
2. **Hook** (`.claude/hooks/check-no-pleasantries.mjs`). Make the term list the union of both: add
   every baseline term this copy lacks, keep every term this copy has that the baseline lacks. Leave
   the file's comments that name this repository's own paths.
3. **Hook registration** (`.claude/settings.json`). Make sure the Stop hook is registered. If it
   already is, under any path form, leave it.
4. **Commands** (`.claude/commands/`). Bring in the ones `commands/README.md` says go into every
   repo, this one included. For one this repo already has, apply the baseline's changes and keep the
   lines that name this repo's own checks. Add the others only if this repo has the machinery the
   README says they need. Every command added goes into this repo's command table in its rules file,
   and into anything else this repo's rules say a new command must update.

## 3. Open one pull request

Run the repository's own checks, then open the pull request ready for review with a
Conventional-Commit `docs:` or `chore:` title and whatever body this repository's rules require. Low
risk: turn on auto-merge where the repository allows it. Do not watch it.

If nothing differs, open nothing.

## 4. Answer

One line per repository: the pull request link and what it changed, or "already in line". Then name
anything this repository has that the baseline lacks and every repository should have, so the owner
can decide whether it goes back into `agents`. Do not add it there yourself.
