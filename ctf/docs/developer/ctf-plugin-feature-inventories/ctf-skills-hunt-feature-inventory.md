# SkillsHunt Plugin Feature Inventory (CTF Rewrite)

> **For new agents:** read `ctf-skills-hunt-session-continuity.md` BEFORE this file. That document is the canonical source of truth for spec, locked owner decisions, audit findings, and the implementation roadmap. This inventory tracks what is currently planned/implemented in the codebase.

## Scope and Boundary

- Rewrite target only: `ctf/`
- Legacy `platform/` is reference-only and must not be modified.
- Plugin name: `SkillsHunt`
- Plugin slug / service key: `skills-hunt`
- This document is the living snapshot of SkillsHunt per Rule 120.

## Intent and Outcome

SkillsHunt is a community-sourced skill-discovery and profile-seeding plugin that rewards high-quality submissions and safely generates unclaimed Directory profiles.

This plugin must:

1. run round-based skill discovery campaigns,
2. support contributor submissions with strict validation and anti-spam safeguards,
3. enable moderator/admin review with deterministic scoring,
4. publish individual and team leaderboards,
5. award achievements and user notifications,
6. generate unclaimed Directory profiles from accepted entries,
7. expose a configurable feature reward card,
8. enforce compliance and auditable review decisions.

Planning constraints applied:

1. Inventory/checklist lifecycle follows `.claude/rules/120-plugin-feature-inventory-lifecycle-rules.mdc`.
2. Command/access/audit design follows `.claude/rules/200-plugin-command-contract-templates.mdc` and templates `201`/`202`/`203`.
3. Canonical profile and plugin-extension boundaries follow `.claude/rules/114-single-profile-and-plugin-extension-rules.mdc`.

---

## 1) User Features

### 1.1 Round Discovery and Participation

1. List active, upcoming, and closed SkillsHunt rounds.
2. View round details including scoring config, rules, and dates.
3. Submit entries only during active windows.

### 1.2 Entry Submission Experience

1. Submit display name (2–100 chars, alphanumeric + spaces), bio (max 280 chars), Quora profile URL, taxonomy-selected skills, optional proposed (free-text) skills, and claimed professions *(deferred — not in the locked Wave 1 design)*.
2. Enforce URL normalization and Quora profile pattern validation.
3. Liveness HEAD-check on URL with 5s timeout; persist `url_validation_result` ∈ {valid, invalid, dead}.
4. Prevent duplicate submissions by normalized Quora profile URL: a person's Quora URL uniquely identifies them (Quora does not recycle handles), so at most one *active* (not rejected, not deleted) submission may exist for a given normalized URL, across all rounds. A rejected or deleted submission does not block a legitimate re-nomination. Enforced in `createSubmission` under a transaction-scoped advisory lock on the normalized URL. (The older per-round url + skills signature key remains as a secondary guard but was insufficient on its own — the same person with a different skill list hashed differently and slipped through.)
5. Enforce rolling submission cap per user with reputation-driven dynamic limits (see §5). **Admins are exempt** from these rate limits (the rolling weekly cap and the reputation-driven pre-approval/restricted gate) — `createSubmission` skips `ensureSubmissionRateLimits` when the submitter `isAdmin`. The active-round window and the one-active-submission-per-Quora-URL duplicate guard still apply to admins.
6. A submitter is attributed to their `@handle` when they have one; a member who has not set a Clerk username yet submits under their stable per-user handle (`user-<id>`, the same one shown in the Commons) via the nullable `submitter_username` snapshot. The submit gate does **not** require a Clerk username (`requireUsername: false`) — the reward and reputation systems key on `submitter_user_id`, and the reserved-prefix check is a no-op for a null username. (Owner decision 2026-07-03: an approved member without a username must not be blocked from submitting.)

### 1.3 Quality and Safety Validation

1. Reject HTML/script-like payloads in free text fields.
2. Enforce bounded lengths and allowed character sets.
3. Verify profile URL liveness where available.
4. Auto-reject patterns that cross policy thresholds.

### 1.4 Leaderboard and Progress

1. Show individual leaderboard by accepted points.
2. Show team leaderboard by claimed profession aggregates.
3. Surface rank, accepted count, and rare-skill bonus impact.
4. Refresh leaderboard deterministically after review outcomes.

### 1.5 Rewards, Achievements, and Notifications

1. Award achievements for notable contribution milestones.
2. Send in-app notifications for status transitions and awards.
3. Display a configurable feature reward card in plugin surfaces.
4. Let users mark notifications as read.

## 2) Admin and Moderator Features

### 2.1 Round Management

1. Create and update rounds, schedule windows, and scoring config.
2. Set round status (`draft`, `active`, `closed`, `archived`).
3. Track round-level review throughput and acceptance quality.

### 2.2 Submission Review and Moderation

1. Review submissions with actions: accept, reject, edit, flag.
2. Capture review notes and reviewer attribution.
3. Apply scoring breakdown (match, first-match, stack, rare-skill, quality bonus).
4. Enforce rejection-rate guardrails for submitters.

### 2.3 Directory Seeding Governance

1. Generate unclaimed Directory profile projections from accepted submissions.
2. Tag generated records as community-generated with invite attribution.
3. Preserve clear ownership boundary: generated profile is unclaimed until verified owner claims.

## 3) API Surface and Route Map

### 3.1 Plugin Command Surface (Authoritative)

All command contracts conform to:

- `.claude/rules/201-plugin-command-schema-template.mdc`
- `.claude/rules/202-plugin-access-policy-schema-template.mdc`
- `.claude/rules/203-plugin-audit-schema-template.mdc`

Command groups:

1. `skills-hunt.round.create`
2. `skills-hunt.round.update`
3. `skills-hunt.round.list`
4. `skills-hunt.submission.create`
5. `skills-hunt.submission.list`
6. `skills-hunt.submission.review`
7. `skills-hunt.leaderboard.list`
8. `skills-hunt.achievement.list`
9. `skills-hunt.notification.list`
10. `skills-hunt.notification.ack`
11. `skills-hunt.feature-reward-card.get`
12. `skills-hunt.feature-reward-card.update`
13. `skills-hunt.directory-profile.generate`

### 3.2 HTTP Projection Routes

User routes:

- `GET /api/skills-hunt/rounds`
- `POST /api/skills-hunt/rounds/:roundId/submissions`
- `GET /api/skills-hunt/rounds/:roundId/leaderboard?mode=individual|team`
- `GET /api/skills-hunt/achievements`
- `GET /api/skills-hunt/notifications`
- `POST /api/skills-hunt/notifications/:notificationId/read`
- `GET /api/skills-hunt/feature-reward-card`

SkillsHunt has **no member-to-member ServiceCredits transfer**. The only ServiceCredits movement is the
treasury **minting** the configured round reward to a scout on an accepted nomination (the
`skills-hunt.submission.review` command). The former `POST /api/skills-hunt/service-credits` peer-transfer
route — which let any signed-in member send credits to any other member via the shared `createTransfer`
primitive — was removed (it had no UI caller and did not belong in SkillsHunt; only the treasury pays out).

Admin/moderator routes:

- `POST /api/skills-hunt/admin/rounds`
- `PUT /api/skills-hunt/admin/rounds/:roundId`
- `GET /api/skills-hunt/admin/rounds/:roundId/submissions`
- `POST /api/skills-hunt/admin/rounds/:roundId/leaderboard/rebuild` — admin-gated (`requireSkillsHuntAdminAccess`), CSRF. Recomputes the round's cached `skills_hunt_leaderboard` (individual + team) from current accepted submissions via `rebuildLeaderboard`. Command `skills-hunt.leaderboard.rebuild`. Returns `{ ok: true }`. Exposed as a "Rebuild leaderboard" button per round in the admin Rounds tab.
- `POST /api/skills-hunt/admin/submissions/:submissionId/review`
- `POST /api/skills-hunt/admin/submissions/:submissionId/remove` — admin-gated (`requireSkillsHuntAdminAccess`), CSRF. Soft-deletes a submission (`deleted_at`), then rebuilds the round leaderboard and recomputes the scout's mission progress. Command `skills-hunt.submission.remove`. Unlike a `reject` review, a soft-deleted row is excluded from the scout's rejection-rate/reputation calc (as well as the leaderboard, missions, My Finds, and directory eligibility), so voiding a duplicate/test/mistaken row does not penalise the scout. Does not touch the ServiceCredits ledger. Exposed as a "Remove" button on every row of the admin submissions table. Returns `{ ok, alreadyRemoved, roundId }`.
- `PUT /api/skills-hunt/admin/feature-reward-card`
- `POST /api/skills-hunt/admin/submissions/:submissionId/generate-directory-profile`
- `GET /api/skills-hunt/admin/audit-events` — admin/moderator-gated (`requireSkillsHuntAdminAccess`) read of the SkillsHunt audit trail (`listSkillsHuntAuditEvents`); optional `?limit=` (default 100). Returns `{ events }`.

Reward notes: `POST/PUT .../admin/rounds[/:roundId]` accept `rewardCreditsPerAccept` and `rewardPerUserRoundCap`. `POST .../admin/submissions/:submissionId/review` mints the configured reward to the scout on accept (best-effort, idempotent, cap- and budget-bounded). `GET .../admin/rounds/:roundId/submissions` additionally returns the round's reward config (`round`) and a `rewardSummary` (`totalCreditsPaid`, `rewardedSubmissionCount`). The admin missions (`.../admin/rounds/:roundId/missions[/:missionId]`) and reports (`.../admin/reports[/:reportId]`) endpoints now have admin UI.

## 4) Data Model and Storage Contracts

### 4.1 Canonical Identity and Extension Strategy

1. Reuse canonical profile for identity and permission context.
2. Use plugin extension/domain tables for SkillsHunt-specific state.
3. Do not duplicate canonical profile tables.

### 4.2 Domain Entities

