# Workforce Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Rewrite target only: `ctf/`
- Legacy `platform/` is reference-only and must not be modified.
- Unified plugin scope slug: `workforce`
- This document is the living snapshot of Workforce per Rule 120.
- V1 scope is full legacy parity plus approved rewrite enhancements.
- Legacy accidental event artifacts from Workforce Recruiter are explicitly out of scope and must not be carried into rewrite design.

Legacy reference preservation:

- Keep `ctf/docs/developer/workforce-recruiter-feature-inventory.md` intact as reference.
- Keep `ctf/docs/developer/workforce-recruiter-rewrite-checklist.md` intact as reference.
- This document is the authoritative merged rewrite source for implementation.

## Intent and Outcome

Workforce is a deterministic workforce planning and reporting plugin with canonical metrics, auditable admin operations, migration-safe contracts, and full parity with legacy Workforce Recruiter capabilities.

Planning constraints applied:

1. Inventory/checklist lifecycle follows `.claude/rules/120-plugin-feature-inventory-lifecycle-rules.mdc`.
2. Metric definitions and rewrite planning align to `.claude/rules/121-canonical-metric-registry-rules.mdc`.
3. Schema and contract planning align to `.claude/rules/122-schema-drift-predeployment-rules.mdc`.
4. Plugin command/access/audit planning aligns to `.claude/rules/200-plugin-command-contract-templates.mdc` and templates `201`/`202`/`203`.

---

Workforce is a **read-only live tracker** of how the skills/talent of a population is distributed across sectors, and where the gaps are. Every number is derived at request time from two upstream sources plus the workforce config; Workforce never writes Directory or Skills Taxonomy.

## 1) User Features

### 1.1 Workforce Dashboard and Drilldowns

1. Live dashboard: Population, Workforce Total, Total Headcount Target, Recruited, Recruitment Progress, Sector Gaps, Skill Level Breakdown, and Top Training Gaps.
2. Demand is population-scale: `population × participation_rate` (workforce config), spread across sectors by each sector's Skills Taxonomy `workforce_share`, then split across the sector's job titles. Supply is read live from Directory: members = active profiles; recruited = the V2 aspirational 3-way match (profiles matching a bucket by sector, job title, or a skill registered under the job title), with the top-line recruited mirroring V2 as the count of all active profiles. Gap = demand − recruited. See section 5 for the exact definition.
3. Drilldowns by sector, skill level, and occupation (the per-occupation training gaps).
4. Deterministic loading/empty/error states for the core screens.

### 1.2 Workforce Directory-Coupled Profile Experience

1. Read-only workforce profile view derived live from the member's own claimed Directory profile (occupation = Skills Taxonomy job title; skill level derived from it; recruited = claimed).
2. Workforce-owned extension fields (availability/work preferences) and a service-scoped deletion marker live in `workforce_user_extension`.
3. There is no profile editor — the profile is read-only; the only write is the compliance soft delete.

### 1.3 Workforce Reporting

1. Current-state report views (sector, skill-level, per-occupation gaps), all derived live. The top-line summary numbers come from the dashboard endpoint; there is no separate summary report route (removed 2026-07-03 — it had no caller).
2. No exporting and no report-running: exporting was removed and there are no stored snapshots or weekly historical buckets — everything is computed live on read.

### 1.4 Workforce Occupations Experience

1. Occupations browse route (read-only list of Skills Taxonomy job titles with their demand/supply overlay, largest gap first), paginated.
2. Occupation detail route with deterministic error/empty handling.
3. Occupations are read from Skills Taxonomy and are never created or edited by Workforce — there are no member- or admin-facing occupation mutations.

## 2) Admin Features

### 2.1 Workforce Admin Operations

1. Admin route for the workforce config (the population model) plus the read-only dashboard snapshot.
2. Admin audit-trail viewer: the admin screen's "Audit trail" panel loads `GET /api/workforce/admin/audit-events` on demand and pages through events newest-first (command, allow/deny, reason, target, actor, timestamp).
3. No occupation/announcement/export/sync/recompute admin surface — those were removed in the read-only model.

### 2.2 Workforce Configuration Governance

1. The only admin-editable, workforce-owned state is the config singleton: `population`, `participation_rate`, `min_recruitable`, `max_recruitable`.
2. Validation and safe defaults on the config update (population > 0; participation 0–1; max ≥ min).
3. Config is never written to Directory or Skills Taxonomy.

### 2.3 Data Stewardship Controls

1. No admin backfill/recompute/sync tool: Workforce is read-only and recruited state derives live from Directory (claimed profiles), so there is nothing to recompute or sync.
2. Demand depends on `skills_taxonomy_sectors.workforce_share`; if no sector carries a positive share the demand falls back to an even split so the breakdown is never blank.

## 3) API Surface and Route Map

### 3.1 Plugin Command Surface

All command contracts must conform to:

- `.claude/rules/201-plugin-command-schema-template.mdc`
- `.claude/rules/202-plugin-access-policy-schema-template.mdc`
- `.claude/rules/203-plugin-audit-schema-template.mdc`

Command groups:

1. `workforce.dashboard.fetch` (live: population-scaled demand from Skills Taxonomy vs Directory supply)
2. `workforce.profile.fetch` (the occupation/skill view is a live read-only Directory view; the read-only availability/work preferences and the deletion marker come from `workforce_user_extension`)
3. `workforce.profile.delete` (service-scoped compliance soft delete: set `service_deleted_at`, reset preference payloads, write `workforce_deletion_events`; CSRF + ownership). Note: `workforce.profile.update` is intentionally retired — the profile is read-only.
4. `workforce.occupations.list` (read-only over Skills Taxonomy job titles with the demand/supply overlay)
5. `workforce.occupations.detail.fetch`
6. `workforce.report.skillLevel.fetch`
7. `workforce.report.sector.fetch`
8. `workforce.report.occupations.fetch` (per-occupation training gaps — the LevelUp recruiting/training signal)
9. `workforce.admin.config.fetch`
10. `workforce.admin.config.update` (population model: population, participation rate, min/max recruitable)
11. `workforce.admin.auditEvents.fetch`

Removed commands (read-only model): `workforce.occupations.admin.create` / `.update` / `.delete` (occupations are read from Skills Taxonomy, never created by Workforce), `workforce.export.job.create` / `.status.fetch` / `.result.fetch` (exporting removed), `workforce.metric.recruited.derive` (recruited is computed live as claimed Directory profiles — no derivation/sync command), and `workforce.report.summary.fetch` (removed 2026-07-03: the route had no caller — the dashboard computes its own top-line summary).

### 3.2 HTTP Projection Routes

User routes:

