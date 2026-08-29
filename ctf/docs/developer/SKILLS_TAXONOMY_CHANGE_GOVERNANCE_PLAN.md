# Skills Taxonomy Change Governance — Design and Build Plan

Owner-approved direction (2026-07-03). The skills taxonomy (sector → occupation → skill) is baseline
data for Directory, Workforce, SkillsHunt, Foundation, SkillUp, and GDP — accuracy matters the way the
ServiceCredits ledger matters. It must not be edited one-off. Every change flows through one checked,
reviewed, reproducible path.

## Owner decisions (fixed)

1. **Change representation:** an append-only, ordered **change list** in the repo
   (migration-style), not a desired-state file.
2. **No hard delete, ever.** Deactivate-only (`is_active = false`) plus reparent. Reversible,
   ledger-style. The existing `skills_taxonomy_change_events` audit log records every applied change.
3. **Apply trigger:** owner-run manual start (the GitHub Actions `workflow_dispatch` trigger), extending the
   existing `seed-skills-taxonomy.yml` pattern. Never auto-apply on merge.
4. **The Skills Taxonomy admin write surface is retired** — last, after the change-list path covers every
   operation. The in-app plugin becomes read-only for everyone; admins use the member browse view.
5. **Append-only applies to applied history.** An entry that has never successfully applied (every run
   containing it failed and rolled back) may be corrected in place via a reviewed PR — like an
   unapplied migration. An entry that has applied is immutable; undo it by appending the reverse change.

## The flow

1. **Request** — a GitHub issue describes the change. Sources: the existing automated
   `skill-proposal` intake (`proposeSkillPromotions.mjs`, unchanged), or the owner filing an issue
   directly after reviewing the member-facing taxonomy browser.
2. **PR** — an agent (or human) turns the issue into a PR that appends changes to the change list.
   Free text becomes a reviewable diff.
3. **Check** — a CI job validates the change list on every PR (the human-error gate; see below).
4. **Merge** — owner-review lane; the owner merges.
5. **Apply** — the owner starts the apply workflow by hand, which runs the changes against the live
   database. Idempotent: already-applied changes write nothing.

## Change vocabulary (the whole surface)

- `addOccupation` — sector (looked up by name, never created) + occupation name.
- `addSkill` — occupation + skill name (+ optional aliases).
- `renameSkill` / `renameOccupation` — old name → new name (aliases keep the old label findable).
- `reparentSkill` — move a skill row to a different occupation. Member profile links follow the row
  (`directory_profile_skills.skill_id` is unchanged), so nobody loses a skill.
- `consolidateSkill` — merge-aware move for occupation merges: reparent when the target occupation
  lacks the name; absorb (deactivate the source copy, reactivate the target row if needed) when it
  already has it. Deterministic end state whatever the live data holds.
- `deactivateSkill` / `deactivateOccupation` — soft-off. No `delete*` op exists.
- `reactivateSkill` / `reactivateOccupation` — the reverse, so mistakes are recoverable.

Sectors are deliberately not creatable/deactivatable via the change list (same as today's promotions
rule: a missing sector is a mis-named entry, not a creation request).

## CI validation (the check that prevents human error)

- The change list parses; every entry is one of the vocabulary above; ordered ids never reused or reordered.
- Sector referenced by name exists in the committed sector list; occupation/skill targets of
  rename/reparent/deactivate changes must be created by an earlier change or declared as pre-existing
  live rows.
- No duplicate skill (normalized name) under the same occupation after replaying the whole list.
- A `deactivate*` change must carry an `acknowledgedImpact` note when the target is above the
  dependency threshold (the apply step re-checks live counts via the same query the
  `dependency-impact` endpoint uses and aborts if the note is missing or stale).
- A deactivated target cannot be referenced by later changes (except `reactivate*`).

## Apply-time checks (what the static check cannot see)

The static check only sees what the change list declares. The live rows are in the database, not the
repo, so a change that collides with a live row validates cleanly and only goes wrong at apply time.
These checks run in the apply engine, which does see them:

- **Plural-twin guard on `addOccupation`** (added 2026-08-29). Refuses to create an occupation that
  names a role a live occupation in the same sector already names, comparing singular forms and
  splitting compound labels on `/`. This is the mistake the taxonomy has made twice — "Marketing
  Specialist" beside "Marketing Specialists" (cleaned up by changes 1 and 26–34) and "Photographer"
  beside "Photographers / Videographers" (changes 68–76) — each time splitting one role's holders
  across two rows that neither Workforce nor the Directory joins back together, and each time
  costing nine changes to unwind. The guard fails the whole run, so the transaction rolls back and
  the change is corrected in a PR rather than cleaned up afterwards. Deactivated rows count: creating
  a twin of a row somebody deliberately turned off would quietly resurrect the split.
  It applies to changes appended from id 80 on. Everything below replays as before, because change 1
  *is* the Marketing twin — guarding it would leave the list unable to replay itself into a fresh
  database, aborting on the historical entry that records the problem before any cleanup could run.
  Every `addOccupation` between 2 and 79 was checked against the live occupation list and none names
  a twin, so the boundary costs no coverage.
  Deliberately imperfect in the safe direction: the `/` split cannot tell that "Graphic / Visual
  Designers" is short for "Graphic Designers / Visual Designers", so a later "Graphic Designers"
  would not be flagged. It is a net for the obvious case, not a proof — better to miss one than to
  block a legitimate add on a guess. `renameOccupation` is not guarded; a rename into a twin is still
  possible and is caught only by review.

