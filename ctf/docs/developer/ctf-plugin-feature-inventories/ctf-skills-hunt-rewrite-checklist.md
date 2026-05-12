# Skills Hunt Rewrite Checklist (CTF)

> **For new agents:** read `ctf-skills-hunt-session-continuity.md` FIRST. It is the canonical spec + locked decisions + roadmap. This file is the execution checklist. Update boxes as work lands. Reference commits where possible.

## Scope and Boundary

- [x] Confirm implementation scope is `ctf/` only.
  - Evidence: confirmed in session-continuity §1.
- [x] Confirm plugin slug and command namespace lock.
  - Stable plugin slug is `skills-hunt` across docs/contracts/routes.
- [x] Confirm Directory boundary semantics.
  - Only governed generation of unclaimed profiles is allowed; ownership lifecycle remains Directory-authoritative. Reaffirmed 2026-05-11.

## Phase 0 — Contract Lock

- [x] Define Skills Hunt plugin command contracts for v1.
  - Evidence: `ctf/docs/contracts/SKILLS_HUNT_PLUGIN_COMMAND_CONTRACTS.yaml`.
- [x] Define Skills Hunt access policy contracts for v1.
  - Evidence: `ctf/docs/contracts/SKILLS_HUNT_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml`.
- [x] Define Skills Hunt audit contracts for v1.
  - Evidence: `ctf/docs/contracts/SKILLS_HUNT_PLUGIN_AUDIT_CONTRACTS.yaml`.
- [ ] Add command for `skills-hunt.submission.report` (community moderation report) and `skills-hunt.profile.delete` (GDPR delete) to all three contracts. — Wave 2.

## Phase 1 — Schema, Migrations, and Retention

- [x] Define Skills Hunt domain schema for v1 baseline.
- [x] **Add new columns/tables for v2 (Wave 1):** Landed in commit `f3aeb3f`.
  - [x] `skills_hunt_submissions`: `url_validation_result` (with CHECK), `url_validation_checked_at`, `credit_granted`, `proposed_skills`, `edit_history`, `edited_at`, `deleted_at`, `participation_points`.
  - [x] `skills_hunt_leaderboard`: `first_match_count`, `pending_points`, `last_submission_at`. Tie-break composite index added.
  - [x] `skills_hunt_achievements`: `round_id` FK to `skills_hunt_rounds`, `archived_at`. UNIQUE constraint preserved; Wave 2 will refactor for per-round badges.
  - [x] `directory_profiles`: `source` enum (admin/self/community-generated) with named CHECK, `invited_by_username`, `unclaimed_handle` with partial UNIQUE index, `deleted_at`.
  - [x] New table `skills_hunt_submission_reports` with XOR check between `submission_id` and `directory_profile_id`.
  - [x] Backfill migration: idempotent DO block assigns `community-<6hex>` to every existing unclaimed Directory profile, retries on UNIQUE collision.
  - [x] `public.users`: defense-in-depth CREATE UNIQUE INDEX on `LOWER(username)` where NOT NULL.
- [ ] Document retention behavior for moderation, reward, and report entities.
- [ ] Prepare rollback/replay notes for the new migrations.

## Phase 2 — Core Contributor Flow

- [x] Implement rounds list/get surfaces.
  - `GET /api/skills-hunt/rounds`, `GET /api/skills-hunt/admin/rounds`.
- [x] Implement submission creation with baseline validation.
- [x] Enforce duplicate (signature) and rolling rate-limit safeguards.
- [ ] **Wave 1 updates:**
  - [ ] URL HEAD-check helper (`lib/skills-hunt/url-validation.ts`, 5s timeout).
  - [ ] Persist `url_validation_result` and auto-reject on `dead`.
  - [x] Flip `requireUsername: true` on submit endpoint.
    - New `requireSkillsHuntSubmitAccess` gate in `app/api/skills-hunt/_lib.ts`; submission POST now uses it. Read endpoints remain on the username-optional gate.
  - [ ] Taxonomy-driven skills parsing (`parseSkillsSubmissionInput`): split matched vs `proposed_skills`.
  - [ ] Align display name (2–100, alphanumeric+spaces) and bio (max 280) limits with spec.

## Phase 3 — Review and Scoring Flow

- [x] Implement moderator/admin submission review actions (accept/reject/edit/flag).
- [x] Implement baseline scoring engine.
- [ ] **Wave 2 — scoring rewrite to spec:**
  - [ ] Match `+10` flat (not `min(skills.length,5)*3`).
  - [ ] First Match `+5` (not `+4`).
  - [ ] Skill Stack `+3` only if 2+ professions (not linear).
  - [ ] Quality `+2` only if accepted without admin edits (not `bio≥200chars`).
  - [ ] Rare Skill `+7` from Workforce live snapshot (<50% recruited).
  - [ ] Participation `+1` point on reject.
  - [ ] All weights configurable per round in `scoring_config`.