- `GET /api/workforce/dashboard`
- `GET /api/workforce/public-snapshot` — **public, unauthenticated** aggregate snapshot for the signed-out Workforce landing page. Returns two coarse counts derived from `getDashboard()` — `recruited` (active Directory profiles) and `sectorGaps` (active sectors with demand) — plus `generatedAtIso`. No per-member rows or identifying data, no auth gate; `force-dynamic`; 503 on persistence failure. Backs the landing "Live snapshot". The unfilled-headcount figure ("Not Recruited") is deliberately **not** exposed — against the 5M goal it is a multi-million number that reads as off-putting marketing.
- `GET /api/workforce/profile` — the occupation/skill section is a live read-only view of the member's own claimed Directory profile (occupation = job title, skill level derived, recruited = claimed); the availability/work preferences and the `service_deleted_at` marker are read from `workforce_user_extension`. Emits a `workforce.profile.fetch` audit event. There is no profile update path — the profile is read-only (owner decision 2026-06-16, reaffirmed).
- `DELETE /api/workforce/profile` — service-scoped compliance soft delete (deletion contract sections 5/8/9): sets `service_deleted_at = NOW()` and resets `availability_preferences` / `work_preferences` to `{}` on `workforce_user_extension`, writes a `workforce_deletion_events` row, and retains `workforce_recruited_events`. Requires CSRF + ownership. Emits the `workforce.profile.delete` audit event(s).
- `GET /api/workforce/occupations` — read-only list of Skills Taxonomy job titles with the demand/supply overlay (largest gap first), paginated
- `GET /api/workforce/occupations/:id` — one occupation with its overlay
- `GET /api/workforce/reports/skill-level/:skillLevel` — `all` returns the breakdown; a specific level also returns `detail` (the matched-member drilldown: each member's name, full skill list, sectors, job titles, and matching occupations — each matched occupation carrying its own match reason, the member's skills that produced it when the skill arm fired, and the occupation's remaining demand gap).
- `GET /api/workforce/reports/sector/:sector` — `all` returns the breakdown; a specific sector also returns `detail` (the V2 matched-member drilldown, plus the sector's matched members).
- `GET /api/workforce/reports/occupations` — per-occupation training gaps (supports `?limit=`); the breakdown that later signals LevelUp which cohorts to stand up
- `GET /api/workforce/reports/community-planning` — read-only roster overlay for the survivor-built gated community planning document ([issue #1465](https://github.com/chargingthefuture/chargingthefuture/issues/1465)). Returns the ten planning teams from that document, each a named union of Workforce sectors, with the team's de-duplicated matched-member roster (reusing the sector drilldown's 3-way match), the summed demand target/recruited/gap of its sectors, and any team sector not currently present in the Skills Taxonomy (`missingSectors`). Nothing is stored; recomputes live from the model on every call, so it updates as the Directory changes. Same read gate as the other reports, so member names are only ever returned to a signed-in member — never published publicly.

Removed routes (read-only model): the export routes (`POST /api/workforce/export/jobs`, `GET …/jobs/:jobId`, `GET …/jobs/:jobId/result`) and the admin occupation CRUD routes (`POST/PUT/DELETE /api/workforce/admin/occupations`). Exporting was removed and occupations are read from Skills Taxonomy, so Workforce owns no occupation write surface. Also removed (2026-07-03): `GET /api/workforce/reports/summary` — it had no caller anywhere (web or mobile); the dashboard computes its own top-line summary.

Admin routes:

- `GET /api/workforce/admin/config`
- `PUT /api/workforce/admin/config` — update the population model (population, participation rate, min/max recruitable)
- `GET /api/workforce/admin/audit-events`

## 4) Data Model and Storage Contracts

### 4.1 Canonical Identity and Extension Strategy

1. Reuse canonical profile identity model; no duplicate full profile table.
2. Workforce extension entities keyed by canonical `user_id`.
3. Directory writes are upstream source for recruited-state inference.

### 4.2 Domain Entities

Read-only sources (Workforce never writes these):

- `directory_profiles` — the supply: active profiles are the members; recruited is the V2 aspirational 3-way match (sector / job title / skill), with the top-line total = all active profiles (section 5). Mapped to sectors/occupations via Skills Taxonomy.
- `directory_profile_skills` (+ `skills_taxonomy_skills` matched by normalized skill NAME) — the skill arm of the match: a profile's skill reaches every active occupation that lists a same-named active skill, not just the one occupation whose copy the profile happens to hold (owner decision 2026-07-04 — a skill is a capability, not a pointer).
- `skills_taxonomy_sectors` (with `workforce_share`), `skills_taxonomy_job_titles` — the demand: sectors and occupations, plus each sector's share of the workforce.

Workforce-owned tables in `ctf/schema.sql` (the only state Workforce writes):

1. `workforce_config` — the population model singleton: `population`, `participation_rate`, `min_recruitable`, `max_recruitable` (admin-editable). Demand = `population × participation_rate`, distributed across sectors by `workforce_share`.
2. `workforce_user_extension` — read-only profile preferences + the service-scoped deletion marker.
3. `workforce_admin_audit_trail` — admin operation audit log.
4. `workforce_deletion_events` — service-scoped deletion event log written by `DELETE /api/workforce/profile`.

No longer used by Workforce (tables retained in `schema.sql`, not dropped, to avoid breaking other consumers): `workforce_occupations` (occupations are read from Skills Taxonomy now; the table is still referenced by the SkillsHunt rare-skill snapshot and the demo seed, so it is kept) and `workforce_export_jobs` (exporting removed; no route writes it). The old `workforce_config` columns `exports_enabled` / `report_week_timezone` / `report_week_start_dow` are dropped (no report-running). The vestigial `workforce_profiles` / `workforce_recruited_events` / `workforce_recruited_sync_cursor` tables are not read or written by Workforce.

Note: there is no snapshot table — the dashboard, sector/skill/occupation breakdowns are all derived live from the read-only sources above in `computeWorkforceModel()`.

### 4.3 Storage and Derivation Rules

1. The sector / skill-level / occupation breakdowns (the report routes) are derived live in `computeWorkforceModel()` from one read of the upstream sources; there is no stored snapshot, no inferred-event history, and no weekly bucketing. The **dashboard** top-line totals come from a separate lightweight read (`getDashboard()`): config + sector demand + two counts (active job titles, active profiles). It deliberately skips the expensive per-bucket supply match, because the dashboard returns only top-line numbers — `recruitedTotal` there is the count of all active profiles, identical to the full model, so the two never diverge.
2. **Demand** per sector = (sector `workforce_share` ÷ sum of shares) × `workforce_total`, where `workforce_total = population × participation_rate`. If no sector carries a positive share, demand is an even split across active sectors. Per-occupation demand = its sector's demand split evenly across the sector's active job titles.
3. **Supply** is read from Directory: a profile's own sector resolves by spec precedence — taxonomy-derived signals first (the chosen occupation's sector via `job_title_id → sector_id`, else the sector the profile's skills map to through the taxonomy: plurality across the skills' occupations' sectors, ties broken by sector name), then the raw profile `sector_id` field. Only a profile with no occupation, no skills, and no sector lands in the `Unassigned` bucket (rendered only when non-empty; it carries no demand). Members = all active profiles. **Recruited** is the V2 aspirational match — a profile counts toward a sector/skill-level/occupation if it matches by sector, job title, or a skill registered under the job title (see section 5); the top-line recruited total is the count of all active profiles (V2 parity).
4. **Skill level** is derived live from each job title's name using V2's keyword rule (`lib/workforce/skill-level.ts`) — Foundational / Intermediate / Advanced. No stored skill-level column.
5. **Gap** = `max(0, demand − recruited)` at the sector, occupation, and skill-level grain.
6. The only workforce-owned writes are the config singleton, the profile extension (`workforce_user_extension`), the admin audit trail, and deletion events.

## 5) Recruited Semantics

`recruited` is the V2 aspirational/projection count, computed live, not stored or inferred (owner decision 2026-06-26 — make Workforce match V2 again; the GDP plugin now carries the "actual application of skills" signal, so Workforce stays a projection of potential):

1. **Top-line total mirrors V2 exactly:** the headline "Recruited" is the count of ALL active Directory profiles (`is_active = TRUE AND deleted_at IS NULL`) — not just claimed profiles. (This makes the top-line "Recruited" equal "Directory Members"; the dashboard reconciles the two cards.)
2. **Per-bucket recruited is a live 3-way match.** Per sector, per skill level, and per occupation, `recruited` is the count of DISTINCT active Directory profiles that match the bucket by ANY of three signals:
   - **Sector** — the profile's resolved sector (spec precedence: occupation's sector, else skills-derived sector, else the raw profile sector field — see 4.3.3) is that sector. A profile's own sector matches **every** occupation in that sector (V2 behavior), so per-occupation recruited is intentionally generous.
   - **Job title** — the profile's job title is that occupation's job title.
   - **Skill** — the profile carries a skill whose normalized NAME is listed (as an active skill) under that occupation. Name-based, not row-based (owner decision 2026-07-04): a skill name appearing under several occupations matches its holders to all of them, across sectors. Row-based matching funneled every holder of a shared skill into the single sector whose copy they happened to pick.
3. **Members vs recruited:** `members` stays the physical count of profiles whose resolved sector / job title falls in the bucket; `recruited` is the matched (aspirational) count and can exceed `members` in a bucket.
4. **Live only, no storage:** recruited is counted at request time from Directory + Skills Taxonomy. There is no inferred recruited-event table, no dedupe key, no append-only history, no weekly buckets, and no sync or recompute job. The number always reflects current Directory state. (V2 had none of these either — they were rewrite-plan additions that were removed.)

## 6) Security, Privacy, and Compliance Controls

1. Server-side authz on all user/admin commands and routes.
2. CSRF protection on every state-changing web endpoint.
3. Android bearer-token mutation flows enforce identical server-side authz decisions (no client bypass path).
4. Access-policy contracts enforce role, consent/legal basis, and deny conditions.
5. Deny taxonomy is standardized across web/mobile policy outcomes.
6. Admin audit endpoint is standardized as `/api/workforce/admin/audit-events`.
7. Audit contracts capture allow/deny + mutation outcome for workforce operations.
8. Data minimization and sensitive-field redaction in logs/diagnostics.
9. Plugin deletion/profile handling aligns to `ctf/docs/templates/PLUGIN_PROFILE_AND_DELETION_CONTRACT_TEMPLATE.md`.

## 7) Seed Coverage Status

`ctf/scripts/seedWorkforce.mjs` seeds the workforce config singleton only (the population model: population 5,000,000, participation 0.5, min/max recruitable). Demand (Skills Taxonomy sectors + `workforce_share`) and supply (Directory profiles) are owned by their own plugins and seeded there, not here.

## 8) Gaps and Known Technical Debt

1. Demand quality depends on `skills_taxonomy_sectors.workforce_share` being populated. If shares are null/zero, demand falls back to an even split across sectors — the dashboard still renders, but the distribution is only as accurate as the shares Skills Taxonomy carries.
2. Per-occupation demand is split evenly across a sector's job titles (no per-occupation weight exists in Skills Taxonomy). If finer weighting is wanted, it would need a new upstream signal.
3. Single-bucket report fetches (`/reports/sector/:sector`, `/reports/skill-level/:skillLevel` with a value other than `all`) now match the bucket case-insensitively on both routes; the dashboard only uses the `all` variant, so the single-bucket paths are lightly exercised.
4. The retained-but-unused `workforce_occupations` / `workforce_export_jobs` tables and the vestigial `workforce_profiles` / `workforce_recruited_events` / `workforce_recruited_sync_cursor` tables are dead weight in the schema; `workforce_occupations` cannot be dropped until the SkillsHunt rare-skill snapshot and the demo seed stop referencing it.
5. ~~`GET /api/workforce/admin/audit-events` is implemented (admin-gated, paginated, self-audited) but no web or mobile admin screen calls it — the audit trail has no viewing surface yet.~~ Resolved (2026-08-04) — the web admin screen now has an "Audit trail" panel (`AuditTrailPanel` in `workforce-admin-shell.tsx`) that loads the route on demand, lists events newest-first (command, allow/deny, reason, target, actor, timestamp), and pages with a "Load more" control.
6. ~~`DELETE /api/workforce/profile` has no member-facing control yet.~~ Reclassified (2026-08-04): the member-facing control already exists — the Account & Data screen (`/account/data`, `account-data-shell.tsx`) offers a per-service "Delete your Workforce data?" confirmation that runs the same service-scoped soft delete via `DELETE /api/account/services/workforce` and the central deletion registry. The plugin route is kept only because the deletion contract §9 mandates it; no separate in-plugin control is needed. Not a gap.
7. ~~The profile API's `region` field is always `null`.~~ Resolved (2026-08-04) by dropping the field: `region` was left as an always-null vestige when the profile went read-only/Directory-derived (2026-06-16) and `directory_profiles` carries no region column, so there was never anything to render. Removed from `WorkforceProfile`, `getOwnProfile`, and the profile panel's dead conditional row.

## 9) Web and Android Delivery Status

Delivery: **web + mobile-responsive complete**. **Android (React Native) surface removed 2026-07-20 (rule 105, PR #1742)** — this feature is now web-only, served by the installable web app (PWA). The Android rows below are kept as historical detail; their status is now removed.

| Surface | Status | Notes |
|---|---|---|
| Web dashboard | ✅ Delivered | `workforce-shell.tsx` + `workforce-hero-stats` (incl. Recruitment Progress), `workforce-sector-gaps`, `workforce-skill-distribution`, `workforce-training-gaps`, sidebar, profile panel. Bound to `/dashboard`, `/reports/sector/all`, `/reports/skill-level/all`, `/reports/occupations`, `/profile`. |
| Web admin | ✅ Delivered | `workforce-admin-shell.tsx` — snapshot counts + the population-model config (population, participation rate, min/max recruitable). |
| Android dashboard | ➖ Removed (web-only per rule 105 / #1742) | `WorkforceDashboard` with StatGrid (Population / Workforce Total / Headcount Target / Recruited / Directory Members), Sector Gaps, Top Training Gaps; `WorkforceLoading`, `WorkforceEmpty`, `WorkforcePublic`, `WorkforceStatCard`, `WorkforceProfileCard`. |
| Android admin | ➖ Removed (web-only per rule 105 / #1742) | `AdminWorkforce.tsx` + `admin-api.ts`; mirrors `/admin/workforce` (snapshot + population-model config) against `GET /dashboard`, `GET/PUT /admin/config` only. |
| Android tabs | ➖ Removed (web-only per rule 105 / #1742) | The single Workforce screen (`WorkforceDashboard.tsx`) now has Overview / Occupations / Sectors / Skill Level / Community tabs (no separate feature). Occupations / Sectors / Skill Level / Community render `WorkforceBrowseViews.tsx`: occupations browse (search + skill-level filter + pagination) with an occupation detail panel, the V2 sector / skill-level member drilldowns, and the Community planning team rosters. Binds `GET /occupations`, `/occupations/:id`, `/reports/sector/:sector`, `/reports/skill-level/:skillLevel`, `/reports/community-planning` (+ the `all` breakdowns) via `api.ts`. Mirrors the web sidebar views. |
| Android Community member → profile link | ➖ Removed (web-only per rule 105 / #1742) | Obsolete: the Android Workforce surface was removed 2026-07-20, so the previously-deferred mobile Community → Directory profile link (#1615) no longer applies. The web Community tab links each member name to their Directory profile. |
| Web Community Planning | ✅ Delivered | `workforce-community-planning.tsx`, reached from the sidebar **Community Planning** view (desktop) / **Community** tab (mobile-responsive) in `workforce-shell.tsx`. Renders the ten planning teams from [issue #1465](https://github.com/chargingthefuture/chargingthefuture/issues/1465), each showing its matched-member count and expandable to its matched-member roster (reusing `workforce-member-list.tsx`), with any unmapped sector flagged. In this view each member name is a link to that member's Directory profile (`/apps/directory/profile/:profileId`, the auth-gated deep link) — enabled by the shared list's `linkProfiles` prop, which the sector / skill-level / occupation drilldowns leave off so their names stay plain. Deliberately does **not** show the sectors' population-model demand gap ("N to fill") — that figure is workforce-scale (tens of thousands) and irrelevant to planning one neighbourhood (owner direction 2026-07-17). Bound to `GET /reports/community-planning` (which still returns target/recruited/gap for any other consumer; the view just doesn't render them). Read-only; recomputes live. |

### Mobile Parity Summary (historical — Android surface removed 2026-07-20, rule 105 / #1742)

- **Real bindings:** `GET /api/workforce/dashboard` → `fetchWorkforceDashboard()`, `GET /api/workforce/reports/sector/all` → `fetchWorkforceSectorReport()`, `GET /api/workforce/reports/occupations?limit=10` → `fetchWorkforceOccupationGaps()`, `GET /api/workforce/profile` → `fetchWorkforceProfile()`, plus the browse/drilldown bindings — `GET /api/workforce/occupations` → `fetchAllWorkforceOccupations()`, `GET /api/workforce/occupations/:id` → `fetchWorkforceOccupation()`, `GET /api/workforce/reports/skill-level/:skillLevel` → `fetchWorkforceSkillLevelReport()` / `fetchWorkforceSkillLevelDetail()`, `GET /api/workforce/reports/sector/:sector` → `fetchWorkforceSectorDetail()`, `GET /api/workforce/reports/community-planning` → `fetchWorkforceCommunityPlanning()` — and the admin bindings `GET/PUT /api/workforce/admin/config` (`admin-api.ts`).
- **Delivered states:** loading, empty (no sectors/occupations and no Directory members), error, and the main authenticated dashboard.
- **Stats shown from real data:** Population, Workforce Total, Total Headcount Target, Recruited, Directory Members. Plus Sector Gaps (recruited / target / gap) and Top Training Gaps (per occupation).
- **Profile section:** occupation name, skill level, recruited state — all from `GET /api/workforce/profile`. (The API's `region` field was dropped 2026-08-04 — see Gaps item 7.) The profile is rendered inline on the dashboard via `WorkforceProfileCard`; there is no standalone profile screen (the orphaned, never-mounted `WorkforceProfile.tsx` and its `Workforce.tsx` wrapper were deleted 2026-07-03).
- **Rule 116 compliance:** dashboard logic is split across `WorkforceDashboard` (orchestration/state) plus small presentational sub-components and `WorkforceStatCard` / `WorkforceProfileCard` / `WorkforceLoading` / `WorkforceEmpty` / `WorkforcePublic`.

Profile read + compliance-delete surface: the profile is read-only (owner decision 2026-06-16, reaffirmed) — there is no `PUT`. `GET /api/workforce/profile` emits a `workforce.profile.fetch` audit and reads the real extension preferences/marker; `DELETE /api/workforce/profile` is the only mutation — a service-scoped soft delete per the deletion contract. The web profile panel and the mobile `WorkforceProfileCard` remain display-only; the member-facing delete control lives on the Account & Data screen (`/account/data`) — see Gaps item 6.

## 10) Change Log

- 2026-08-04: **Two gaps closed by history check, not by building (inventory audit).** Gap #6: the
  "missing" member delete control has existed on the Account & Data screen since 2026-06-05 — the
  gap text predated that surface and was never reconciled; reclassified as not-a-gap. Gap #7: the
  always-null `region` field is dropped from the profile type, `getOwnProfile`, and the panel's dead
  conditional row — it became a vestige when the profile went read-only/Directory-derived
  (2026-06-16) and no upstream region source exists. API shape change is removal-only (a field that
  was always `null`); no schema change (`workforce_profiles.region` stays in the dead legacy table
  already listed in gap #4).
- 2026-08-04: **Audit trail viewing surface (closes Gaps item 5).** The admin screen
  (`workforce-admin-shell.tsx`) gained an "Audit trail" panel below the config card. It fetches
  `GET /api/workforce/admin/audit-events` only when the admin clicks "Load audit trail" (each read
  is itself audited server-side, so no automatic fetch on page load), renders events newest-first
  with command, allow/deny, reason, target, actor, and timestamp, and pages with "Load more" using
  the route's existing `page`/`pageSize` parameters. UI-only — no route, schema, or contract change.
- 2026-07-17: **History-aware back + admin↔member navigation (app-wide sweep).** The member
  shell's hand-rolled back chevron was replaced by the shared `BackChevronButton` — it returns to
  the previous in-app page and falls back to All Apps when there is no in-app history. The admin
  surface header gained the shared "Member view" pill (`PluginUserShellButton`) linking to
  `/apps/workforce`. UI-only; no schema, route, or contract change.
- 2026-07-17: **Community Planning: dropped the per-occupation "N to fill" figure from member cards (web + Android).** The team-level demand gap was already removed from this view on 2026-07-17; each member's occupation rows still showed the population-model "N to fill" / "filled" figure (e.g. "6,432 to fill"), which is the same workforce-scale number and just as irrelevant to planning one neighbourhood. The shared member lists gained a `showOccupationGap` flag (default on) — `workforce-member-list.tsx` (`OccupationMatchRow`) on web and `MemberCard` in `WorkforceBrowseViews.tsx` on Android — which only the Community view/tab sets to off, so the sector / skill-level / occupation drilldowns keep the gap. Display-only — no route, contract, or schema change; the match reason and "via <skills>" attribution stay.
- 2026-07-17: **Community Planning: member names now link to their Directory profile (web).** In the Community tab each team member's name is a link to `/apps/directory/profile/:profileId` (the auth-gated Directory deep link), so a planner can open the person straight from the roster. The shared `workforce-member-list.tsx` gained a `linkProfiles` prop (default off); only `workforce-community-planning.tsx` sets it, so the sector / skill-level / occupation drilldowns keep plain names. Display-only — no route, contract, or schema change. Android parity (the mobile Community tab needs a navigation path from Workforce to a Directory profile screen, which does not exist yet) is tracked in [#1615](https://github.com/chargingthefuture/chargingthefuture/issues/1615).
- 2026-07-17: **Community Planning: corrected two team sector names to the live taxonomy names (owner-confirmed from the Skills Taxonomy browser).** The team table in `lib/workforce/community-planning.ts` had transcribed issue #1465's shorthand sector names, which do not exist in the live Skills Taxonomy, so Land & Site, Build & Infrastructure, and Operations & Maintenance showed "Construction/Trades · not mapped" (and Build & Infrastructure also "Energy · not mapped") and could not draw members from those sectors. `Construction/Trades` → `Housing & Construction` (three teams) and `Energy` → `Energy & Utilities` (Build & Infrastructure). The "not mapped" flag itself worked as designed — it surfaced exactly this mis-naming instead of silently emptying the teams. Data-mapping fix in the team definitions only; no route, contract, or schema change. Issue #1465's team table updated to the live names in the same pass.
- 2026-07-17: **Removed the demand gap ("N to fill") from the Community Planning view (web + Android; owner direction).** The team cards were showing each team's population-model demand gap (e.g. "57,926 to fill"), which is workforce-scale and meaningless for planning one neighbourhood — you do not need tens of thousands of people to plan a community. The team cards now show only the matched-member count; the intro copy dropped the sentence describing the gap. Display-only: `GET /api/workforce/reports/community-planning` still returns `target`/`recruited`/`gap` (unchanged) for any other consumer, and `missingSectors` is still surfaced as the "not mapped" flag. No schema, route, or contract change.

- 2026-07-16: **Added the Community Planning team-roster view (web + Android).** A read-only overlay that answers the recurring question from the survivor-built gated community planning document ([issue #1465](https://github.com/chargingthefuture/chargingthefuture/issues/1465)): given the ten teams that document defines, which Directory members would each team be drawn from? New `GET /api/workforce/reports/community-planning` returns each team as a named union of Workforce sectors, its de-duplicated matched-member roster (reusing the sector drilldown's 3-way match via the new `fetchSectorDetailsForSectors` in `detail.ts`, which loads the model + profile set once and computes every sector in one pass), the team's summed sector demand target/recruited/gap, and any team sector not present in the Skills Taxonomy (`missingSectors`). Team definitions live in `lib/workforce/community-planning.ts` (`fetchCommunityPlanningReport`). Web: `workforce-community-planning.tsx`, reached from the sidebar **Community Planning** view / mobile **Community** tab. Android: a **Community** tab rendering a team drilldown in `WorkforceBrowseViews.tsx` (reuses `MemberCard`), with `fetchWorkforceCommunityPlanning()` + `CommunityPlanningReport`/`CommunityPlanningTeamRoster` types in `api.ts`. Nothing is stored; recomputes live from the model on every load, so the rosters track the Directory as it changes — no scheduled job. Behind the existing read gate, so member names are only returned to a signed-in member — this deliberately keeps the roster in-app rather than posting names to the public repo, per issue #1465's privacy principle. Contract `dataAccess` for the model-backed read commands is unchanged (same tables as the sector drilldown); no schema change; the sector drilldown response shape is unchanged (`fetchSectorDetail` now delegates to the shared multi-sector helper).

- 2026-07-14: **Added refresh controls (app-wide refresh rollout).** Web: shared `RefreshButton` in the desktop and mobile-responsive shell headers (`workforce-shell.tsx`); the dashboard fetch was extracted from the mount effect into a `fetchAll` callback shared by the initial load and the button, so a refresh re-pulls without the full-screen loading state. Android: native pull-to-refresh via `RefreshControl` on the dashboard ScrollView (`WorkforceDashboard.tsx`); the load was likewise extracted into a shared `load` callback with a background-refresh variant. UI-only; no schema, route, or contract change.

- 2026-07-04: **Skill matching is now name-based, not row-based (owner decision: the row-based mapping was too restrictive).** A member holding only "Financial planning and budgeting" and "Financial modeling and cashflow management" — both rows parented under Agribusiness Managers — was matched and placed exclusively in Food & Agriculture, because the skill arm followed each held row's single `job_title_id` pointer. The skill arm (in `computeWorkforceModel` and `detail.ts`) now joins the member's held skill to every active same-named skill row across the taxonomy, so a profile counts toward every occupation that lists a skill name they hold; the skill-derived sector placement inherits the same expansion. Consequences: a skill is a capability rather than a pointer; taxonomy curation becomes additive (listing an existing skill name under another occupation instantly re-maps every holder — no reparent, no member migration); recruited counts can widen, which is the intent. The drilldown "via <skills>" attribution is unchanged and remains accurate per occupation. Companion data change: taxonomy change ops 40–42 add "Financial Analysts / Accountants" (Professional & Business Services) carrying both financial skill names, so finance-skilled members stop being confined to agriculture the moment the ops apply. No schema, route, or contract change; response shapes unchanged.

- 2026-07-03: **Dropped the "Members" (declared-occupation) card from the occupation detail screen** (web `workforce-occupations.tsx`, Android `WorkforceBrowseViews.tsx`; owner decision). Members join jobless but skilled, so the count of profiles that declared an occupation as their job title is ~always 0 and reads as an error next to "Recruited (matched)" (e.g. Members 0 / Recruited 14). "Recruited (matched)" carries the story; the `members` field stays in the occupation API responses for any consumer that needs the declared count, and the mobile label is now "Recruited (matched)" to match web. Display only — no API, schema, or contract change.

- 2026-07-03: **Drilldown member cards now attribute every match (owner direction: members join jobless but skilled — the display must show how their skills fill the demand, not imply their whole skill list caused every match).** The `detail` payload's `matchingOccupations` entries gained three fields: `reason` (the per-occupation match arm — previously computed in `buildMatch` and discarded in favor of one card-level badge), `viaSkills` (the member's skills registered under that occupation; empty unless the skill arm fired), and `gap` (the occupation's remaining demand in the population model, from the occupation gap report). Web (`workforce-member-list.tsx`) and Android (`WorkforceBrowseViews.tsx`) render each matched occupation as its own row — occupation (sector), reason badge, "via <skills>" when skill-matched, and "N to fill" — and the member's complete skill list is now labeled "All skills" so it stops reading as the justification for the matches. This resolves the "music maps to journalism" misreading: a sector-arm match now visibly says Sector, with no skills attached. Additive response fields inside the loosely-typed `detail` output object — no contract yaml, schema, or route change.

- 2026-07-03: **Sector placement now follows the taxonomy spec (owner requirement: all skills are mapped to occupations and sectors).** Previously a member was placed only by their occupation's sector, falling back to the raw profile `sector` field — a member with fully mapped skills but no occupation set landed in `Unassigned`, contradicting the spec. Placement (and the sector arm of the recruited match, and the drilldown's own-sector display) now resolves by spec precedence: the occupation's sector, else the sector the member's skills map to through the taxonomy (plurality across their skills, ties broken by sector name for determinism), else the raw profile sector field. Only a member with no occupation, no skills, and no sector can appear under `Unassigned`, making that row a true empty-profile signal. Implemented in `computeWorkforceModel()` (`lib/workforce/repository.ts`) and `resolveOwnSector()` (`lib/workforce/detail.ts`); the member query now surfaces the occupation's sector and the raw profile sector separately instead of a SQL `COALESCE`. No schema, route, or contract change; response shapes unchanged.

- 2026-07-03: Dead-code sweep from the plugin audit (owner directive: all code must be live and reachable in production, or recorded as a gap here / in a GitHub issue). (1) **Removed the dead in-process sync cron.** `src/cron/workforce-sync.ts` POSTed to `/api/workforce/internal/sync` every 4 hours, but that route was deliberately deleted on 2026-06-16 with the read-only model — the cron was missed then, so every scheduled run 404'd and logged an error check-in (Sentry monitor `workforce-incremental-sync`). Deleted the cron, `src/cron/init-cron.ts`, the `initializeCronJobs` call in `instrumentation.ts`, and the now-unused `node-cron` / `@types/node-cron` dependencies (the workforce cron was the only in-process cron; all other scheduled work runs as GitHub Actions workflows). Also removed the out-of-date "Workforce Incremental Sync Baseline" section from `ctf/README.md`. If a Sentry cron monitor exists for `workforce-incremental-sync`, it should be deleted in Sentry so it does not alert on missed check-ins. (2) **Removed `GET /api/workforce/reports/summary`** — no caller anywhere (web or mobile; the dashboard computes its own top-line summary). Deleted the route, `fetchSummaryReport`, the `WorkforceSummaryReport` type, the `workforce.report.summary.fetch` entries in the command and access-policy contracts, and its audit version-registry entry. (3) **Deleted the two orphaned mobile files** `Workforce.tsx` (unused wrapper) and `WorkforceProfile.tsx` (standalone profile screen; exported but never mounted in `App.tsx` — correcting the 2026-06-26 change-log claim that it was wired: the wiring was real but the screen was never reachable). The profile renders inline via `WorkforceProfileCard`. (4) **Removed the dead "Invite Members to Onboard" button** from the web empty state (`workforce-shell.tsx`) — it had no handler. Kept deliberately: `DELETE /api/workforce/profile` (mandated by the deletion contract §9; the missing member-facing control is Gaps item 6) and `GET /api/workforce/admin/audit-events` (Gaps item 5). Doc drift fixed in the same pass: merged the duplicate §7.5 delivery-status section into §9, completed the mobile "Real bindings" list (occupations browse/detail, skill-level and sector drilldowns, admin config), and recorded the always-null profile `region` (Gaps item 7). No schema change.
- 2026-06-29: Reframed the signed-in Workforce "gap" displays as opportunity, not deficit (owner direction — the big red negative numbers read as loss when they are the outsized opportunity to fill). Across the dashboard Overview and the Sectors / Skill Level / Occupations tabbed views, on web and Android: dropped the minus sign and the red color, renamed "Sector Gaps" → "Sector Opportunities" and "Top Training Gaps" → "Top Training Opportunities", and the per-row figure now reads "{n} to fill" (or "filled" at zero) in the brand orange, with green reserved for recruited. The sector panel's target bar/legend also moved from red to orange so nothing on the panel reads as alarm; the "{n} sectors" badge is now neutral. This extends the earlier signed-out "Sectors to fill" framing to the signed-in surfaces (superseding the note that the signed-in dashboard kept the "Sector Gaps" label). Display-only; no data, API, schema, or contract change.
- 2026-06-29: Fixed the Skill Level Breakdown bar chart (`workforce-skill-distribution.tsx`). The bars were sized by each level's `target` (demand), so the tallest bar read as if the millions-scale target had been reached. Bars now show the number of people recruited at each level (green, scaled to the largest recruited count — like V2, where the level with the most people is the tallest); the recruited count is the prominent number, and `target`/`gap` are shown as secondary context with a subtitle ("Members recruited at each skill level (bar height = people). Target shown for context."). Display-only; no data, API, or contract change.
- 2026-06-29: Dropped "Not Recruited" from the public Workforce snapshot (UI + endpoint) and relabeled the remaining gap figure for the signed-out page. Against the 5M goal the unfilled-headcount-target figure is a multi-million number that dwarfed the Recruited bar and read as off-putting marketing on the signed-out landing. `GET /api/workforce/public-snapshot` now returns only `{recruited, sectorGaps, generatedAtIso}`, and the landing card shows just **Recruited** and **Sectors to fill** (the positive marketing label for the active-sector `sectorGaps` figure — the signed-in dashboard keeps calling it "Sector Gaps"). These unauthed pages market without lying: real numbers, opportunity framing. No schema change.
- 2026-06-29: Made the signed-out Workforce landing "Live snapshot" actually live. It previously rendered four mockup categories (Employed / In Training / Seeking Work / Exploring) as empty bars with dashes — those categories have no backing data in the model (workforce tracks occupation, skill level, region, and recruited-state only). Replaced them with the three real aggregate counts the signed-in dashboard already exposes — Recruited / Not Recruited / Sector Gaps — via a new public `GET /api/workforce/public-snapshot` endpoint (and a `getWorkforcePublicSnapshot()` repository projection over `getDashboard()`). The public shell fetches it client-side and renders proportional bars + the real numbers, degrading to neutral dashes while loading or if the endpoint is unavailable. Aggregate counts only — no per-member or identifying data — so the endpoint needs no auth gate. No schema change.
- 2026-06-26: Follow-up to the dashboard 503 fix — gave `GET /api/workforce/dashboard` its own lightweight read instead of the full `computeWorkforceModel()`. The dashboard returns only top-line totals, so it never needed the per-bucket supply match (the per-member expansion across every occupation in a member's sector and the profile-skill → job-title join). `getDashboard()` now reads only config + sector demand + two `COUNT`s (active job titles, active profiles); the sector-demand math is shared with the full model via a new `buildSectorDemand()` helper so `totalHeadcountTarget` can never diverge from the sector reports, and `recruitedTotal` stays the count of all active profiles (V2 parity). This is both a performance win (the most-loaded workforce endpoint stops computing data it never returns) and defense-in-depth: even if the full model regresses again, the dashboard's core numbers keep rendering. The report routes still use the full model (now hardened to degrade the skill arm on failure — see the entry below). No schema, route surface, or contract-field change; the dashboard response shape is unchanged.
- 2026-06-26: Fixed the workforce dashboard returning 503. The new "skill arm" query for the recruited match joined `directory_profiles` on `dp.id = dps.profile_id`; on the deployed database that join failed (the pre-503 dashboard never joined on `directory_profiles.id`), so `computeWorkforceModel` threw and every dashboard/report read returned `persistenceUnavailable` (503). Removed that unnecessary self-join from both `repository.ts` and `detail.ts` (the skill rows are keyed by profile and only read for the already-filtered active members), and wrapped the skill query in `computeWorkforceModel` so that if it ever fails again, recruited degrades to the sector + job-title arms (logged via `reportError`) instead of failing the whole read-only dashboard. No schema or contract change.
- 2026-06-26: Folded the Android occupations/sectors/skill-level views into the single Workforce screen as tabs instead of a separate "Workforce Explore" screen (these are part of the one Workforce feature, not a new feature). `WorkforceDashboard.tsx` now shows Overview / Occupations / Sectors / Skill Level tabs under its header; the non-overview tabs render `WorkforceBrowseViews.tsx` (renamed from the earlier `WorkforceExplore.tsx`). Removed the `workforce-explore` screen key, nav entry, import, and renderer from `App.tsx` and the export from the feature `index.ts`. No behavior change to the views themselves; no backend/API/contract change.
- 2026-06-26: Dropped the duplicate "Directory Members" stat now that recruited mirrors V2 (recruited total = all active Directory profiles = the directory headcount, so the two cards showed the same number). Removed it from the web sidebar Quick Stats and the Android dashboard StatGrid; the web hero "Recruited" card now shows "% of target" instead of repeating the directory count; the Android dashboard subtitle now reads "recruited · target". `totalMembers` stays in the dashboard payload (used for the empty-state check). Display-only.
- 2026-06-26: Android parity for the occupations browse and the V2 sector/skill-level member drilldowns. New `WorkforceExplore.tsx` (registered as the `workforce-explore` screen in `App.tsx`) with three tabs — Occupations (search + skill-level filter + pagination + occupation detail panel showing demand/target, annual training target, members, recruited, gap, and the math) and Sectors / Skill Level (expandable buckets that lazy-load matched members with name + match-reason). `api.ts` gained the matching client functions/types (`fetchAllWorkforceOccupations`, `fetchWorkforceOccupation`, `fetchWorkforceSkillLevelReport`, `fetchWorkforceSectorDetail`, `fetchWorkforceSkillLevelDetail`, `WorkforceOccupation` / `WorkforceMatchedMember` / `WorkforceBucketDetail`). The mobile sector filter is covered by the search box (matches name + sector). No backend, schema, route, or contract change. Verified with the mobile typecheck + lint.
- 2026-06-26: Web UI for the V2 drilldowns and occupations browse (web; Android parity is the next step). Added a sidebar **Occupations** view: a browse table (`workforce-occupations.tsx`) with a search box, sector filter, skill-level filter, and pagination, each row opening an occupation detail panel that shows the demand/target, the derived annual training target, members, recruited, training gap, and a plain explanation of the math. The **Sectors** and **By Skill Level** views are now expandable drilldowns (`workforce-bucket-drilldown.tsx` + `workforce-member-list.tsx`): opening a bucket lazy-loads its matched members (name, match-reason badge, matching occupations, skills/sectors/job titles) from the `detail` payload, mirroring V2. Member names are shown by design. Overview is unchanged. No new endpoints, schema, or contracts — the screens consume the existing read APIs. Mobile-responsive layout included; the React Native (Android) screens are the remaining parity item.
- 2026-06-26: Occupation overlay now carries a V2-style `annualTrainingTarget` (backend). The occupations list/detail responses (`GET /api/workforce/occupations` and `/occupations/:id`) include `annualTrainingTarget`, derived live from the occupation demand by skill level (Foundational 10%, Intermediate 15%, Advanced 25% — the midpoints of V2's seed ranges). V3 stores no occupation, so this is computed, not a stored admin value. Helper `deriveAnnualTrainingTarget` in `lib/workforce/skill-level.ts`; field added to the `WorkforceOccupation` type. No schema change; feeds the occupation detail screen.
- 2026-06-26: Added the V2 sector and skill-level member drilldowns (backend). `GET /api/workforce/reports/sector/:sector` and `/reports/skill-level/:skillLevel`, when called with a specific (non-`all`) bucket, now also return a `detail` object listing the matched members — each member's display name, skills, sectors, job titles, the occupations they match in that bucket, and the match reason (jobTitle > skill > sector). New module `lib/workforce/detail.ts` (`fetchSectorDetail` / `fetchSkillLevelDetail`); new types `WorkforceMatchReason` / `WorkforceMatchedMember` / `WorkforceBucketDetail`. Member names are shown by design (Workforce requires sign-in and is a filtered view of the Directory). The `all` responses and the dashboard are unchanged. Contract `dataAccess` for the model-backed commands now lists `directory_profile_skills` and `skills_taxonomy_skills` (the skill arm of the match), and the two report commands gained the optional `detail` output. No schema change. (Web/mobile drilldown UI is the next step.)
- 2026-06-26: Restored V2's aspirational "recruited" definition (owner decision — make Workforce match V2 again now that the GDP plugin carries the actual-application-of-skills signal). `recruited` is no longer "claimed Directory profiles only". In `computeWorkforceModel()` (`lib/workforce/repository.ts`), per-sector / per-skill-level / per-occupation recruited is now the count of DISTINCT active Directory profiles that match the bucket by ANY of three signals — same sector (a profile's own sector matches every occupation in that sector), same job title, or a skill registered under the job title (`directory_profile_skills.skill_id → skills_taxonomy_skills.job_title_id`). The top-line "Recruited" total mirrors V2 exactly: the count of all active Directory profiles. `members` stays the physical per-bucket count. Updated the `workforce_recruited_current_count` canonical metric and section 5 to match. Live-only — no stored state, no weekly buckets, no sync (V2 had none). No schema or route change; response shapes are unchanged.
- 2026-06-26: Third code-review pass follow-ups (issues #912, #924, #925, #927, #928). (1) `logWorkforceAudit` now stamps the correct `commandVersion` per command via a lookup (several commands are 2.0.0) instead of a hardcoded 1.0.0. (2) `GET /api/workforce/admin/config` now emits a `workforce.admin.config.fetch` audit event (added to the audit contract), symmetric with the audited PUT and the other admin GETs. (3) `updateWorkforceConfig` invalidates the in-process workforce-model cache so an admin sees fresh numbers immediately after saving; the cache is documented as safe only because the model is global/single-tenant. (4) Web `WorkforceOccupation.sector` tightened to `string` (the repository always falls back to the 'Unassigned' bucket, never null), matching the mobile type. (5) The mobile `WorkforceProfileData` type now mirrors the web profile shape (including the extension fields the server already returns) to stop client type drift. Issues #909/#917 were re-flagged as regressions but are already fixed on `main` (false positives) and #926 (the app-wide `x-ctf-csrf` double-submit CSRF model; mobile authenticates by bearer token) is not a workforce-scoped change — all closed with notes.
- 2026-06-26: Second code-review pass follow-ups (issues #916, #917, #918, #919, #920, #921). (1) `PUT /api/workforce/admin/config` now returns `updatedAt` at the top level (the `workforce.admin.config.update` contract output), in addition to `config.updatedAtIso`. (2) `softDeleteOwnProfile` returns `'deleted' | 'already_deleted' | 'not_found'`; the DELETE route skips writing a second `workforce_deletion_events` row when the profile was already service-deleted (idempotent). (3) `computeWorkforceModel` coalesces concurrent calls and reuses the result for a 1s TTL, so the web shell's four report fetches in one page load run the model once instead of four times. (4) The single-bucket `/reports/skill-level/:skillLevel` fetch now compares case-insensitively (it returned `[]` for e.g. `advanced`). (5) `GET /api/workforce/admin/audit-events` now emits a `workforce.admin.auditEvents.fetch` audit event (added to the audit contract). (6) The web shell surfaces a real error when the core dashboard fetch fails and a non-blocking notice when a secondary panel fails, instead of silently showing empty panels. Issues #846, #907, #908, #909, #910, #912 were re-reviewed and are already satisfied on `main` (the second sweep re-flagged fixed code) — closed, regression labels removed.
- 2026-06-26: Code-review follow-ups (issues #907, #908, #909, #910, #912). (1) `insertWorkforceDeletionEvent` now records a real `requested_at` (captured at the top of the DELETE handler, before any await) distinct from `processed_at` (`NOW()` in SQL) — they were both effectively `NOW()` before. (2) `logWorkforceAudit` extended to carry top-level `requestId` / `traceId` and extra `targetContext` fields; the dashboard, admin-config-update, and profile fetch/delete routes now emit `workspaceId` (the single-tenant constant `global`), `requestId` / `traceId`, and the per-command context (`dashboardRequestId`, `configVersion`, `userId`) the audit contracts list. (3) The mobile `WorkforceDashboard` now gates on `usePluginAuth('clerk')` — it no longer fires the member-scoped fetches before auth resolves, and shows `WorkforcePublic` when signed out. (4) Documented why the mobile `WorkforceProfileData` type intentionally omits the extension fields the web type carries. Issues #906 (DELETE ownership), #911 (web fetch auth), and #913 (unclaimed-profile null) were reviewed and closed as not applicable — see the issue comments. No schema, route surface, or contract-field change.
- 2026-06-26: Restored the V2 demand/supply/gap model so the dashboard is usable, and made Workforce a fully read-only live tracker of skills distribution across a population. Demand is now population-scale: `population × participation_rate` (workforce config) distributed across sectors by `skills_taxonomy_sectors.workforce_share`, split across each sector's job titles. Supply is read live from Directory — members = active profiles, recruited = claimed. Sector gap = demand − recruited (huge when few are recruited), and per-occupation training gaps surface the LevelUp recruiting/training signal. Reworked `workforce_config` to the population model (`population`, `participation_rate`, `min_recruitable`, `max_recruitable`); dropped the `exports_enabled` / `report_week_timezone` / `report_week_start_dow` columns. Removed report exporting (routes + the three `workforce.export.*` commands) and the workforce-owned occupation CRUD (routes + the three `workforce.occupations.admin.*` commands) — occupations are read from Skills Taxonomy. Added `GET /api/workforce/reports/occupations` and the `workforce.report.occupations.fetch` command. Rebuilt the web dashboard (Population / Workforce Total / Total Headcount Target / Recruited cards, Recruitment Progress, Sector Gaps, Skill Level Breakdown, Top Training Gaps) and the web admin config (population model), and matched both on Android. The `workforce_occupations` and `workforce_export_jobs` tables are left in `schema.sql` (unused by Workforce) rather than dropped, because `workforce_occupations` is still read by the SkillsHunt rare-skill snapshot and the demo seed. Workforce never writes Directory or Skills Taxonomy; the only workforce-owned writes are the config singleton, the profile extension, the audit trail, and deletion events.
- 2026-06-26: Removed the dead mobile admin sync/recompute buttons and the orphaned recompute command (code-review issues #823, #816 for sync; #841, #815 for recompute). The Android admin screen (`AdminWorkforce.tsx`) still POSTed to `/api/workforce/admin/sync` and `/api/workforce/admin/recompute`, but those routes were deliberately removed on 2026-06-16 when Workforce became read-only and recruited state began deriving live from Directory — so both buttons always returned 404. Owner decision: keep Workforce read-only; remove the dead client surface rather than recreate the routes. Deleted `runAdminSync` and `runAdminRecompute` from `admin-api.ts` (kept `fetchAdminOverview` and `updateAdminConfig`); removed the two buttons, the `runSync`/`runRecompute` handlers, the `'sync'`/`'recompute'` `busy` states, the now-unused styles, and the unused `Alert`/`Pressable` imports from `AdminWorkforce.tsx`; the config save flow is unchanged. Updated the admin subtitle to "Operational controls: config." Removed the orphaned `workforce.admin.recompute.enqueue` command from all three contract files (`WORKFORCE_PLUGIN_COMMAND_CONTRACTS.yaml`, `WORKFORCE_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml`, `WORKFORCE_PLUGIN_AUDIT_CONTRACTS.yaml`); there was no `workforce.admin.sync.*` command to remove. No schema change; no utility-token (credits) behavior change.
- 2026-06-26: Workforce profile read path audit + compliance delete; profile update retired (code-review issues #839, #819, #842, #821, #814, #824, #812, #822, #843, #813). `GET /api/workforce/profile` now emits the `workforce.profile.fetch` audit and reads the real `availability_preferences` / `work_preferences` / `service_deleted_at` from `workforce_user_extension`. Added `DELETE /api/workforce/profile` — service-scoped compliance soft delete (sets `service_deleted_at`, resets the preference payloads, writes the new `workforce_deletion_events` table, retains `workforce_recruited_events`; CSRF + ownership) with `workforce.profile.delete` audit events. `workforce.profile.update` is intentionally retired (profile is read-only, owner decision 2026-06-16 reaffirmed): its command / access-policy / audit entries were removed from the three contract YAMLs rather than implemented.
- 2026-06-26: Wired the standalone Android `WorkforceProfile` screen to real auth and a real API call (resolves code-review issues #845 and #827, duplicates). The screen previously defined its own local `AuthContext` (never provided a real value, so `isAuthenticated` was always false) and loaded data with a `setTimeout(() => setProfile(null), 1000)` stub marked `TODO: Replace with real API call`, so it always showed the unauthenticated / no-profile state and never hit `GET /api/workforce/profile`. It now uses `usePluginAuth('clerk')` for auth (matching `WorkforceDashboard`/`AdminWorkforce`) and `fetchWorkforceProfile()` (existing function in `api.ts`, already calling `GET /api/workforce/profile` via the shared `authedFetch`). States covered: loading (while auth resolves or the fetch is in flight), unauthenticated (sign-in prompt), error, empty (no profile / 404 → `null`), and populated. The populated state reuses the shared `WorkforceProfileCard`, so it renders only the real fields the API returns (occupation name, skill level, region, recruited state) — the old fabricated `name`/`role`/`skills` fields are gone. No backend, schema, contract, or route change.
- 2026-06-26: Fixed export-job correctness and audit-evidence gaps (code-review issues #825, #844, #817). (1) `createDeferredExportJob` no longer sets `completed_at = NOW()` for a `deferred` job — `completed_at` is left NULL because a deferred job has not completed (`completed_at` dropped from the INSERT column/values list so it defaults NULL). (2) The export POST route (`POST /api/workforce/export/jobs`) now validates `exportType` against an explicit whitelist (`summary`, `skill-level`, `sector` — `WORKFORCE_EXPORT_TYPES` in `lib/workforce/constants.ts`, mirrored as an `enum` on the `workforce.export.job.create` `inputSchema` in `WORKFORCE_PLUGIN_COMMAND_CONTRACTS.yaml`) and rejects an unknown value with `WORKFORCE_INVALID_PAYLOAD` / 400 before any job row is written. (3) The route now emits the structured `logWorkforceAudit` event in addition to the existing `insertWorkforceAdminAudit` row, and both carry the full evidence object the audit contract (`WORKFORCE_PLUGIN_AUDIT_CONTRACTS.yaml`, `workforce.export.job.create`) requires — `roleCheck`, `exportScopeCheck`, `piiGuardCheck` (the command is `containsPHI=true`, so the PII-guard evidence is mandatory), and `defermentCheck` for the deferred variant. No schema, contract field, or route surface added; the command contract gained only the `exportType` enum to match the code.
- 2026-06-18: Removed per-plugin announcements from Workforce. Deleted the admin Announcements tab and its component (`workforce-admin-announcements.tsx`), the `activeAnnouncementsTotal` dashboard stat card (web hero stats + admin shell), the user/admin announcement routes (`/api/workforce/announcements`, `/api/workforce/admin/announcements` and its `:id` route), the repository announcement types/mappers/validators/functions (`listAnnouncements`, `createAnnouncement`, `updateAnnouncement`, `deactivateAnnouncement`, `mapAnnouncement`, `validateAnnouncementInput`, `WorkforceAnnouncementRow`) and the `activeAnnouncementsTotal` dashboard count, the `WorkforceAnnouncement`/`WorkforceAnnouncementInput` types and the `activeAnnouncementsTotal` field on `WorkforceDashboard`, the five `workforce.announcements.*` command contracts, and the announcements seed block. Unlike LightHouse/SocketRelay (which read the shared `announcements` table by targeting), Workforce had its own dedicated `workforce_announcements` table; that table is dropped from `schema.sql` and a guarded `DROP TABLE IF EXISTS workforce_announcements;` migration was added at `ctf/db/migrations/post/0007_drop_workforce_announcements.sql`. Announcements are now posted in one place — the Feed (`feed-announcements` plugin), which can target any plugin (including Workforce) — so the Feed is the single place to post announcements about Workforce. Sections 1.5, 2.3, the announcement command/route/data-model entries, and the announcement dashboard stat were removed above to match.
- 2026-06-17: Removed the Workforce kill switch (owner decision — unapproved agentic addition). Dropped `workforce_config.kill_switch_enabled` (`schema.sql` + `schema.demo.sql` add a guarded `DROP COLUMN IF EXISTS`), the `killSwitchEnabled` field on `WorkforceConfig`/`WorkforceConfigInput`, its validation, the `PUT /api/workforce/admin/config` parse/audit usage, the web admin toggle, and the Android admin toggle + confirm dialog. Part of a product-wide kill-switch removal (also feed and Foundation). Exports toggle and report-week settings are unchanged. (The earlier dated entries below still mention the kill switch as the historical record of when it existed.)
- 2026-06-13: Web admin CRUD. Added Occupations and Announcements tabs to the admin shell (the Config + Operations panels move under an Overview tab). Occupations (`components/workforce/workforce-admin-occupations.tsx`): add (`POST /api/workforce/admin/occupations`), hide/show (`PUT …/occupations/:id` with `isActive` flipped), and delete (`DELETE …/occupations/:id`). Announcements (`components/workforce/workforce-admin-announcements.tsx`): post (`POST /api/workforce/admin/announcements`) and delete (`DELETE …/announcements/:id`). All with `x-ctf-csrf: '1'`; split into their own components for the rule-116 size budget. No new endpoint, schema, or contract.
- 2026-06-13: Web admin design pass. Replaced the bare diagnostic `/admin/workforce` page with `components/workforce/workforce-admin-shell.tsx`, styled to the admin design system (header with icon + ADMIN badge, snapshot stat blocks, Config + Operations panels). Bound to the real backend — `getDashboard` counts and the editable `getWorkforceConfig` (exports enabled, kill switch, report week timezone, week-start day). Real actions on existing endpoints (with `x-ctf-csrf: '1'`): save config (`PUT /api/workforce/admin/config`), recompute (`POST /api/workforce/admin/recompute`), and sync (`POST /api/workforce/admin/sync`). Occupations and announcements admin CRUD remain available via their endpoints but are not surfaced in this slice. No new endpoint, schema, or contract.
- 2026-06-12: Android API clients (`api.ts`, `admin-api.ts`) now call the backend through the shared authenticated fetch wrapper (`authedFetch`): the signed-in member's Clerk bearer token is attached and the base URL comes from runtime config, replacing the plain dev-only fetch against hardcoded emulator/localhost URLs. The admin functions no longer take a token argument (the wrapper supplies the live token); `AdminWorkforce.tsx` call sites updated. No backend, schema, or contract change.
- 2026-06-06: Android admin parity. Added `AdminWorkforce.tsx` + `admin-api.ts` and registered the `workforce-admin` screen in `App.tsx`. Mirrors the web admin page (`/admin/workforce`) against existing endpoints only: `GET /dashboard` (counts), `GET/PUT /admin/config` (exports + kill-switch toggles), `POST /admin/sync`, `POST /admin/recompute`. No backend added. Kill-switch, sync, and recompute are confirm-gated; all mutations send `x-ctf-csrf: '1'`. Web admin page was already mobile-responsive (no layout change). The mockup's "flags" queue has no endpoint and is omitted per rule 126; occupations/announcements admin CRUD remain web-only for now.
- 2026-05-31: Android pixel-pass delivered (`feat/workforce-android-pixel-pass`). Rewrote `WorkforceDashboard.tsx` to bind real API routes (`/dashboard`, `/profile`). Added `WorkforceLoading`, `WorkforceEmpty`, `WorkforcePublic`, `WorkforceStatCard`, `WorkforceProfileCard` sub-components matching `MobileWorkforce*` design mockups. Retired mock data and `setTimeout` stubs. Flipped Android row ⬜ → ✅ in readiness plan. Added "Web and Android Delivery Status" section to this inventory.

- 2026-05-31: Web pixel pass delivered. Shell rewritten to match canonical `Workforce.tsx` design mockup: exact inline hex colors (`#B45309`, `#0F1117`, `#0D0F14`, `#090B0F`), Inter type scale, lucide-react icons, three-column layout (72px icon rail + 240px sidebar + main content + 280px right panel), 4-card hero stats, skill-level distribution chart (bar per bucket), sector gaps table (supply/demand dual progress bars), loading and empty states. Chat tab omitted (no backing API). Fabricated stats (Employed/In Training/Seeking Work distribution, pathways, skill count) omitted per real-data-only policy. Files created/updated: `workforce-shell.tsx`, `workforce-icon-rail.tsx`, `workforce-sidebar.tsx`, `workforce-hero-stats.tsx`, `workforce-sector-gaps.tsx`, `workforce-skill-distribution.tsx`, `workforce-profile-panel.tsx`. TypeCheck, build, ESLint, and EOF gates all pass.

- 2026-05-30: Backend marked complete (🟡 → ✅ in the readiness plan) after audit confirmed no code/schema/contract gaps remain: all 9 `workforce_*` tables exist, all 20 routes are implemented (export job execution intentionally deferred with `501 exportDeferred`), the repository/seed are complete, and the schema-drift gate passes. Reconciled the lagging docs: removed the stale `workforce_report_snapshots` "not yet implemented / decision needed" claims (the table was removed by owner decision on 2026-05-21; the dashboard derives state live) and documented the two sync routes (`/api/workforce/admin/sync`, `/api/workforce/internal/sync`) in the API Surface. Docs-only; no code/schema/route/contract/seed changes. (A `workforce_config` singleton seed is a deferred dev-hygiene nice-to-have — routes already fall back to coded defaults — and would ship in a seed PR paired with the schema-drift seed/schema policy.)

- 2026-05-21: Added the missing unique index `uq_workforce_recruited_events_dedupe_key` on `workforce_recruited_events(inference_dedupe_key)` — without it the `ON CONFLICT (inference_dedupe_key)` upserts in `repository.ts` and the seed fail at runtime. Reconciled Domain Entities (4.2) to the 9 tables actually in `ctf/schema.sql`; flagged the `workforce_report_snapshots` contract drift and undocumented sync routes in Gaps.
- 2026-05-18: Renamed "Gaps, Ambiguities, and Known Debt (Planning)" to canonical "Gaps and Known Technical Debt" per Rule 120. Updated seed coverage status to reference shipping seed script. Removed unimplemented-feature-as-debt entry for command-level role matrix sign-off.
- 2026-02-24: Created initial Workforce CTF rewrite inventory.
- 2026-02-24: Merged legacy parity scope (profile, occupations, announcements, export, admin flows) with new Workforce rewrite capabilities; standardized audit-events route, explicit skill-level/sector report endpoints, async export job model, mobile admin v1 inclusion, and weekly ET Saturday bucket policy.
- 2026-03-03: Began phase-1 implementation under `ctf/packages/web` with migration-backed API/admin routes, deterministic recruited recompute sourced from Directory profiles, seed fixtures, and export workflow deferment.


## Build Checklist

> **Historical planning artifact — superseded.** This checklist captures the original rewrite plan, which included announcements, exporting, recruited inference/recompute, and weekly historical buckets. Those were since removed: Workforce is now a read-only live tracker (see sections 1–5 and the Change Log). Items below that reference announcements, export, sync/recompute, or inferred recruited events no longer apply; the current shipped scope is the authoritative one above.

### Scope and Boundary

- [ ] Confirm implementation scope is `ctf/` only.
  - Acceptance criteria:
    - No implementation work is required in `platform/`.
- [ ] Confirm legacy reference files remain intact.
  - Acceptance criteria:
    - `ctf/docs/developer/workforce-recruiter-feature-inventory.md` is unchanged.
    - `ctf/docs/developer/workforce-recruiter-rewrite-checklist.md` is unchanged.
- [ ] Confirm unified plugin slug and naming.
  - Acceptance criteria:
    - New rewrite assets use `workforce` (not `workforce-recruiter`) unless explicitly documented as legacy reference.
- [ ] Confirm accidental legacy event artifacts are excluded.
  - Acceptance criteria:
    - No legacy scaffold/event code paths from old Workforce Recruiter are included in rewrite contracts, schema, or routes.
- [ ] Confirm v1 feature scope includes full parity plus approved enhancements.
  - Acceptance criteria:
    - Included parity features: profile, occupations, announcements, reports, export, and admin management flows.
    - Included enhancements: deterministic recruited inference, canonical metric lock, recompute controls, and standardized audit-events route.
- [ ] Confirm mobile admin is in v1 scope.
  - Acceptance criteria:
    - Admin capabilities included in web and mobile parity contract/validation scope.

### Legacy Review and Contract Lock

- [ ] Review and correct sections 8 and 9 from legacy Workforce inventory before implementation starts.
  - Acceptance criteria:
    - A reviewed/corrected planning note is committed and linked from implementation kickoff PR.
- [ ] Lock plugin command contract shape.
  - Acceptance criteria:
    - Workforce commands conform to `.claude/rules/201-plugin-command-schema-template.mdc`.
- [ ] Lock access policy contract shape.
  - Acceptance criteria:
    - Workforce access policies conform to `.claude/rules/202-plugin-access-policy-schema-template.mdc`.
- [ ] Lock audit contract shape.
  - Acceptance criteria:
    - Workforce audit events conform to `.claude/rules/203-plugin-audit-schema-template.mdc`.
- [ ] Confirm template bundle compliance.
  - Acceptance criteria:
    - Planning evidence references `.claude/rules/200-plugin-command-contract-templates.mdc` and all required template files.
- [ ] Lock route shape and naming decisions.
  - Acceptance criteria:
    - Drilldowns are explicit routes: `reports/skill-level/:skillLevel` and `reports/sector/:sector`.
    - Admin audit route is standardized: `GET /api/workforce/admin/audit-events`.
    - Export uses async jobs: create/status/result route family.
- [ ] Confirm contract-first-in-parallel execution mode.
  - Acceptance criteria:
    - Command/policy/audit contracts can be implemented in parallel with route handlers.

### Canonical Metric Definition Lock

- [ ] Define and lock `recruited` canonical metric in `ctf/config/canonical_metrics.yaml`.
  - Acceptance criteria:
    - Metric entry includes required fields from `.claude/rules/121-canonical-metric-registry-rules.mdc` (`id`, `name`, `description`, `owner`, `data_type`, `unit`, `calculation`, `inputs`, `example_values`, `last_updated`).
- [ ] Lock recruited derivation semantics.
  - Acceptance criteria:
    - Definition states automatic derivation from Directory profile create/update writes only.
    - Definition states no manual admin/user trigger exists.
    - Definition states append-only inferred history for mapping changes.
    - Definition states live dashboard uses current state and historical dashboard uses weekly trend buckets from event history.
- [ ] Lock historical bucket and correction policy.
  - Acceptance criteria:
    - Week start day is Saturday.
    - Timezone is `America/New_York`.
    - Late-arrival correction window is T+14 days then bucket freeze.
- [ ] Record metric check evidence.
  - Acceptance criteria:
    - PR includes metric registry check output and explicit canonical metric identifier mapping.

### Schema and Drift Readiness

- [ ] Define Workforce schema and migration plan in `ctf/migrations/`.
  - Acceptance criteria:
    - Migration replay and rollback strategy are documented.
- [ ] Add append-only inferred recruited event storage model.
  - Acceptance criteria:
    - Model supports immutable history and weekly historical bucketing inputs.
- [ ] Add deterministic inference idempotency model.
  - Acceptance criteria:
    - `inference_dedupe_key` is deterministic hash over canonical source/user/version fields.
    - Unique constraint prevents duplicate replay/backfill writes.
    - Duplicate replays produce idempotent no-op behavior.
- [ ] Run schema drift checks and capture evidence.
  - Acceptance criteria:
    - Drift validation aligns to `.claude/rules/122-schema-drift-predeployment-rules.mdc` and is attached in PR evidence.
- [ ] Enforce schema/contract version compatibility decision.
  - Acceptance criteria:
    - PR declares `Schema Drift: none`, `compatible`, or `versioned-breaking` with required details.

### API and Behavior Implementation Readiness

- [ ] Finalize Workforce API route map and command mapping.
  - Acceptance criteria:
    - Planned routes/commands are versioned and mapped to policy/audit contracts.
- [ ] Implement full parity API groups in Workforce namespace.
  - Acceptance criteria:
    - Profile/config/occupations/reports/announcements/export/admin routes exist under `workforce` slug.
    - No new API contract uses `workforce-recruiter` slug.
- [ ] Validate recruited inference trigger boundaries.
  - Acceptance criteria:
    - Only Directory create/update writes can produce recruited inference events.
- [ ] Add regression guard against manual recruited event mutation paths.
  - Acceptance criteria:
    - Validation gate fails if user/admin-triggered recruited event creation is introduced.

### Security and Compliance Gates

- [ ] Verify authz + CSRF coverage for all state-changing operations.
  - Acceptance criteria:
    - No state-changing endpoint bypasses CSRF or role policy checks.
- [ ] Lock unified web/mobile deny taxonomy.
  - Acceptance criteria:
    - Shared deny reasons are enforced for both web and mobile server-side policy outcomes.
    - At minimum include: `unauthenticated`, `insufficient_role`, `cross_workspace_access`, `missing_consent`, `region_not_permitted`, `csrf_missing`, `csrf_invalid`, `invalid_source_event`, `idempotency_replay`.
- [ ] Verify deletion/profile contract alignment.
  - Acceptance criteria:
    - Workforce behavior is documented against `ctf/docs/templates/PLUGIN_PROFILE_AND_DELETION_CONTRACT_TEMPLATE.md`.
- [ ] Verify audit parity for allow/deny outcomes.
  - Acceptance criteria:
    - Audit contract evidence includes both success and denied operation cases.

### Validation, Seeds, and Non-Regression Gates [MVP: VALIDATION DEFERRED — see Rule 118.]

- [ ] Command/policy/audit schema design documentation. [MANUAL TESTING DEFERRED FOR MVP — see Rule 118.]
  - Acceptance criteria:
    - Valid and invalid payload paths for all core commands are documented.
- [ ] Recruited derivation and dashboard semantics design documentation.
  - Acceptance criteria:
    - Live current-state and historical weekly-bucket behavior is documented.
- [ ] Parity user/admin flows design scope. [PARITY TESTING DEFERRED FOR MVP — see Rule 118.]
  - Acceptance criteria:
    - Profile, occupations, announcements, report drilldowns, and export job flows are documented for post-MVP testing.
- [ ] Deterministic seed fixtures for Directory-write-derived recruited history.
  - Acceptance criteria:
    - Seed outputs are deterministic and schema-compatible.
- [ ] Non-regression guard for legacy event artifacts.
  - Acceptance criteria:
    - Lint gate fails if legacy accidental event artifact patterns are reintroduced.

### PR Evidence and Release Readiness

- [ ] Include schema drift and migration evidence in PR.
  - Acceptance criteria:
    - PR includes drift check output, migration replay evidence, rollback notes, and compatibility decision.
- [ ] Implementation tracking. [EVIDENCE COLLECTION DEFERRED FOR MVP — see Rule 118.]
  - Acceptance criteria:
    - Implementation status is tracked; detailed evidence collection deferred to post-MVP.
- [ ] Confirm inventory + checklist lifecycle compliance.
  - Acceptance criteria:
    - `ctf-workforce-feature-inventory.md` and this checklist are updated in the same PR as behavior/contract changes.

### Change Log

- 2026-07-19: **Android parity for the overview (owner: "parity android now").** The Android
  Overview tab drops its "Headcount Target" tile (same duplicate-of-Workforce-Total reasoning as
  web), and the screen subtitle now reads "{recruited} recruited · {min recruitable} goal" instead
  of measuring against the headcount target — matching the web card's goal framing. UI-only.
- 2026-07-19: **Dropped the "Total Headcount Target" hero card from the web overview (owner
  decision).** It was Workforce Total re-summed after per-sector rounding (1,999,998 vs 2,000,000)
  — a duplicate at the top level. The overview now shows Population, Workforce Total, and
  Recruited; per-sector targets stay in the Sectors view, where the allocation carries meaning.
  The dashboard API payload is unchanged; the Android screens are unchanged (tracked as a small
  parity note — the Android overview still lists a Headcount Target row).
- 2026-07-19: **Recruitment Progress card now tracks the recruitment goal (owner report: the math
  read wrong).** The card showed "Remaining capacity" (the max-recruitable ceiling minus recruited
  — a config ceiling, not progress) and a static "Min recruitable: 2,000,000". It now shows
  progress toward the goal itself: percent = recruited / min-recruitable (the owner's 2,000,000
  target, the same goal Weekly Performance tracks), the recruited count, and "Remaining to the
  2,000,000 goal", which counts down as members are recruited. Web card only
  (`workforce-hero-stats.tsx`); the dashboard API payload is unchanged (the goal percent is
  derived client-side from `recruitedTotal` / `minRecruitable`). The Android member screen does
  not render this card.

- 2026-06-26: Code-review fixes to the web shells (issues #940, #941), client-side display only — no server, contract, schema, or auth-enforcement change. (1) `workforce-shell.tsx`: when any dashboard fetch (dashboard/sector/skill/occupations/profile) returns 401 or 403, the page now throws a "Your session has expired. Please sign in again." error instead of falling through to a soft "couldn't load" warning, so a member whose session expired after page load is told to re-authenticate rather than left on a half-rendered dashboard. (2) `workforce-admin-shell.tsx`: after a successful config save, the admin form now adopts the config returned by `PUT /api/workforce/admin/config` (`{ ok, config, updatedAt }`) into local state, so the fields show the values the server actually stored (after any clamping/normalization) instead of the unverified local input. Matches the mobile admin's `setForm(toForm(saved))` behavior. (Code-review issue #939 — adding blanket per-route deny-audits at the workforce route guards — was reviewed and dismissed: domain denials are already audited, the platform authz layer records authorization denials, and per-route deny-audit duplication adds noise without command context.)
- 2026-06-26: Workforce profile stays read-only; added the missing fetch audit and a compliance delete, and resolved the code-review drift (issues #812, #842, #821, #843, #813, #839, #819, #822, #814, #824). The profile is read-only per the owner decision (2026-06-16, reaffirmed), so `workforce.profile.update` and its `PUT /api/workforce/profile` are intentionally retired — the update-related issues are resolved by REMOVING the command, not implementing it. Removed from the contracts: the `workforce.profile.update` entry in the command, access-policy, and audit YAMLs. What the change keeps/adds: (1) `GET /api/workforce/profile` now emits a `workforce.profile.fetch` audit and reads the real `availability_preferences` / `work_preferences` / `service_deleted_at` from `workforce_user_extension` instead of hard-coding `{}`/`null` (`getOwnProfile` + new `getOwnExtension`); (2) `DELETE /api/workforce/profile` — the only mutation — soft-deletes per the deletion contract (set `service_deleted_at = NOW()`, reset both preference payloads to `{}`), writes a `workforce_deletion_events` row, retains `workforce_recruited_events`, and emits the `workforce.profile.delete` audit event(s) (`softDeleteOwnProfile`, `insertWorkforceDeletionEvent`). New table `workforce_deletion_events` added to `schema.sql` + `schema.demo.sql`. The profile route now exposes GET + DELETE only — no PUT. Backend only; the web profile panel and mobile `WorkforceProfileCard` stay display-only, so no UI/parity change.
- 2026-06-16: Read-only Workforce profile. `getOwnProfile` now derives the member's profile live from their own claimed Directory profile (occupation = Skills Taxonomy job title, skill level derived via `lib/workforce/skill-level.ts`, recruited = claimed), instead of reading `workforce_profiles`. Removed the profile editor path: `upsertOwnProfile` / `deleteOwnWorkforceProfile` and the `POST` / `PUT` / `DELETE /api/workforce/profile` handlers (the route is now `GET`-only), plus the now-orphaned `validateProfileInput` / `normalizeSkillLevel` / `ensureOccupationExists` / `mapWorkforceProfile` helpers. The web profile panel and the mobile `WorkforceProfileCard` were already display-only, so no UI change. `workforce_profiles` / `workforce_recruited_events` / `workforce_recruited_sync_cursor` are now written by nothing; they are still listed in the deletion registry (purged on deletion) and dropped from the schema in the immediate follow-up PR. The `workforce.profile.create/update/delete` commands are retired.
- 2026-06-16: Removed the dead recruited-state sync and recompute. Now that the dashboard/reports derive recruited live from Directory (claimed profiles), the sync that copied Directory into `workforce_profiles` served no read path — and it had no scheduled job, so it never ran. Deleted `runIncrementalRecruitedSync` and `enqueueRecruitedRecompute` from the repository, the routes `POST /api/workforce/admin/sync`, `POST /api/workforce/internal/sync`, and `POST /api/workforce/admin/recompute`, and the Recompute/Sync buttons from the admin shell (Save config stays). Step toward the owner-approved read-only Workforce model (2026-06-16). Still to do (next PR): make the user profile a read-only Directory-derived view (remove the editor + `upsertOwnProfile`/`deleteOwnWorkforceProfile`) and drop the now-unused `workforce_profiles` / `workforce_recruited_events` / `workforce_recruited_sync_cursor` tables via the schema process.
- 2026-06-16: Workforce reads now derive live from Directory (the single source of truth), not a synced `workforce_profiles` copy. `getDashboard`, `fetchSummaryReport`, and `fetchSectorReport` query `directory_profiles` directly — total = active profiles, recruited = claimed (`claimed_by_user_id IS NOT NULL`), sector grouping via `skills_taxonomy_sectors`. This fixes the dashboard showing 0 while ~62–67 directory profiles exist: the recruited-state sync (`runIncrementalRecruitedSync`) had no scheduled job and never populated the copy. The skill-level breakdown (`fetchSkillLevelReport`) keeps full V2 parity: V2 derived skill level algorithmically from the job-title name (case-insensitive keyword match → Foundational / Intermediate / Advanced), not from a stored field. That rule is ported verbatim to `lib/workforce/skill-level.ts` and applied live to each active directory profile's Skills Taxonomy job title — no stored column, no seed, no drift. Follow-up (separate PR): the now-vestigial `workforce_profiles` write path, the recruited sync routes, and the per-sector/per-skill detail report endpoints should be removed or likewise re-pointed at Directory (the skill-level drill-down should reuse `deriveWorkforceSkillLevel`). No schema or contract change in this PR; response shapes are unchanged.
- 2026-02-24: Created initial Workforce rewrite checklist with phase gates for legacy section review, canonical metric lock, schema drift evidence, and non-regression controls preventing accidental legacy event artifacts.
- 2026-03-03: Phase-1 implementation initiated with workforce migration, API/admin route baseline, canonical metric alignment update, and schema drift gate validation evidence.
