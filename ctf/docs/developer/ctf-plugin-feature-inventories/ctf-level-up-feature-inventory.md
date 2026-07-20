# LevelUp Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Rewrite target only: `ctf/`
- Legacy reference excluded from implementation: `platform/`
- Plugin name: `LevelUp`
- Plugin slug: `level-up`

## Implemented User Features

1. Cohort listing with filters for `track`, `status`, and `startDate`.
2. Cohort detail view with curriculum, milestones, and enrollment affordance.
3. Enrollment flow with optional deposit policy and escrow split per milestone.
4. User dashboard with wallet balance, LevelUp escrow totals, active enrollments, and recent transactions.
5. Dispute open flow with comments and attachment metadata support.
6. Trainers directory (read-only browse): survivor-advocate trainer profiles with headline, bio, tracks, and active-cohort count.
7. Achievements (grant-only badges): badge definitions with the signed-in user's earned status. Badges are awarded, never bought or spent.
8. Credits Wallet (grant-only view): the signed-in user's ServiceCredits balance, total earned through LevelUp, escrow held, and a read-only history of credits earned/granted. Exposes no spend or transfer action.

## Implemented Trainer Features

1. Milestone validation endpoint for trainer/admin.
2. Milestone release endpoint that settles learner escrow and trainer payout split.
3. Trainer dashboard with cohorts, pending validations, trainees, and payout ledger summary.

## Implemented Admin Features

1. Admin credit grant endpoint (`mint`/`adjustment` path), wired to a real admin UI on both web and Android. Owner decision (2026-06-06): the admin UI is grant-only — it only ever grants ServiceCredits to a member ("earn or earn nothing") and exposes no remove/negative path; the amount input accepts positive values only and submit is disabled client-side for non-positive amounts. (The backend endpoint still technically accepts a signed amount so a mistaken grant can be corrected later, but the UI never sends a negative.) Every grant requires a member user ID, an amount greater than zero, a reason, and a governance ticket ID, and goes behind an explicit in-screen confirm step that restates exactly what will change ("add N credits to member X") before submit. The mutation carries the `x-ctf-csrf: '1'` header and is written to the audit log.
2. Dispute resolution endpoint with optional adjustment transfer.
3. Admin panel with operational KPIs (enrollments, completions, avg days to first trainer payout) plus a read-only cohort overview (title, track, status, seats open, required deposit, trainer split, completion bonus) from `GET /api/level-up/cohorts`.
4. Auto-cohort run control (issue #904): a "Run now" button that triggers the same auto-cohort creation the daily cron runs (reads the Workforce talent gaps and opens cohorts for the largest of them). The admin cohort overview shows `auto` and `needs trainer` badges on auto-created cohorts that have no human trainer yet.

## Auto-Cohort Creation from Workforce Gaps (issue #904)

LevelUp stands up training cohorts from the Workforce talent gaps without an admin hand-building each
one. The behaviour is deliberately lean for the current small active user base; the gap×talent-spread
algorithm that will later set cadence and caps is deferred (see the deferral issues in the Change Log).

**LevelUp ↔ Workforce read interface (the contract the issue asked for before build):**

- LevelUp reads the gap signal **server-side, in-process** via `fetchOccupationGapReport()` from
  `lib/workforce/repository` — it does not call Workforce over HTTP. The return is the per-occupation
  list `{ jobTitleId, occupation, sector, skillLevel, target, recruited, gap }`, sorted largest-gap-first.
- The read is **one-way**: LevelUp never writes Workforce, Directory, or Skills Taxonomy. The cohort's
  `source_job_title_id` is the gap's `jobTitleId` (a Skills Taxonomy job title id), so a cohort ties to
  the exact occupation with no fuzzy title match.
- **Cadence:** a daily GitHub Actions cron (`.github/workflows/level-up-auto-cohorts.yml`) calls
  `POST /api/internal/level-up/auto-cohorts/run` (CRON_SECRET bearer). An admin "Run now" button is the
  manual fallback.
- **Selection / caps (admin-editable in `level_up_auto_cohort_config`):** filter to the configured skill
  level (default `Foundational`), require `gap ≥ min_gap_threshold`, take the `top_n` largest, cap total
  concurrent auto cohorts at `max_concurrent` (default 3) and at `per_sector_cap` per sector (default 1).
- **Lifecycle:** fixed term — each cohort's end date is start + the per-occupation term override (or
  `default_term_days`). The run closes any auto cohort whose term has elapsed (status → `completed`).
