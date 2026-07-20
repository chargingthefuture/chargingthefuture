# Skills Taxonomy Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Rewrite target only: `ctf/`
- Plugin name: `Skills Taxonomy`
- Plugin slug / service key: `skills-taxonomy`
- This plugin is the authoritative taxonomy management boundary for sectors, job titles, and skills.

This inventory is the source-of-truth for CTF rewrite implementation scope for Skills Taxonomy.

## Intent and Outcome

Skills Taxonomy is a standalone plugin-owned capability and is not part of non-plugin parity scope.
Taxonomy service and admin UI are combined as one `Skills Taxonomy` plugin scope and are not split into separate plugin surfaces or names.

This plugin must:

1. provide governed hierarchy CRUD for taxonomy entities,
2. provide stable hierarchy and flattened read models for downstream consumers,
3. enforce destructive-action safeguards before deletes,
4. enforce dependency-impact checks to protect cross-app compatibility.

---

## 1) User and Admin Feature Scope

### 1.1 User-Facing Scope

1. No general user-facing taxonomy CRUD in v1.
2. Read-model consumption is exposed through downstream plugin selectors and compatibility adapters.

### 1.2 Admin Feature Scope

1. Hierarchy browser for Sector → Job Title → Skill with expand/collapse controls.
2. Ordered hierarchy display using `display_order` then `name` within each level.
3. Sector CRUD with `name`, `display_order`, and workforce share/count metadata fields.
4. Job title CRUD under parent sector constraints.
5. Skill CRUD under parent job title constraints.
6. Dependency-impact preview prior to destructive actions.

## 2) API and Command Surface

### 2.1 Plugin Command Surface (Authoritative)

All command/access/audit contracts follow templates `201`/`202`/`203`.

Command groups:

1. `skills-taxonomy.hierarchy.get`
2. `skills-taxonomy.flattened.get`
3. `skills-taxonomy.sector.create`
4. `skills-taxonomy.sector.update`
5. `skills-taxonomy.sector.delete`
6. `skills-taxonomy.job-title.create`
7. `skills-taxonomy.job-title.update`
8. `skills-taxonomy.job-title.delete`
9. `skills-taxonomy.skill.create`
10. `skills-taxonomy.skill.update`
11. `skills-taxonomy.skill.delete`
12. `skills-taxonomy.dependency-impact.preview`

### 2.2 HTTP Projection Routes

Admin routes:

- `GET /api/skills-taxonomy/admin/hierarchy`
- `GET /api/skills-taxonomy/admin/flattened`
- `GET /api/skills-taxonomy/admin/sectors`
- `GET /api/skills-taxonomy/admin/sectors/:id`
- `GET /api/skills-taxonomy/admin/job-titles`
- `GET /api/skills-taxonomy/admin/job-titles/:id`
- `GET /api/skills-taxonomy/admin/skills`
- `GET /api/skills-taxonomy/admin/skills/:id`
- `POST /api/skills-taxonomy/admin/sectors`
- `PUT /api/skills-taxonomy/admin/sectors/:id`
- `DELETE /api/skills-taxonomy/admin/sectors/:id`
- `POST /api/skills-taxonomy/admin/job-titles`
- `PUT /api/skills-taxonomy/admin/job-titles/:id`
- `DELETE /api/skills-taxonomy/admin/job-titles/:id`
- `POST /api/skills-taxonomy/admin/skills`
- `PUT /api/skills-taxonomy/admin/skills/:id`
- `DELETE /api/skills-taxonomy/admin/skills/:id`
- `GET /api/skills-taxonomy/admin/dependency-impact` — query params `targetType`, `targetId`, and `operation` (one of `delete`/`deactivate`); all three are required and validated.

Consumer routes:

- `GET /api/skills-taxonomy/hierarchy`
- `GET /api/skills-taxonomy/flattened`
- `GET /api/skills-taxonomy/summary` — **public, unauthenticated.** Returns live aggregate counts `{ sectors, jobTitles, skills }` of active rows (no taxonomy rows, no member data) for the signed-out splash teaser. Command `skills-taxonomy.summary.get`.

## 3) Data Dependencies and Downstream Safeguards

1. Core taxonomy entities: sectors, job titles, skills.
2. Read model projections: hierarchy model and flattened model.
3. Downstream dependency inventory includes Directory, Workforce, and any approved plugin selector surfaces.
4. Delete/update operations require dependency-impact checks before commit.
5. Contract versioning required when read models change shape.
6. Compatibility contract requires both hierarchy and flattened feeds to remain maintained for downstream consumers.

### 3.1 Owned storage tables

The canonical entities live in `skills_taxonomy_sectors`, `skills_taxonomy_job_titles`, and `skills_taxonomy_skills`. Three further tables back the read model, the dependency tracker, and the audit log:

- `skills_taxonomy_flattened_projection` — the denormalized read model behind the flattened feed (`GET /api/skills-taxonomy/flattened`). One row per skill carrying the full chain: `sector_id`/`sector_name`, `job_title_id`/`job_title_name`, `skill_id`/`skill_name`, `skill_aliases` (jsonb), `is_active`, `created_at`/`updated_at`. Rebuilt from the canonical tables so consumers read one flat shape instead of joining three levels.
- `skills_taxonomy_consumer_bindings` — the downstream-reference tracker behind the dependency-impact safeguards (§4). Columns: `id`, `target_type` + `target_id` (the taxonomy node referenced), `consumer_plugin` (e.g. `directory`, `workforce`), `reference_count`, `created_at`/`updated_at`. A non-zero `reference_count` is what blocks a hard-delete of a still-referenced node.
- `skills_taxonomy_change_events` — the append-only audit log of taxonomy mutations. Columns: `id`, `actor_id`, `target_type` + `target_id`, `action`, `reason`, `metadata` (jsonb), `created_at`. `action` is check-constrained to the full vocabulary both writers use: `create`, `update`, `delete` (the app's delete path), `rename`, `reparent`, `deactivate`, `reactivate` (the taxonomy change apply engine); `target_type` is check-constrained to `sector`, `job-title` (hyphen), `skill`. Both checks are `NOT VALID`: they constrain new writes only — the audit log is append-only and historical rows are never rewritten to fit a newer vocabulary. One row per change decision on a sector/job-title/skill, providing the auditable evidence required by §4.5.

## 4) Destructive-Action and Dependency-Impact Requirements

1. Hard-delete is denied when active downstream references exist beyond approved thresholds.
2. Pre-delete dependency preview is mandatory for sector/job-title/skill delete actions.
3. High-impact delete paths require elevated role + explicit purpose code.
4. Policy-safe alternatives (deactivate/rename/reparent) should be available where feasible.
5. Every destructive decision (allow/deny) must emit auditable evidence.

## 5) Security and Compliance Controls

1. Authenticated admin access is required for all admin routes and mutation commands.
2. Admin-only mutation commands with server-side RBAC/ABAC checks.
3. CSRF protection for all taxonomy mutation routes.
4. Deny-by-default policy enforcement for writes.
5. Admin action logging is required for sector/job-title/skill create/update/delete mutations.
6. Audit coverage for create/update/delete and dependency-impact checks.
7. Request validation and integrity constraints to prevent hierarchy corruption.
8. Durable audit store: the delete path writes one row to `skills_taxonomy_change_events` (see §3.1) as the durable evidence of a destructive decision. The contract `dataAccess`/`dataClassesAccessed` audit data class is named `skills_taxonomy_change_events` to match this real store (there is no `skills_taxonomy_audit_log` table). Create/update/list/preview commands additionally emit a policy-decision audit line via `logSkillsTaxonomyAudit`; only the delete path persists a durable row today.

## 6) Operator Safety and Destructive Risk

1. Taxonomy mutations are treated as downstream blast-radius operations due to cross-app selector dependencies.
2. Delete flows require explicit safeguards (dependency-impact preview, policy gates, and role checks) before commit.
3. Safe alternatives (deactivate/rename/reparent) should be preferred when delete risk exceeds approved thresholds.

## 7) Web and Android Delivery Status

Delivery: **web + mobile-responsive complete**. **Android (React Native) surface removed 2026-07-20 (rule 105, PR #1742)** — this feature is now web-only, served by the installable web app (PWA). Web admin taxonomy management lives under `/apps/skills-taxonomy`. Historical parity detail: a former Android surface consumed the same read models via `packages/mobile/src/features/skills-taxonomy` (now removed); hierarchy/flattened reads, admin CRUD, dependency-impact preview, and destructive delete safeguards were consistent across platforms.

Web pixel pass (design `c5d83c0`): the user-facing `/apps/skills-taxonomy` surface is rebuilt to `design/.../survivor-hub/SkillsTaxonomy.tsx` and its Empty/Loading states — the full-height 3-column browser (sectors → job titles → skills) with icon rail, breadcrumb, and in-role skill search. The whole tree loads from the existing `GET /api/skills-taxonomy/hierarchy` route (response `{ items }`); sectors/titles/skills are derived client-side from that nested payload, and sector/title counts use the real `jobTitles.length` / `skills.length`. The mockup's demand/level/category chips and per-sector totals have no backing in the data model and were omitted rather than faked; the browser is read-only — there is no in-app taxonomy editor (taxonomy changes go through the append-only change list, not the UI). Decomposed into modular sub-components within the rule-116 limits.

Android pixel pass (2026-05-31): the `SkillsTaxonomy` mobile screen is rebuilt from `design/.../survivor-hub/MobileSkillsTaxonomy.tsx` (populated), `MobileSkillsTaxonomyEmpty.tsx`, `MobileSkillsTaxonomyLoading.tsx`, and `MobileSkillsTaxonomyPublic.tsx`. Loads the nested sector → jobTitle → skill tree from `GET /api/skills-taxonomy/hierarchy` (response `{ items: TaxonomyHierarchySector[] }`). All four states (loading, unauthenticated/public, empty, populated) are covered. The populated state renders sector pills (scrollable), a job-title accordion with collapsible skill pills, live client-side search, and a bottom nav. Counts (total skills, total sectors, total job titles) are derived client-side from real API data. A real `SkillsTaxonomyApi.ts` client was added; the old `api/index.ts` stub re-exports from it. The obsolete `MockSkillsTaxonomy.tsx` was already retired; `index.ts` export is unchanged. Omitted: per-sector accent dot color (no color field in API data; fallback to BRAND purple). All TypeScript, EOF format, and parity gates pass.

## 8) Seed Coverage Status

- **The live database taxonomy is the source of truth.** The old legacy platform dataset (`platform/scripts/data/skills-data.ts`) and its sync were removed with the legacy app. The legacy-sync scripts (`syncSkillsTaxonomyFromLegacy.mjs`, `loadLegacySkillsData.mjs`, `syncSkillsTaxonomyFromPlatform.mjs`) and the `sync:skills-taxonomy:legacy` package script have been deleted — do not look for or rebuild them.
- **The append-only change list is the only repo path that writes the taxonomy** (owner decision 2026-07-03 — see `ctf/docs/developer/SKILLS_TAXONOMY_CHANGE_GOVERNANCE_PLAN.md`). The list lives in `ctf/scripts/lib/taxonomyChange.mjs` (change vocabulary: addOccupation, addSkill, renameOccupation, renameSkill, reparentSkill, consolidateSkill, deactivateSkill/Occupation, reactivateSkill/Occupation — **no hard-delete change type exists**). CI validates it statically on every PR (`taxonomy-change-gate` job in `ci.yml`; locally `pnpm --dir ctf run check:taxonomy-changes`); `ctf/scripts/seedSkillsTaxonomy.mjs` (the `seed:skills-taxonomy` script) applies it to the live DB via the owner-run `Skills Taxonomy — Apply Changes (production)` workflow (`.github/workflows/seed-skills-taxonomy.yml`).
- Apply semantics (`ctf/scripts/lib/applyTaxonomyChange.mjs`): the whole list replays in one transaction, in order; every change is naturally idempotent (an entry whose end state already holds writes nothing), so re-runs are safe and a reseed can never resurrect a deactivated row. Sectors are looked up by name and never created; a missing sector/target fails the run visibly. Every real mutation writes a `skills_taxonomy_change_events` audit row (actor `taxonomy-change`; rows written before 2026-07-14 carry the older actor value `taxonomy-change-ops`; metadata carries the change id); deactivations record the live member-reference count. `addSkill` keeps the promotion side-effects: matching `skills_hunt_proposed_skill_promotions` rows are marked `promoted`, and the now-official skill is auto-attached to every profile waiting on it — both self-edit Directory "skill not listed" proposals and nominated / community-generated profiles whose SkillsHunt nomination proposed the skill (via `skills_hunt_directory_profiles`). The nominated-profile attach does not depend on the tracker status, so re-applying repairs a nominated profile whose "pending review" chip cleared before this branch existed.
- Do not look for a curated promotions list or `seedSkillsTaxonomyPromotions.mjs` — deleted (migrated into changes 1–25). Append changes instead.

## 9) Gaps and Known Technical Debt

1. Downstream dependency threshold for hard-delete denial is encoded as a conservative default; an explicit product-side policy has not been signed off.
2. Elevated destructive actions are gated behind admin role only; a finer-grained role split (e.g., "taxonomy editor" vs "destructive operator") has not been carved out.
3. Read-model evolution has no formal contract versioning process; consumers track shape changes through code review.

## 10) Change Log

- 2026-07-17: **History-aware back navigation (app-wide sweep).** The member shell's hand-rolled
  back chevron was replaced by the shared `BackChevronButton` — it returns to the previous in-app
  page and falls back to All Apps when there is no in-app history. UI-only; no schema, route, or
  contract change.
- 2026-07-17: **New "Web Developers" job title (changes 52–57).** A live-DB check confirmed the taxonomy had no occupation containing "web" — the nearest were "Software Engineers / Developers" (R&D & High-Tech) and "Software Developers" (Telecommunications & IT), neither a web-development home. Added occupation **Web Developers** under **R&D & High-Tech** (owner sector pick — it clusters the web-building trades already there: UX/UI Designers, Software Engineers / Developers), seeded with five starter skills — **Front-end development**, **Back-end development**, **Full-stack development**, **Web and responsive design**, **JavaScript / TypeScript** — so the occupation is not inert (Workforce matches holders by skill name; a skill-less occupation matches nobody and shows empty in the browser). "Web and responsive design" repeats the name added under Graphic / Visual Designers in change 50 — deliberate, since the same skill name may live under several occupations and each listing extends where its holders are matched. Op 52 creates the occupation; ops 53–57 add its skills in the same apply transaction (no `occupationExisting` flag needed). Appended as changes 52–57 to `ctf/scripts/lib/taxonomyChange.mjs`; additive, applies on the next owner run of the seed-skills-taxonomy apply workflow. Data only — no schema change.
- 2026-07-17: **Two missing design/art skills (changes 50–51).** The taxonomy had no plain "web design" or "illustration" skill a member could pick. Added **Web and responsive design** under the pre-existing **Graphic / Visual Designers** occupation (owner kept it out of the design-heavy UX/UI Designers occupation) and **Illustration and concept art** under the pre-existing **Artists / Illustrators** occupation, both in Creative & Media. UX/UI design was deliberately skipped — it is a job title (the "UX/UI Designers" occupation already exists), not a skill. Appended as changes 50–51 to `ctf/scripts/lib/taxonomyChange.mjs`; additive, applies on the next owner run of the seed-skills-taxonomy apply workflow. Both use `occupationExisting: true` (the occupations are live rows, not created by an earlier change). Because Workforce matches skills by name, the same skill name can later be added under more occupations without a reparent if the owner wants wider matching. Data only — no schema change.
- 2026-07-16: **Attach promoted skills to nominated profiles too (apply-engine fix).** A community-generated / nominated directory profile surfaces a proposed skill through the SkillsHunt nomination link (`skills_hunt_directory_profiles` → the cross-app tracker, shown by `loadProfilePendingSkills`), not through `directory_profile_proposed_skills`. On apply, `applyProposalPromotions` marked the tracker `promoted` (clearing the "pending review" chip) but only auto-attached self-edit proposals — so a nominated skill vanished instead of becoming a real skill (seen with "Chef" on the "Jamie" profile after change 49). Added a second attach in `ctf/scripts/lib/applyTaxonomyChange.mjs` that joins `skills_hunt_directory_profiles` → tracker → the new skill and inserts `directory_profile_skills` (UUID-shape guard before casting the TEXT `directory_profile_id`; `ON CONFLICT DO NOTHING`). It ignores tracker status, so re-running the apply workflow retroactively restores the skill on already-affected profiles. Code only — no schema change.

- 2026-07-16: **Promote skill proposal #1550 — "Chef" (change 49).** SkillsHunt scout proposal for the free-text skill "Chef" (submission 5ead88c9…). Added under the pre-existing "Chefs / Cooks" occupation in Tourism & Hospitality (the issue's AI-suggested placement, confirmed correct). `proposalNormalizedSkills: ['chef']` so the apply run marks the proposal `promoted` and attaches the skill to the proposing member. Appended as change 49 to `ctf/scripts/lib/taxonomyChange.mjs`; additive, applies on the next owner run of the seed-skills-taxonomy workflow. Data only — no schema change.
- 2026-07-15: **New "Advocates / Awareness Raisers" occupation for invited members (changes 43–48).** Bare Quora profiles are invited with a temporary profile, and Directory / Skills Hunt each require at least one skill, so an invited member needs a baseline skill that names what they are already doing on Quora — arguing for humanity and justice, and helping others survive. New occupation "Advocates / Awareness Raisers" under Creative & Media holds **Advocacy** (the baseline skill stamped on temporary invite profiles), Writing, Awareness raising, Storytelling, and Peer support. Appended as changes 43–48 to `ctf/scripts/lib/taxonomyChange.mjs` (validator green, 48 changes); additive, applies on the next owner run of the seed-skills-taxonomy apply workflow. Members swap the baseline once they claim. Wiring Advocacy as the temporary-profile default in the Directory invite/seed path is a dependent follow-up (the occupation/skill must be applied to the live DB first). Data only — no schema change.
- 2026-07-15: **Removed dead admin "add" affordances from the read-only browser (404 fix).** The Sectors `+`, Job Titles `+`, and "Add Skill" buttons — plus the empty-state "Manage taxonomy" button — all linked to `/admin/skills-taxonomy`, a page that does not exist, so each returned a 404 when tapped. There is no in-app taxonomy editor (changes go through the append-only change list), so the affordances were removed and the now-unused `isAdmin` prop was dropped from the browser, shell, and the four column/detail/empty-state components (`skills-taxonomy-browser.tsx`, `skills-taxonomy-shell.tsx`, `st-sectors-column.tsx`, `st-titles-column.tsx`, `st-skills-detail.tsx`, `st-empty-state.tsx`) plus its pass-down in `app/apps/[pluginSlug]/page.tsx`. Android: removed the matching decorative "Add" bottom-nav item in `SkillsTaxonomy.tsx` (inert — no handler — but it advertised the same removed capability). Web typecheck + lint green. UI-only; no schema, route, or contract change.
- 2026-07-14: **Added refresh controls (app-wide refresh rollout).** Web: shared `RefreshButton` in the mobile-responsive header and — because the desktop browser has no header bar — in the desktop icon rail (`skills-taxonomy-browser.tsx`, `st-icon-rail.tsx`); the hierarchy fetch was extracted into a `load` callback so a refresh re-pulls without the full-screen loading state and keeps the current sector selection. Android: native pull-to-refresh via `RefreshControl` on the job-title accordion ScrollView (`SkillsTaxonomy.tsx`); the load was extracted into a shared callback with a background-refresh variant. UI-only; no schema, route, or contract change.
- 2026-07-14: **Plain-language rename of the taxonomy change tooling (owner directive: "ops adds no value"; "dispatch" becomes "run").** File renames: `ctf/scripts/lib/taxonomyChangeOps.mjs` → `taxonomyChange.mjs`, `ctf/scripts/lib/applyTaxonomyChangeOps.mjs` → `applyTaxonomyChange.mjs`, `ctf/scripts/check-taxonomy-change-ops.mjs` → `check-taxonomy-change.mjs`. Symbol renames: `TAXONOMY_CHANGE_OPS` → `TAXONOMY_CHANGES`, `TAXONOMY_CHANGE_OP_TYPES` → `TAXONOMY_CHANGE_TYPES`, `validateTaxonomyChangeOps` → `validateTaxonomyChanges`, `applyTaxonomyChangeOps` → `applyTaxonomyChanges`. CI job `taxonomy-ops-gate` → `taxonomy-change-gate`; package script `check:taxonomy-ops` → `check:taxonomy-changes`; workflow title "Apply Change Ops (production)" → "Apply Changes (production)" (job id `apply-change-ops` → `apply-changes`). New audit rows use actor `taxonomy-change` and reason prefix `change <id>:` (older rows keep `taxonomy-change-ops` / `change-op <id>:` — the audit log is append-only and never rewritten). The list entries themselves (ids 1–42, including the `op:` field key) are untouched: applied history is immutable. Prose in scripts, workflows, the governance plan, and this inventory now says "change list" / "changes" and "owner-run" instead of "change-ops" and "dispatch". Naming only — no behavior change.
- 2026-07-04: **Finance skillset gains a finance home (ops 40–42).** "Financial planning and budgeting" and "Financial modeling and cashflow management" existed only under Agribusiness Managers (Food & Agriculture), confining purely finance-skilled members to agriculture in Workforce. New occupation "Financial Analysts / Accountants" under Professional & Business Services carries both skill names. With Workforce's name-based skill matching (same-day change on the Workforce side), listing the names under the finance occupation matches every holder there too — no reparent, no member migration, and the Agribusiness copies stay untouched for genuinely agricultural finance work. Applies on the next owner dispatch of the apply workflow. Data only — no schema change.

- 2026-07-03: **Deactivate "Marketing and market analysis" under Agribusiness Managers (op 39) — the change that started the governance effort.** The generic marketing skill was parented under a Food & Agriculture occupation, so the Workforce skill-match funneled every holder into that sector. The marketing skillset now lives under Professional & Business Services › Marketing Specialists, and the sole known holder ("00") re-picked their skills there before the op was appended. Reversible; the audit row records the live holder count at apply time. Data only — no schema change.

- 2026-07-03: **Thin the last two near-duplicate marketing pairs (ops 37–38).** With the merge applied (run 28665279225: 8 consolidation absorbs, the singular occupation deactivated), the owner picked the survivors of the remaining pairs: "Content strategy and analytics" survives (op 37 deactivates "Content Marketing") and "Brand Management" survives (op 38 deactivates "Brand strategy and positioning"). Reversible; each audit row records the live member-holder count at apply time. Data only — no schema change.

- 2026-07-03: **New `consolidateSkill` op; ops 26–33 corrected to use it (never applied — permitted correction).** The dispatched apply run exposed a state race the reparent design cannot express: the collision pre-flight checks the live state, but ops 1–9 recreate the singular "Marketing Specialist" rows mid-run (the live rows had changed since the ops were authored — the plural gained a same-named "Marketing" via admin Add Skill), so the freshly recreated source collided at op 26 after a clean pre-flight. Rather than encode assumptions about live data, `consolidateSkill` produces the correct end state whatever the target holds: reparent when the target occupation lacks the name; absorb when it has it (deactivate the source copy with its member-holder count in the audit row, reactivate the target row if inactive). Idempotent in every branch. Ops 26–33 corrected from `reparentSkill` to `consolidateSkill`; validator + engine + governance plan updated; validator exercised against 4 new cases. Script + docs only — no schema change.

- 2026-07-03: **Fourth apply-run finding: a real data collision, and two tools to resolve it.** With all constraints fixed, the apply run failed on op 26: the live "Marketing Specialists" occupation already carries a row named "Marketing" (not visible in the owner's earlier browse screenshot — the collision check matches inactive rows too), and a reparent cannot merge rows, by design. Nothing applied (single transaction). Two changes: (1) the apply engine now runs a read-only **collision pre-flight** that reports every reparent conflict in one error — each with the blocking row's active/inactive state and both rows' member-holder counts — instead of dying on the first of possibly several; (2) the append-only rule is clarified in the ops-list header and the governance plan: an op that has **never successfully applied** may be corrected in place via a reviewed PR (like an unapplied migration), while applied ops stay immutable and are undone only by appending the reverse op. The colliding ops 26–33 will be corrected once the pre-flight (or the owner's current view of the occupation) shows the full conflict set. Script + docs only — no schema change.

- 2026-07-03: **Third apply-chain fix: the audit-vocabulary checks are now `NOT VALID`.** The Neon schema runs after the two constraint PRs failed at `ADD CONSTRAINT ... action_check` with "violated by some row": the live audit table holds historical rows whose `action`/`target_type` predate the canonical vocabulary, and a plain ADD validates all existing rows. Consequences of those failed runs: the old `action_check` was dropped but its replacement never added, and psql stopped mid-file, so every `schema.sql` statement after that line (including the `target_type` declaration) went unapplied. Historical audit rows are deliberately not rewritten (append-only ledger discipline), so both checks are now added `NOT VALID` — enforced for new writes only. `schema.demo.sql` regenerated. After merge the Neon run completes the whole file (also catching up the statements the failed runs skipped); then re-dispatch the apply workflow. Schema + docs only.

- 2026-07-03: **Fixed the second apply-workflow failure: `target_type` vocabulary mismatch.** After the `action` constraint was widened (previous entry), the run failed on the sibling `skills_taxonomy_change_events_target_type_check` — also live-only, also undeclared in `schema.sql`. The apply engine wrote `job_title` (underscore) while the app's delete path and the live check use `job-title` (hyphen); ops 26–33 (`skill`) passed and op 34's occupation deactivation was rejected, rolling the whole run back (nothing applied). The engine now writes `job-title`, and `schema.sql` declares the `target_type` check explicitly (`sector`, `job-title`, `skill`) with the drop + re-add idiom so no hidden vocabulary remains on this table; `schema.demo.sql` regenerated. Script + schema + docs only.

- 2026-07-03: **Fixed the first apply-workflow run failing on the `action` check constraint.** The live database carried a `skills_taxonomy_change_events_action_check` older and narrower than the audit vocabulary (it predates the change-ops engine and is absent from `schema.sql` — live-side drift), so the engine's first `reparent` audit write was rejected and the whole run rolled back (nothing applied — the apply is one transaction by design). `schema.sql` now declares the constraint explicitly with the full vocabulary (`create`, `update`, `delete`, `rename`, `reparent`, `deactivate`, `reactivate`) using the idempotent drop + re-add idiom; `schema.demo.sql` regenerated. The Neon update workflow applies it to the live DB on merge; re-dispatch the apply workflow after that. Schema + docs only.

- 2026-07-03: **Thin the near-duplicate marketing skills left by the merge (ops 35–36).** Owner picked the survivor of each pair: "Market research and segmentation" survives (op 35 deactivates "Market Research") and "Search Engine Optimization (SEO)" survives (op 36 deactivates "SEO/SEM and paid-media management"). Deactivations are reversible and each audit row records the live member-holder count at apply time. The remaining two near-duplicate pairs ("Content Marketing" vs "Content strategy and analytics"; "Brand Management" vs "Brand strategy and positioning") are left untouched pending the owner naming the survivors. Data only — no schema change.
- 2026-07-03: **First governed change — merge the duplicate "Marketing Specialist" occupation (ops 26–34).** The live taxonomy carried two occupations under Professional & Business Services: the pre-existing "Marketing Specialists" (plural, 5 skills) and the "Marketing Specialist" (singular, 8 skills) that op 1 created on 2026-06-21 — the exact-name occupation match did not catch the plural, so the promotion created a twin. Owner decision: combine them, keeping the plural (it matches the sector's plural naming convention and is the original live row). Ops 26–33 reparent all eight singular skills (Marketing; Social Media Marketing; Content Marketing; Search Engine Optimization (SEO); Email Marketing; Market Research; Brand Management; Copywriting) into "Marketing Specialists" — member profile links follow the skill row ids, so no member loses a skill — and op 34 deactivates the emptied singular (the apply engine refuses the op if any active skill remains). No exact-name collisions with the plural's five pre-existing skills. Applies on the next owner dispatch of the `Skills Taxonomy — Apply Change Ops (production)` workflow after merge. Data only — no schema change.
- 2026-07-03: **Taxonomy change governance — the append-only change-ops list replaces the curated promotions list** (owner decisions: ops list over desired-state; deactivate-only + reparent, no hard delete ever; owner-run manual-dispatch apply; see `ctf/docs/developer/SKILLS_TAXONOMY_CHANGE_GOVERNANCE_PLAN.md`). New `ctf/scripts/lib/taxonomyChangeOps.mjs` (op vocabulary + `TAXONOMY_CHANGE_OPS` + pure static validation) and `ctf/scripts/lib/applyTaxonomyChangeOps.mjs` (transactional, order-preserving, naturally idempotent replay; audit row per real mutation in `skills_taxonomy_change_events`; live member-reference counts recorded on deactivations; promotion side-effects preserved on `addSkill`). `seedSkillsTaxonomy.mjs` now applies the ops list; the `seed-skills-taxonomy.yml` workflow (renamed "Apply Change Ops") validates the list before applying and stays `workflow_dispatch`-only. New CI gate `taxonomy-ops-gate` in `ci.yml` runs `check-taxonomy-change-ops.mjs` on every PR (package script `check:taxonomy-ops`); validator behavior exercised against 8 failure/success cases (sequential ids, unknown ops, missing targets, duplicates, missing acknowledged-impact notes, use-after-deactivate, reparent collisions). The three `APPROVED_SKILL_PROMOTIONS` entries were migrated into ops 1–25 and the promotions lib + standalone runner deleted (per the all-code-live rule, no unused shim retained). The generated skill-proposal issue body now describes the ops path. Remaining plan tasks: the marketing reparent (needs the owner-named target occupations), the `taxonomy-change` issue template, and retiring the admin write surface. Data/script/CI/docs — no schema change.
- 2026-06-29: **Removed the legacy dependency from the taxonomy seed (owner direction — legacy should be long gone).** Deleted `syncSkillsTaxonomyFromLegacy.mjs`, `loadLegacySkillsData.mjs`, and `syncSkillsTaxonomyFromPlatform.mjs`, and dropped the `sync:skills-taxonomy:legacy` package script. `seedSkillsTaxonomy.mjs` (the `seed:skills-taxonomy` script) no longer backfills from the removed `platform/scripts/data/skills-data.ts` dataset — it now applies **only** the curated promotions against the live DB (the source of truth), so the command works again (it previously crashed trying to read the deleted legacy file). The one neutral helper the promotions/proposal scripts shared (`normalizeTaxonomyName`) moved to a new `ctf/scripts/lib/taxonomyNames.mjs`. The generated skill-proposal issue body (`proposeSkillPromotions.mjs`) now points at the live-DB promotions path instead of the legacy sync. No schema change.
- 2026-06-29: Promoted the **Merchandising** skill (skill proposal #1180, from a SkillsHunt nomination) under the existing **Retail & Services › Supply Managers** occupation in the live taxonomy — it joins the occupation's existing skills (Inventory control, Supplier negotiation, Demand forecasting). Appended to `APPROVED_SKILL_PROMOTIONS` in `ctf/scripts/lib/seedSkillsTaxonomyPromotions.mjs` (idempotent; sector + occupation already exist, so the seed only adds the skill and marks the proposal `promoted`). Also clarified, in both `seedSkillsTaxonomyPromotions.mjs` and `syncSkillsTaxonomyFromLegacy.mjs`, that **legacy is deprecated and the live database taxonomy is the source of truth** — the old `platform/scripts/data/skills-data.ts` dataset was removed, so agents should add skills via the promotions list against the live DB, not by chasing the legacy file. Data/script + docs only — no schema change.
- 2026-06-27: Added a public, unauthenticated `GET /api/skills-taxonomy/summary` (command `skills-taxonomy.summary.get`) returning live aggregate counts `{ sectors, jobTitles, skills }` of active rows, and wired the signed-out splash teaser to it on both web (`skills-taxonomy-public-shell.tsx`) and mobile (`SkillsTaxonomy.tsx` / `SkillsTaxonomyApi.ts`). This replaces the earlier behavior where the signed-out splash showed zeros (the only counts source, `/hierarchy`, is auth-gated). The endpoint returns only counts — no taxonomy rows or member data — so it carries no access gate; the counts are read straight from the tables, so adding a sector/job title/skill is reflected on the next load. While the counts load or if the fetch fails, both surfaces fall back to neutral phrasing rather than showing zeros. `getTaxonomySummary()` added to the repository; command + access-policy (publicAccess) contracts updated.
- 2026-06-27: Resolved code-review sweep findings for this plugin. (1) Reconciled the audit data class name in the command and audit contracts from `skills_taxonomy_audit_log` to `skills_taxonomy_change_events`, which is the real durable store the delete path writes to (no `skills_taxonomy_audit_log` table exists); noted the audit-store policy in §5. (2) The mobile screen now skips the hierarchy fetch when the viewer is signed out and renders the public splash, and the unauthenticated branch is checked before the error branch. (3) Documented the deliberate `includeInactive` defaults (admin opts out, public opts in) inline on both endpoints. (4) The `dependency-impact` route now reads, validates, and audits a required `operation` param (`delete`/`deactivate`), and emits a `deny` / `invalid_target` audit decision when the target is not found. (5) The admin sectors/job-titles/skills list GETs now emit a policy-decision audit line on success and failure. Documented the `operation` param on the dependency-impact route in §2.2.
- 2026-06-25: **Documented the three owned support tables** (inventory-debt burn-down — documentation catch-up, no code change). Added `skills_taxonomy_flattened_projection` (flattened read model), `skills_taxonomy_consumer_bindings` (downstream-reference tracker for dependency-impact), and `skills_taxonomy_change_events` (mutation audit log) to §3.1, each from its `schema.sql` definition. Removed these three tables from `ctf/scripts/inventory-drift-allowlist.json`.
- 2026-06-25: Added the owner-approved promotion for game design / development. New occupation "Game Designers / Developers" under the existing "Creative & Media" sector, with 14 skills: Game Design, Level Design, Narrative Design, Game Systems Design, Game Development, Gameplay Programming, Game Physics, Game AI Programming, Multiplayer Networking, Unity, Unreal Engine, Godot, Game Prototyping, and Playtesting & QA. Appended to `APPROVED_SKILL_PROMOTIONS` in `ctf/scripts/lib/seedSkillsTaxonomyPromotions.mjs`; it upserts the occupation and skills on the next reseed (idempotent), looking the sector up by name (never creating it). No SkillsHunt proposal backs it, so `proposalNormalizedSkills` is empty. Data/script only — no schema change.
- 2026-06-21: Added a durable, idempotent promotion path for owner-approved free-text skills. New `ctf/scripts/seedSkillsTaxonomyPromotions.mjs` plus shared list in `ctf/scripts/lib/seedSkillsTaxonomyPromotions.mjs`, wired to run right after the legacy backfill in `seedSkillsTaxonomy.mjs`. First promotion: occupation "Marketing Specialist" under the existing "Professional & Business Services" sector, with skills Marketing, Social Media Marketing, Content Marketing, Search Engine Optimization (SEO), Email Marketing, Market Research, Brand Management, and Copywriting (fulfils the "Marketing" proposal, issue #681). The promotion step also marks the matching `skills_hunt_proposed_skill_promotions` row `status = 'promoted'`. Also added a "Context for the agent picking this up" section to the generated skill-proposal issue body in `ctf/scripts/proposeSkillPromotions.mjs` documenting the taxonomy model, tables, file locations, and the promote recipe. Data/script only — no schema change.
- 2026-06-12: The Android Skills Taxonomy API client (`SkillsTaxonomyApi.ts`) now uses the shared authenticated fetch helper, which attaches the signed-in user's Clerk bearer token and reads the server address from runtime config (`APP_URL`), replacing the env-based origin lookup and plain fetch against a hardcoded development URL. No schema, route, or contract change.
- 2026-05-31: Android pixel pass. Rebuilt `SkillsTaxonomy.tsx` mobile screen from `MobileSkillsTaxonomy.tsx` (and Empty/Loading/Public variants). Added `SkillsTaxonomyApi.ts` real API client (GET /api/skills-taxonomy/hierarchy). Covers loading, unauthenticated, empty (admin/non-admin), and populated states. Omitted: per-sector color (no API backing; uses brand purple). Retired the old `api/index.ts` stub (now re-exports from canonical client). TypeScript, EOF, and parity gates green.

- 2026-05-29: Web UI circle-back (design `c5d83c0`; unblocked by the design re-pin). Rebuilt the `/apps/skills-taxonomy` browser from the prior summary/snapshot shell to the `SkillsTaxonomy.tsx` mockup (3-column hierarchy + Empty/Loading). Loads the nested tree from the existing `GET /api/skills-taxonomy/hierarchy` (response `{ items }`) and derives the columns client-side; no schema/API change. Decomposed into modular sub-components (`st-shared`, `st-loading`, `st-icon-rail`, `st-empty-state`, `st-sectors-column`, `st-titles-column`, `st-skills-detail`, plus the browser and shell). Real data only; the mockup's demand/level/category chips were omitted as unbacked.

- 2026-05-18: Replaced "Web and Android Parity Notes" with canonical "Web and Android Delivery Status" (`web+android complete`). Removed deferred-owner/milestone tracking and "Phase-0 baseline" framing per Rule 120. Renamed "Open Decisions" to canonical "Gaps and Known Technical Debt" and removed Android-parity-deferral entries.
- 2026-03-02: Delivered web/API runtime baseline (migration + hierarchy/flattened routes + admin CRUD + dependency preview + delete safeguards + audit + CSRF + deterministic seed).
- 2026-03-02: Added Option B legacy-data migration path (one-time backfill + incremental sync) from `platform/scripts/data/skills-data.ts` into plugin-owned taxonomy tables.
- 2026-02-25: Created initial Skills Taxonomy plugin inventory.


## Build Checklist

> **Reconciliation (2026-05-26):** the Delivery Status above was `web+android complete` (feature parity) at the time; the Android surface was removed 2026-07-20 (rule 105, PR #1742) and this feature is now **web-only**.
> Unchecked items below are obsolete web-first / Android-deferral planning artifacts and deferred MVP
> validation/release gates (Rule 118) — not missing implementation. The authoritative production bar
> (pixel-perfect to `design` + parity + gates + deploy) is tracked in
> `ctf/docs/developer/PRODUCTION_READINESS_PLAN.md`, which wins where it differs from this checklist.

### Scope and Boundary

- [x] Confirm implementation scope is `ctf/` only.
  - Acceptance criteria:
    - No implementation work is required in `platform/`.
- [x] Confirm plugin slug and namespace lock.
  - Acceptance criteria:
    - Stable plugin slug is `skills-taxonomy` across inventory, contracts, and routes.

### �� Contract Lock

- [x] Define v1 plugin command contracts.
  - Acceptance criteria:
    - Command set conforms to `.claude/rules/201-plugin-command-schema-template.mdc`.
- [x] Define v1 access policy contracts.
  - Acceptance criteria:
    - Each command includes role/attribute checks, legal basis metadata, and deny conditions under `.claude/rules/202-plugin-access-policy-schema-template.mdc`.
- [x] Define v1 audit contracts.
  - Acceptance criteria:
    - Each command has allow/deny and result audit coverage under `.claude/rules/203-plugin-audit-schema-template.mdc`.
- [x] Lock destructive-delete policy matrix.
  - Acceptance criteria:
    - Clear allow/deny rules exist for sector/job-title/skill deletes with dependency thresholds.

### �� Schema and Migrations

- [x] Define taxonomy entities and constraints in `ctf/migrations/`.
  - Acceptance criteria:
    - Sector/job-title/skill tables and parent-child constraints are migration-backed.
- [x] Define hierarchy and flattened read-model projections.
  - Acceptance criteria:
    - Projection rebuild strategy and versioning approach are documented.
- [x] Define retention and rollback/replay notes.
  - Acceptance criteria:
    - Migration rollback and replay evidence plan is approved.

### �� API and Policy Implementation

- [x] Implement hierarchy and flattened read endpoints.
  - Acceptance criteria:
    - Read models are deterministic and match command contracts.
- [x] Implement sector/job-title/skill CRUD endpoints.
  - Acceptance criteria:
    - Parent-child validation and integrity constraints are enforced server-side.
- [x] Implement dependency-impact preview endpoint.
  - Acceptance criteria:
    - Preview returns impacted downstream consumers before destructive actions.
- [x] Enforce deny-by-default policy checks.
  - Acceptance criteria:
    - Unauthorized or non-compliant writes are denied with stable reason categories.

### �� Web and Mobile Parity

- [ ] Deliver web admin hierarchy management surface. (Deferred: owner `taxonomy-web-admin-phase1`, target milestone `2026-03-22`)
  - Acceptance criteria:
    - Hierarchy browse + CRUD + dependency warnings are functional.
- [ ] Deliver Android read-model parity for approved dependent apps. (Deferred: owner `taxonomy-android-read-parity`, target milestone `2026-04-15`)
  - Acceptance criteria:
    - Android consumers resolve hierarchy/flattened models with equivalent semantics.
- [ ] Validate parity drift controls.
  - Acceptance criteria:
    - Contract snapshots and parity checks detect web/mobile read-model divergence.

### �� Security and Compliance

- [x] Verify authz/authn controls for all plugin routes.
  - Acceptance criteria:
    - Admin mutation routes enforce server-side RBAC/ABAC and session controls.
- [x] Verify CSRF controls for mutation routes.
  - Acceptance criteria:
    - Create/update/delete endpoints reject missing or invalid CSRF tokens.
- [x] Verify audit evidence coverage for destructive actions.
  - Acceptance criteria:
    - Delete allow/deny outcomes include actor, purpose, target class, and timestamp metadata.

### �� Validation, Seeds, and Release Gates [MVP: VALIDATION DEFERRED — see Rule 118.]

- [x] Command/access/audit parity design documentation.
  - Acceptance criteria:
    - Command names and required fields are documented across contract files.
- [x] Dependency safeguards design.
  - Acceptance criteria:
    - Destructive-delete policy and dependency warnings are documented with deterministic fixtures.
- [x] Cross-app compatibility design.
  - Acceptance criteria:
    - Directory/Workforce (and approved dependents) compatibility requirements are documented for hierarchy/flattened outputs.
- [x] Deterministic seed fixtures for taxonomy scenarios.
  - Acceptance criteria:
    - Seeded hierarchy trees and dependency references are reproducible.
- [x] Release gate review.
  - Acceptance criteria:
    - Inventory + checklist are updated in the same PR as accepted scope changes.

### Open Decisions Tracker

- [x] Final dependency threshold values for hard-delete denial.
- [x] Final elevated-role policy for destructive actions.
- [ ] Full Android admin CRUD parity plan.

### Change Log

- 2026-02-25: Created initial Skills Taxonomy rewrite checklist with contract, schema, API/policy, parity, security/compliance, destructive-delete safeguards, dependency-impact checks, and cross-app compatibility validation gates.
- 2026-03-02: Completed taxonomy phase-0 core runtime scope (migration + API + policy + dependency safeguards + seed), with explicit web-admin and Android parity deferment owners/dates.
