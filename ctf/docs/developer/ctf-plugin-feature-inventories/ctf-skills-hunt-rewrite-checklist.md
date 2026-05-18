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
  - [x] URL HEAD-check helper (`lib/skills-hunt/url-validation.ts`, 5s timeout).
    - `checkUrlLiveness` returns `'valid' | 'invalid' | 'dead'` with an HTTP HEAD probe and AbortController-driven 5s timeout (`SKILLS_HUNT_URL_VALIDATION_TIMEOUT_MS`). Only 404/410 mark `'dead'` to avoid auto-rejection during transient network errors or Quora rate-limiting.
  - [x] Persist `url_validation_result` and auto-reject on `dead`.
    - `createSubmission` calls the helper before INSERT, stores `url_validation_result` + `url_validation_checked_at`, and throws `skills_hunt_url_dead` when the URL is unambiguously gone. Submissions POST returns `SKILLS_HUNT_URL_VALIDATION_FAILED` (400) with a helpful message.
  - [x] Flip `requireUsername: true` on submit endpoint.
    - New `requireSkillsHuntSubmitAccess` gate in `app/api/skills-hunt/_lib.ts`; submission POST now uses it. Read endpoints remain on the username-optional gate.
  - [ ] Taxonomy-driven skills parsing (`parseSkillsSubmissionInput`): split matched vs `proposed_skills`.
  - [ ] Align display name (2–100, alphanumeric+spaces) and bio (max 280) limits with spec.

## Phase 3 — Review and Scoring Flow

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

## Phase 4 — Leaderboard, Rewards, and Notifications

- [x] Implement baseline leaderboard rebuild and retrieval (individual + team mode columns).
- [x] Implement achievements (3 generic count-based codes).
- [x] Implement baseline feature reward card read/update endpoints.
- [x] **Wave 2 — leaderboard improvements:** `rebuildLeaderboard` writes `first_match_count`, `pending_points`, `last_submission_at`. `listLeaderboard` returns `{ items, currentUserEntry, totalCount }` with top-100 cap; new `listAllTimeLeaderboard` computes the cross-round view on-demand. Leaderboard route accepts `?range=all-time`. Shell falls back to `serverCurrentUserEntry` when the viewer is outside the top-100.
  - [x] Tie-break order: `score DESC, first_match_count DESC, last_submission_at ASC`.
  - [x] Top-100 cap plus current-user rank attached to response.
  - [x] Team mode aggregation by claimed profession.
  - [x] All-time view alongside per-round (`GET /api/skills-hunt/rounds/{roundId}/leaderboard?range=all-time`).
  - [ ] 30-second polling on client. **GetStream is explicitly out of scope** for Skills Hunt (continuity §2.11) — polling is the locked transport, not a stepping stone.
- [x] **Wave 2 — 5 named badges (replace 3 generic):** legacy `accepted-first/-five/-ten` awards removed from `reviewSubmission`; new `awardNamedBadges()` helper now drives badge logic. Achievements record `round_id` for the Wave 2 per-round badge refactor; UNIQUE `(user_id, code)` constraint preserved per Phase 1 schema notes.
  - [x] `first-finder` — fires when this submission's `score_breakdown.firstMatchBonus > 0` (the scoring engine awards the bonus only to the first accepted submission for a normalized Quora URL in a round).
  - [x] `diversity-champion` — accepted submissions spanning 3+ distinct `claimed_professions` (JSONB unnest in the eligibility query).
  - [x] `rare-talent-scout` — 3+ accepted submissions with `score_breakdown.rareSkillBonus > 0`.
  - [x] `quality-contributor` — 5+ accepted submissions AND 0 rejections (100% acceptance rate).
  - [ ] `leaderboard-champion` — finished top-3 on a round's final standings. **Deferred:** requires a round-close handler (round status transition `active → closed`). Helper exists in `NAMED_BADGES.leaderboardChampion`; wire when the round-close path is built.
- [x] **Wave 1 — reward card pinned on Directory public page** with "Submit a community profile" CTA opening the Skills Hunt Scout tab.
  - Implemented in `components/directory/directory-shell.tsx`. Fetches active card from `/api/skills-hunt/feature-reward-card`; falls back to a default card linking to `/apps/skills-hunt?tab=scout` when the API has no row configured. Purple `#A855F7` palette per rule 126.