- **Economics (one global policy, admin-editable):** every auto cohort is stamped with the deposit
  (`default_required_credits`, default 0 = free to join — sets `allow_no_deposit`), the trainer split
  (`default_trainer_split_percent`, default 25%), the completion bonus (`default_completion_bonus_credits`,
  default 0), and a standard 3-milestone skeleton (`LEVEL_UP_AUTO_COHORT_DEFAULT_MILESTONES`: 40/30/30).
  Milestones matter because the escrow split, the trainer payout, and the completion bonus only settle on
  milestone release — a cohort with no milestones has no progression or payout path. Per-occupation
  economic tuning is deferred (#1197).
- **Idempotency:** a deterministic command idempotency key plus the partial unique index mean a re-run
  never duplicates a cohort for an occupation; a concurrent duplicate is caught as the occupation being
  already covered.
- **Pre-flight guard:** if no sector carries a positive `skills_taxonomy_sectors.workforce_share`,
  Workforce demand falls back to an even split and the "largest gap" order is meaningless, so the run
  does nothing and records `skipped: no_workforce_share`.
- **Recruiting:** an auto cohort opens with the scheduler as a placeholder owner and `status='open'`
  (so it shows in the existing cohort browse and trainees can enroll). A trainer claims it via
  `POST /api/level-up/cohorts/[cohortId]/claim-trainer`, which makes them the trainer of record; until
  then the cohort carries a derived `needsTrainer` flag.

## API Surface and Route Map

- `GET /api/level-up/cohorts`
- `POST /api/level-up/cohorts` — create a cohort; admin or trainer role (per `cohort.create` contract). The cohort list response now also carries `autoCreated`, `sourceJobTitleId`, `sourceSector`, and a derived `needsTrainer` flag.
- `POST /api/level-up/cohorts/[cohortId]/claim-trainer` — a trainer or admin claims an auto-created cohort that has no human trainer yet, becoming its trainer of record (per `cohort.claim_trainer` contract).
- `POST /api/level-up/admin/auto-cohorts/run` — admin-only manual trigger for the auto-cohort run (the fallback for the daily cron); CSRF-guarded (per `cohort.auto_create` contract).
- `POST /api/internal/level-up/auto-cohorts/run` — cron-only auto-cohort run, guarded by `Authorization: Bearer ${CRON_SECRET}` (no user session). Reads the Workforce occupation gaps and stands up cohorts for the largest of them, then closes any auto cohort whose term has elapsed. Idempotent.
- `POST /api/level-up/enroll` — member or admin only; trainer-only accounts are blocked (per `enrollment.create` contract).
- `POST /api/level-up/milestones/[milestoneId]/validate`
- `POST /api/level-up/milestones/[milestoneId]/release`
- `POST /api/level-up/transfers` — self-transfer (recipient equals actor) is rejected with 400.
- `POST /api/level-up/disputes`
- `POST /api/level-up/disputes/[disputeId]/resolve` — admin, or the trainer assigned to the dispute's cohort (per `dispute.resolve` `trainerAssignmentOrAdmin`).
- `POST /api/level-up/admin/adjust-credits` — audit event records `targetContext` (`targetUserId`, `governanceTicketId`) per the `admin.adjust_credits` audit contract.
- `GET /api/level-up/trainers` — list trainer directory (read-only), optional `track` filter.
- `GET /api/level-up/achievements` — list grant-only badges with the signed-in user's earned status.
- `GET /api/level-up/wallet` — signed-in user's balance + grant-only earned/granted history (no spend path).

## Data Model and Storage Contracts

Primary migration: `ctf/migrations/2026-03-24-level-up-core-phase3.sql`

Core tables:

1. `level_up_cohorts`
2. `level_up_curriculum_items`
3. `level_up_milestones`
4. `level_up_enrollments`
5. `level_up_enrollment_milestone_escrows`
6. `level_up_milestone_validations`
7. `level_up_disbursements`
8. `level_up_stipend_schedules`
9. `level_up_disputes`
10. `level_up_dispute_comments`
11. `level_up_rate_limit_counters`
12. `level_up_command_idempotency`
13. `level_up_audit_events`
14. `level_up_policy_config`
15. `level_up_trainers` — trainer directory profile. Columns: `id` (PK), `user_id` (unique), `display_name`, `headline`, `bio`, `tracks` (jsonb array), `status`, `created_at`, `updated_at`. Read-only browse surface.
16. `level_up_achievements` — grant-only badge definitions. Columns: `id` (PK), `slug` (unique), `name`, `description`, `track`, `icon`, `credit_reward` (display-only grant amount), `sequence_no`, `status`, `created_at`, `updated_at`.
17. `level_up_user_achievements` — per-user earned badge rows (grant-only: a row means earned). Columns: `id` (PK), `user_id`, `achievement_id`, `earned_at`, `granted_credits`, `source_reference`, `created_at`; unique on `(user_id, achievement_id)`.
18. `level_up_auto_cohort_config` — singleton config for auto-cohort creation (issue #904). Columns: `singleton_key` (PK bool), `enabled`, `min_gap_threshold`, `max_concurrent` (default 3), `per_sector_cap` (default 1), `skill_level_filter` (default `Foundational`), `top_n` (default 10), `default_term_days` (default 90), `default_seats` (default 12), `default_required_credits` (default 0 = free to join), `default_trainer_split_percent` (default 25), `default_completion_bonus_credits` (default 0), `updated_by_user_id`, `updated_at`. Admin-editable. The economic columns are one global policy applied to every auto cohort; per-occupation tuning is deferred (#1197).
19. `level_up_auto_cohort_term_overrides` — per-occupation fixed-term overrides (issue #904). Columns: `job_title_id` (PK), `occupation`, `term_days`, `updated_by_user_id`, `updated_at`. Falls back to `default_term_days` when an occupation has no override.

Auto-cohort columns on `level_up_cohorts` (issue #904): `auto_created` (bool), `source_job_title_id` (UUID, references `skills_taxonomy_job_titles.id` by convention — no hard FK, mirroring `directory_profiles.job_title_id`), `source_sector` (text), `source_gap_at_creation` (numeric). A partial unique index `uq_level_up_auto_cohort_active_source` on `source_job_title_id WHERE auto_created = TRUE AND status IN ('open','active')` enforces at most one open/active auto cohort per occupation (the database-level idempotency guard).

Multi-currency (issue #120): `level_up_cohorts` carries `stipend_currency` and `microgrant_currency`
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
3. Input validation via `zod` on all LevelUp routes.
4. Command idempotency persistence for mutation replay safety.
5. Audit events for all implemented LevelUp commands.
6. Enrollment and milestone validate rate-limit counters persisted in DB.

## Seed Coverage Status

Deterministic seed script added:

- `ctf/scripts/seedLevelUp.mjs`

Seed content:

1. 5 users by deterministic IDs (1 admin, 1 trainer, 3 trainees).
2. Trainees set to 500 ServiceCredits each.
3. Open cohort with required credits 300, milestones (30/70), and baseline payout/refund policy JSON.
4. 1 trainer directory profile (`level_up_trainers`) for the seed trainer, with headline, bio, and tracks (`Tech`, `Finance`).
5. 3 achievement definitions (`level_up_achievements`): First Milestone, Cohort Graduate, Peer Mentor — deterministic UUIDs.
6. 1 earned badge row (`level_up_user_achievements`): trainee 1 has earned First Milestone.

## Web and Android Delivery Status

Parity status: **web+android complete** (pixel pass delivered). Web pixel pass complete: the web shell
(`components/level-up/level-up-shell.tsx` + `lu-*` sub-components) is aligned to the design mockup and
decomposed within rule-116 limits. Android pixel pass complete (2026-05-31): `LevelUp.tsx` rewritten to
the design mockup (`MobileLevelUp.tsx` / `MobileLevelUpEmpty.tsx` / `MobileLevelUpLoading.tsx` /
`MobileLevelUpPublic.tsx`), covering loading / empty / main states. Real-data-only: binds
`GET /api/level-up/cohorts` and `GET /api/service-credits/wallet`; `MockLevelUp.tsx` retired.
Unbacked mockup elements omitted: `trainerName`, `tags`, `milestoneCount` (not returned by cohorts
list endpoint); active-enrollment banner (no user-enrollment GET endpoint yet).

Trainers / Achievements / Credits Wallet (2026-06-07): the three former "coming soon" sidebar sections
are now real, backed surfaces on web and Android. Web: `lu-trainers.tsx`, `lu-achievements.tsx`,
`lu-wallet.tsx` rendered from the shell (`level-up-shell.tsx`), each lazy-loaded on first tab open and
each with its own empty state; the desktop sidebar and the phone-width tab bar both reach all three.
Android: `LevelUpTrainers.tsx`, `LevelUpAchievements.tsx`, `LevelUpWallet.tsx` reached via a new tab bar
in `LevelUp.tsx`. Real-data-only: bind `GET /api/level-up/trainers`, `GET /api/level-up/achievements`,
`GET /api/level-up/wallet`. Grant-only: the Wallet shows balance + earned/granted history with no spend or
transfer action; Achievements are grant-only badges.

Design refresh (2026-06-08, design submodule `b3742f7`): the three screens were brought up to the new
`LevelUpTrainers` / `LevelUpAchievements` / `LevelUpCreditsWallet` mockups (and their `Mobile*` variants).
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

Admin surface (2026-06-06): the `/admin/level-up` web page is now a real, mobile-responsive admin UI
(`components/level-up/lu-admin-shell.tsx` + `lu-admin-shared.ts`, `useIsMobile()` responsive, admin-gated
via `evaluatePluginAccess` at the route) showing KPI cards, the cohort overview, and the ServiceCredits
adjustment action with an explicit confirm step. The Android admin screen
(`ctf/packages/mobile/src/features/level-up/AdminLevelUp.tsx` + `admin-api.ts`, registered in `App.tsx` as
`level-up-admin`) mirrors the same cohort overview and adjustment action. The mockup
`MobileLevelUpAdmin.tsx` shows a track/badge editor; no track or badge admin endpoints exist, so that
layout is not implemented — the admin screens bind only the cohort list and the adjust-credits endpoint
that exist today.

## Gaps and Known Technical Debt

1. Dispute attachment storage uses URL metadata only (no secure file storage backend). This is a known limitation; full storage integration is a future optimization.
2. No admin KPI read endpoint exists; the web admin page renders KPIs from server-side `getAdminPanelData()` and the Android admin screen has no KPI cards (no GET route to call). Add a `GET /api/level-up/admin/kpis` route to give the mobile screen the same KPI cards as web.
3. No admin-gated GET route exists for the LevelUp admin screens, so the mobile admin screen cannot pre-gate by role before render; it relies on the server-side admin gate on `POST /adjust-credits` to deny non-admins. The cohort list (`GET /api/level-up/cohorts`) is read-access for any approved user. A dedicated admin-gated read route would let the mobile screen show the admin-only notice without attempting a mutation.
4. The design mockup `MobileLevelUpAdmin.tsx` (track/badge management) has no backing endpoints; tracks are a free-text field on cohorts and there is no badge model. Building that surface would require new schema, routes, and contracts.
5. ~~Auto cohorts' trainer payout did not fire because enrollments had no `assigned_trainer_id`.~~ **Resolved (2026-06-29):** enrolling in a claimed auto cohort now sets `assigned_trainer_id` to the claiming trainer (the cohort's `created_by_user_id` once it is no longer the scheduler placeholder), and `claim-trainer` backfills that trainer onto any enrollments made before the claim. So a milestone release now settles the trainer split for auto cohorts. (Admin/human-built cohorts are unchanged — they only get an assigned trainer when one is passed in, since their `created_by_user_id` may be an admin, not the trainer.)

## Change Log

- 2026-07-19: **Corrected the "who earns" copy on the signed-out LevelUp screen (and the Android
  empty state).** The public marketing copy read "Complete milestones to earn ServiceCredits" /
  "Earn credits while learning", which implied a learner is paid new credits for each milestone. The
  code (`releaseMilestoneCredits` in `lib/level-up/repository.ts`) does not work that way: passing a
  validated milestone **releases the learner's own escrowed deposit back to them** (not new credits),
  the **trainer** earns the newly minted split (`levelup_trainer_split`) for validating the work, and a
  learner earns *new* credits only through grant-only **badges** and a **completion bonus** at
  graduation. Rewrote the desktop and mobile-responsive subheads and the highlight bullet in
  `components/level-up/level-up-public-shell.tsx` to say this plainly (learners earn via badges and
  completion bonuses; trainers earn a credit split for validating milestones), and aligned the Android
  signed-in empty state (`packages/mobile/src/features/level-up/LevelUp.tsx`). Copy-only; no schema,
  route, or contract change.
- 2026-07-17: **History-aware back + admin↔member navigation (app-wide sweep).** The member
  shell's hand-rolled back chevron was replaced by the shared `BackChevronButton` — it returns to
  the previous in-app page and falls back to All Apps when there is no in-app history. The admin
  surface header gained the shared "Member view" pill (`PluginUserShellButton`) linking to
  `/apps/level-up`. UI-only; no schema, route, or contract change.
- 2026-07-14: Added refresh controls (app-wide refresh rollout). Web: the shared `RefreshButton` now sits in the member shell's section header on desktop and in the mobile-responsive sticky header (before the shared top actions); it re-runs the shell's `load` (cohorts + wallet) in a new background mode and resets the lazily loaded section flags so the trainers/achievements/wallet views re-fetch — all without flashing the full-screen loading state. Android: native pull-to-refresh via `RefreshControl` on the `LevelUp` browse `FlatList`, wired to a new background variant of `load` (the other tabs render their own components and are unchanged). UI-only; no schema, route, or contract change.
- 2026-06-29: Android parity for the auto-cohort admin controls (issue #1200, follow-up to #904). The mobile LevelUp admin screen (`packages/mobile/src/features/level-up/AdminLevelUp.tsx`) now mirrors the web `lu-admin-shell.tsx`: an "Auto cohorts from Workforce gaps" card with a "Run now" button that POSTs `POST /api/level-up/admin/auto-cohorts/run` (via `runAutoCohorts()` in `admin-api.ts`, with the `x-ctf-csrf: '1'` header through the shared `authedFetch`) and shows the created/closed/skipped summary in the notice banner; and `auto` / `needs trainer` badges on each cohort row, driven by the `autoCreated` / `needsTrainer` fields now typed on the mobile `Cohort` (already returned by `GET /api/level-up/cohorts`). No backend, schema, or contract change — binds only existing endpoints and fields.
- 2026-06-29: Wired the trainer of record onto auto-cohort enrollments so trainer payouts actually settle (issue #904 follow-up). `enrollInCohort` now resolves the assigned trainer: an explicitly supplied trainer wins; otherwise, for an auto-created cohort whose `created_by_user_id` is no longer the scheduler placeholder (i.e. a trainer has claimed it), the enrollment's `assigned_trainer_id` defaults to that claiming trainer. `claimAutoCohortTrainer` also backfills `assigned_trainer_id` onto existing enrollments that were created while the cohort had no trainer (members can enroll in an open auto cohort before it is claimed). Milestone release pays `assigned_trainer_id`, so the trainer split now fires for auto cohorts. Admin/human-built cohorts are unchanged (no auto-assignment — their `created_by_user_id` may be an admin). `cohort.claim_trainer` contract `dataAccess` now includes `level_up_enrollments`. No schema change. Resolves the Gaps item from the previous entry.
- 2026-06-29: Gave auto-created cohorts an explicit, admin-editable economic policy plus a default milestone skeleton (issue #904, owner decision). Previously the auto path hardcoded deposit 0 / no milestones and let the trainer split fall through to the code default, so an auto cohort had no progression or payout scaffolding. Added `default_required_credits` (0 = free to join), `default_trainer_split_percent` (25), and `default_completion_bonus_credits` (0) to `level_up_auto_cohort_config`, and a `LEVEL_UP_AUTO_COHORT_DEFAULT_MILESTONES` 3-milestone skeleton (40/30/30) in constants. `runAutoCohortCreation` now stamps each cohort with these (deposit sets `allow_no_deposit` when 0) and the milestone skeleton. One global policy for now; per-occupation tuning deferred to #1197. Regenerated `schema.demo.sql`. Known follow-up: trainer payouts need the enroll path to set `assigned_trainer_id` for a claimed auto cohort (see Gaps).
- 2026-06-29: Auto-cohort creation from Workforce gaps (issue #904). LevelUp now stands up training cohorts from the Workforce occupation talent gaps without an admin hand-building each one. New module `lib/level-up/auto-cohort.ts` reads the gap signal server-side via `fetchOccupationGapReport()` (no HTTP, one-way read — Workforce/Directory/Skills Taxonomy are never written), filters to the configured skill level (default `Foundational`) and a minimum gap, takes the top N, and creates cohorts up to a concurrency cap (default 3) and a per-sector cap (default 1), anchoring each to the gap's `source_job_title_id`. Fixed-term lifecycle: each cohort's end date is start + a per-occupation term override (or `default_term_days`); the run closes cohorts whose term has elapsed. Idempotent via a deterministic command key + a partial unique index (`uq_level_up_auto_cohort_active_source`). Pre-flight guard skips the run when no sector carries a positive `workforce_share`. New schema: `auto_created` / `source_job_title_id` / `source_sector` / `source_gap_at_creation` columns on `level_up_cohorts`, plus `level_up_auto_cohort_config` (singleton knobs) and `level_up_auto_cohort_term_overrides` tables. New routes: `POST /api/internal/level-up/auto-cohorts/run` (CRON_SECRET), `POST /api/level-up/admin/auto-cohorts/run` (admin manual fallback), `POST /api/level-up/cohorts/[cohortId]/claim-trainer` (trainer claims an auto cohort). Cadence: daily cron `.github/workflows/level-up-auto-cohorts.yml`. Admin UI: a "Run now" button and `auto` / `needs trainer` badges on the LevelUp admin screen. New contracts `cohort.auto_create` and `cohort.claim_trainer` (command / access-policy / audit). The cohort list response gained `autoCreated` / `sourceJobTitleId` / `sourceSector` / `needsTrainer`. Deferred to follow-up issues (current user base is small): the gap×talent-spread cadence/cap algorithm (#1197); sector-mixed cohorts with a per-trainee skills picker (#1198); and the graduation skill-attach that writes learned skills to the Directory profile (#1199 — the loop-closing write, which needs its own contract + consent).
- 2026-06-27: Resolved code-review sweep findings for level-up. Access-policy alignment: `POST /api/level-up/cohorts` now allows admin or trainer (was admin-only) per `cohort.create`; `POST /api/level-up/disputes/[disputeId]/resolve` now allows the trainer assigned to the dispute's cohort in addition to admin (added `getDisputeCohortId` repository helper to map dispute → enrollment → cohort and reuse `isTrainerForCohort`) per `dispute.resolve` `trainerAssignmentOrAdmin`; `POST /api/level-up/enroll` now blocks trainer-only accounts (member or admin only) per `enrollment.create`. Money safety: `POST /api/level-up/transfers` rejects a self-transfer (recipient equals actor) with 400. Audit compliance: `admin.adjust_credits` audit event now writes a structured `targetContext` (`targetUserId`, `governanceTicketId`) inside metadata per the audit contract. Web shell bug fixes: `handleEnroll` now sends the `x-ctf-csrf: '1'` header (enrollment from the shell was failing CSRF); `handleValidate` now sends the required `enrollmentId`, `cohortId`, and `idempotencyKey` (the trainer Approve button posted an empty body that always failed validation) — `PendingValidation` extended to carry `enrollmentId` and `cohortId`. No schema table or column changes.
- 2026-06-26: Hyphenation/cleanup rename of the LevelUp plugin as a hard cutover with no backward-compatible aliases — `levelup` → `level-up` everywhere. `/api/levelup/*` no longer exists; the app shell (`/apps/level-up`), admin surface (`/admin/level-up`), web components, and the mobile API client all repoint to `/api/level-up/*`. Plugin slug in the registry/catalog/concierge/parity contract is now `level-up`; command names are `level-up.*`; constant family moved `LEVELUP_*` → `LEVEL_UP_*` (including the client-facing error-code string values `level_up_*`). Every database table renamed to the matching snake_case prefix: each `levelup_*` table becomes `level_up_*` (15 tables: enrollments, cohorts, curriculum_items, milestones, command_idempotency, audit_events, rate_limit_counters, enrollment_milestone_escrows, milestone_validations, disputes, dispute_comments, disbursements, trainers, achievements, user_achievements). `schema.sql` runs `ALTER TABLE ... RENAME TO` first so an existing database keeps its data; `schema.demo.sql` regenerated. Contract files renamed `LEVELUP_*` → `LEVEL_UP_*` (pluginId, dataAccess tables, scopes updated). Cross-plugin refs updated: Trust signal type `engagement-level-up-cohorts`, Trust `level_up_enrollments` read + `levelUpCohortsCompleted` metric; GDP recognition `pluginSlug: 'level-up'` and `level_up_*` table refs (the `levelUpTrainerPayoutSource` identifier kept). Deliberately UNCHANGED (stored ServiceCredits ledger/governance values matched against existing production rows; renaming them would orphan data and break the GDP recognizer): the mint-grant `reason` values `levelup_trainer_split` / `levelup_completion_bonus`, the `releasePolicy`/`releaseReason` value `levelup_milestone_validated`, the `refundReason` `levelup_enrollment_setup_failed`, the `reasonCode` `levelup_transfer`, and the `governanceTicketId` prefix `levelup:`. No `levelup → level-up` slug alias was added (hard cutover). Web + mobile typecheck/lint clean.
- 2026-06-17: Restyled the `/admin/level-up` surface (`lu-admin-shell`) to the shared dark admin design system (icon header with `ADMIN` badge, dark tokens, stat blocks, dark form inputs) per rule 131. Visual only — the grant-only confirmation flow, amount validation, governance ticket, idempotency key, and endpoints are unchanged. The mockup's track/badge management has no backing endpoints (see Gaps), so the real KPIs, cohort list, and credit-grant form are kept rather than the mockup's tabs/counts. Web typecheck + eslint clean.
- 2026-06-12: Android API clients (`api.ts`, `admin-api.ts`) now call the backend through the shared authenticated fetch wrapper (`authedFetch`): the signed-in member's Clerk bearer token is attached and the base URL comes from runtime config, replacing the plain dev-only fetch against hardcoded localhost URLs. The admin functions no longer take a token argument (the wrapper supplies the live token); `AdminLevelUp.tsx` call sites updated. No backend, schema, or contract change.
- 2026-06-08: Design refresh of the Trainers, Achievements, and Credits Wallet screens to the new design mockups (design submodule advanced to `b3742f7`). Web: rewrote `lu-trainers.tsx` (stats row + avatar cards), `lu-achievements.tsx` (Earned / Locked buckets, stats row, `icon`-name-to-glyph mapping), and `lu-wallet.tsx` (balance overview cards + All / Earned / Escrow filter tabs over a transaction table). Android: rewrote `LevelUpTrainers.tsx`, `LevelUpAchievements.tsx`, `LevelUpWallet.tsx` to match the `Mobile*` mockups. Switched the shell's mobile root from `100vh` to `100dvh`. No backend, schema, route, or contract change — all three screens stay bound to the existing `GET /api/level-up/trainers`, `GET /api/level-up/achievements`, and `GET /api/level-up/wallet`. Real-data-only: the mockups' rating / handle / cohort-status / learners / SC-released fields, achievement emoji / rarity / in-progress progress bars, and wallet total-spent / running-balance / per-cohort escrow / earn-more list were not invented — only real fields are rendered, with honest empty states for sections that have no data.
- 2026-06-07: Built the three former "coming soon" sections — Trainers, Achievements, Credits Wallet — into real surfaces on web and Android. Added three tables adjacent to the existing LevelUp tables in `schema.sql`: `level_up_trainers` (trainer directory profiles), `level_up_achievements` (grant-only badge definitions), and `level_up_user_achievements` (per-user earned badge rows, unique on user+achievement). Added three read-only API routes: `GET /api/level-up/trainers`, `GET /api/level-up/achievements`, `GET /api/level-up/wallet` — plus matching `trainer.list` / `achievement.list` / `wallet.view` command and access-policy contract entries. Web: `lu-trainers.tsx`, `lu-achievements.tsx`, `lu-wallet.tsx` wired into `level-up-shell.tsx` (lazy-loaded per tab; reachable from the desktop sidebar and the phone-width tab bar). Android: `LevelUpTrainers.tsx`, `LevelUpAchievements.tsx`, `LevelUpWallet.tsx` reached via a new tab bar in `LevelUp.tsx`. Extended `scripts/seedLevelUp.mjs` with 1 trainer profile, 3 achievement definitions, and 1 earned badge. Owner rule applied throughout: LevelUp is grant-only ("earn or earn nothing") — the Wallet reads balance + earned/granted history only and exposes no spend or transfer action; Achievements are grant-only badges. Regenerated `schema.demo.sql`.
- 2026-06-06: Owner decision — LevelUp admin UI is grant-only. An admin can never remove a member's ServiceCredits from the UI ("earn or earn nothing"). The web shell (`lu-admin-shell.tsx`) and the Android screen (`AdminLevelUp.tsx`) now accept positive amounts only: the amount input is labelled "Amount to grant (greater than zero)", the action is labelled "Grant"/"Review grant", the confirm copy reads "add N credits to member X" (no "remove"), and submit is disabled client-side for non-positive amounts. The backend `POST /api/level-up/admin/adjust-credits` endpoint is unchanged (it still technically accepts a signed amount so a mistaken grant can be corrected later); only the UI no longer exposes a negative path. Member id, reason, governance ticket id, idempotency key, and the two-step confirm are all kept. Copy-only/validation-only UI change; no schema/route/contract changes.
- 2026-06-06: Admin UI — turned the `/admin/level-up` web page from a KPI-only stub into a real, mobile-responsive admin UI (`components/level-up/lu-admin-shell.tsx` + `lu-admin-shared.ts`): KPI cards (server-fetched), a read-only cohort overview from `GET /api/level-up/cohorts`, and a ServiceCredits adjustment form wired to `POST /api/level-up/admin/adjust-credits` (CSRF header, idempotency key) behind an explicit confirm step that restates the member, direction (add/remove), and amount before submit. Added an Android admin screen (`ctf/packages/mobile/src/features/level-up/AdminLevelUp.tsx` + `admin-api.ts`, registered in `App.tsx` as `level-up-admin`) mirroring the cohort overview and the same confirm-gated adjustment action. No new amounts are fabricated and no ServiceCredits→fiat equivalence is rendered. The mockup's track/badge editor was not built (no backing endpoints). No schema/route/contract changes. Documented endpoint gaps (no admin KPI GET, no admin-gated read route) in Gaps.
- 2026-06-01: Multi-currency (issue #120): added `stipend_currency` and `microgrant_currency` (FK → `currencies.code`, default ServiceCredits) to `level_up_cohorts`. Documented the no-fiat-parity rule. Schema + inventory only; the currency UI is design-gated.
- 2026-05-31: Android pixel pass — rewrote `ctf/packages/mobile/src/features/level-up/LevelUp.tsx` to the design mockup (loading/empty/main states). Created real `api.ts` bound to `GET /api/level-up/cohorts` and `GET /api/service-credits/wallet`. Retired `MockLevelUp.tsx`. Omitted unbacked fields: trainerName, tags, milestoneCount (not in cohorts list endpoint), active-enrollment banner (no user enrollment GET route). EOF, parity, and tsc gates all green.
- 2026-05-30: Web pixel pass — rebuilt the web shell to the design mockup and decomposed the 520-line `level-up-shell.tsx` monolith into modular sub-components (`lu-shared.ts`, `lu-loading.tsx`, `lu-sidebar.tsx`, `lu-cohort-card.tsx`, `lu-browse.tsx`, `lu-progress.tsx`, `lu-right-panel.tsx`, thin shell) within rule-116 limits. Removed 6 dead unreferenced components (AdminPanel, CohortDetail, CohortList, EnrollModal, TrainerDashboard, UserDashboard). Shell binds real routes (cohorts, service-credits wallet, enroll, milestone validate); unbacked mockup figures omitted. No schema/route/contract changes.
- 2026-05-17: Updated inventory to enforce Rule 105 parity baseline and Rule 120 living-snapshot model. Removed Android parity deferral language; confirmed web+android complete delivery status. Clarified technical debt (attachment storage) as genuine limitation, not unimplemented feature.
- 2026-03-24: Initial LevelUp phase-3 implementation inventory created (schema, repository, API routes, shell components, seed script, contracts).


## Build Checklist


### Scope and Boundary

- [x] Confirm implementation scope is `ctf/` only.
- [x] Confirm plugin slug and route namespace (`level-up`).
- [x] Confirm no Prisma usage; SQL migration + repository pattern only.

### Schema and Registry

- [x] Add core migration for LevelUp domain tables.
- [x] Add plugin registry availability entry for `level-up`.
- [x] Add baseline policy config (`starter_credits`, split defaults).

### Repository and Business Rules

- [x] Implement cohort creation/list/detail repository methods.
- [x] Implement enrollment and escrow allocation logic with idempotency.
- [x] Implement milestone validation and release settlement.
- [x] Implement dispute open/resolve and admin adjust credit flows.
- [x] Implement persisted DB rate-limit counters for enroll/validate.

### API Surface

- [x] Implement route helpers for authz, CSRF, and error mapping.
- [x] Add zod validation to LevelUp mutation/query handlers.
- [x] Add routes for cohorts, enrollments, milestones, transfers, disputes, admin adjustment.

### Web UI Shell

- [x] Add `LevelUpShell` under plugin app route.
- [x] Add `CohortList`, `CohortDetail`, `EnrollModal` components.
- [x] Add `UserDashboard`, `TrainerDashboard`, `AdminPanel` components.
- [x] Add `/admin/level-up` page.

### Contracts and Inventory

- [x] Add command contracts file.
- [x] Add access policy contracts file.
- [x] Add audit contracts file.
- [x] Add plugin feature inventory file.
- [x] Add rewrite checklist file.

### Seed and Release Readiness

- [x] Add deterministic seed script for sample users/cohort/milestones.
- [x] Android parity pixel pass delivered (2026-05-31). `LevelUp.tsx` aligned to design mockup; real API bindings only; `MockLevelUp.tsx` retired.
- [x] Observability KPI finalization for non-placeholder admin metrics.

### MVP Testing Note

- [x] Automated test suites deferred for MVP per Rule 118.

### Change Log

- 2026-03-24: Initial checklist created and baseline implementation items marked.
