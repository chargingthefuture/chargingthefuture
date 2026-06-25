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
- `GET /api/skills-taxonomy/admin/dependency-impact`

Consumer routes:

- `GET /api/skills-taxonomy/hierarchy`
- `GET /api/skills-taxonomy/flattened`

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
- `skills_taxonomy_change_events` — the append-only audit log of taxonomy mutations. Columns: `id`, `actor_id`, `target_type` + `target_id`, `action`, `reason`, `metadata` (jsonb), `created_at`. One row per change decision on a sector/job-title/skill, providing the auditable evidence required by §4.5.

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

## 6) Operator Safety and Destructive Risk

1. Taxonomy mutations are treated as downstream blast-radius operations due to cross-app selector dependencies.
2. Delete flows require explicit safeguards (dependency-impact preview, policy gates, and role checks) before commit.
3. Safe alternatives (deactivate/rename/reparent) should be preferred when delete risk exceeds approved thresholds.

## 7) Web and Android Delivery Status

`web+android complete`. Web admin taxonomy management lives under `/apps/skills-taxonomy`; Android consumes the same read models via `packages/mobile/src/features/skills-taxonomy`. Hierarchy/flattened reads, admin CRUD, dependency-impact preview, and destructive delete safeguards are consistent across platforms.

Web pixel pass (design `c5d83c0`): the user-facing `/apps/skills-taxonomy` surface is rebuilt to `design/.../survivor-hub/SkillsTaxonomy.tsx` and its Empty/Loading states — the full-height 3-column browser (sectors → job titles → skills) with icon rail, breadcrumb, and in-role skill search. The whole tree loads from the existing `GET /api/skills-taxonomy/hierarchy` route (response `{ items }`); sectors/titles/skills are derived client-side from that nested payload, and sector/title counts use the real `jobTitles.length` / `skills.length`. The mockup's demand/level/category chips and per-sector totals have no backing in the data model and were omitted rather than faked; admin create/edit/delete affordances link to the dedicated `/admin/skills-taxonomy` route. Decomposed into modular sub-components within the rule-116 limits.

Android pixel pass (2026-05-31): the `SkillsTaxonomy` mobile screen is rebuilt from `design/.../survivor-hub/MobileSkillsTaxonomy.tsx` (populated), `MobileSkillsTaxonomyEmpty.tsx`, `MobileSkillsTaxonomyLoading.tsx`, and `MobileSkillsTaxonomyPublic.tsx`. Loads the nested sector → jobTitle → skill tree from `GET /api/skills-taxonomy/hierarchy` (response `{ items: TaxonomyHierarchySector[] }`). All four states (loading, unauthenticated/public, empty, populated) are covered. The populated state renders sector pills (scrollable), a job-title accordion with collapsible skill pills, live client-side search, and a bottom nav. Counts (total skills, total sectors, total job titles) are derived client-side from real API data. A real `SkillsTaxonomyApi.ts` client was added; the old `api/index.ts` stub re-exports from it. The obsolete `MockSkillsTaxonomy.tsx` was already retired; `index.ts` export is unchanged. Omitted: per-sector accent dot color (no color field in API data; fallback to BRAND purple). All TypeScript, EOF format, and parity gates pass.

## 8) Seed Coverage Status

- `ctf/scripts/seedSkillsTaxonomy.mjs` is the deterministic backfill script and imports canonical legacy source data.
- `ctf/scripts/syncSkillsTaxonomyFromPlatform.mjs` is the incremental sync script for repeat updates from the same legacy source.
- Legacy source loader/sync engine lives under `ctf/scripts/lib/` and reads `platform/scripts/data/skills-data.ts` without modifying legacy files.
- Curated, owner-approved skill promotions are applied by `ctf/scripts/seedSkillsTaxonomyPromotions.mjs` (promotion list in `ctf/scripts/lib/seedSkillsTaxonomyPromotions.mjs`). It runs right after the legacy backfill inside `seedSkillsTaxonomy.mjs`, so every reseed keeps promoted occupations and skills. The legacy sync deactivates rows it did not touch; the promotions step runs afterwards and re-activates the promoted occupation and skills on conflict. Each promotion looks the sector up by name (never creates a sector), upserts the occupation under it, then upserts each skill under that occupation; every write is `ON CONFLICT` no-op so re-runs are safe. It also marks the matching `skills_hunt_proposed_skill_promotions` row `status = 'promoted'` when present. Data/script only — no schema change.

## 9) Gaps and Known Technical Debt

1. Downstream dependency threshold for hard-delete denial is encoded as a conservative default; an explicit product-side policy has not been signed off.
2. Elevated destructive actions are gated behind admin role only; a finer-grained role split (e.g., "taxonomy editor" vs "destructive operator") has not been carved out.
3. Read-model evolution has no formal contract versioning process; consumers track shape changes through code review.

## 10) Change Log

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

> **Reconciliation (2026-05-26):** the Delivery Status above is `web+android complete` (feature parity).
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