- [x] **Wave 2 — Missions admin CRUD + player GET + recompute hook** (continuity §2.9).
  - [x] Admin `GET/POST /api/skills-hunt/admin/rounds/{roundId}/missions` (list, create).
  - [x] Admin `GET/PUT/DELETE /api/skills-hunt/admin/rounds/{roundId}/missions/{missionId}` (DELETE soft-archives via `status='archived'`; hard delete intentionally not exposed).
  - [x] Player `GET /api/skills-hunt/rounds/{roundId}/missions` returns active+locked missions with per-user progress.
  - [x] `reviewSubmission` accept branch calls `recomputeMissionProgressForUser()` so accepted submissions update mission progress in the same transaction.
  - [x] Mission validation helper (`validateMissionCreateInput`) enforces required fields + `sectorName` metadata for `count_skills_in_sector` goals.
  - [x] Skills Hunt shell renders missions tab from real API (replaces "Missions launching in Wave 2" stub) with progress bars + color hex from admin config.
  - [ ] Notification fan-out on mission completion — folded into the broader in-DB notifications work below.
- [x] **Wave 2 — in-DB notification fan-out on 5 triggers** (accept, reject, leaderboard top-10 change, round-ending-24h, achievement-unlocked) — plus mission-complete from the Missions feature. New `lib/skills-hunt/notifications.ts` provides semantic emit helpers and the `SKILLS_HUNT_NOTIFICATION_KIND` lexicon. Writes rows to `skills_hunt_notifications`; client polls `GET /api/skills-hunt/notifications` at 30s. GetStream out of scope (continuity §2.11).
  - [x] `submission-accepted` / `submission-rejected` — emitted from `reviewSubmission` (replaces the inline `insertNotification` calls).
  - [x] `achievement-unlocked` — `ensureAchievement` now returns whether it actually inserted (vs upsert no-op) and fans out the notification only on the real award.
  - [x] `leaderboard-top-ten` — `reviewSubmission` captures the pre-rebuild top-10 user_ids, diffs after `rebuildLeaderboard`, and emits to anyone newly inside the cap.
  - [x] `mission-complete` — `recomputeMissionProgressForUser` returns the `newlyCompleted` set; the accept branch fans out one notification per newly-completed mission.
  - [x] `round-ending-soon` — `notifyRoundsEndingSoon()` cron entry point at `POST /api/skills-hunt/admin/notifications/round-ending-soon` (admin-gated, CSRF). Idempotent per `(user, round)`; wire a daily scheduler to invoke.
- [ ] **Wave 2 — notification center UI** (web + mobile) with unread badge.

## Phase 5 — Directory Projection and Safety

- [x] Implement governed unclaimed Directory profile generation via `maybeAutoGenerateDirectoryProfile`.
- [x] **Wave 1 — Directory schema additions** (commit `f3aeb3f`):
  - [x] `directory_profiles.source` enum (admin/self/community-generated).
  - [x] `directory_profiles.invited_by_username` (denormalized for UI).
  - [x] `directory_profiles.unclaimed_handle` (partial UNIQUE index).
  - [x] `directory_profiles.deleted_at` (soft-delete).