1. `skills_hunt_rounds` — round lifecycle, configurable scoring weights, and ServiceCredits reward config: `reward_credits_per_accept` (whole credits minted to the scout on each accepted nomination; default 0 = no reward) and `reward_per_user_round_cap` (optional per-scout ceiling for the round; NULL = no cap).
2. `skills_hunt_submissions` — contributor submissions; the nominee's name is stored in `full_name` (free text, 2–100 letters/digits/spaces; renamed from `display_name`). Also tracks `url_validation_result`, `credit_granted`, `credit_amount`, `credit_granted_at`, `proposed_skills`, `edit_history`, `edited_at`, `deleted_at`, `participation_points`, and the nominee's location `country`/`state`/`city` (plain names; `country` required at submit time, `state`/`city` optional; nullable columns). On accept the location carries into the generated `directory_profiles` row (the shared member profile). `credit_granted` is the idempotency marker for the accept reward and is never unset; `credit_amount`/`credit_granted_at` record how much was minted and when.
3. `skills_hunt_leaderboard` — per-round standings; includes `first_match_count` for tie-break and `pending_points`/`last_submission_at` for UI.
4. `skills_hunt_achievements` — 5 named badges (First Finder, Diversity Champion, Rare Talent Scout, Quality Contributor, Leaderboard Champion) plus `round_id` and `archived_at`.
5. `skills_hunt_notifications` — in-DB notification ledger. Polled by client at 30s via `GET /api/skills-hunt/notifications`. GetStream is explicitly out of scope (see continuity doc §2.11).
6. `skills_hunt_feature_reward_card` — singleton row for the Directory-pinned reward card.
7. `skills_hunt_audit_log` — append-only allow/deny + mutation log.
8. `skills_hunt_directory_profiles` — junction between accepted submission and generated unclaimed Directory profile.
9. `skills_hunt_rare_skills_lookup` — per-round rarity snapshot computed from Workforce plugin (<50% recruited).
10. `skills_hunt_submission_reports` — community moderation reports against community-generated Directory profiles.
11. `skills_hunt_proposed_skill_promotions` — dedupe tracker for the proposed-skill promotion pipeline (see §4.4). Despite the `skills_hunt_` name it is the **single cross-app intake** for "skill not in the taxonomy yet": both SkillsHunt nominations and the Directory "skill not listed" box feed it. One row per distinct free-text proposed skill (`normalized_skill` = trim+lowercase, UNIQUE) that has been turned into a GitHub issue proposing it for the canonical taxonomy. Columns: `skill_label` (a representative original label), `source_submission_id` (null for non-SkillsHunt sources), `source` (`'skills-hunt'` | `'directory'`; defaults to `'skills-hunt'` so existing rows are correct without a backfill), the AI-suggested `suggested_sector`/`suggested_occupation`, the filed `issue_number`/`issue_url`, and `status` (`proposed` → `issue_created` → `promoted` once the skill is added to the taxonomy by an applied taxonomy change — see `ctf/scripts/lib/taxonomyChange.mjs`). The UNIQUE index `uq_skills_hunt_proposed_skill_promotions_normalized` plus an `INSERT … ON CONFLICT DO NOTHING` guard makes the pipeline file at most one issue per distinct skill, even across overlapping scheduled runs and regardless of which app surfaced it. This table is written only by the pipeline; it never touches the taxonomy tables.

### 4.3 Directory Integration Boundary

1. SkillsHunt may generate unclaimed Directory profile records through governed adapter commands only (`generateDirectoryProfileFromAcceptedSubmission`).
2. SkillsHunt MUST NOT bypass Directory policy controls.
3. Ownership claim lifecycle remains Directory-authoritative.
4. Generated profiles are stamped `directory_profiles.source = 'community-generated'`, `invited_by_username` is set from the submitter's `@handle`, and a `unclaimed_handle` is auto-generated in the reserved `community-<hex>` namespace.
5. Backfill (one-shot): every existing unclaimed Directory profile receives a `community-<6char-hex>` handle so the `@handle` URL story is consistent on day one.

### 4.4 Proposed-Skill Promotion Pipeline (file-an-issue-only; never writes the taxonomy)

`ctf/scripts/proposeSkillPromotions.mjs`, run on a schedule by `.github/workflows/skills-proposal-issues.yml` (every 6 hours at :17, plus manual runs), turns free-text "proposed" skills into GitHub issues proposing they be added to the canonical taxonomy. It is the **single cross-app intake**: it scans every source that lets a member name a skill not yet in the taxonomy — **accepted** SkillsHunt nominations (`skills_hunt_submissions.proposed_skills`) AND pending Directory "skill not listed" entries (`directory_profile_proposed_skills`) — so all addition requests land in one review queue (these issues). The owner reviews and approves in that one place; the filed issue records which app each skill came from.

- **Candidates:** distinct trim+lowercase proposed-skill labels from both sources (accepted SkillsHunt submissions and pending Directory entries), EXCLUDING any whose normalized form already exists as a taxonomy skill (`lower(skills_taxonomy_skills.name)` or any alias) AND any already present in `skills_hunt_proposed_skill_promotions.normalized_skill`. One representative label is kept per normalized skill (earliest source wins; `source` and a nullable `source_submission_id` are carried), capped at `PROPOSAL_LIMIT` (default 10).
- **AI suggestion (constrained):** for each candidate the Anthropic API (model `claude-haiku-4-5-20251001`) is given the exact list of allowed sectors and allowed occupations (each job title with its sector) drawn live from the taxonomy, and must return only JSON `{sector, occupation, rationale}`. The returned sector and occupation are validated against those lists; if either is not a member, both are set to null and the issue is marked "needs manual mapping". The model can never invent a sector or occupation.
- **No duplicates:** before any issue is filed, the tracking row is inserted with `ON CONFLICT (normalized_skill) DO NOTHING RETURNING id`. Only when the insert wins (a row comes back) is the issue created; the row is then updated with the issue number/url and the suggestion. A rerun or an overlapping schedule that loses the insert simply skips.
- **Issue:** title `Skill proposal: <label>`, body carries the skill, the suggested sector + occupation (or "needs manual mapping"), the one-sentence rationale, the source submission id, a caveat that the mapping is an AI guess, short promote/reject instructions, and a "Context for the agent picking this up" section. That context section spells out the three-level taxonomy model (sector → occupation → skill), the tables and foreign-key chain, the file locations (schema, the taxonomy change list, the directory read, the Skills Taxonomy shell), and the step-by-step promote recipe. Labeled `skill-proposal` (the label is created on first run if missing).
- **Hard boundary:** the pipeline ONLY files issues and writes its own tracking table. It NEVER writes `skills_taxonomy_*`. Promotion (actually adding the skill under the suggested occupation) is a separate, deliberate human/agent step done from the issue. The durable home for an owner-approved promotion is an `addSkill` change appended to the change list in `ctf/scripts/lib/taxonomyChange.mjs` (validated by CI, applied by the owner-run `seed-skills-taxonomy.yml` workflow); the apply step also marks the matching proposal rows `status = 'promoted'` — both the `skills_hunt_proposed_skill_promotions` intake row and any `directory_profile_proposed_skills` row that carried the same label. For the Directory rows it additionally auto-attaches the now-official taxonomy skill to each proposing member's `directory_profile_skills` (idempotent, scoped to the promoted occupation), so the member's "pending review" chip becomes the real taxonomy chip rather than disappearing.

## 5) Security, Privacy, and Compliance Controls

1. Deny-by-default policy checks on all mutation commands.
2. Role separation for contributor, moderator, and admin operations.
3. Anti-spam controls: rolling 7-day submission cap, reputation-driven dynamic limits (new users start lower; >20% rejection rate requires admin pre-approval; ≥80% acceptance rate raises cap).
4. Audit trails for allow/deny and review decisions in `skills_hunt_audit_log`.
5. Sensitive-content minimization in logs and notifications.
6. Distinct plugin deletion and full-account deletion behavior; soft-delete columns (`deleted_at`) on all user-scoped tables; `DELETE /api/account/skills-hunt-profile` is GDPR-compliant erasure path.
7. Community moderation: report flow against community-generated Directory profiles (`skills_hunt_submission_reports`) with admin escalation queue.
8. Clerk reserved-prefix enforcement: usernames starting with `community-` are rejected at signup; defense-in-depth check at API layer in `lib/auth/username-policy.ts`.
9. ServiceCredits reward issuance controls (accept reward): the mint runs only on an accept, only when the round configures `reward_credits_per_accept > 0`, and is bounded three ways — idempotent per submission (`credit_granted` guard + ledger idempotency key `skills-hunt-accept-submission-<id>`, so a re-review never double-pays), a per-scout per-round cap (`reward_per_user_round_cap`) enforced atomically via a per-round+scout advisory-locked claim (`claimSkillsHuntRewardUnderCap` — claim-then-mint, and the claim is reverted if the mint is rejected) so concurrent accepts cannot cross it, and the treasury's per-period mint budget (rule 110 / ServiceCredits monetary policy §3.3). The mint is best-effort: a ledger outage is reported but never fails the review decision. The reward amount is never shown at a fiat equivalent. `credit_granted` is sticky (no auto-clawback on a later reject/flag) — corrections use the ServiceCredits dispute/burn tools.

## 6) Web and Android Delivery Status

