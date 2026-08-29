# SkillUp Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Rewrite target only: `ctf/`
- Legacy reference excluded from implementation: `platform/`
- Plugin name: `SkillUp`
- Plugin slug: `skill-up`

## Intent and Outcome

SkillUp is where skills training runs. A member browses the open cohorts, reads each one's
curriculum and milestones, joins one, and follows their own progress — how many milestones are
done, who the trainer is, and which cohorts they are in right now. Cohorts exist because Workforce
shows the community is short of people in that occupation; an admin approves each one from that
ranked list, so what SkillUp offers follows where the skills gaps actually are.

ServiceCredits move through SkillUp, and credits are an internal, non-fiat unit — never money,
never cash, never redeemable for anything outside the app. A cohort may ask for a deposit in
credits, held against that cohort's milestones and released as each milestone is validated, with
the trainer's share set as a percentage. A member's credits view inside SkillUp is read-only: it
shows the balance, what is being held, and what was earned here, and offers no way to spend or
transfer. Badges are awarded for reaching something, never bought and never spent.

If something goes wrong with an enrollment, the member opens a dispute and writes what happened,
with comments and attachments; an admin resolves it. Trainer profiles are browsable but read-only —
a member reads who runs a cohort and cannot edit it.

## Implemented User Features

1. Cohort listing with filters for `track`, `status`, and `startDate`.
2. Cohort detail view with curriculum, milestones, and enrollment affordance.
3. Enrollment flow with optional deposit policy and escrow split per milestone.
4. User dashboard with wallet balance, SkillUp escrow totals, active enrollments, and recent transactions.
5. Dispute open flow with comments and attachment metadata support.
6. Trainers directory (read-only browse): survivor-advocate trainer profiles with headline, bio, tracks, and active-cohort count.
7. Achievements (grant-only badges): badge definitions with the signed-in user's earned status. Badges are awarded, never bought or spent.
8. Credits Wallet (grant-only view): the signed-in user's ServiceCredits balance, total earned through SkillUp, escrow held, and a read-only history of credits earned/granted. Exposes no spend or transfer action.
9. Your own cohorts, on every visit (2026-08-15). Browse shows **My Cohorts** — how many cohorts you are in right now — and Progress lists each one with its milestone count (for example "2/5") and your trainer's name; a cohort you have already joined shows "✓ Enrolled" instead of an Enroll button. Before this the member screen only remembered cohorts you joined during that same visit, so coming back later showed zero and an empty Progress tab. Finished cohorts read "Completed" and ones you left read "You left this cohort", so the count of cohorts you are in never quietly includes them. If the read fails, the count shows a dash and a note explains that it could not be read — it never shows a "0" that would look like you are not enrolled anywhere.

## Implemented Trainer Features

1. Milestone validation endpoint for trainer/admin.
2. Milestone release endpoint that settles learner escrow and trainer payout split.
3. Trainer dashboard data layer (`getTrainerDashboardData`: cohorts, pending validations, trainees,
   payout ledger summary). Note: this is a repository function with no member-shell surface today —
   the inline "pending validations" approve panel was removed with the member-shell right panel
   (see the 2026-07-21 change-log entry). An **admin** validates, releases, resolves, and claims
   from the admin panel's actionable review queues (2026-08-05); a non-admin **trainer** still acts
   via the API (`POST /api/skill-up/milestones/[milestoneId]/validate` etc., server-scoped by
   `isTrainerForCohort`) — a trainer-facing member-shell surface remains open (see Gaps).

## Implemented Admin Features