## Build tasks (ordered; no phases)

1. **Define the change module** — `ctf/scripts/lib/taxonomyChange.mjs`: the change vocabulary, the
   append-only list, and pure validation of the list shape. Migrate the three existing
   `APPROVED_SKILL_PROMOTIONS` entries into equivalent `addOccupation`/`addSkill` changes so there is
   one list. No dependencies. **Done 2026-07-03** (changes 1–25; the promotions lib and its standalone
   runner were deleted outright rather than shimmed — nothing called them once the seed switched,
   and the all-code-live rule forbids an unused shim).
2. **Apply engine** — extend the seed script to replay the change list against the live DB:
   rename/reparent/deactivate/reactivate in addition to today's upserts, each write recorded in
   `skills_taxonomy_change_events`, each change idempotent. Blocked by task 1. **Done 2026-07-03**
   (`ctf/scripts/lib/applyTaxonomyChange.mjs`; promotion side-effects preserved on `addSkill`).
3. **CI check** — a PR job that runs the list validation (task 1) plus the static consistency rules
   above; wire into `ci.yml`. Blocked by task 1. **Done 2026-07-03** (`taxonomy-change-gate` job,
   `ctf/scripts/check-taxonomy-change.mjs`, package script `check:taxonomy-changes`).
4. **Apply workflow** — extend/replace `seed-skills-taxonomy.yml` (`workflow_dispatch` only) to run
   the apply engine with Infisical-injected `DATABASE_URL`. Blocked by task 2. **Done 2026-07-03**
   (renamed "Skills Taxonomy — Apply Changes (production)"; validates the list before applying;
   fails visibly on missing sectors/targets).
5. **First governed change** — the pending marketing reparent: `reparentSkill` for
   "Marketing and market analysis" from Agribusiness Managers (Food & Agriculture) to the
   Professional & Business Services occupation the owner names, plus `addSkill` changes for the
   Creative & Media and Retail & Services occupations the owner names. Blocked by task 4 and the
   owner naming the target occupations (live names visible in the admin/browse screen).
6. **Issue template + intake note** — a `taxonomy-change` issue template capturing change-shaped fields.
   Blocked by task 1 (vocabulary must exist to reference). The `skill-proposal` issue body
   generator already describes the change-list path (done 2026-07-03 with task 1).
7. **Retire the admin write surface** — remove the ST admin write routes
   (`POST/PUT/DELETE /api/skills-taxonomy/admin/{sectors,job-titles,skills}[/:id]`) and their
   command/access-policy/audit contract entries; keep every read route. The admin page's only wired
   control today is Add Skill — replace it with a link to file a `taxonomy-change` issue. Update the
   ST inventory (routes, controls, change log) in the same PR. Blocked by tasks 4 and 5 (the change-list path
   must have applied a real change end-to-end first). **Done 2026-08-28.** The six route files each
   keep their `GET` and carry a comment saying why the writes are gone; the nine command,
   access-policy and audit contract entries are removed, as are the 17 repository functions that had
   no other caller. The dead "Add Skill" control had already been removed in 2026-07-14 (PR #1528),
   so there was no button left to replace — the plugin has been read-only in the app since then. The
   stated blocker was spent: the change list has grown from 25 entries to 57 and carries the
   `reparentSkill` task 5 named. Found while sweeping for admin actions that write no audit row —
   auditing an ungoverned bypass would have made it more comfortable to use, so this was done
   instead.
8. **Inventory + rules sync** — record the governance model in the ST feature inventory and add a
   short taxonomy-change section to the relevant rule module so agents route all taxonomy changes
   through change-list PRs. Blocked by task 7.

Lane: owner-review for tasks 2, 4, 5, and 7 (foundational data, contracts, stateful apply logic);
low-risk lane for 1, 3, 6, and 8.

## Interactions worth knowing

- **Reseed safety:** because the change list is the single write path and replays idempotently, a
  reseed can never resurrect a deactivated skill — deactivation is itself an entry in the list, so
  every replay lands on the same end state.
- **Workforce/SkillUp:** reparenting a skill instantly moves its holders' sector/occupation match in
  the Workforce live model (it reads `skills_taxonomy_skills.job_title_id` at request time). Gap
  numbers shift on the next read; no Workforce change needed.
- **Demo data:** `schema.demo.sql` / demo seeds are unaffected (ops apply to the live DB; demo
  provisioning is a separate path).