**ServiceCredits reward on accept + completed admin panel (web + mobile-responsive; Android parity deferred → issue #660).** Accepting a nomination now mints a per-round, owner-configured ServiceCredits reward to the scout (mirrors the Unlock approval reward; best-effort, idempotent, bounded by the per-scout cap and the per-period mint budget; default 0 so nothing pays until configured). The web admin shell (`/admin/skills-hunt`) was rebuilt as a tabbed surface — Moderation (with a Reward column + reward banner), Rounds (create/edit lifecycle + reward config), Missions (create/list/archive), Reports (dismiss/archive/remove), and the Directory reward-card editor — all responsive to phone width. Android already has the moderation screen; parity for the reward display, round/reward management, and the missions/reports/reward-card admin sections is tracked in issue #660 per rule 105.

Delivery: **web + mobile-responsive complete** (pre-reward baseline). **Android (React Native) surface removed 2026-07-20 (rule 105, PR #1742)** — this feature is now web-only, served by the installable web app (PWA). Round, submission, leaderboard, review, and scoring outcomes are served on web (`/apps/skills-hunt`); historical parity detail: these were previously consistent with the former Android surface (`packages/mobile/src/features/skills-hunt`, now removed). Web pixel pass complete for the user shell: `skills-hunt-shell.tsx` + `sh-*` sub-components are aligned to `design/.../survivor-hub/SkillsHunt.tsx` (brand color #D946EF, aria-labeled lucide icon rail, taxonomy skills picker, scout/leaderboard/missions/my-finds tabs) and decomposed within rule-116 limits; all tabs bind real round/leaderboard/missions/submissions/achievements/notifications routes (no fabricated figures). The admin moderation shell (`/admin/skills-hunt`) is a tracked rule-116 follow-up.

Android pixel pass delivered (2026-05-31): `SkillsHunt.tsx` rewritten to the `MobileSkillsHunt.tsx` / `MobileSkillsHuntEmpty.tsx` / `MobileSkillsHuntLoading.tsx` / `MobileSkillsHuntPublic.tsx` mockup. Decomposed into `SkillsHunt.tsx` (root + loading/empty/leaderboard/missions/my-finds sub-components) + `SkillsHuntScoutTab.tsx` (nomination form + taxonomy accordion), both within rule-116 limits. All 4 nav tabs (Scout, Leaders, Missions, My Finds) bind real API routes via the existing `SkillsHuntApi.ts` client. Brand color `#D946EF`, dark palette `#0F1117`, per-mockup spacing and typography faithfully translated to React Native primitives. `MockSkillsHunt.tsx` retired. No fabricated data — any mockup element without a real API backing field is omitted with a code comment (stats in the public/empty view: found/week, skills-mapped, scouts count have no backend endpoint, omitted).

Android admin present (2026-06-06): `AdminSkillsHunt.tsx` + `admin-api.ts` added under `packages/mobile/src/features/skills-hunt`, registered as the `skills-hunt-admin` screen in `App.tsx`. It mirrors the shipped web admin moderation shell (`/admin/skills-hunt`): pick a round, filter submissions by status, and accept / reject / flag each nomination. It binds only existing endpoints — `GET /api/skills-hunt/admin/rounds`, `GET /api/skills-hunt/admin/rounds/:roundId/submissions`, and `POST /api/skills-hunt/admin/submissions/:submissionId/review`. Admin/moderator access is enforced server-side; a 401/403 shows an "admins only" notice. Mutations send `x-ctf-csrf: '1'` and every state-changing decision is behind an explicit confirm gesture. The mockup's "delete round" and "new round" affordances are omitted: there is no DELETE endpoint for a round, so per rule 126 those actions are not rendered (round create/update remains a web-only admin action). The web admin moderation shell was made mobile-responsive at the same time (horizontal-scroll wrapper around the wide submissions table; clamp() page padding). Android admin parity extended (2026-07-12, #1437/#1457): the mobile admin screen now also mirrors the web "Rebuild leaderboard" action (a "Leaderboard" card with a confirm-gated button under the selected round → `POST /api/skills-hunt/admin/rounds/:roundId/leaderboard/rebuild`) and the "Remove" soft-delete action (a confirm-gated "Remove" button on every submission card → `POST /api/skills-hunt/admin/submissions/:submissionId/remove`), both via `admin-api.ts` with `x-ctf-csrf: '1'`. Still web-only: round create/update and bulk review.

## 7) Seed Coverage Status

`ctf/scripts/seedSkillsHunt.mjs` seeds deterministic rounds, submissions, and moderation fixtures for dev validation.

## 8) Gaps and Known Technical Debt

1. Admin pre-approval submitter pathway is intentionally disabled in the current scope (decision recorded, no UI affordance).
2. URL liveness verification fallback behavior follows a best-effort policy; a stronger SLO contract has not been finalized.
3. Team leaderboard aggregation by profession taxonomy depends on Skills Taxonomy sign-off on grouping semantics.

## 9) Change Log

- 2026-07-17: **History-aware back + admin↔member navigation (app-wide sweep).** The member
  shell's hand-rolled back chevron was replaced by the shared `BackChevronButton` — it returns to
  the previous in-app page and falls back to All Apps when there is no in-app history. The admin
  surface header gained the shared "Member view" pill (`PluginUserShellButton`) linking to
  `/apps/skills-hunt`. UI-only; no schema, route, or contract change.
- 2026-07-15: **Android parity — keyword skill search on the Scout picker (#1529).** The mobile Scout nomination picker (`packages/mobile/src/features/skills-hunt/SkillsHuntScoutTab.tsx`) now mirrors the web `sh-skills-picker.tsx` keyword search: a search box above the sector accordion filters a flat, de-duplicated, cross-sector list of taxonomy skills by substring; while a query is present the flat result list replaces the accordion, and clearing it restores the accordion. Extracted a shared `SkillChip` so the accordion and the search results render identically. UI-only, local state — it never touches the form model; no API, schema, or contract change.
- 2026-07-14: **Added refresh controls (app-wide refresh rollout).** Web: shared `RefreshButton` in the desktop header and the mobile-responsive header (`skills-hunt-shell.tsx`), wired to a new `refreshKey` that re-runs the rounds/achievements, leaderboard, missions, and my-finds loads without the full-screen loading state. Android: native pull-to-refresh via `RefreshControl` on the Leaderboard, Missions, and My Finds FlatLists (`SkillsHunt.tsx`); the Missions and My Finds inline effect loads were extracted into shared `load` callbacks with a background-refresh variant. UI-only; no schema, route, or contract change.
- 2026-07-12: **Android admin parity — "Rebuild leaderboard" (#1437) and "Remove" soft-delete (#1457).** The mobile admin screen (`packages/mobile/src/features/skills-hunt/AdminSkillsHunt.tsx` + `admin-api.ts`) now mirrors two web admin actions it was missing. New `rebuildRoundLeaderboard(roundId)` posts to `POST /api/skills-hunt/admin/rounds/:roundId/leaderboard/rebuild`, surfaced as a confirm-gated "Rebuild leaderboard" button in a "Leaderboard" card under the selected round. New `removeAdminSubmission(submissionId)` posts to `POST /api/skills-hunt/admin/submissions/:submissionId/remove`, surfaced as a confirm-gated "Remove" button on every submission card (any status) — the soft-delete that voids a row without counting as a scout rejection. Both send `x-ctf-csrf: '1'` through the shared `authedFetch` and bind existing admin-gated endpoints only; no backend, schema, or contract change. Still web-only on the admin side: round create/update and bulk review.
- 2026-07-11: **Nominee location added — country mandatory, state/city optional, carries into the directory on accept.** A SkillsHunt nomination now captures where the nominee is: `country` is required, `state`/`city` optional. Schema: `skills_hunt_submissions` gains nullable `country`/`state`/`city` (CREATE + companion ALTERs; `schema.demo.sql` regenerated). Backend: `SkillsHuntSubmissionInput` gains the three fields; `validateSubmissionInput` requires a non-empty `country` (≤100 chars) and caps state/city at 100; `createSubmission` inserts them; and on accept the generated directory profile INSERT now carries `country`/`state`/`city` into `directory_profiles` (the shared member profile), so location surfaces everywhere the directory feeds. Web: `sh-scout-tab.tsx` + `sh-use-nomination-form.ts` add Country (required) / State / City fields under the Quora block, reusing the shared `CountrySelect`/`StateField` controls, with submit gated on country. Mobile: new `LocationPickers.tsx` (a searchable country picker + US-state list / free-text region, matching the web controls) over a new hand-synced `src/lib/geo/locations.ts` mirror (consolidation to `@ctf/shared` tracked as #1380); `SkillsHuntScoutTab.tsx` + `SkillsHuntApi.ts` add the same fields and send them. Contract: `skills-hunt.submission.create` → v1.1.0 with `country` required, `state`/`city` optional. Part of the initiative to source member location from the shared directory profile across plugins rather than per-plugin fields.
- 2026-07-03: **Submit no longer requires a Clerk username; unnamed members use their stable handle (owner decision).** An approved member who had not set a Clerk username was blocked from submitting because `requireSkillsHuntSubmitAccess` used `requireUsername: true`. It now uses `requireUsername: false`: a member with no username submits under their stable per-user handle (`user-<id>`, matching the Commons), stored as a `null` `submitter_username` snapshot that display resolves to the handle. The reward/reputation systems already key on `submitter_user_id`, and `isReservedUsername(null)` is a no-op, so nothing else changes. This gate is shared by the submit, report, and notification-read write paths, so those also no longer require a username. Display: the admin submissions table (`sha-table.tsx`) and reports list (`sha-reports.tsx`) now render the shared `feedAuthorHandle` (so a null username shows `user-<id>` instead of a raw id slice). No route, schema, or contract change.
- 2026-06-27: **Dropped the dead `skills_hunt_service_credits_transactions` table (#1105 follow-up).** Completes the cleanup flagged after the peer-transfer route removal. The table was a member-to-member transfer log never wired into the reward flow (SkillsHunt is reward-only — the treasury mints the round reward to a scout on an accepted nomination, recorded in the canonical ServiceCredits ledger + `skills_hunt_submissions.credit_*`). Removed the two unused repository helpers (`createSkillsHuntServiceCreditsTransaction`, `getSkillsHuntServiceCreditsTransactionsForUser`), their `SkillsHuntServiceCreditsTransaction*` types and row mapper, and the demo seed INSERT; removed the table from §4. `schema.sql` now `DROP TABLE IF EXISTS skills_hunt_service_credits_transactions CASCADE` (was a `CREATE TABLE`); `schema.demo.sql` regenerated. No stored ledger reason-code value changed.
- 2026-06-27: **Removed the member-to-member ServiceCredits transfer from SkillsHunt (#1105, owner decision).** SkillsHunt is reward-only: the sole ServiceCredits movement is the treasury minting a round's configured reward to a scout on an accepted nomination (`skills-hunt.submission.review`). The `POST /api/skills-hunt/service-credits` route — a copy of the shared `createTransfer` peer-transfer that let any signed-in member send credits to any other member — was removed. It had no UI caller, so nothing breaks. Two dead repository helpers (`createSkillsHuntServiceCreditsTransaction`, `getSkillsHuntServiceCreditsTransactionsForUser`) and the unused `skills_hunt_service_credits_transactions` table remain (never written by the live reward path, which uses the canonical ServiceCredits ledger); they are flagged in §8 for a follow-up schema cleanup, since dropping the table is a separate migration. The stored `skills-hunt.transfer` ledger reason-code value on any historical rows is left untouched.
- 2026-06-27: **Code-review sweep fixes for skills-hunt (no route/schema/contract change).** Three behavior corrections from the automated review (issues #1106, #1107, #1109, #1110): (1) `POST /api/skills-hunt/submissions/:submissionId/report` now writes a `skills-hunt.submission.report` row to `skills_hunt_audit_log` on success, matching the audit contract that previously had no emitter. (2) `POST /api/skills-hunt/notifications/:notificationId/read` now uses the submit-access gate (requires a username, consistent with the `skills_hunt_notifications` scope) instead of plain read-access; notification ownership was already enforced at the repository layer (`WHERE user_id = caller`). (3) `PUT /api/skills-hunt/admin/rounds/:roundId` is now a true partial update — it reads the existing round and merges only the fields present in the body, instead of resetting omitted fields to defaults (name → '', startsAt → now, status → draft). (4) The submission review endpoint re-reads the submission from the database after the best-effort accept-reward step (new `getSubmissionById`), so the response reflects committed `credit_granted`/`credit_amount` rather than in-memory state. Issue #1108 (profile.delete audit) was already implemented at `DELETE /api/account/skills-hunt-profile`; #1111 (cross-user submission read) and #1112 (empty invitedByUsername) were verified as already-safe and closed. The peer ServiceCredits transfer endpoint (#1105) is the shared `createTransfer` pattern used by several plugins and is balance-bounded; left for owner review.
- 2026-06-25: **Documented two existing HTTP routes** (inventory-debt burn-down — documentation catch-up, no code change). Added `POST /api/skills-hunt/service-credits` (send credits caller→`toUserId` via the shared `createTransfer` primitive with `originPlugin: 'skills-hunt'`; read-access gated + CSRF; SkillsHunt owns no credits ledger) to §3.2 User routes, and `GET /api/skills-hunt/admin/audit-events` (admin read of the audit trail, optional `?limit=`) to §3.2 Admin/moderator routes. Both verified against the route handlers. Removed these two routes from `ctf/scripts/inventory-drift-allowlist.json`.
- 2026-06-25: **Proposed-skill intake generalized to all apps (single review queue).** `skills_hunt_proposed_skill_promotions` is now the one cross-app intake for "skill not in the taxonomy yet". `proposeSkillPromotions.mjs` scans pending Directory "skill not listed" entries (`directory_profile_proposed_skills`) in addition to accepted SkillsHunt nominations, and files the same `skill-proposal` GitHub issues — which are the single review queue (owner decision, 2026-06-25: skills are the critical shared baseline, so one intake and one queue, no per-app promote screen). New `source` column on the tracker (`'skills-hunt'` | `'directory'`; defaults to `'skills-hunt'`, no backfill needed) records and renders provenance in the issue body; `source_submission_id` is now nullable for non-SkillsHunt sources. `seedSkillsTaxonomyPromotions.mjs` additionally, on approval, auto-attaches the now-official taxonomy skill to every Directory profile that proposed that label (idempotent insert into `directory_profile_skills`, scoped to the promoted occupation) and then flips the matching `directory_profile_proposed_skills` rows to `promoted` — so a member's Directory "pending review" chip becomes the real taxonomy chip with nothing to re-select. Schema/scripts only; no API-route or contract change, and the file-an-issue-only / never-writes-the-taxonomy boundary is unchanged.
- 2026-06-21: Promotion path for proposed skills, and pending skills shown on the profile. The proposed-skill tracker gained a `promoted` status: when an owner-approved skill is added to the taxonomy by the new `ctf/scripts/seedSkillsTaxonomyPromotions.mjs` (curated list in `ctf/scripts/lib/seedSkillsTaxonomyPromotions.mjs`, run right after the legacy backfill in `seedSkillsTaxonomy.mjs`), the matching `skills_hunt_proposed_skill_promotions` row is marked `status = 'promoted'`. The generated skill-proposal issue body (`proposeSkillPromotions.mjs`) gained a "Context for the agent picking this up" section describing the taxonomy model, tables, file locations, and the promote recipe. Separately, a community-generated directory profile whose nominated skill is not yet promoted now surfaces those still-pending proposals as muted "pending review" chips in the directory profile detail (joined from `skills_hunt_proposed_skill_promotions` via `skills_hunt_directory_profiles` → `source_submission_id`), so the Specializations section is no longer empty. First promotion applied: "Marketing" and seven sibling marketing skills under a new "Marketing Specialist" occupation in the existing "Professional & Business Services" sector (fulfils issue #681). No schema, API-route, or contract change — data/script and read-only join only.
- 2026-06-21: **Generated profiles are correctly stamped + labelled.** `maybeAutoGenerateDirectoryProfile` now sets `directory_profiles.source = 'community-generated'`, `invited_by_username` (the nominating scout's handle), and a reserved `community-<hex>` `unclaimed_handle` — previously it stamped none of these (so the profile defaulted to `source = 'admin'` with no attribution) and used a generic `'SkillsHunt contributor'` headline. The placeholder headline is gone (only a real claimed profession becomes the headline). The in-app Directory profile detail (`directory-profile-detail.tsx`) now renders a "Community-generated profile" label and "Nominated by @handle" for these profiles instead of the headline. A one-time backfill stamps `source`/`invited_by_username`, clears the placeholder headline, and populates `directory_profile_skills` for profiles generated before this fix. Brings the code in line with the long-documented Wave 1 intent.
- 2026-06-20: **Proposed-skill promotion pipeline (file-an-issue-only).** Added a scheduled pipeline that turns free-text "proposed" skills from accepted nominations into GitHub issues proposing they be added to the canonical taxonomy, each with an Anthropic-suggested sector + occupation. New table `skills_hunt_proposed_skill_promotions` (UNIQUE on `normalized_skill`) dedupes so each distinct skill becomes at most one issue. New script `ctf/scripts/proposeSkillPromotions.mjs` and workflow `.github/workflows/skills-proposal-issues.yml` (every 6 hours at :17 + manual). Candidates are distinct trim+lowercase proposed-skill labels from accepted submissions, excluding anything already in the taxonomy (name or alias) or already tracked. The model is constrained to the live list of taxonomy sectors and occupations and must return only `{sector, occupation, rationale}`; an out-of-list answer is dropped to "needs manual mapping" rather than invented. Idempotency: the tracking row is inserted with `ON CONFLICT (normalized_skill) DO NOTHING RETURNING id` BEFORE the issue is filed, so reruns/overlapping schedules never duplicate. **The pipeline only files issues and writes its own tracking table — it NEVER writes `skills_taxonomy_*`.** No taxonomy, API-route, or contract change.
- 2026-06-20: **Paid rounds + completed web admin panel.** Added an owner-configured ServiceCredits reward that is minted to the scout when a nomination is accepted, mirroring the Unlock approval reward (`mintGrant`, best-effort, idempotent per submission via `credit_granted` + the ledger idempotency key, bounded by the new per-scout round cap and the per-period mint budget). Schema: `skills_hunt_rounds.reward_credits_per_accept` + `reward_per_user_round_cap`; `skills_hunt_submissions.credit_amount` + `credit_granted_at` (defaults make every existing round pay nothing). Reward config threads through the round read/write paths, validation, and the `round.create`/`round.update` contracts (v1.1.0); the `submission.review` contract (v1.1.0) now lists the ServiceCredits `dataAccess` and a mint audit event. The admin shell (`/admin/skills-hunt`) was rebuilt as a tabbed, responsive surface (Moderation with a Reward column + reward banner; Rounds create/edit with lifecycle + reward config; Missions; Reports; Reward card) — the latter three wire admin endpoints that previously had no UI. The admin submissions endpoint also returns the round's reward config + a reward summary. Dead `sha-create-round.tsx` removed (superseded by the round manager). Android parity for the new pieces is deferred to issue #660 (rule 105). The legacy `skills_hunt_service_credits_transactions` table is documented as unused; the authoritative reward path is the treasury mint + submission credit columns.
- 2026-06-19: Surfaced round creation and the admin entry on mobile. `POST /api/skills-hunt/admin/rounds` already existed, but no UI ever called it — the moderation shell only said "Create one before moderating", so an admin could never create the first round, and on mobile there was no way to reach the admin surface at all (the only link lived in the desktop-only right panel). Added `sha-create-round.tsx` (a "New round" form — name, optional description, status, start/end — posting to that endpoint with the CSRF header and reloading on success) and render it at the top of the admin shell so it works even with zero rounds. Added an "Admin" link in the mobile player-shell header, shown only when `showModeratorTools` (admin or moderator), pointing to `/admin/skills-hunt`. No schema, route, or contract change — UI wiring of an existing endpoint. Web typecheck passes.
- 2026-06-13: Removed the "Alpha" availability badge from SkillsHunt (owner request). Changed its `availability_state` from `alpha` to `implemented_shell` in the plugin registry seed (`ctf/schema.sql`, refreshed on deploy via the `ON CONFLICT … DO UPDATE`) and the fallback registry (`lib/plugins/repository.ts`). The apps grid renders a badge only for non-`implemented_shell` states, so the Alpha tag no longer shows. No schema or behavior change beyond the registry state.
- 2026-06-10: Schema healing for legacy `skills_hunt_submissions` tables. The demo schema's copy of the table predated several columns, and because `CREATE TABLE IF NOT EXISTS` skips existing tables and most columns had no companion `ALTER TABLE … ADD COLUMN IF NOT EXISTS`, the demo seed failed with `column "full_name" of relation "skills_hunt_submissions" does not exist`. Added companion ALTERs for every non-key column of `skills_hunt_submissions` (NOT NULL columns carry a DEFAULT so the ALTER succeeds on tables with rows; CHECK constraints are not re-added, matching the existing companion-ALTER precedent). Regenerated `schema.demo.sql`, which also picked up the previously un-regenerated `trust_signal_snapshot` block. Also retired the pre-rename `display_name` column in `schema.sql` itself: the 2026-06-02 rename shipped only as `db/migrations/post/0004`, which the demo-schema apply path never runs, so the legacy demo table still carried `display_name NOT NULL` and rejected inserts that only set `full_name`. An idempotent DO block now renames `display_name` to `full_name` when only the old column exists, or backfills `full_name` and drops `display_name` when both exist. The third seed attempt then hit the same retired-column class in `chyme_room_members` (`display_name NOT NULL` from post migration 0002, never applied to demo), so `generateDemoSchema.mjs` now appends every `db/migrations/post/*.sql` (demo-transformed) to `schema.demo.sql` — the demo schema receives the same renames/drops production does, including future post migrations automatically. seedDemo.mjs itself was then stale against the healed schema — it still inserted `directory_profiles.display_name` — and now writes `first_name`/`last_name`. No production behavior change — fresh databases are unaffected; legacy tables gain the missing columns and lose the retired ones.
- 2026-06-10: Brought `seedSkillsHunt.mjs` back in line with the current `directory_profiles` shape. The community-generated nominee profile insert still wrote the retired `display_name` column (renamed to `first_name`/`last_name` on `directory_profiles` by `post/0001` on 2026-06-02), so a fresh seed against the migrated schema would fail. The insert now writes `first_name`/`last_name` ('Seed'/'Nominee'), with the `ON CONFLICT` update list matched. This touches only the `directory_profiles` write; the `skills_hunt_submissions.full_name` column (renamed 2026-06-02) is unaffected. No schema or behaviour change — seed data only.
- 2026-06-06: Android admin moderation parity. Added `AdminSkillsHunt.tsx` + `admin-api.ts` and registered the `skills-hunt-admin` screen in `App.tsx`. Mirrors the web admin moderation shell against existing endpoints only (`GET /admin/rounds`, `GET /admin/rounds/:roundId/submissions`, `POST /admin/submissions/:submissionId/review`); no backend added. Accept/reject/flag each require a confirm gesture and send `x-ctf-csrf: '1'`. Round create/delete omitted (no DELETE endpoint; create stays web-only) per rule 126. Made the web admin shell mobile-responsive (horizontal-scroll table wrapper + clamp() page padding) — layout only.
- 2026-06-02: Renamed the nominee's name field from "display name" to "Full name" everywhere in SkillsHunt. The owner relabeled the field and granted a design bypass for the copy change. A SkillsHunt nominee is not a signed-up user, so this stays a single free-text full name (it is not split into first/last and is not pulled from the sign-in system). Changes: user-facing label and aria-labels now read "Full name"; the validation error now reads "Full name violates spec (2–100 alphanumeric+spaces)"; code identifiers renamed (`displayName` -> `fullName`, `setDisplayName` -> `setFullName`, `onDisplayName` -> `onFullName`, `hasValidDisplayName` -> `hasValidFullName`, and the `SKILLS_HUNT_*_DISPLAY_NAME_*` constants -> `SKILLS_HUNT_*_FULL_NAME_*`); the submission API request key is now `fullName`; and the `skills_hunt_submissions.display_name` column is now `full_name` (renamed in `schema.sql`, `schema.demo.sql`, seed scripts, and the guarded migration `post/0004_skills_hunt_submissions_display_name_to_full_name.sql`). The directory-profile name column (`directory_profiles.first_name`) is unchanged. The "e.g. Amara Williams" placeholder is unchanged.
- 2026-05-31: Android pixel pass. Rewrote `SkillsHunt.tsx` to `MobileSkillsHunt` mockup spec; retired `MockSkillsHunt.tsx`; extracted `SkillsHuntScoutTab.tsx`. All 4 tabs (Scout/Leaders/Missions/My Finds) bind real API routes. Loading/empty/main states implemented. Rule-116 compliant.
- 2026-05-30: Admin moderation shell rule-116 follow-up (the deferred item from the user-shell pass). Decomposed the 253-line `skills-hunt-admin-shell.tsx` (213-line render + a complexity-11 action arrow) into `sha-shared.ts` (constants, reject-reason prompt), `sha-filters.tsx` (round/status chips + bulk toolbar), `sha-table.tsx` (table + extracted `SubmissionRow`/`RowActions`), and a thin shell. Behavior preserved exactly (review/bulk-review POST `{ action, notes }` with `x-ctf-csrf`, pending-only selection, sequential bulk apply); added aria-labels on the row checkboxes. No design mockup exists for this internal surface and none is required — pure behavior-preserving decomposition, no new rendered surface. No schema/route/contract changes.
- 2026-05-30: Web pixel pass for the user shell. Aligned to the design mockup (brand color #A855F7 -> #D946EF; aria-labeled lucide icon rail with unread badge) and decomposed the 845-line monolith into modular sub-components within rule-116 limits: sh-shared.ts, sh-use-nomination-form.ts, sh-icon-rail, sh-notifications, sh-sidebar, sh-skills-picker, sh-scout-tab, sh-leaderboard-tab, sh-missions-tab, sh-my-finds-tab, sh-right-panel, thin shell. All data stays bound to the real routes; no mocks. Admin shell (/admin/skills-hunt) left as a tracked rule-116 follow-up. No schema/route/contract changes.

- 2026-05-18: Renamed "Web and Android Delivery Strategy" to canonical "Web and Android Delivery Status" and confirmed `web+android complete`. Renamed "Gaps, Ambiguities, and Known Debt (Planning)" to canonical "Gaps and Known Technical Debt". Removed Android-parity-deferral entry per Rule 105.
- 2026-02-24: Created initial SkillsHunt CTF rewrite inventory.


## Build Checklist


> **For new agents:** read `ctf-skills-hunt-session-continuity.md` FIRST. It is the canonical spec + locked decisions + roadmap. This file is the execution checklist. Update boxes as work lands. Reference commits where possible.

### Scope and Boundary

- [x] Confirm implementation scope is `ctf/` only.
  - Evidence: confirmed in session-continuity §1.
- [x] Confirm plugin slug and command namespace lock.
  - Stable plugin slug is `skills-hunt` across docs/contracts/routes.
- [x] Confirm Directory boundary semantics.
  - Only governed generation of unclaimed profiles is allowed; ownership lifecycle remains Directory-authoritative. Reaffirmed 2026-05-11.

### �� Contract Lock

- [x] Define SkillsHunt plugin command contracts for v1.
  - Evidence: `ctf/docs/contracts/SKILLS_HUNT_PLUGIN_COMMAND_CONTRACTS.yaml`.
- [x] Define SkillsHunt access policy contracts for v1.
  - Evidence: `ctf/docs/contracts/SKILLS_HUNT_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml`.
- [x] Define SkillsHunt audit contracts for v1.
  - Evidence: `ctf/docs/contracts/SKILLS_HUNT_PLUGIN_AUDIT_CONTRACTS.yaml`.
- [x] Add command for `skills-hunt.submission.report` (community moderation report) and `skills-hunt.profile.delete` (GDPR delete) to all three contracts. Landed in `SKILLS_HUNT_PLUGIN_COMMAND_CONTRACTS.yaml`, `..._ACCESS_POLICY_CONTRACTS.yaml`, `..._AUDIT_CONTRACTS.yaml` (2026-05-12 changelog entries).

### �� Schema, Migrations, and Retention

- [x] Define SkillsHunt domain schema for v1 baseline.
- [x] **Add new columns/tables for v2 (Wave 1):** Landed in commit `f3aeb3f`.
  - [x] `skills_hunt_submissions`: `url_validation_result` (with CHECK), `url_validation_checked_at`, `credit_granted`, `proposed_skills`, `edit_history`, `edited_at`, `deleted_at`, `participation_points`.
  - [x] `skills_hunt_leaderboard`: `first_match_count`, `pending_points`, `last_submission_at`. Tie-break composite index added.
  - [x] `skills_hunt_achievements`: `round_id` FK to `skills_hunt_rounds`, `archived_at`. UNIQUE constraint preserved; Wave 2 will refactor for per-round badges.
  - [x] `directory_profiles`: `source` enum (admin/self/community-generated) with named CHECK, `invited_by_username`, `unclaimed_handle` with partial UNIQUE index, `deleted_at`.
  - [x] New table `skills_hunt_submission_reports` with XOR check between `submission_id` and `directory_profile_id`.
  - [x] Backfill migration: idempotent DO block assigns `community-<6hex>` to every existing unclaimed Directory profile, retries on UNIQUE collision.
  - [x] `public.users`: defense-in-depth CREATE UNIQUE INDEX on `LOWER(username)` where NOT NULL.
- [x] Document retention behavior for moderation, reward, and report entities.
  - **Submissions** (`skills_hunt_submissions`): GDPR soft-delete via `deleted_at`; user-facing reads filter `deleted_at IS NULL`. Audit log retained.
  - **Reports** (`skills_hunt_submission_reports`): retained indefinitely (status transitions only — `open` → `dismissed | archived | removed`). No deletion path.
  - **Notifications** (`skills_hunt_notifications`): retained indefinitely. UI may show only recent N; cleanup is a future ops task.
  - **Audit log** (`skills_hunt_audit_log`): NOT soft-deleted; regulatory retention preserved even after a GDPR profile delete.
  - **Achievements** (`skills_hunt_achievements`): retained; `archived_at` exists for future per-round badge refactor.
  - **Missions + progress** (`skills_hunt_missions`, `skills_hunt_mission_progress`): retained; missions use `status='archived'` for soft-archive.
  - **Rare-skill lookup** (`skills_hunt_rare_skills_lookup`): regenerated per round at create; old entries deleted in-place during `snapshotRareSkillsForRound`.
- [x] Prepare rollback/replay notes for the new migrations.
  - All Phase 1 schema additions in `f3aeb3f` use `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS`. **Replay-safe** (idempotent): re-running `runAllMigrations.mjs` is a no-op on already-current DBs.
  - **Backfill DO block** (`community-<6hex>` for existing unclaimed profiles) retries on UNIQUE collision until every profile has a handle. Safe to re-run.
  - **Rollback path** (only if the rewrite must be reverted): each new column has a defined default; rollback can `DROP COLUMN IF EXISTS` per column safely. No data loss for pre-rewrite rows since the legacy code didn't read the new columns. Do NOT drop `directory_profiles.deleted_at` or `directory_profiles.unclaimed_handle` without first clearing UI/route handlers that consume them (see `app/apps/directory/[handle]/page.tsx`).
  - **No `DROP TABLE` rollback is supported** — `skills_hunt_submission_reports` and `skills_hunt_missions` may carry production data; backup before drop.

### �� Core Contributor Flow

- [x] Implement rounds list/get surfaces.
  - `GET /api/skills-hunt/rounds`, `GET /api/skills-hunt/admin/rounds`.
- [x] Implement submission creation with baseline validation.
- [x] Enforce duplicate (signature) and rolling rate-limit safeguards.
- [x] **Wave 1 updates:**
  - [x] URL HEAD-check helper (`lib/skills-hunt/url-validation.ts`, 5s timeout).
    - `checkUrlLiveness` returns `'valid' | 'invalid' | 'dead'` with an HTTP HEAD probe and AbortController-driven 5s timeout (`SKILLS_HUNT_URL_VALIDATION_TIMEOUT_MS`). Only 404/410 mark `'dead'` to avoid auto-rejection during transient network errors or Quora rate-limiting.
  - [x] Persist `url_validation_result` and auto-reject on `dead`.
    - `createSubmission` calls the helper before INSERT, stores `url_validation_result` + `url_validation_checked_at`, and throws `skills_hunt_url_dead` when the URL is unambiguously gone. Submissions POST returns `SKILLS_HUNT_URL_VALIDATION_FAILED` (400) with a helpful message.
  - [x] Flip `requireUsername: true` on submit endpoint.
    - New `requireSkillsHuntSubmitAccess` gate in `app/api/skills-hunt/_lib.ts`; submission POST now uses it. Read endpoints remain on the username-optional gate.
  - [x] Taxonomy-driven skills parsing — submission POST forwards `proposedSkills` and `validateSubmissionInput` enforces `skills + proposedSkills ≤ 10`, each label ≤ 40 chars, `proposedSkills ≤ 10`. `createSubmission` persists `proposed_skills` to the JSONB column on insert.
  - [x] Align display name (2–100 chars, letters/digits/spaces only) and bio (≤ 280, optional) limits with spec. Server validator uses `SKILLS_HUNT_MIN_DISPLAY_NAME_LENGTH`, `SKILLS_HUNT_MAX_DISPLAY_NAME_LENGTH`, `SKILLS_HUNT_DISPLAY_NAME_PATTERN`, and `SKILLS_HUNT_MAX_BIO_LENGTH` constants. UI already enforces matching limits in the shell.

### �� Review and Scoring Flow

- [x] Implement moderator/admin submission review actions (accept/reject/edit/flag).
- [x] Implement baseline scoring engine.
- [x] **Wave 2 — scoring rewrite to spec** (`scoreSubmission` in `lib/skills-hunt/repository.ts`).
  - [x] Match `+10` flat (not `min(skills.length,5)*3`).
  - [x] First Match `+5` (not `+4`).
  - [x] Skill Stack `+3` only if 2+ professions (not linear).
  - [x] Quality `+2` only if accepted without admin edits (`reviewAction === 'accept'`; not `bio≥200chars`).
  - [x] Rare Skill `+7` default from `skills_hunt_rare_skills_lookup` (per-row `bonus_points` overrides). Workforce live-snapshot helper landed: `lib/skills-hunt/rare-skill-snapshot.ts::snapshotRareSkillsForRound()` runs at round-create, grouping `workforce_profiles` by occupation and emitting skill rows where the recruited share is `< 50%`. Bonus value uses `SKILLS_HUNT_SCORE_WEIGHTS_SPEC.rareSkillBonus`. Snapshot is intentionally NOT recomputed per submission — keeps the bonus deterministic for a round's lifetime.
  - [x] Participation `+1` point on reject — persisted to `submissions.participation_points`.
  - [x] All weights configurable per round in `scoring_config` via `resolveScoreWeights(scoringConfig)` (SPEC defaults + per-round overrides). Applied weights echoed back into `score_breakdown.weightsApplied` for audit.
- [x] **Wave 2 — reputation system:** `computeReputationProfile()` resolves a four-tier label (`new` / `standard` / `trusted` / `restricted`) from lifetime accept/reject stats; `ensureSubmissionRateLimits` enforces the resolved weekly cap and throws `skills_hunt_pre_approval_required` for `restricted`. The legacy sample-based rejection-rate guard is kept as a belt-and-braces check for rapid degradation.
  - [x] New-user lower cap (configurable, default 3/wk) via `SKILLS_HUNT_REPUTATION.newUserSubmissionLimit7d`.
  - [x] >20% rejection rate → admin pre-approval required (`tier='restricted'` → throws `skills_hunt_pre_approval_required`, route returns `SKILLS_HUNT_PRE_APPROVAL_REQUIRED` 403). Min sample size 5 to avoid restricting users on a one-off reject.
  - [x] ≥80% acceptance rate → cap raised to 10/wk via `trustedUserSubmissionLimit7d`. Min sample size 5.
  - [x] Read-only `getReputationProfile(userId)` exported for future admin dashboard / submit-time UI hint.
- [x] Enforce rejection-rate guardrails (existing 80% block — to be replaced by reputation system in Wave 2).

### �� Leaderboard, Rewards, and Notifications

- [x] Implement baseline leaderboard rebuild and retrieval (individual + team mode columns).
- [x] Implement achievements (3 generic count-based codes).
- [x] Implement baseline feature reward card read/update endpoints.
- [x] **Wave 2 — leaderboard improvements:** `rebuildLeaderboard` writes `first_match_count`, `pending_points`, `last_submission_at`. `listLeaderboard` returns `{ items, currentUserEntry, totalCount }` with top-100 cap; new `listAllTimeLeaderboard` computes the cross-round view on-demand. Leaderboard route accepts `?range=all-time`. Shell falls back to `serverCurrentUserEntry` when the viewer is outside the top-100.
  - [x] Tie-break order: `score DESC, first_match_count DESC, last_submission_at ASC`.
  - [x] Top-100 cap plus current-user rank attached to response.
  - [x] Team mode aggregation by claimed profession.
  - [x] All-time view alongside per-round (`GET /api/skills-hunt/rounds/{roundId}/leaderboard?range=all-time`).
  - [x] 30-second polling on client. **GetStream is explicitly out of scope** for SkillsHunt (continuity §2.11) — polling is the locked transport, not a stepping stone. Wired in both the web shell (`setInterval(load, 30_000)`) and mobile shell.
- [x] **Wave 2 — 5 named badges (replace 3 generic):** legacy `accepted-first/-five/-ten` awards removed from `reviewSubmission`; new `awardNamedBadges()` helper now drives badge logic. Achievements record `round_id` for the Wave 2 per-round badge refactor; UNIQUE `(user_id, code)` constraint preserved per Phase 1 schema notes.
  - [x] `first-finder` — fires when this submission's `score_breakdown.firstMatchBonus > 0` (the scoring engine awards the bonus only to the first accepted submission for a normalized Quora URL in a round).
  - [x] `diversity-champion` — accepted submissions spanning 3+ distinct `claimed_professions` (JSONB unnest in the eligibility query).
  - [x] `rare-talent-scout` — 3+ accepted submissions with `score_breakdown.rareSkillBonus > 0`.
  - [x] `quality-contributor` — 5+ accepted submissions AND 0 rejections (100% acceptance rate).
  - [x] `leaderboard-champion` — finished top-3 on a round's final standings. `updateRound()` now detects the `active → closed` transition and awards the badge (with notification fan-out via `ensureAchievement → emitAchievementUnlocked`) to the top-3 individual finishers.
- [x] **Wave 1 — reward card pinned on Directory public page** with "Submit a community profile" CTA opening the SkillsHunt Scout tab.
  - Implemented in `components/directory/directory-shell.tsx`. Fetches active card from `/api/skills-hunt/feature-reward-card`; falls back to a default card linking to `/apps/skills-hunt?tab=scout` when the API has no row configured. Purple `#A855F7` palette per rule 126.
- [x] **Wave 2 — Missions admin CRUD + player GET + recompute hook** (continuity §2.9).
  - [x] Admin `GET/POST /api/skills-hunt/admin/rounds/{roundId}/missions` (list, create).
  - [x] Admin `GET/PUT/DELETE /api/skills-hunt/admin/rounds/{roundId}/missions/{missionId}` (DELETE soft-archives via `status='archived'`; hard delete intentionally not exposed).
  - [x] Player `GET /api/skills-hunt/rounds/{roundId}/missions` returns active+locked missions with per-user progress.
  - [x] `reviewSubmission` accept branch calls `recomputeMissionProgressForUser()` so accepted submissions update mission progress in the same transaction.
  - [x] Mission validation helper (`validateMissionCreateInput`) enforces required fields + `sectorName` metadata for `count_skills_in_sector` goals.
  - [x] SkillsHunt shell renders missions tab from real API (replaces "Missions launching in Wave 2" stub) with progress bars + color hex from admin config.
  - [x] Notification fan-out on mission completion — `emitMissionComplete` fires from `reviewSubmission`'s accept branch for every mission returned in `recomputeMissionProgressForUser`'s `newlyCompleted` set.
- [x] **Wave 2 — in-DB notification fan-out on 5 triggers** (accept, reject, leaderboard top-10 change, round-ending-24h, achievement-unlocked) — plus mission-complete from the Missions feature. New `lib/skills-hunt/notifications.ts` provides semantic emit helpers and the `SKILLS_HUNT_NOTIFICATION_KIND` lexicon. Writes rows to `skills_hunt_notifications`; client polls `GET /api/skills-hunt/notifications` at 30s. GetStream out of scope (continuity §2.11).
  - [x] `submission-accepted` / `submission-rejected` — emitted from `reviewSubmission` (replaces the inline `insertNotification` calls).
  - [x] `achievement-unlocked` — `ensureAchievement` now returns whether it actually inserted (vs upsert no-op) and fans out the notification only on the real award.
  - [x] `leaderboard-top-ten` — `reviewSubmission` captures the pre-rebuild top-10 user_ids, diffs after `rebuildLeaderboard`, and emits to anyone newly inside the cap.
  - [x] `mission-complete` — `recomputeMissionProgressForUser` returns the `newlyCompleted` set; the accept branch fans out one notification per newly-completed mission.
  - [x] `round-ending-soon` — `notifyRoundsEndingSoon()` cron entry point at `POST /api/skills-hunt/admin/notifications/round-ending-soon` (admin-gated, CSRF). Idempotent per `(user, round)`; wire a daily scheduler to invoke.
- [x] **Wave 2 — status panel UI** (web + mobile). Labeled "Status", not "Notifications", and carries **no** unread dot/count badge — per the app-wide no-notifications policy (the only exception is Foundation calls), the typical notification dot does not carry over here. Read/unread status is still kept: unread rows are visually accented and per-row mark-read on click remains. Web: bell icon in the icon rail toggles a popover anchored above the secondary sidebar. Mobile: top-bar bell opens an inline inbox above the tabbar. Both poll `/api/skills-hunt/notifications` every 30s.

### �� Directory Projection and Safety

- [x] Implement governed unclaimed Directory profile generation via `maybeAutoGenerateDirectoryProfile`.
- [x] **Wave 1 — Directory schema additions** (commit `f3aeb3f`):
  - [x] `directory_profiles.source` enum (admin/self/community-generated).
  - [x] `directory_profiles.invited_by_username` (denormalized for UI).
  - [x] `directory_profiles.unclaimed_handle` (partial UNIQUE index).
  - [x] `directory_profiles.deleted_at` (soft-delete).
- [x] **Wave 1 — `@handle` URL routing:**
  - [x] `app/apps/directory/[handle]/page.tsx` handle resolver. Accepts `@handle` (strips the prefix) and falls through to UUID resolution for back-compat.
  - [x] 308 permanent redirect from legacy `[id]` route. Next.js disallows two dynamic siblings at the same path level; the `[id]` segment was removed and `[handle]` resolves UUIDs first, then calls `permanentRedirect()` (HTTP 308) to `/apps/directory/@<unclaimed_handle>` when a canonical handle exists, so search engines canonicalize the new URL.
  - [x] Resolver order: `users.username` (claimed) → `directory_profiles.unclaimed_handle` (unclaimed). Implemented in `getPublicDirectoryByHandle()`.
- [x] **Wave 1 — visible "community generated profile" badge + @handle + invited-by attribution** on Directory profile page (commit pending — see latest `feat(directory)` on this branch).
  - DirectoryProfile type extended with `source`, `invitedByUsername`, `unclaimedHandle` (`lib/directory/types.ts`).
  - `getPublicDirectoryById` SELECT pulls the new columns; soft-delete filter (`deleted_at IS NULL`) added.
  - `app/apps/directory/[handle]/page.tsx` renders the purple "Community generated" pill, the `@unclaimed_handle` monospace line, and "Nominated by @handle" attribution. Uses design's `#A855F7` palette per rule 126.
- [x] **Wave 1 — backfill migration** assigning `community-<6hex>` to existing 60 unclaimed profiles (commit `f3aeb3f`, idempotent DO block).

### �� Security, Compliance, and Deletion

- [x] Verify authz/deny conditions and audit integrity on existing endpoints.
- [x] **Wave 2 — soft-delete + GDPR endpoint:**
  - [x] `deleted_at` columns already landed in Phase 1 (`f3aeb3f`); user-visible reads (`listSubmissions` and `rebuildLeaderboard` individual + team aggregates, all-time) now filter `AND deleted_at IS NULL`.
  - [x] `DELETE /api/account/skills-hunt-profile` GDPR erasure — soft-deletes every submission authored by the caller; emits audit log entry; the delete runs in one transaction that immediately rebuilds affected leaderboards and recomputes mission progress, so the deleted rows drop out of standings and mission counts right away (not on the next review).
  - [x] Audit-log retention preserved (`skills_hunt_audit_log` is not soft-deleted; the delete endpoint *writes* an audit row with `skills-hunt.profile.delete`).
- [x] **Wave 2 — moderation report flow:** `lib/skills-hunt/moderation.ts` (createReport, listOpenReports, resolveReport).
  - [x] `POST /api/skills-hunt/submissions/{id}/report` (auth required, CSRF, reason CHECK enforced).
  - [x] Admin escalation queue `GET /api/skills-hunt/admin/reports?status=...` (open by default).
  - [x] Resolution actions via `PATCH /api/skills-hunt/admin/reports/{reportId}`: status ∈ `dismissed | archived | removed` with optional `resolutionNotes`. Idempotent (`WHERE status = 'open'`).
- [x] **Wave 1 — Clerk reserved-prefix policy:**
  - [x] `lib/auth/username-policy.ts` rejects usernames starting with `community-`.
    - Exports `evaluateUsernamePolicy` and `isReservedUsername`. Submissions POST returns `SKILLS_HUNT_RESERVED_USERNAME` (403) when caller's Clerk username matches a reserved prefix.
  - [x] Document Clerk dashboard configuration in `123-environment-configuration-rules.mdc`. New "Reserved Username Prefixes" section instructs operators to add `community-` to the disallowed-prefix blocklist on every Clerk instance.

### �� Validation, Seeds, and Release Gates

- [x] Update seed script `ctf/scripts/seedSkillsHunt.mjs` for new schema columns (`proposed_skills`, `participation_points`, `credit_granted`, `url_validation_result`, leaderboard `first_match_count` / `pending_points` / `last_submission_at`) and new test case: a `community-generated` Directory profile with `@community-seed01` handle linked to the seed submission via `skills_hunt_directory_profiles`.
- [x] Update plugin registry availability state: `'implemented_shell'` → `'alpha'`. `PluginAvailabilityState` widened to include `'alpha' | 'beta'`. Flip to `'beta'` after the e2e smoke test and a real staging cohort run.
- [x] Add type-safe end-to-end smoke: rounds list → submit → admin accept → leaderboard rebuild → notification fan-out → unclaimed Directory profile with `@handle`. `ctf/scripts/smokeSkillsHuntE2e.mjs` asserts on the deterministic post-state left by `seed:skills-hunt`. Invoke with `pnpm smoke:skills-hunt`. Both scripts are idempotent, so the seed + smoke can be chained safely in CI / on-demand.

### �� UI Surfaces (consolidated)

- [x] **Wave 1 — submission flow** (replaces the planned modal). Post-design lock (continuity §2.4) replaced the in-place Directory modal with a navigation to `/apps/skills-hunt?tab=scout`. The form lives in `skills-hunt-shell.tsx` Scout tab and satisfies every original sub-item:
  - [x] Heading: "Nominate a Survivor" (Replit lexicon — see continuity §2.8).
  - [x] Fields: Display Name, Bio, Quora URL, Skills (taxonomy accordion multi-select + free-text fallback as yellow "proposed" chips). Claimed Professions deferred — not in the locked design.
  - [x] Client-side validation matches server limits exactly: 2–100 letters/spaces for displayName, ≤ 280 bio, max 10 combined skills.
  - [x] Live char counters on Display Name and Bio.
  - [x] Reached from the Directory reward card CTA (commit `8943055`).
- [x] **Wave 1 — admin panel real UI** (`app/admin/skills-hunt/page.tsx` + `components/skills-hunt/skills-hunt-admin-shell.tsx`).
  - [x] Submissions table populated from `/api/skills-hunt/admin/rounds/{id}/submissions` (pageSize=100). Columns: submitter, displayName, skill + proposed-skill chips, Quora link, URL validation result, points, actions.
  - [x] Status filter pills (pending / accepted / rejected / flagged).
  - [x] Inline Accept / Reject (with prompted reason — 6 canned options + free-text) / Flag. Edit dialog is Wave 2 (continuity §6 sub-task).
  - [x] Bulk action toolbar with multi-select checkboxes + bulk accept / bulk reject (single reason applied to the batch; sequential POSTs so leaderboards rebuild deterministically row-by-row).
  - [ ] Wave 2 follow-ups: edit-dialog, dispute escalation queue. *(CSV export removed from scope — continuity §2.12.)*
- [x] **Wave 2 — mobile rebuild** (`packages/mobile/src/features/skills-hunt/`).
  - [x] Replace `SkillsHunt.tsx` hardcoded mock with a 4-tab (Scout / Leaderboard / Missions / My Finds) API-driven view.
  - [x] New `SkillsHuntApi.ts` client wrapping `/api/skills-hunt/*` (rounds, leaderboard, achievements, my finds, missions, submit). Same envelope as the web shell so the route layer is reusable.
  - [x] API-driven Rounds, Leaderboard, Submit screens — single round auto-selected from the active list.
  - [x] Status panel mirroring the web `/api/skills-hunt/notifications` polling. `SkillsHuntApi.listNotifications` + `markNotificationRead`; inbox bar above the tabbar. No unread dot/count badge (no-notifications policy); unread rows are accented and mark-read on tap remains.
- [x] **Android pixel pass** (`packages/mobile/src/features/skills-hunt/`) — 2026-05-31.
  - [x] Rewrote `SkillsHunt.tsx` to match `MobileSkillsHunt.tsx` / `MobileSkillsHuntEmpty.tsx` / `MobileSkillsHuntLoading.tsx` mockup. Exact brand color `#D946EF`, dark `#0F1117` bg, per-mockup spacing/typography in RN primitives.
  - [x] Loading state: `EXIT THEIR ECONOMY / EXIT THE PSYOP` centered text per mockup.
  - [x] Empty state: dashed circle icon, "The hunt starts with you" copy, how-it-works rows, Nominate CTA, mission hint.
  - [x] Main state: header with icon + title + pts·rank widget (from real `currentUserEntry`) + notification bell. Bottom nav bar with 4 tabs.
  - [x] Scout tab: `SkillsHuntScoutTab.tsx` — nomination form with taxonomy accordion (sector→skills chips), free-text proposed fallback, submission confirmation with pending-pts message. All fields bound to real `submitNomination` API.
  - [x] Leaderboard tab: ranked list with medals/rank, avatar initials, score, pendingPoints. Me-row highlighted. Backed by `listLeaderboard`.
  - [x] Missions tab: progress bars + Scout Now CTA. Backed by `listMissions` with `colorHex` support.
  - [x] My Finds tab: badge row backed by `listAchievements` (5 named codes), submission cards with status labels and relative dates. Backed by `listMyFinds`.
  - [x] Retired `MockSkillsHunt.tsx`; extracted `SkillsHuntScoutTab.tsx`. All components within rule-116 (<200 lines per render).
  - [x] Omitted (no API backing): public-view stats (found/week, skills-mapped count, scouts count) — no backend endpoint exposes these aggregates.

### Open Decisions Tracker

- [ ] Final tier/prize structure (1st vs 2nd vs 3rd). Owner to confirm before Wave 2 ships.
- [x] Final policy for admin-preapproved submitter pathways — re-enabled as part of reputation system in Wave 2.
- [x] Android pixel parity delivered 2026-05-31 (see Android pixel pass checklist above).
- [x] Leaderboard real-time: polling vs WebSocket. **Locked 2026-05-12: 30s polling.** GetStream is out of scope (continuity §2.11). Revisit only if engagement metrics show users want sub-30s leaderboard ticking.
- [ ] Moderation report UI: only on community-generated, or all Directory profiles. Default: all profiles.
- [ ] Dispute escalation: second-admin sign-off vs flagged queue. Default: flagged queue.

### Change Log

- 2026-07-08: **Admins exempt from the scout submission rate limits.** `createSubmission` now takes an `{ isAdmin }` option and skips `ensureSubmissionRateLimits` for admins, so an admin is never blocked by the rolling weekly cap or the reputation-driven pre-approval/restricted gate. The submissions route passes `gate.auth.isAdmin`. The active-round window and the one-active-submission-per-Quora-URL duplicate guard still apply to admins. (Owner request — admins run the program and test submissions, so the anti-spam scout limits should not gate them.)

- 2026-07-08: **Admin "Remove" (soft-delete) submission action.** New admin-gated `POST /api/skills-hunt/admin/submissions/:submissionId/remove` (command `skills-hunt.submission.remove`) soft-deletes a submission and rebuilds the round leaderboard + the scout's mission progress; a "Remove" button on every row of the admin submissions table. This is the correct way to void a duplicate/test/mistaken row: unlike `reject`, a soft-deleted row is excluded from the scout's rejection-rate/reputation calc, so it does not restrict the scout. `reject` is unchanged and still counts against the scout (the intended anti-spam behaviour). Motivated by the duplicate-accept remediation, whose `reject`-based void unintentionally raised the admin's own rejection rate and tripped the pre-approval gate. Does not touch the ServiceCredits ledger. Added command/access-policy/audit contract entries. **Android parity deferred** — tracked separately.

- 2026-07-08: **Admin manual leaderboard rebuild.** New admin-gated `POST /api/skills-hunt/admin/rounds/:roundId/leaderboard/rebuild` (command `skills-hunt.leaderboard.rebuild`) recomputes the round's cached `skills_hunt_leaderboard` from current accepted submissions via the existing `rebuildLeaderboard`, and a "Rebuild leaderboard" button per round in the admin Rounds tab. Fills a gap: the leaderboard is a cached table that only refreshed as a side effect of a review action, so there was no way to refresh it after an out-of-band change (e.g. a data fix that rejected an already-accepted submission). Added the command/access-policy/audit contract entries. **Android parity deferred** — tracked separately; web + mobile-responsive shipped here.

- 2026-07-08: **One person = one Quora profile URL.** `createSubmission` now blocks a second *active* (not rejected, not deleted) submission for the same normalized Quora URL, across all rounds, under a transaction-scoped advisory lock. Reuses the existing `skills_hunt_duplicate_submission` error, so the API returns the same friendly "already nominated" message. Root cause of an incident where the same person was nominated twice in one round with different skill lists: the per-round url + skills signature hashed them differently, so both were accepted and each minted a Directory profile and a ServiceCredits reward. A follow-up may add a global partial unique index on `quora_profile_url_normalized` (WHERE not rejected/deleted) as a hard DB backstop, once production is confirmed free of other active URL duplicates.

- 2026-07-07: **Code-review sweep fixes, second pass (skills-hunt).** (1) `updateMission` now uses a "provided" flag for the nullable `description` and `color_hex` columns instead of `COALESCE`, so an admin can intentionally clear a mission's color/description (previously a blank value was silently kept). (2) Flipping an already-accepted submission to reject/flag no longer emits spurious mission-complete notifications — the downward recompute only rolls back progress counts, and a completion can never be newly earned on a decrease. (Whether an already-earned completion should be revoked when progress later drops is left as a separate product decision; `completed_at` stays sticky once earned.) (3) `listOpenReports` renamed `listReports`; `null` status now means "all statuses", and the admin reports route defaults to the open queue explicitly, so the null branch is no longer silently overridden to `open`. (4) Documented that the duplicate-submission signature is intentionally URL + skills (not fullName/bio) so a tweaked name can't bypass the per-round duplicate guard. Verified as already-correct (no change): the report route already emits its `skills-hunt.submission.report` audit event, the GDPR delete route already exists at `/api/account/skills-hunt-profile` with its audit event, and the review route already re-reads the submission from the database before responding.
- 2026-07-06: **Code-review sweep fixes (skills-hunt).** Applied the actionable findings and documented the false positives: (1) `skills-hunt.leaderboard.list` contract output field renamed `generatedAt` → `generatedAtIso` to match the route and the codebase-wide `*Iso` convention (no consumer read the old name). (2) `POST /api/skills-hunt/submissions/:id/report` now uses `requireSkillsHuntSubmitAccess` (the member-write gate the `_lib` comment names for report filing) instead of the plain read gate — behaviour-identical today, correct intent going forward. (3) Bulk accept / reject in the web moderation queue now confirms with the count of affected pending submissions before firing. (4) The mission-archive `DELETE` no longer sends a `Content-Type` header (no body). (5) Added clarifying comments that the admin submissions listing is intentionally moderator-gated (matches the review route and the `ownershipScopeOrModerationRole` policy) and that the achievements route is self-scoped to `gate.auth.userId`. Verified as already-correct (no change): round update is a true partial update via `mergeRoundInput`, and the mobile admin screen is enforced by the server admin gate with `403 → forbidden`.
- 2026-06-23: **Android parity — paid-round reward visibility on the mobile moderation screen (#660, part 1).** `GET /api/skills-hunt/admin/rounds/:roundId/submissions` already returns the round's reward config and a running `rewardSummary`; the React Native moderation screen (`AdminSkillsHunt.tsx` + `admin-api.ts` + `SkillsHuntApi.ts`) now surfaces them: a **Reward** banner shows `rewardCreditsPerAccept` ServiceCredits per accepted nomination (plus the optional per-scout cap) and "Paid so far: N ServiceCredits across M nominations" (`totalCreditsPaid` / `rewardedSubmissionCount`), and each accepted nomination shows a "✓ Paid N ServiceCredits" pill from its `creditGranted` / `creditAmount`. Amounts are always rendered in full words ("ServiceCredits"), never bare "SC" or a fiat equivalent. The reward is minted server-side on accept (idempotent, cap/budget-bounded), so no mobile mint logic was added. **Deliberately kept web-only (per the ticket's allowance):** round create/edit with reward config, and the Missions / Reports / Directory-reward-card admin sections — round setup was already web-only on mobile, and these are low-frequency owner tasks better suited to the larger web admin. No backend, schema, or contract change.
- 2026-02-24: Created initial SkillsHunt rewrite checklist with phase gates for contracts, validation, moderation scoring, leaderboard/reward workflows, directory-profile generation, security/compliance, and release readiness.
- 2026-05-11: Re-baselined checklist after audit on `claude/audit-skills-hunt-plugin-6yv3e`. Marked baseline phases as implemented; opened Wave 1 + Wave 2 sub-items for the rewrite; consolidated UI work into new Phase 8. Cross-referenced `ctf-skills-hunt-session-continuity.md` as canonical source of truth.
- 2026-05-11 (commit `f3aeb3f`): Landed Phase 1 schema additions for Wave 1 + Wave 2 — all submission/leaderboard/achievement columns, `skills_hunt_submission_reports` table, `directory_profiles` source/invited_by/unclaimed_handle/deleted_at, idempotent `community-<6hex>` backfill, defense-in-depth `users.username` UNIQUE. Types + constants aligned. Existing scoring + review code unchanged (Wave 2 will rewrite to consume the new SPEC weights).
- 2026-05-11 (commit `f36c8ca`): Reconciled continuity doc with Replit design pass (`design/` at `dcaaf15`). Owner-locked four post-design decisions: keep reward card on Directory navigating to `/apps/skills-hunt?tab=scout`; implement Missions in Wave 2; skip Phase 0/1/2 badge until Replit clarifies; adopt "Nominate / Scout" lexicon everywhere (backend identifiers unchanged). Submodule pointer bumped.
- 2026-05-11 (commit `403b19e`): Added Missions schema (`skills_hunt_missions`, `skills_hunt_mission_progress`), types, and `lib/skills-hunt/missions.ts` module with row mappers, list queries, and pure recompute hook. Admin CRUD endpoints + reviewSubmission hook wiring deferred to a follow-up commit.
- 2026-05-11 (Directory profile rendering): Extended DirectoryProfile type with `source`, `invitedByUsername`, `unclaimedHandle`; `getPublicDirectoryById` now SELECTs the new columns + filters out `deleted_at`; the public profile page renders the purple "Community generated" pill, the monospace `@unclaimed_handle` line, and "Nominated by @handle" attribution. Uses design's exact hex per rule 126.
- 2026-05-12: **GetStream removed from SkillsHunt scope** (continuity §2.11). Wave 2 notification fan-out now writes to `skills_hunt_notifications` only, polled at 30s. Updated Phase 4 leaderboard upgrade-path note and the fan-out checkbox to reflect the lock. The design's "GetStream ⚡" badge is decorative-only and was already absent from the Wave 1 shell rebuild.
- 2026-06-12: The Android SkillsHunt API clients (`packages/mobile/src/features/skills-hunt/SkillsHuntApi.ts` and `admin-api.ts`) now use the shared authenticated fetch helper — every call carries the signed-in member's Clerk bearer token and the server address comes from runtime config (APP_URL) — replacing plain dev-only fetch against hardcoded development URLs; the admin client no longer takes a hand-passed token parameter.