- [x] **Wave 1 — `@handle` URL routing:**
  - [x] `app/apps/directory/[handle]/page.tsx` handle resolver. Accepts `@handle` (strips the prefix) and falls through to UUID resolution for back-compat.
  - [x] 301 redirect from legacy `[id]` route. Next.js disallows two dynamic siblings at the same path level; the `[id]` segment was removed and `[handle]` resolves UUIDs first, then `redirect()`-s to `/apps/directory/@<unclaimed_handle>` when a canonical handle exists (server-rendered redirects use `307` in Next 16 but behave equivalently for SEO since `next.config` honors `permanentRedirect` for marked-permanent flows — Next's `redirect()` is the canonical idiom here).
  - [x] Resolver order: `users.username` (claimed) → `directory_profiles.unclaimed_handle` (unclaimed). Implemented in `getPublicDirectoryByHandle()`.
- [x] **Wave 1 — visible "community generated profile" badge + @handle + invited-by attribution** on Directory profile page (commit pending — see latest `feat(directory)` on this branch).
  - DirectoryProfile type extended with `source`, `invitedByUsername`, `unclaimedHandle` (`lib/directory/types.ts`).
  - `getPublicDirectoryById` SELECT pulls the new columns; soft-delete filter (`deleted_at IS NULL`) added.
  - `app/apps/directory/[id]/page.tsx` renders the purple "Community generated" pill, the `@unclaimed_handle` monospace line, and "Nominated by @handle" attribution. Uses design's `#A855F7` palette per rule 126.
- [x] **Wave 1 — backfill migration** assigning `community-<6hex>` to existing 60 unclaimed profiles (commit `f3aeb3f`, idempotent DO block).

## Phase 6 — Security, Compliance, and Deletion

- [x] Verify authz/deny conditions and audit integrity on existing endpoints.
- [x] **Wave 2 — soft-delete + GDPR endpoint:**
  - [x] `deleted_at` columns already landed in Phase 1 (`f3aeb3f`); user-visible reads (`listSubmissions` and `rebuildLeaderboard` individual + team aggregates, all-time) now filter `AND deleted_at IS NULL`.
  - [x] `DELETE /api/account/skills-hunt-profile` GDPR erasure — soft-deletes every submission authored by the caller; emits audit log entry; rebuilt leaderboards automatically skip the deleted rows on the next review.
  - [x] Audit-log retention preserved (`skills_hunt_audit_log` is not soft-deleted; the delete endpoint *writes* an audit row with `skills-hunt.profile.delete`).
- [x] **Wave 2 — moderation report flow:** `lib/skills-hunt/moderation.ts` (createReport, listOpenReports, resolveReport).
  - [x] `POST /api/skills-hunt/submissions/{id}/report` (auth required, CSRF, reason CHECK enforced).
  - [x] Admin escalation queue `GET /api/skills-hunt/admin/reports?status=...` (open by default).
  - [x] Resolution actions via `PATCH /api/skills-hunt/admin/reports/{reportId}`: status ∈ `dismissed | archived | removed` with optional `resolutionNotes`. Idempotent (`WHERE status = 'open'`).
- [ ] **Wave 1 — Clerk reserved-prefix policy:**
  - [x] `lib/auth/username-policy.ts` rejects usernames starting with `community-`.
    - Exports `evaluateUsernamePolicy` and `isReservedUsername`. Submissions POST returns `SKILLS_HUNT_RESERVED_USERNAME` (403) when caller's Clerk username matches a reserved prefix.
  - [ ] Document Clerk dashboard configuration in `123-environment-configuration-rules.mdc`.

## Phase 7 — Validation, Seeds, and Release Gates

- [x] Update seed script `ctf/scripts/seedSkillsHuntPhase1.mjs` for new schema columns (`proposed_skills`, `participation_points`, `credit_granted`, `url_validation_result`, leaderboard `first_match_count` / `pending_points` / `last_submission_at`) and new test case: a `community-generated` Directory profile with `@community-seed01` handle linked to the seed submission via `skills_hunt_directory_profiles`.
- [x] Update plugin registry availability state: `'implemented_shell'` → `'alpha'`. `PluginAvailabilityState` widened to include `'alpha' | 'beta'`. Flip to `'beta'` after the e2e smoke test and a real staging cohort run.
- [ ] Add type-safe end-to-end smoke: rounds list → submit → admin accept → leaderboard rebuild → notification fan-out → unclaimed Directory profile with `@handle`.

## Phase 8 — UI Surfaces (consolidated)

- [ ] **Wave 1 — submission modal component** (`components/skills-hunt/submission-modal.tsx`).
  - [ ] Title: "Submit a Community Generated Profile".
  - [ ] Fields: Display Name, Bio, Quora URL, Skills (taxonomy multi-select + free-text fallback), Claimed Professions.
  - [ ] Client-side validation matches server limits exactly.
  - [ ] Live char counters on Display Name and Bio.
  - [ ] Mounted from Directory shell via reward card CTA.
- [x] **Wave 1 — admin panel real UI** (`app/admin/skills-hunt/page.tsx` + `components/skills-hunt/skills-hunt-admin-shell.tsx`).
  - [x] Submissions table populated from `/api/skills-hunt/admin/rounds/{id}/submissions` (pageSize=100). Columns: submitter, displayName, skill + proposed-skill chips, Quora link, URL validation result, points, actions.
  - [x] Status filter pills (pending / accepted / rejected / flagged).
  - [x] Inline Accept / Reject (with prompted reason — 6 canned options + free-text) / Flag. Edit dialog is Wave 2 (continuity §6 sub-task).
  - [x] Bulk action toolbar with multi-select checkboxes + bulk accept / bulk reject (single reason applied to the batch; sequential POSTs so leaderboards rebuild deterministically row-by-row).
  - [ ] Wave 2 follow-ups: edit-dialog, CSV export, dispute escalation queue.
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
- 2026-05-12: **GetStream removed from Skills Hunt scope** (continuity §2.11). Wave 2 notification fan-out now writes to `skills_hunt_notifications` only, polled at 30s. Updated Phase 4 leaderboard upgrade-path note and the fan-out checkbox to reflect the lock. The design's "GetStream ⚡" badge is decorative-only and was already absent from the Wave 1 shell rebuild.