- [ ] **Wave 2 — reputation system:**
  - [ ] New-user lower cap (configurable, default 3/wk).
  - [ ] >20% rejection rate → admin pre-approval required for next submission.
  - [ ] ≥80% acceptance rate → cap raised to 10/wk.
- [x] Enforce rejection-rate guardrails (existing 80% block — to be replaced by reputation system in Wave 2).

## Phase 4 — Leaderboard, Rewards, and Notifications

- [x] Implement baseline leaderboard rebuild and retrieval (individual + team mode columns).
- [x] Implement achievements (3 generic count-based codes).
- [x] Implement baseline feature reward card read/update endpoints.
- [ ] **Wave 2 — leaderboard improvements:**
  - [ ] Tie-break order: `score DESC, first_match_count DESC, last_submission_at ASC`.
  - [ ] Top-100 cap plus current-user rank attached to response.
  - [ ] Team mode aggregation by claimed profession.
  - [ ] All-time view alongside per-round.
  - [ ] 30-second polling on client (Wave 2 upgrade path: GetStream feeds).
- [ ] **Wave 2 — 5 named badges (replace 3 generic):**
  - [ ] `first-finder` — first accepted submission for a given Quora URL in a round.
  - [ ] `diversity-champion` — accepted submissions across 3+ professions in a round.
  - [ ] `rare-talent-scout` — 3+ accepted submissions tagged with rare skills.
  - [ ] `quality-contributor` — 100% acceptance rate with 5+ submissions.
  - [ ] `leaderboard-champion` — finished top-3 on a round's final standings.
- [x] **Wave 1 — reward card pinned on Directory public page** with "Submit a community profile" CTA opening the Skills Hunt Scout tab.
  - Implemented in `components/directory/directory-shell.tsx`. Fetches active card from `/api/skills-hunt/feature-reward-card`; falls back to a default card linking to `/apps/skills-hunt?tab=scout` when the API has no row configured. Purple `#A855F7` palette per rule 126.
- [ ] **Wave 2 — GetStream fan-out on 5 triggers** (accept, reject, leaderboard top-10 change, round-ending-24h, achievement-unlocked).
- [ ] **Wave 2 — notification center UI** (web + mobile) with unread badge.

## Phase 5 — Directory Projection and Safety

- [x] Implement governed unclaimed Directory profile generation via `maybeAutoGenerateDirectoryProfile`.
- [x] **Wave 1 — Directory schema additions** (commit `f3aeb3f`):
  - [x] `directory_profiles.source` enum (admin/self/community-generated).
  - [x] `directory_profiles.invited_by_username` (denormalized for UI).
  - [x] `directory_profiles.unclaimed_handle` (partial UNIQUE index).
  - [x] `directory_profiles.deleted_at` (soft-delete).
- [ ] **Wave 1 — `@handle` URL routing:**
  - [ ] `app/apps/directory/[handle]/page.tsx` handle resolver.
  - [ ] 301 redirect from legacy `[id]` route.
  - [ ] Resolver order: `users.username` → `directory_profiles.unclaimed_handle`.
- [x] **Wave 1 — visible "community generated profile" badge + @handle + invited-by attribution** on Directory profile page (commit pending — see latest `feat(directory)` on this branch).
  - DirectoryProfile type extended with `source`, `invitedByUsername`, `unclaimedHandle` (`lib/directory/types.ts`).
  - `getPublicDirectoryById` SELECT pulls the new columns; soft-delete filter (`deleted_at IS NULL`) added.
  - `app/apps/directory/[id]/page.tsx` renders the purple "Community generated" pill, the `@unclaimed_handle` monospace line, and "Nominated by @handle" attribution. Uses design's `#A855F7` palette per rule 126.
- [x] **Wave 1 — backfill migration** assigning `community-<6hex>` to existing 60 unclaimed profiles (commit `f3aeb3f`, idempotent DO block).

## Phase 6 — Security, Compliance, and Deletion

- [x] Verify authz/deny conditions and audit integrity on existing endpoints.
- [ ] **Wave 2 — soft-delete + GDPR endpoint:**
  - [ ] Add `deleted_at` to all user-scoped Skills Hunt tables.
  - [ ] `DELETE /api/account/skills-hunt-profile` GDPR erasure.
  - [ ] Audit-log retention preserved (`skills_hunt_audit_log` is not soft-deleted).
- [ ] **Wave 2 — moderation report flow:**
  - [ ] `POST /api/skills-hunt/submissions/{id}/report` (auth required).
  - [ ] Admin escalation queue (`GET /api/skills-hunt/admin/reports`).
  - [ ] Resolution actions: dismiss, archive profile, hard-delete.
- [ ] **Wave 1 — Clerk reserved-prefix policy:**
  - [x] `lib/auth/username-policy.ts` rejects usernames starting with `community-`.
    - Exports `evaluateUsernamePolicy` and `isReservedUsername`. Submissions POST returns `SKILLS_HUNT_RESERVED_USERNAME` (403) when caller's Clerk username matches a reserved prefix.
  - [ ] Document Clerk dashboard configuration in `123-environment-configuration-rules.mdc`.