1. Admin credit grant endpoint (`mint`/`adjustment` path), wired to a real admin UI on both web and Android. Owner decision (2026-06-06): the admin UI is grant-only — it only ever grants ServiceCredits to a member ("earn or earn nothing") and exposes no remove/negative path; the amount input accepts positive values only and submit is disabled client-side for non-positive amounts. (The backend endpoint still technically accepts a signed amount so a mistaken grant can be corrected later, but the UI never sends a negative.) Every grant requires a member user ID, an amount greater than zero, a reason, and a governance ticket ID, and goes behind an explicit in-screen confirm step that restates exactly what will change ("add N credits to member X") before submit. The mutation carries the `x-ctf-csrf: '1'` header and is written to the audit log.
2. Dispute resolution endpoint with optional adjustment transfer.
3. Admin panel with operational KPIs plus a read-only cohort overview (title, track, status, seats open, required deposit, trainer split, completion bonus) from `GET /api/skill-up/cohorts`.
4. Cohort proposal queue (issue #904, proposal-queue model — owner decision 2026-07-23): a ranked, sector-diverse list of proposed cohorts derived from the Workforce talent gaps. Each row shows the occupation, sector, and gap, with a 1/3/5-month **term** selector and **Approve & open** / **Dismiss** actions; a **Refresh proposals** button re-reads the current gaps. Approving opens a real cohort (the admin picks the term); dismissing removes the proposal. The admin cohort overview shows `auto` and `needs trainer` badges on cohorts opened from proposals that have no human trainer yet.
5. Review queues on the admin panel — **actionable since 2026-08-05** (`su-review-actions.tsx`): **Open disputes** (`skill_up_disputes` `status='open'`, newest first, with title, description, opener name, and time) each carry a **Resolve…** control (a written resolution posted to `POST /api/skill-up/disputes/:id/resolve`; credit adjustments deliberately stay out of the form — an adjustment case goes through the ServiceCredits admin). **Pending milestone validations** (`skill_up_milestone_validations` `status='pending'`, newest first) each carry **Validate** and **Release credits** buttons calling the live milestone routes (the server stays the referee on ordering; a row missing its cohort id shows a handle-via-API note instead of a broken button). Cohorts flagged `needs trainer` carry a **Claim as trainer** button (`POST /api/skill-up/cohorts/:id/claim-trainer`). Both queue lists are server-rendered from `getAdminPanelData()` and drive the admin-landing "new to review" dot; a completed action re-pulls them via `router.refresh()`.
6. **Who enrolled** roster on the admin panel (2026-08-29). Every enrollment, newest first (capped at 100), showing the member's Clerk handle (`@name`), the cohort they joined, their enrollment status, and the date. Handles are resolved in one batched Clerk lookup (`resolveUsernames`); an id Clerk cannot resolve falls back to `member <short id>` rather than an empty cell. Finished and left enrollments are included, so this list can be longer than the live "Members in a cohort now" KPI — the copy above the list says so. Server-rendered from `getAdminPanelData()`; no new route.
7. KPI cards that each say which question they answer (2026-08-15). The panel shows **Members in a cohort now** (distinct people holding a live enrollment), **Active enrollments** (the live enrollment rows themselves — one member in three cohorts is three of these), **Enrollments, all time** (every enrollment row ever written, including left and finished ones), **Completions**, and **Avg days to first trainer credit grant**. All the enrollment numbers come from one pass over `skill_up_enrollments` in `getAdminPanelData()`, so they cannot disagree with each other. Before this there was a single card labeled "Enrollments" carrying the all-time row count, which was read as a headcount of people.

## Cohort Proposals from Workforce Gaps (issue #904)

SkillUp turns the Workforce talent gaps into a **ranked, admin-approved proposal queue** — it does not
create cohorts on its own. Owner decision (2026-07-23, small active user base): the admin opens and
closes cohorts at their discretion by approving proposals; full auto-create and a demand-*prediction*
algorithm (tracking Workforce trends over time to forecast demand, not just today's snapshot) are
deferred. That future model is where `max_concurrent` becomes load-bearing again.

**SkillUp ↔ Workforce read interface (the contract the issue asked for before build):**

- SkillUp reads the gap signal **server-side, in-process** via `fetchOccupationGapReport()` from
  `lib/workforce/repository` — it does not call Workforce over HTTP. The return is the per-occupation
  list `{ jobTitleId, occupation, sector, skillLevel, target, recruited, gap }`, sorted largest-gap-first.
- The read is **one-way**: SkillUp never writes Workforce, Directory, or Skills Taxonomy. A proposal's
  and the resulting cohort's `source_job_title_id` is the gap's `jobTitleId` (a Skills Taxonomy job title
  id), so it ties to the exact occupation with no fuzzy title match.
- **Cadence:** a daily GitHub Actions cron (`.github/workflows/skill-up-auto-cohorts.yml`) calls
  `POST /api/internal/skill-up/auto-cohorts/run` (CRON_SECRET bearer). Each run closes expired auto
  cohorts, and — at most every `generation_interval_days` (default 90) — re-reads the gaps into the
  proposal queue. The admin **Refresh proposals** button forces a re-read on demand.
- **Selection (admin-editable in `skill_up_auto_cohort_config`):** filter to the configured skill level
  (default `Foundational`), require `gap ≥ min_gap_threshold`, exclude occupations already covered by an
  open/active auto cohort or already holding a pending proposal, then rank **sector-diverse**:
  round-robin across sectors (each sector's occupations largest-gap-first; sectors ordered by their top
  gap) up to `per_sector_cap` per sector, bounded by `top_n` for a reviewable queue. There is **no**
  max-concurrent cap on proposals — the admin opens on demand.
- **Approval → term:** the admin approves a proposal and picks a **1/3/5-month** term; a real cohort
  opens with `start = today`, `end = today + term`, `auto_created = true`, and the `source_*` fields. If
  the occupation already has an open auto cohort (the `uq_skill_up_auto_cohort_active_source` guard
  fires), the proposal is marked `superseded` and no second cohort opens.
- **Economics (one global policy, admin-editable):** every approved cohort is stamped with the deposit
  (`default_required_credits`, default 0 = free to join — sets `allow_no_deposit`), the trainer split
  (`default_trainer_split_percent`, default 25%), the completion bonus (`default_completion_bonus_credits`,
  default 0), and a standard 3-milestone skeleton (`SKILL_UP_AUTO_COHORT_DEFAULT_MILESTONES`: 40/30/30).
  Per-occupation economic tuning is deferred (#1197).
- **Lifecycle:** each approved cohort's end date is `start + term`. The daily run closes any auto cohort
  whose term has elapsed (status → `completed`). Expiry is checked every run; proposal regeneration is
  gated to the 90-day cadence.
- **Queue upkeep / idempotency:** the partial unique index `uq_skill_up_cohort_proposal_pending`
  (one pending proposal per occupation) plus the cadence guard make repeat runs idempotent. On each
  regeneration, pending proposals no longer valid (occupation now covered, or gap fell below the
  threshold) are marked `superseded`; still-valid ones keep their row with a refreshed gap/rank.
- **Pre-flight guard:** if no sector carries a positive `skills_taxonomy_sectors.workforce_share`,
  Workforce demand falls back to an even split and the "largest gap" order is meaningless, so the run
  generates nothing and records `skipped: no_workforce_share`.
- **Recruiting:** an approved cohort opens with the scheduler as a placeholder owner and `status='open'`
  (so it shows in the existing cohort browse and trainees can enroll). A trainer claims it via
  `POST /api/skill-up/cohorts/[cohortId]/claim-trainer`, which makes them the trainer of record; until
  then the cohort carries a derived `needsTrainer` flag.

## API Surface and Route Map

- `GET /api/skill-up/cohorts`
- `POST /api/skill-up/cohorts` — create a cohort; admin or trainer role (per `cohort.create` contract). The cohort list response now also carries `autoCreated`, `sourceJobTitleId`, `sourceSector`, and a derived `needsTrainer` flag.
- `POST /api/skill-up/cohorts/[cohortId]/claim-trainer` — a trainer or admin claims an auto-created cohort that has no human trainer yet, becoming its trainer of record (per `cohort.claim_trainer` contract).
- `POST /api/skill-up/admin/auto-cohorts/run` — admin-only "Refresh proposals" action; force-regenerates the cohort proposal queue from the current Workforce gaps and closes expired auto cohorts; CSRF-guarded (per `cohort.auto_create` contract).
- `POST /api/internal/skill-up/auto-cohorts/run` — cron-only run, guarded by `Authorization: Bearer ${CRON_SECRET}` (no user session). Closes any auto cohort whose term has elapsed, and — at most every `generation_interval_days` (default 90) — re-reads the Workforce occupation gaps into the ranked, sector-diverse proposal queue. Does **not** create cohorts. Idempotent.
- `GET /api/skill-up/admin/cohort-proposals` — admin-only; the ranked pending proposal queue (per `cohort.proposal_approve`/`_dismiss` read surface).
- `POST /api/skill-up/admin/cohort-proposals/[proposalId]/approve` — admin-only; opens a cohort from a pending proposal with a chosen term of 1/3/5 months; CSRF-guarded (per `cohort.proposal_approve` contract).
- `POST /api/skill-up/admin/cohort-proposals/[proposalId]/dismiss` — admin-only; removes a pending proposal from the queue; CSRF-guarded (per `cohort.proposal_dismiss` contract).
- `POST /api/skill-up/enroll` — member or admin only; trainer-only accounts are blocked (per `enrollment.create` contract).
- `GET /api/skill-up/enrollments` — the calling member's own enrollments, each with cohort title/track, assigned trainer name, status, an `isCurrent` flag (true while the status is `enrolled` or `active`), and a milestone tally (`milestoneTotal` / `milestoneCompleted`, counting `validated` and `released` validations). Read-only, capped at 50, newest first. Scoped to the caller inside the repository query — it accepts no user id, so an admin calling it still gets only their own rows (per `enrollment.list` contract).
- `POST /api/skill-up/milestones/[milestoneId]/validate`
- `POST /api/skill-up/milestones/[milestoneId]/release`
- `POST /api/skill-up/transfers` — self-transfer (recipient equals actor) is rejected with 400.
- `POST /api/skill-up/disputes`
- `POST /api/skill-up/disputes/[disputeId]/resolve` — admin, or the trainer assigned to the dispute's cohort (per `dispute.resolve` `trainerAssignmentOrAdmin`).
- `POST /api/skill-up/admin/adjust-credits` — audit event records `targetContext` (`targetUserId`, `governanceTicketId`) per the `admin.adjust_credits` audit contract.
- `GET /api/skill-up/trainers` — list trainer directory (read-only), optional `track` filter.
- `GET /api/skill-up/achievements` — list grant-only badges with the signed-in user's earned status.
- `GET /api/skill-up/wallet` — signed-in user's balance + grant-only earned/granted history (no spend path).

## Data Model and Storage Contracts

Primary migration: `ctf/migrations/2026-03-24-skill-up-core-phase3.sql`

Core tables:

1. `skill_up_cohorts`
2. `skill_up_curriculum_items`
3. `skill_up_milestones`
4. `skill_up_enrollments` — one row per member per cohort (unique on `(cohort_id, user_id)`). Columns: `id` (PK), `cohort_id`, `user_id`, `status`, `credits_deposited`, `assigned_trainer_id`, `enrolled_at`, `progress_percent`, `created_at`, `updated_at`. `status` is `enrolled` on insert (`active` on rows written before the value changed) and moves to `completed` or `dropped`; every read that means "a live enrollment" matches `('enrolled', 'active')`, and both `enrolled` and `pending` are in the check constraint. `enrolled_at` was corrected into `ctf/schema.sql` on 2026-08-15 — it had always existed on the long-running database but a freshly built one lacked it while three reads order or measure by it.
5. `skill_up_enrollment_milestone_escrows`
6. `skill_up_milestone_validations`
7. `skill_up_disbursements`
8. `skill_up_stipend_schedules`
9. `skill_up_disputes`
10. `skill_up_dispute_comments`
11. `skill_up_rate_limit_counters`
12. `skill_up_command_idempotency`
13. `skill_up_audit_events`
14. `skill_up_policy_config`
15. `skill_up_trainers` — trainer directory profile. Columns: `id` (PK), `user_id` (unique), `display_name`, `headline`, `bio`, `tracks` (jsonb array), `status`, `created_at`, `updated_at`. Read-only browse surface.
16. `skill_up_achievements` — grant-only badge definitions. Columns: `id` (PK), `slug` (unique), `name`, `description`, `track`, `icon`, `credit_reward` (display-only grant amount), `sequence_no`, `status`, `created_at`, `updated_at`.
17. `skill_up_user_achievements` — per-user earned badge rows (grant-only: a row means earned). Columns: `id` (PK), `user_id`, `achievement_id`, `earned_at`, `granted_credits`, `source_reference`, `created_at`; unique on `(user_id, achievement_id)`.
18. `skill_up_auto_cohort_config` — singleton config for the gap-driven proposal queue (issue #904). Columns: `singleton_key` (PK bool), `enabled` (gates proposal generation), `min_gap_threshold`, `max_concurrent` (default 3 — retained for the future full-auto model; **not** used by proposal generation), `per_sector_cap` (default 1 — diversity cap), `skill_level_filter` (default `Foundational`), `top_n` (default 10 — queue-size bound), `default_term_days` (default 90), `default_seats` (default 12), `default_required_credits` (default 0 = free to join), `default_trainer_split_percent` (default 25), `default_completion_bonus_credits` (default 0), `generation_interval_days` (default 90 — the cadence), `last_generated_at` (nullable — cadence guard), `updated_by_user_id`, `updated_at`. Admin-editable. The economic columns are one global policy applied to every approved cohort; per-occupation tuning is deferred (#1197).
19. `skill_up_auto_cohort_term_overrides` — legacy per-occupation fixed-term overrides (issue #904). Columns: `job_title_id` (PK), `occupation`, `term_days`, `updated_by_user_id`, `updated_at`. No longer consulted in the proposal model (the admin picks 1/3/5 months at approval); kept for the future full-auto model.
20. `skill_up_cohort_proposals` — the gap-driven cohort proposal queue (issue #904, proposal-queue model). Columns: `id` (PK), `source_job_title_id` (Skills Taxonomy job title — no hard FK, mirroring `skill_up_cohorts.source_job_title_id`), `occupation`, `sector`, `skill_level`, `gap_at_proposal`, `rank`, `status` (`pending`/`approved`/`dismissed`/`superseded`), `generated_source`, `generated_at`, `decided_by_user_id`, `decided_at`, `created_cohort_id` (set when approved), `created_at`, `updated_at`. Partial unique index `uq_skill_up_cohort_proposal_pending` on `source_job_title_id WHERE status='pending'` (at most one live proposal per occupation); `idx_skill_up_cohort_proposal_pending_rank` on `(status, rank)` for the ranked read.

Auto-cohort columns on `skill_up_cohorts` (issue #904): `auto_created` (bool), `source_job_title_id` (UUID, references `skills_taxonomy_job_titles.id` by convention — no hard FK, mirroring `directory_profiles.job_title_id`), `source_sector` (text), `source_gap_at_creation` (numeric). A partial unique index `uq_skill_up_auto_cohort_active_source` on `source_job_title_id WHERE auto_created = TRUE AND status IN ('open','active')` enforces at most one open/active auto cohort per occupation (the database-level idempotency guard).

Multi-currency (issue #120): `skill_up_cohorts` carries `stipend_currency` and `microgrant_currency`
(FK → `currencies.code`), naming the currency of `stipend_amount_per_payout` and `microgrant_amount`.
Both default to ServiceCredits (code `SC`) — these are internal token payouts. No surface renders a
ServiceCredits amount at a fiat equivalent (the no-fiat-parity rule from issue #120).

External value movement dependencies:

- `service_credits_wallets`
- `service_credits_transfers`
- `service_credits_escrow_holds`
- `service_credits_governance_events`
- `service_credits_dispute_adjustments`

## Security and Compliance Controls

1. Server-side role and access checks (`admin`, `trainer`, `user`) via plugin access gate.
2. CSRF checks enforced on mutation endpoints.
3. Input validation via `zod` on all SkillUp routes.
4. Command idempotency persistence for mutation replay safety. `dispute.resolve` reads its
   idempotency record **before** applying the credit adjustment, so a retried resolve never
   re-runs the adjustment transfer.
5. Audit events for all implemented SkillUp commands.
6. Enrollment and milestone validate rate-limit counters persisted in DB.
7. Enrollment-party check on `dispute.open`: only the enrollment's learner, its assigned trainer,
   or an admin may open a dispute on it (enforced in `openDispute`), per the access policy's
   `enrollment_not_visible` deny condition.

## Seed Coverage Status

Deterministic seed script added:

- `ctf/scripts/seedSkillUp.mjs`

Seed content:

1. 5 users by deterministic IDs (1 admin, 1 trainer, 3 trainees).
2. Trainees set to 500 ServiceCredits each.
3. Open cohort with required credits 300, milestones (30/70), and baseline payout/refund policy JSON.
4. 1 trainer directory profile (`skill_up_trainers`) for the seed trainer, with headline, bio, and tracks (`Tech`, `Finance`).
5. 3 achievement definitions (`skill_up_achievements`): First Milestone, Cohort Graduate, Peer Mentor — deterministic UUIDs.
6. 1 earned badge row (`skill_up_user_achievements`): trainee 1 has earned First Milestone.

## Web and Android Delivery Status

Delivery: **web + mobile-responsive complete** (pixel pass delivered). **Android (React Native) surface removed 2026-07-20 (rule 105, PR #1742)** — this feature is now web-only, served by the installable web app (PWA). Web pixel pass complete: the web shell
(`components/skill-up/skill-up-shell.tsx` + `lu-*` sub-components) is aligned to the design mockup and
decomposed within rule-116 limits. Android pixel pass complete (2026-05-31): `SkillUp.tsx` rewritten to
the design mockup (`MobileSkillUp.tsx` / `MobileSkillUpEmpty.tsx` / `MobileSkillUpLoading.tsx` /
`MobileSkillUpPublic.tsx`), covering loading / empty / main states. Real-data-only: binds
`GET /api/skill-up/cohorts` and `GET /api/service-credits/wallet`; `MockSkillUp.tsx` retired.
Unbacked mockup elements omitted: `trainerName`, `tags`, `milestoneCount` (not returned by cohorts
list endpoint); active-enrollment banner (no user-enrollment GET endpoint at the time). The web shell
gained that read on 2026-08-15 (`GET /api/skill-up/enrollments`); the Android screen still does not
call it — SkillUp is off the Android keep-list per rule 105, so the web app is its only surface.

Trainers / Achievements / Credits Wallet (2026-06-07): the three former "coming soon" sidebar sections
are now real, backed surfaces on web and Android. Web: `su-trainers.tsx`, `su-achievements.tsx`,
`su-wallet.tsx` rendered from the shell (`skill-up-shell.tsx`), each lazy-loaded on first tab open and
each with its own empty state; the desktop sidebar and the phone-width tab bar both reach all three.
Android: `SkillUpTrainers.tsx`, `SkillUpAchievements.tsx`, `SkillUpWallet.tsx` reached via a new tab bar
in `SkillUp.tsx`. Real-data-only: bind `GET /api/skill-up/trainers`, `GET /api/skill-up/achievements`,
`GET /api/skill-up/wallet`. Grant-only: the Wallet shows balance + earned/granted history with no spend or
transfer action; Achievements are grant-only badges.

Design refresh (2026-06-08, design submodule `b3742f7`): the three screens were brought up to the new
`SkillUpTrainers` / `SkillUpAchievements` / `SkillUpCreditsWallet` mockups (and their `Mobile*` variants).
Web Trainers now shows a stats row (trainers, tracks covered, active cohorts) and richer avatar cards;
Achievements splits badges into honest Earned / Locked buckets with a stats row and icon tiles (the real
`icon` name mapped to a glyph); the Wallet shows balance overview cards plus All / Earned / Escrow filter
tabs over a transaction table. Real-data-only deviations from the mockups, recorded so the design team can
decide whether to back them: trainer rating / handle / per-cohort name+status / learners / milestones
validated / SC released / recent-activity feed (none in the trainers endpoint); achievement emoji / rarity /
an "In Progress" bucket with a progress fraction (the endpoint exposes only an earned boolean); wallet
"Total Spent", a per-row running balance, a "Spent" filter, a per-cohort escrow breakdown, and the
"earn more" suggestion list (grant-only model has no spend path, and the wallet endpoint returns only an
aggregate escrow figure). The shell's mobile root was switched from `100vh` to `100dvh` so there is no
bottom gap on mobile browsers.

Admin surface (2026-06-06): the `/admin/skill-up` web page is now a real, mobile-responsive admin UI
(`components/skill-up/su-admin-shell.tsx` + `su-admin-shared.ts`, `useIsMobile()` responsive, admin-gated
via `evaluatePluginAccess` at the route) showing KPI cards, the cohort overview, and the ServiceCredits
adjustment action with an explicit confirm step. The Android admin screen
(`ctf/packages/mobile/src/features/skill-up/AdminSkillUp.tsx` + `admin-api.ts`, registered in `App.tsx` as
`skill-up-admin`) mirrors the same cohort overview and adjustment action. The mockup
`MobileSkillUpAdmin.tsx` shows a track/badge editor; no track or badge admin endpoints exist, so that
layout is not implemented — the admin screens bind only the cohort list and the adjust-credits endpoint
that exist today.

## Gaps and Known Technical Debt

0. **The member has no in-app way to OPEN a dispute, and a non-admin trainer has no in-app
   validate/release/claim surface.** (History-checked 2026-08-05: never built on any platform.)
   The admin side became actionable 2026-08-05 (see Admin Features #5). The blocker named here — a
   missing own-enrollments read — was cleared on 2026-08-15 by `GET /api/skill-up/enrollments`, which
   gives the Progress tab a real `enrollmentId` per row to attach a dispute to. Remaining order of
   work: the dispute form on the Progress tab, then the trainer surface (which can reuse
   `getTrainerDashboardData` behind a trainer-gated read route).
1. Dispute attachment storage uses URL metadata only (no secure file storage backend). This is a known limitation; full storage integration is a future optimization.
2. No admin KPI read endpoint exists; the web admin page renders KPIs from server-side `getAdminPanelData()` and the Android admin screen has no KPI cards (no GET route to call). Add a `GET /api/skill-up/admin/kpis` route to give the mobile screen the same KPI cards as web.
3. No admin-gated GET route exists for the SkillUp admin screens, so the mobile admin screen cannot pre-gate by role before render; it relies on the server-side admin gate on `POST /adjust-credits` to deny non-admins. The cohort list (`GET /api/skill-up/cohorts`) is read-access for any approved user. A dedicated admin-gated read route would let the mobile screen show the admin-only notice without attempting a mutation.
4. The design mockup `MobileSkillUpAdmin.tsx` (track/badge management) has no backing endpoints; tracks are a free-text field on cohorts and there is no badge model. Building that surface would require new schema, routes, and contracts.
5. ~~Auto cohorts' trainer payout did not fire because enrollments had no `assigned_trainer_id`.~~ **Resolved (2026-06-29):** enrolling in a claimed auto cohort now sets `assigned_trainer_id` to the claiming trainer (the cohort's `created_by_user_id` once it is no longer the scheduler placeholder), and `claim-trainer` backfills that trainer onto any enrollments made before the claim. So a milestone release now settles the trainer split for auto cohorts. (Admin/human-built cohorts are unchanged — they only get an assigned trainer when one is passed in, since their `created_by_user_id` may be an admin, not the trainer.)

## Change Log

- 2026-08-29: **The admin panel names who enrolled (owner report).** The KPI cards counted
  enrollments and each cohort row showed how many seats were gone, but nothing named a single
  person — an admin could see a seat had been taken and have no way to see who took it. New
  repository read `listEnrollmentsForAdmin` (`lib/skill-up/repository.ts`) returns every enrollment
  newest-first with the member's handle, the cohort title, the status and the enrolled date,
  resolving handles through the existing batched `resolveUsernames` Clerk lookup exactly as
  `listOpenDisputes` already does. `getAdminPanelData()` returns it as `enrollments`, and a new
  **Who enrolled** section (`components/skill-up/su-enrollments-section.tsx`, kept out of
  `su-admin-shell.tsx` for rule 116) renders it above the cohort overview. An id Clerk cannot resolve
  reads `member <short id>` rather than blank. The list includes finished and left enrollments, so it
  can exceed the live "Members in a cohort now" KPI; the section copy says so rather than leaving the
  two numbers looking contradictory. Read-only and admin-gated by the existing route gate — no new
  route, no schema change, no contract change, and no member-facing surface moves.
- 2026-08-29: **Renamed the plugin LevelUp → SkillUp (owner decision), as a hard cutover with no
  aliases.** Member-facing name, slug, folders, files, code identifiers, API routes, contracts and
  database tables all move together. `/apps/level-up` and every `/api/level-up/*` route are gone and
  do NOT redirect — the shell is `/apps/skill-up`, the admin surface `/admin/skill-up`, and the
  routes `/api/skill-up/*` (plus the scheduled `/api/internal/skill-up/auto-cohorts/run`, which the
  renamed `skill-up-auto-cohorts.yml` workflow calls). The old `level-up` registry row is deleted so
  the Apps list does not show the plugin twice. Command names are `skill-up.*`; the constant family
  is `SKILL_UP_*`; error-code string values are `skill_up_*`; the scheduler actor id is
  `skill-up-auto-cohort-scheduler`. Components moved to `components/skill-up/` and the file prefix
  went `lu-` → `su-` (`su-shared.ts`, `su-browse.tsx`, `su-admin-shell.tsx`, and the rest), with the
  two shells renamed `skill-up-shell.tsx` / `skill-up-public-shell.tsx`. Library code is
  `lib/skill-up/`, the seed script `seedSkillUp.mjs`, and the contract files `SKILL_UP_PLUGIN_*`.
  All 18 tables move from the `level_up_` prefix to `skill_up_`. `schema.sql` chains the renames so
  every database generation lands in the same place: the 2026-06-26 block still takes a pre-2026-06-26
  database `levelup_` → `level_up_`, then the new block takes it `level_up_` → `skill_up_`; a fresh
  database no-ops through both. Because renaming a table moves rows but not the strings other plugins
  wrote about it, a data-migration block at the end of `schema.sql` also moves the stored values:
  Weekly Performance `metric_key` (`value.level_up_completions` / `value.level_up_trainer_payouts`)
  and `source_plugin`, so the week-over-week comparison keeps reading its own history; delivered
  `notifications` (`link_path`, `source_plugin`, `notification_type`), so an already-sent notification
  does not open a dead link; `service_credits_transfers.origin_plugin` and
  `recurring_activities.origin_plugin`, which `isRegisteredPluginSlug()` would otherwise read as an
  unknown origin; the auto-cohort scheduler `actor_id`; and the command names on
  `skill_up_audit_events`, `skill_up_command_idempotency` and `skill_up_rate_limit_counters` — the
  idempotency rows matter most, since a replay lookup matches on `command_name` and a row left at the
  old name would let an already-applied command run a second time. `post/0008` lists both the old and
  new scheduler actor ids so it stays correct whichever order it and the rename run in. Cross-plugin
  references updated: the Trust signal type is `engagement-skill-up-cohorts` with the
  `skillUpCohortsCompleted` metric, and GDP recognition reads `pluginSlug: 'skill-up'`.
  Deliberately UNCHANGED, for the same reason they survived the 2026-06-26 rename: the stored
  ServiceCredits ledger and governance values `levelup_trainer_split`, `levelup_completion_bonus`,
  `levelup_milestone_validated`, `levelup_enrollment_setup_failed`, `levelup_transfer`, and the
  `levelup:` governance ticket prefix. Those are matched against existing production rows and read by
  the GDP recognizer; renaming them would orphan that history and drop SkillUp trainer payouts out of
  the Community Value Index. Android has no SkillUp surface (rule 105 keep-list), so only the plugin
  icon and color-token maps changed there. Web + mobile typecheck, lint and build clean.

- 2026-08-18: **Intent and Outcome statement added — it now ships to the public user guide.** As of
  2026-08-18 the guide generator (`ctf/scripts/generate-user-guide.mjs`) reads each inventory's
  "Intent and Outcome" section as its framing block; SkillUp had no such heading, so its `/guide`
  section was written from feature bullets alone and described joining a cohort as setting up a
  "payment plan" — credits are an internal, non-fiat unit and are never described in money terms. The
  new section states what SkillUp is, where its cohorts come from (the Workforce skills gaps, admin
  approved), and how credits work here in the approved wording: a deposit in credits held against the
  cohort's milestones, a read-only credits view with no spend or transfer, badges awarded and never
  bought. Documentation only; no schema, route, contract, or behavior change.

- 2026-08-15: **The admin and the member now count the same enrollment rows (owner report: "admin
  says 3 people enrolled but the member side says 3 cohorts are open, not members").** Three separate
  causes, all fixed here.
  (1) *The member side could not see its own enrollments at all.* No route returned them, so the shell
  held them in React state only: the Browse count and the Progress tab were correct for a cohort you
  joined in that same visit and empty on every later visit, and a cohort you were already in still
  offered an Enroll button. New read `GET /api/skill-up/enrollments` (`listMemberEnrollments`, scoped
  to the caller by user id, capped at 50, newest first) returns each enrollment with its cohort title
  and track, the assigned trainer's name, the status, an `isCurrent` flag, and a milestone tally. The
  shell loads it with the cohorts and seeds the already-enrolled set from it; a failure there shows a
  dash and a plain note instead of a "0". New `enrollment.list` command and access-policy contracts.
  (2) *The one admin number was labeled ambiguously and counted every row of any status.* The panel's
  "Enrollments" card was `COUNT(*)` over `skill_up_enrollments`, so left and finished enrollments were
  in it and one member in three cohorts counted three times — a row count that reads as a headcount.
  `getAdminPanelData()` now does one pass over the table and returns `membersEnrolled` (distinct people
  with a live enrollment), `activeEnrollments`, `enrollments` (all time), and `completions`; the panel
  shows each under a label that says which it is. The single pass also means the numbers cannot drift
  apart from each other.
  (3) *The member's "Enrolled" card sat under a people icon next to a site-wide "Open Cohorts" count,*
  which invited reading it as everyone enrolled. It reads **My Cohorts** with a bookmark icon and counts
  only cohorts you are in right now.
  Also fixed in `ctf/schema.sql`, both affecting a freshly built database only: `skill_up_enrollments`
  gains the `enrolled_at` column (it exists on the long-running database, came over with the legacy
  `levelup_enrollments` table, but was never declared here — three live reads order or measure by it),
  and its `status` check now allows `enrolled`, the value the enrollment insert actually writes (a fresh
  database rejected every enrollment). The long-running database is unchanged by both: the column is
  already there and the check lives in the `CREATE TABLE` block that a table which already exists never
  runs. Web-only; SkillUp has no Android surface to match (rule 105).
- 2026-08-05: **The admin review queues act (closes "read-only lists" scope, part of the inventory
  audit).** The history check found five live, hardened SkillUp routes with zero UI callers on any
  platform, ever. The admin panel's queues are now actionable via the new `su-review-actions.tsx`
  (kept out of the 862-line `su-admin-shell.tsx` per rule 116): each open dispute carries a
  **Resolve…** control (written resolution → `POST /disputes/:id/resolve`; credit adjustments
  deliberately stay out of the form — an adjustment case goes through the ServiceCredits admin),
  each pending validation carries **Validate** and **Release credits** (the milestone routes; the
  server referees ordering; a row missing its cohort id shows a handle-via-API note), and a
  `needs trainer` cohort carries **Claim as trainer**. Completed actions re-pull the
  server-rendered queues via `router.refresh()`; the claim re-pulls the client-fetched cohort list.
  Still open (new Gaps #0): the member-side dispute form (blocked on an own-enrollments read
  endpoint) and a non-admin trainer surface. UI-only — no route, schema, or contract change.
- 2026-08-02: **Deletion burn-down batch 4.** On account deletion, `skill_up_trainers` (your trainer profile) and `skill_up_user_achievements` are now deleted. Shared/admin records (`skill_up_cohorts`, `skill_up_cohort_proposals`, `skill_up_milestone_validations`, auto-cohort config and term overrides) are classified retained — admin decision audit and ledger-adjacent validation history.
- 2026-08-02: **Deletion burn-down batch 3: disbursements and disputes classified as retained.** On account deletion, `skill_up_disbursements`, `skill_up_disputes`, and `skill_up_dispute_comments` are retained — they are the record of why cohort escrow balances moved and how contests over them were resolved, matching the ServiceCredits ledger policy. Caught by the deletion-coverage gate added in #2056.
- 2026-07-31: **Stored status value respelled to US English (owner-directed).** `skill_up_cohorts.status` now stores `canceled`; existing rows are migrated by the idempotent US-spelling data migration block at the end of `ctf/schema.sql`. Code, contracts, and docs were renamed in the same PR.
- 2026-07-23: **#904 delivered as an admin-approved cohort proposal queue (replaces auto-create).**
  Owner decision (small active user base): instead of the daily cron creating cohorts outright, SkillUp
  now re-reads the Workforce gaps on a cadence into a ranked, **sector-diverse** proposal queue that the
  admin approves at their discretion. New table `skill_up_cohort_proposals` (pending/approved/dismissed/
  superseded; one pending per occupation). `skill_up_auto_cohort_config` gains `generation_interval_days`
  (default 90 — the re-read cadence) and `last_generated_at` (cadence guard); `max_concurrent` is no
  longer used by generation (retained for the future full-auto model). `lib/skill-up/auto-cohort.ts` was
  rewritten: `generateCohortProposals` (sector-diverse round-robin, per-sector cap, supersede-stale),
  `runAutoCohortProposals` (always close expired cohorts; regenerate only when forced or the 90-day
  cadence is due), `approveCohortProposal` (admin picks a **1/3/5-month** term → opens a cohort;
  double-approve-guarded; already-covered → superseded), `dismissCohortProposal`, `listPendingProposals`.
  The two `auto-cohorts/run` routes were repointed (admin = force refresh, cron = cadence-gated). New
  admin routes: `GET /api/skill-up/admin/cohort-proposals`, `POST …/[proposalId]/approve`,
  `POST …/[proposalId]/dismiss`. The admin shell (`su-admin-shell.tsx`) replaces the "Run now" button
  with a **Refresh proposals** action and a proposal queue (occupation · sector · gap, term selector,
  Approve & open / Dismiss). New contracts `cohort.proposal_approve` / `cohort.proposal_dismiss` (command
  / access-policy / audit); `cohort.auto_create` updated to the proposal-generation shape. Cron header
  and `schema.demo.sql` regenerated. Deferred: full auto-create and the demand-prediction algorithm;
  per-occupation economic tuning (#1197). The admin picks the term (not the trainer) and the queue is
  Foundational-only for now — both admin-editable/revisitable.
- 2026-07-23: **Fixed enrollment failing on free (0 SC) cohorts.** Tapping "Enroll" on a cohort with
  no required deposit (`allow_no_deposit = true`, `required_credits = 0` — the default for
  auto-created cohorts) returned "Invalid SkillUp payload." The `enrollInCohort` guard required the
  caller to send `allowWithoutDeposit` whenever a no-deposit cohort was enrolled with a zero deposit,
  but the web shell's one-tap Enroll does not send that flag. The flag only makes sense when there is
  a *nonzero* required deposit to skip, so the guard is now gated on `requiredCredits > 0`; a
  genuinely free cohort enrolls with a zero deposit (the existing `depositRequested <= 0` short-circuit
  already skips escrow/wallet movement). No schema, route, or contract change. Paid and
  deposit-optional cohorts are unchanged; a paid cohort with a zero deposit still rejects.
- 2026-07-23: **Admin review queues for open disputes + pending validations, and the admin-landing dot.** The admin panel previously showed only KPIs, so open disputes and pending milestone validations had no admin surface. `getAdminPanelData()` now also returns `openDisputes` (`listOpenDisputes`, `skill_up_disputes` `status='open'`, opener names resolved via Clerk) and `pendingValidations` (`listPendingMilestoneValidations`, `skill_up_milestone_validations` `status='pending'`), both newest first and capped. The web admin shell (`su-admin-shell.tsx`) renders them as two read-only review lists below the KPIs. SkillUp is now wired into the admin-landing "new to review" dot (`lib/admin/area-attention.ts`): a dot shows when a dispute/validation arrived since the admin last opened the area. Server-rendered (no new API route); no schema or contract change. Resolving/approving stays in the existing dispute/validation flows.
- 2026-07-21: **Removed the orphaned member-shell right panel (resolves #1761).** The
  desktop-branch-collapse refactor (commit `279831a`) had already dropped the member shell's
  right-side panel from render — the enrollments summary now lives in the Progress tab — leaving
  `components/skill-up/su-right-panel.tsx` (which held the enrollments summary and the trainer
  "pending validations" approve panel) with no importers, plus a dangling `isTrainer` prop on
  `SkillUpShell` and its page call site. Deleted the dead component, removed the unused
  `PendingValidation` type from `su-shared.ts`, and dropped the `isTrainer` prop/pass-through. This
  closes the #1761 concern at the source: there is no member-shell pending-validations feed to scope,
  and none can be reintroduced by re-wiring the removed panel. Trainers still validate milestones
  through `POST /api/skill-up/milestones/[milestoneId]/validate` (server-scoped by `isTrainerForCohort`).
  UI/dead-code cleanup only — no schema, route, or contract change.
- 2026-07-20: **Notifications producer.** The milestone-release route emits a best-effort
  notification (`notifySafe`, `skill-up.milestone.released`) to the learner when their milestone
  credits are released — deduped on the transfer id, never to the trainer/admin who released. To
  address the learner, `releaseMilestoneCredits` now returns `recipientUserId` on its response
  (additive; it was already computed internally). No schema/route/contract-list change.
- 2026-07-20: **Resolved the skill-up code-review sweep findings (#1756–#1763).** No schema, route
  list, or contract change — behavior and security hardening only:
  - **dispute.open ownership (#1756, security).** `openDispute` now verifies the actor is the
    enrollment's learner, its assigned trainer, or an admin before creating the dispute (and before
    flipping any milestone validation to `disputed`); the route passes `isAdmin`. Previously any
    authenticated member who guessed an enrollment UUID could file a dispute on someone else's
    enrollment.
  - **dispute.resolve idempotency (#1757, correctness).** The stored idempotency response is read
    before `applyDisputeAdjustment` runs, so a retried resolve returns the prior result instead of
    re-invoking the credit adjustment. Mirrors `releaseMilestoneCredits`.
  - **Error mapping consolidation (#1762).** Deleted the dead duplicate
    `app/api/skill-up/_lib.ts` and merged its complete `skillUpErrorResponse` into the active
    `lib/skill-up/_lib.ts`, so `not_found` → 404, `invalid_state` → 409, `rate_limit_exceeded` →
    429, and the external-ledger errors → 503 (they previously collapsed to a generic 500). Added a
    `forbidden` → 403 case used by the new dispute ownership guard.
  - **claim_trainer audit (#1758, compliance).** The `cohort.claim_trainer` audit event now carries
    `targetContext: { cohortId }`, matching its audit contract (workspaceId is an unpopulated
    contract placeholder in this single-tenant codebase, consistent with `admin.adjust_credits`).
  - **admin.adjust_credits zero guard (#1759).** The route schema now rejects `amount === 0` for a
    clean 400; the signed +/- amount (grant / mistaken-grant correction) is still allowed.
  - **Trainer sees pending validations (#1760, correctness).** The right-panel Validation section is
    gated on `isAdmin || isTrainer` (was admin-only); `isTrainer` is threaded page → shell → panel.
    `milestone.validate` is permitted for trainers by contract, so a trainer must be able to see it.
  - **Scoping note (#1761).** Documented in the shell that a future pending-validations feed must be
    scoped to the trainer's own cohorts before being passed to the panel. It is a static empty list
    today, so there is no exposure yet.
  - #1763 (seatsAvailable query param) was already correct in current code (`.optional()`), so no
    code change — the issue is closed as already-fixed.
- 2026-07-19: **Corrected the "who earns" copy on the signed-out SkillUp screen (and the Android
  empty state).** The public marketing copy read "Complete milestones to earn ServiceCredits" /
  "Earn credits while learning", which implied a learner is paid new credits for each milestone. The
  code (`releaseMilestoneCredits` in `lib/skill-up/repository.ts`) does not work that way: passing a
  validated milestone **releases the learner's own escrowed deposit back to them** (not new credits),
  the **trainer** earns the newly minted split (`levelup_trainer_split`) for validating the work, and a
  learner earns *new* credits only through grant-only **badges** and a **completion bonus** at
  graduation. Rewrote the desktop and mobile-responsive subheads and the highlight bullet in
  `components/skill-up/skill-up-public-shell.tsx` to say this plainly (learners earn via badges and
  completion bonuses; trainers earn a credit split for validating milestones), and aligned the Android
  signed-in empty state (`packages/mobile/src/features/skill-up/SkillUp.tsx`). Copy-only; no schema,
  route, or contract change.
- 2026-07-17: **History-aware back + admin↔member navigation (app-wide sweep).** The member
  shell's hand-rolled back chevron was replaced by the shared `BackChevronButton` — it returns to
  the previous in-app page and falls back to All Apps when there is no in-app history. The admin
  surface header gained the shared "Member view" pill (`PluginUserShellButton`) linking to
  `/apps/skill-up`. UI-only; no schema, route, or contract change.
- 2026-07-14: Added refresh controls (app-wide refresh rollout). Web: the shared `RefreshButton` now sits in the member shell's section header on desktop and in the mobile-responsive sticky header (before the shared top actions); it re-runs the shell's `load` (cohorts + wallet) in a new background mode and resets the lazily loaded section flags so the trainers/achievements/wallet views re-fetch — all without flashing the full-screen loading state. Android: native pull-to-refresh via `RefreshControl` on the `SkillUp` browse `FlatList`, wired to a new background variant of `load` (the other tabs render their own components and are unchanged). UI-only; no schema, route, or contract change.
- 2026-06-29: Android parity for the auto-cohort admin controls (issue #1200, follow-up to #904). The mobile SkillUp admin screen (`packages/mobile/src/features/skill-up/AdminSkillUp.tsx`) now mirrors the web `su-admin-shell.tsx`: an "Auto cohorts from Workforce gaps" card with a "Run now" button that POSTs `POST /api/skill-up/admin/auto-cohorts/run` (via `runAutoCohorts()` in `admin-api.ts`, with the `x-ctf-csrf: '1'` header through the shared `authedFetch`) and shows the created/closed/skipped summary in the notice banner; and `auto` / `needs trainer` badges on each cohort row, driven by the `autoCreated` / `needsTrainer` fields now typed on the mobile `Cohort` (already returned by `GET /api/skill-up/cohorts`). No backend, schema, or contract change — binds only existing endpoints and fields.
- 2026-06-29: Wired the trainer of record onto auto-cohort enrollments so trainer payouts actually settle (issue #904 follow-up). `enrollInCohort` now resolves the assigned trainer: an explicitly supplied trainer wins; otherwise, for an auto-created cohort whose `created_by_user_id` is no longer the scheduler placeholder (i.e. a trainer has claimed it), the enrollment's `assigned_trainer_id` defaults to that claiming trainer. `claimAutoCohortTrainer` also backfills `assigned_trainer_id` onto existing enrollments that were created while the cohort had no trainer (members can enroll in an open auto cohort before it is claimed). Milestone release pays `assigned_trainer_id`, so the trainer split now fires for auto cohorts. Admin/human-built cohorts are unchanged (no auto-assignment — their `created_by_user_id` may be an admin). `cohort.claim_trainer` contract `dataAccess` now includes `skill_up_enrollments`. No schema change. Resolves the Gaps item from the previous entry.
- 2026-06-29: Gave auto-created cohorts an explicit, admin-editable economic policy plus a default milestone skeleton (issue #904, owner decision). Previously the auto path hardcoded deposit 0 / no milestones and let the trainer split fall through to the code default, so an auto cohort had no progression or payout scaffolding. Added `default_required_credits` (0 = free to join), `default_trainer_split_percent` (25), and `default_completion_bonus_credits` (0) to `skill_up_auto_cohort_config`, and a `SKILL_UP_AUTO_COHORT_DEFAULT_MILESTONES` 3-milestone skeleton (40/30/30) in constants. `runAutoCohortCreation` now stamps each cohort with these (deposit sets `allow_no_deposit` when 0) and the milestone skeleton. One global policy for now; per-occupation tuning deferred to #1197. Regenerated `schema.demo.sql`. Known follow-up: trainer payouts need the enroll path to set `assigned_trainer_id` for a claimed auto cohort (see Gaps).
- 2026-06-29: Auto-cohort creation from Workforce gaps (issue #904). SkillUp now stands up training cohorts from the Workforce occupation talent gaps without an admin hand-building each one. New module `lib/skill-up/auto-cohort.ts` reads the gap signal server-side via `fetchOccupationGapReport()` (no HTTP, one-way read — Workforce/Directory/Skills Taxonomy are never written), filters to the configured skill level (default `Foundational`) and a minimum gap, takes the top N, and creates cohorts up to a concurrency cap (default 3) and a per-sector cap (default 1), anchoring each to the gap's `source_job_title_id`. Fixed-term lifecycle: each cohort's end date is start + a per-occupation term override (or `default_term_days`); the run closes cohorts whose term has elapsed. Idempotent via a deterministic command key + a partial unique index (`uq_skill_up_auto_cohort_active_source`). Pre-flight guard skips the run when no sector carries a positive `workforce_share`. New schema: `auto_created` / `source_job_title_id` / `source_sector` / `source_gap_at_creation` columns on `skill_up_cohorts`, plus `skill_up_auto_cohort_config` (singleton knobs) and `skill_up_auto_cohort_term_overrides` tables. New routes: `POST /api/internal/skill-up/auto-cohorts/run` (CRON_SECRET), `POST /api/skill-up/admin/auto-cohorts/run` (admin manual fallback), `POST /api/skill-up/cohorts/[cohortId]/claim-trainer` (trainer claims an auto cohort). Cadence: daily cron `.github/workflows/skill-up-auto-cohorts.yml`. Admin UI: a "Run now" button and `auto` / `needs trainer` badges on the SkillUp admin screen. New contracts `cohort.auto_create` and `cohort.claim_trainer` (command / access-policy / audit). The cohort list response gained `autoCreated` / `sourceJobTitleId` / `sourceSector` / `needsTrainer`. Deferred to follow-up issues (current user base is small): the gap×talent-spread cadence/cap algorithm (#1197); sector-mixed cohorts with a per-trainee skills picker (#1198); and the graduation skill-attach that writes learned skills to the Directory profile (#1199 — the loop-closing write, which needs its own contract + consent).
- 2026-06-27: Resolved code-review sweep findings for skill-up. Access-policy alignment: `POST /api/skill-up/cohorts` now allows admin or trainer (was admin-only) per `cohort.create`; `POST /api/skill-up/disputes/[disputeId]/resolve` now allows the trainer assigned to the dispute's cohort in addition to admin (added `getDisputeCohortId` repository helper to map dispute → enrollment → cohort and reuse `isTrainerForCohort`) per `dispute.resolve` `trainerAssignmentOrAdmin`; `POST /api/skill-up/enroll` now blocks trainer-only accounts (member or admin only) per `enrollment.create`. Money safety: `POST /api/skill-up/transfers` rejects a self-transfer (recipient equals actor) with 400. Audit compliance: `admin.adjust_credits` audit event now writes a structured `targetContext` (`targetUserId`, `governanceTicketId`) inside metadata per the audit contract. Web shell bug fixes: `handleEnroll` now sends the `x-ctf-csrf: '1'` header (enrollment from the shell was failing CSRF); `handleValidate` now sends the required `enrollmentId`, `cohortId`, and `idempotencyKey` (the trainer Approve button posted an empty body that always failed validation) — `PendingValidation` extended to carry `enrollmentId` and `cohortId`. No schema table or column changes.
- 2026-06-26: Hyphenation/cleanup rename of the LevelUp plugin as a hard cutover with no backward-compatible aliases — `levelup` → `level-up` everywhere. `/api/levelup/*` no longer exists; the app shell (`/apps/level-up`), admin surface (`/admin/level-up`), web components, and the mobile API client all repoint to `/api/level-up/*`. Plugin slug in the registry/catalog/concierge/parity contract is now `level-up`; command names are `level-up.*`; constant family moved `LEVELUP_*` → `LEVEL_UP_*` (including the client-facing error-code string values `level_up_*`). Every database table renamed to the matching snake_case prefix: each `levelup_*` table becomes `level_up_*` (15 tables: enrollments, cohorts, curriculum_items, milestones, command_idempotency, audit_events, rate_limit_counters, enrollment_milestone_escrows, milestone_validations, disputes, dispute_comments, disbursements, trainers, achievements, user_achievements). `schema.sql` runs `ALTER TABLE ... RENAME TO` first so an existing database keeps its data; `schema.demo.sql` regenerated. Contract files renamed `LEVELUP_*` → `LEVEL_UP_*` (pluginId, dataAccess tables, scopes updated). Cross-plugin refs updated: Trust signal type `engagement-level-up-cohorts`, Trust `level_up_enrollments` read + `levelUpCohortsCompleted` metric; GDP recognition `pluginSlug: 'level-up'` and `level_up_*` table refs (the `levelUpTrainerPayoutSource` identifier kept). Deliberately UNCHANGED (stored ServiceCredits ledger/governance values matched against existing production rows; renaming them would orphan data and break the GDP recognizer): the mint-grant `reason` values `levelup_trainer_split` / `levelup_completion_bonus`, the `releasePolicy`/`releaseReason` value `levelup_milestone_validated`, the `refundReason` `levelup_enrollment_setup_failed`, the `reasonCode` `levelup_transfer`, and the `governanceTicketId` prefix `levelup:`. No `levelup → level-up` slug alias was added (hard cutover). Web + mobile typecheck/lint clean.
- 2026-06-17: Restyled the `/admin/skill-up` surface (`su-admin-shell`) to the shared dark admin design system (icon header with `ADMIN` badge, dark tokens, stat blocks, dark form inputs) per rule 131. Visual only — the grant-only confirmation flow, amount validation, governance ticket, idempotency key, and endpoints are unchanged. The mockup's track/badge management has no backing endpoints (see Gaps), so the real KPIs, cohort list, and credit-grant form are kept rather than the mockup's tabs/counts. Web typecheck + eslint clean.
- 2026-06-12: Android API clients (`api.ts`, `admin-api.ts`) now call the backend through the shared authenticated fetch wrapper (`authedFetch`): the signed-in member's Clerk bearer token is attached and the base URL comes from runtime config, replacing the plain dev-only fetch against hardcoded localhost URLs. The admin functions no longer take a token argument (the wrapper supplies the live token); `AdminSkillUp.tsx` call sites updated. No backend, schema, or contract change.
- 2026-06-08: Design refresh of the Trainers, Achievements, and Credits Wallet screens to the new design mockups (design submodule advanced to `b3742f7`). Web: rewrote `su-trainers.tsx` (stats row + avatar cards), `su-achievements.tsx` (Earned / Locked buckets, stats row, `icon`-name-to-glyph mapping), and `su-wallet.tsx` (balance overview cards + All / Earned / Escrow filter tabs over a transaction table). Android: rewrote `SkillUpTrainers.tsx`, `SkillUpAchievements.tsx`, `SkillUpWallet.tsx` to match the `Mobile*` mockups. Switched the shell's mobile root from `100vh` to `100dvh`. No backend, schema, route, or contract change — all three screens stay bound to the existing `GET /api/skill-up/trainers`, `GET /api/skill-up/achievements`, and `GET /api/skill-up/wallet`. Real-data-only: the mockups' rating / handle / cohort-status / learners / SC-released fields, achievement emoji / rarity / in-progress progress bars, and wallet total-spent / running-balance / per-cohort escrow / earn-more list were not invented — only real fields are rendered, with honest empty states for sections that have no data.
- 2026-06-07: Built the three former "coming soon" sections — Trainers, Achievements, Credits Wallet — into real surfaces on web and Android. Added three tables adjacent to the existing SkillUp tables in `schema.sql`: `skill_up_trainers` (trainer directory profiles), `skill_up_achievements` (grant-only badge definitions), and `skill_up_user_achievements` (per-user earned badge rows, unique on user+achievement). Added three read-only API routes: `GET /api/skill-up/trainers`, `GET /api/skill-up/achievements`, `GET /api/skill-up/wallet` — plus matching `trainer.list` / `achievement.list` / `wallet.view` command and access-policy contract entries. Web: `su-trainers.tsx`, `su-achievements.tsx`, `su-wallet.tsx` wired into `skill-up-shell.tsx` (lazy-loaded per tab; reachable from the desktop sidebar and the phone-width tab bar). Android: `SkillUpTrainers.tsx`, `SkillUpAchievements.tsx`, `SkillUpWallet.tsx` reached via a new tab bar in `SkillUp.tsx`. Extended `scripts/seedSkillUp.mjs` with 1 trainer profile, 3 achievement definitions, and 1 earned badge. Owner rule applied throughout: SkillUp is grant-only ("earn or earn nothing") — the Wallet reads balance + earned/granted history only and exposes no spend or transfer action; Achievements are grant-only badges. Regenerated `schema.demo.sql`.
- 2026-06-06: Owner decision — SkillUp admin UI is grant-only. An admin can never remove a member's ServiceCredits from the UI ("earn or earn nothing"). The web shell (`su-admin-shell.tsx`) and the Android screen (`AdminSkillUp.tsx`) now accept positive amounts only: the amount input is labeled "Amount to grant (greater than zero)", the action is labeled "Grant"/"Review grant", the confirm copy reads "add N credits to member X" (no "remove"), and submit is disabled client-side for non-positive amounts. The backend `POST /api/skill-up/admin/adjust-credits` endpoint is unchanged (it still technically accepts a signed amount so a mistaken grant can be corrected later); only the UI no longer exposes a negative path. Member id, reason, governance ticket id, idempotency key, and the two-step confirm are all kept. Copy-only/validation-only UI change; no schema/route/contract changes.
- 2026-06-06: Admin UI — turned the `/admin/skill-up` web page from a KPI-only stub into a real, mobile-responsive admin UI (`components/skill-up/su-admin-shell.tsx` + `su-admin-shared.ts`): KPI cards (server-fetched), a read-only cohort overview from `GET /api/skill-up/cohorts`, and a ServiceCredits adjustment form wired to `POST /api/skill-up/admin/adjust-credits` (CSRF header, idempotency key) behind an explicit confirm step that restates the member, direction (add/remove), and amount before submit. Added an Android admin screen (`ctf/packages/mobile/src/features/skill-up/AdminSkillUp.tsx` + `admin-api.ts`, registered in `App.tsx` as `skill-up-admin`) mirroring the cohort overview and the same confirm-gated adjustment action. No new amounts are fabricated and no ServiceCredits→fiat equivalence is rendered. The mockup's track/badge editor was not built (no backing endpoints). No schema/route/contract changes. Documented endpoint gaps (no admin KPI GET, no admin-gated read route) in Gaps.
- 2026-06-01: Multi-currency (issue #120): added `stipend_currency` and `microgrant_currency` (FK → `currencies.code`, default ServiceCredits) to `skill_up_cohorts`. Documented the no-fiat-parity rule. Schema + inventory only; the currency UI is design-gated.
- 2026-05-31: Android pixel pass — rewrote `ctf/packages/mobile/src/features/skill-up/SkillUp.tsx` to the design mockup (loading/empty/main states). Created real `api.ts` bound to `GET /api/skill-up/cohorts` and `GET /api/service-credits/wallet`. Retired `MockSkillUp.tsx`. Omitted unbacked fields: trainerName, tags, milestoneCount (not in cohorts list endpoint), active-enrollment banner (no user enrollment GET route). EOF, parity, and tsc gates all green.
- 2026-05-30: Web pixel pass — rebuilt the web shell to the design mockup and decomposed the 520-line `skill-up-shell.tsx` monolith into modular sub-components (`su-shared.ts`, `su-loading.tsx`, `su-sidebar.tsx`, `su-cohort-card.tsx`, `su-browse.tsx`, `su-progress.tsx`, `su-right-panel.tsx`, thin shell) within rule-116 limits. Removed 6 dead unreferenced components (AdminPanel, CohortDetail, CohortList, EnrollModal, TrainerDashboard, UserDashboard). Shell binds real routes (cohorts, service-credits wallet, enroll, milestone validate); unbacked mockup figures omitted. No schema/route/contract changes.
- 2026-05-17: Updated inventory to enforce Rule 105 parity baseline and Rule 120 living-snapshot model. Removed Android parity deferral language; confirmed web+android complete delivery status. Clarified technical debt (attachment storage) as genuine limitation, not unimplemented feature.
- 2026-03-24: Initial SkillUp phase-3 implementation inventory created (schema, repository, API routes, shell components, seed script, contracts).


## Build Checklist


### Scope and Boundary

- [x] Confirm implementation scope is `ctf/` only.
- [x] Confirm plugin slug and route namespace (`skill-up`).
- [x] Confirm no Prisma usage; SQL migration + repository pattern only.

### Schema and Registry

- [x] Add core migration for SkillUp domain tables.
- [x] Add plugin registry availability entry for `skill-up`.
- [x] Add baseline policy config (`starter_credits`, split defaults).

### Repository and Business Rules

- [x] Implement cohort creation/list/detail repository methods.
- [x] Implement enrollment and escrow allocation logic with idempotency.
- [x] Implement milestone validation and release settlement.
- [x] Implement dispute open/resolve and admin adjust credit flows.
- [x] Implement persisted DB rate-limit counters for enroll/validate.

### API Surface

- [x] Implement route helpers for authz, CSRF, and error mapping.
- [x] Add zod validation to SkillUp mutation/query handlers.
- [x] Add routes for cohorts, enrollments, milestones, transfers, disputes, admin adjustment.

### Web UI Shell

- [x] Add `SkillUpShell` under plugin app route.
- [x] Add `CohortList`, `CohortDetail`, `EnrollModal` components.
- [x] Add `UserDashboard`, `TrainerDashboard`, `AdminPanel` components.
- [x] Add `/admin/skill-up` page.

### Contracts and Inventory

- [x] Add command contracts file.
- [x] Add access policy contracts file.
- [x] Add audit contracts file.
- [x] Add plugin feature inventory file.
- [x] Add rewrite checklist file.

### Seed and Release Readiness

- [x] Add deterministic seed script for sample users/cohort/milestones.
- [x] Android parity pixel pass delivered (2026-05-31). `SkillUp.tsx` aligned to design mockup; real API bindings only; `MockSkillUp.tsx` retired.
- [x] Observability KPI finalization for non-placeholder admin metrics.

### MVP Testing Note

- [x] Automated test suites deferred for MVP per Rule 118.

### Change Log

- 2026-03-24: Initial checklist created and baseline implementation items marked.