## Phase 7 — Validation, Seeds, and Release Gates

- [ ] Update seed script `ctf/scripts/seedSkillsHuntPhase1.mjs` for new schema columns and new test cases (community-generated profile with backfilled handle).
- [ ] Update plugin registry availability state: `'implemented_shell'` → `'alpha'` until Wave 2 ships, then `'beta'`.
- [ ] Add type-safe end-to-end smoke: rounds list → submit → admin accept → leaderboard rebuild → notification fan-out → unclaimed Directory profile with `@handle`.

## Phase 8 — UI Surfaces (consolidated)

- [ ] **Wave 1 — submission modal component** (`components/skills-hunt/submission-modal.tsx`).
  - [ ] Title: "Submit a Community Generated Profile".
  - [ ] Fields: Display Name, Bio, Quora URL, Skills (taxonomy multi-select + free-text fallback), Claimed Professions.
  - [ ] Client-side validation matches server limits exactly.
  - [ ] Live char counters on Display Name and Bio.
  - [ ] Mounted from Directory shell via reward card CTA.
- [ ] **Wave 1 — admin panel real UI** (`app/admin/skills-hunt/page.tsx`).
  - [ ] Pending submissions table.
  - [ ] Status filter (pending/accepted/rejected/flagged).
  - [ ] Inline Accept / Reject (with reason dropdown) / Edit (typo-fix dialog).
  - [ ] Bulk action toolbar (multi-select + bulk accept/reject).
  - [ ] Wave 2 follow-ups: CSV export, dispute escalation queue.
- [ ] **Wave 2 — mobile rebuild** (`packages/mobile/src/features/skills-hunt/`).
  - [ ] Replace `SkillsHunt.tsx` hardcoded mock.
  - [ ] API-driven Rounds, Leaderboard, Submit screens.
  - [ ] Notification center.

## Open Decisions Tracker

- [ ] Final tier/prize structure (1st vs 2nd vs 3rd). Owner to confirm before Wave 2 ships.
- [x] Final policy for admin-preapproved submitter pathways — re-enabled as part of reputation system in Wave 2.
- [ ] Android parity target date and owners — to be set during Wave 2 mobile rebuild.
- [ ] Leaderboard real-time: polling vs WebSocket. Default: 30s polling.
- [ ] Moderation report UI: only on community-generated, or all Directory profiles. Default: all profiles.
- [ ] Dispute escalation: second-admin sign-off vs flagged queue. Default: flagged queue.

## Change Log

- 2026-02-24: Created initial Skills Hunt rewrite checklist with phase gates for contracts, validation, moderation scoring, leaderboard/reward workflows, directory-profile generation, security/compliance, and release readiness.
- 2026-05-11: Re-baselined checklist after audit on `claude/audit-skills-hunt-plugin-6yv3e`. Marked baseline phases as implemented; opened Wave 1 + Wave 2 sub-items for the rewrite; consolidated UI work into new Phase 8. Cross-referenced `ctf-skills-hunt-session-continuity.md` as canonical source of truth.
- 2026-05-11 (commit `f3aeb3f`): Landed Phase 1 schema additions for Wave 1 + Wave 2 — all submission/leaderboard/achievement columns, `skills_hunt_submission_reports` table, `directory_profiles` source/invited_by/unclaimed_handle/deleted_at, idempotent `community-<6hex>` backfill, defense-in-depth `users.username` UNIQUE. Types + constants aligned. Existing scoring + review code unchanged (Wave 2 will rewrite to consume the new SPEC weights).
- 2026-05-11 (commit `f36c8ca`): Reconciled continuity doc with Replit design pass (`design/` at `dcaaf15`). Owner-locked four post-design decisions: keep reward card on Directory navigating to `/apps/skills-hunt?tab=scout`; implement Missions in Wave 2; skip Phase 0/1/2 badge until Replit clarifies; adopt "Nominate / Scout" lexicon everywhere (backend identifiers unchanged). Submodule pointer bumped.
- 2026-05-11 (commit `403b19e`): Added Missions schema (`skills_hunt_missions`, `skills_hunt_mission_progress`), types, and `lib/skills-hunt/missions.ts` module with row mappers, list queries, and pure recompute hook. Admin CRUD endpoints + reviewSubmission hook wiring deferred to a follow-up commit.
- 2026-05-11 (Directory profile rendering): Extended DirectoryProfile type with `source`, `invitedByUsername`, `unclaimedHandle`; `getPublicDirectoryById` now SELECTs the new columns + filters out `deleted_at`; the public profile page renders the purple "Community generated" pill, the monospace `@unclaimed_handle` line, and "Nominated by @handle" attribution. Uses design's exact hex per rule 126.
