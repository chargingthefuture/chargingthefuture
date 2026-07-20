# PeerProgramming Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Plugin name: `PeerProgramming`
- Plugin slug / service key: `peer-programming`
- Owned surfaces: `/apps/peer-programming` (web), `packages/mobile/src/features/peer-programming` (Android), `/api/peer-programming/*` routes, `peer_programming_*` tables.
- Not owned: identity (Clerk), chat infrastructure (Chyme/Hub), notifications transport (shared notifications plugin).

## Intent and Outcome

PeerProgramming is a persistent, async-first collaboration experience that builds survivor momentum through weekly cohort assignment, guided discussion prompts, and reliable in-app communication.

The plugin:

1. Runs weekly cohort assignment from active users (login within the last 7 days),
2. Assigns up to 12 users per cohort (participation is voluntary; about 5 are expected to actively show up in a given week),
3. Records in-app assignment notifications for every assignment cycle with idempotent delivery,
4. Opens fallback access when fewer than 2 cohort members are present,
5. Provides a cohort room optimized for async text with threaded replies,
6. Preserves messages and thread context continuously (24/7 persistence),
7. Enforces tiered participation across cohort member, authenticated audience, and unauthenticated audience,
8. Captures structured feedback for iteration,
9. Supports admin-defined weekly topic guidance.

### Single standing, always-open Cohort 1 mode (low-population, admin-flippable)

When there are not enough active members to fill weekly cohorts of twelve, the plugin runs in a
single standing, always-open Cohort 1 mode instead of splitting members into tiny one-person rooms.
The effective mode is resolved by the async resolver `isSingleOpenCohortModeEnabled()` (and
`resolveSingleOpenCohortMode()`, which also reports the source) in
`ctf/packages/web/lib/peer-programming/repository.ts`, with this precedence: (a) the persisted admin
setting `peer_programming_settings.single_open_cohort_enabled` if it is set (non-null) → use it;
(b) else the server flag `PEER_PROGRAMMING_SINGLE_OPEN_COHORT` (read by the env-only fallback
`isPeerProgrammingSingleOpenCohortEnabled()` in `constants.ts`); (c) else the built-in default (ON).
An admin flips the toggle from the PeerProgramming admin surface
(`POST /api/peer-programming/admin/single-open-cohort`) without a redeploy; clearing it (null) reverts
to the env flag, then the default. With no admin setting and no env override, the mode is ON.

- **When ON (default):** there is a single standing cohort — the one row with `is_standing = TRUE`,
  label `C1`, always open (`fallback_open = TRUE`). It is not week-scoped: it persists across weeks
  and is found by `is_standing = TRUE`, not by the current week. Opening PeerProgramming auto-joins the
  member to Cohort 1 so they can post, not just listen: the membership WRITE is `joinStandingCohort`,
  called by the gated routes (`GET /room`, `POST /session/join`) **after** their access gate authorizes
  the request — a find-or-create plus an `ON CONFLICT DO NOTHING` membership insert. `getMyCohort` is
  read-only and never writes, so a plain read can never place a member; it returns the standing cohort
  only once the caller is a member. `listActiveCohorts`/`getCohortById`/`listManagedCohorts` include the standing cohort
  regardless of week so the room's cohort list and `?cohortId=` listen-in resolve it. The weekly
  auto-split is paused: `runWeeklyAssignment` (cron and admin manual run) ensures the standing cohort
  exists and idempotently joins all the provided active members into it (same idempotent assignment
  notifications), creating no `C2`/`C3`. The find-or-create helper `ensureStandingCohort(actorId)` is
  idempotent and races safely against the partial-unique standing index.
- **When OFF (admin toggle set to off, or `PEER_PROGRAMMING_SINGLE_OPEN_COHORT=0` with no admin
  setting):** behavior is exactly the original weekly cohorting — members are sliced into week-scoped
  cohorts of twelve, `getMyCohort` resolves the current week's cohort, and `runWeeklyAssignment` forms
  `C1`/`C2`/`C3`. The resolved mode is the only thing that changes behavior, so flipping the admin
  toggle (or the env flag) restores weekly cohorting.

---

## User Features

### Weekly Cohort Assignment

1. Weekly active-user selection includes only accounts with login activity in the prior 7 days.
2. Cohorts are formed with a target size of 12 users per cohort (`PEER_PROGRAMMING_COHORT_TARGET_SIZE`); participation is voluntary, so about 5 are expected to actively take part in a given week.
3. Assignment status and cohort metadata are visible in the user room entry surface.

### In-App Assignment Notifications

1. In-app notifications are generated when users are assigned to a cohort.
2. Notification payload includes cohort identifier, topic window, and next action prompt.
3. Notification delivery is idempotent on `idempotency_key`.

### Cohort Room Experience

1. Room header shows weekly topic guidance and cohort participation summary.
2. Message stream is text-first and supports threaded replies per message.
3. Room timeline persists continuously and is recoverable across reconnects.
4. Fallback open mode activates when fewer than 2 cohort members are present/active.

### Tiered Participation Visibility

1. Cohort members can create posts and threaded replies.
2. Authenticated non-cohort users can view with audience-limited interaction capabilities.
3. Unauthenticated users are audience-only with constrained read surfaces.

### Feedback and Iteration Loop

1. Users can submit structured feedback from cohort room context.
2. Feedback captures release surface, issue type, and suggestion category.
3. Feedback records are retained for iteration analytics and audit.

## Admin Features

### Weekly Topic Guidance Governance

1. Admins define and publish weekly topic guidance.
2. Guidance supports week scoping, revision note, and publication status.
3. Previous guidance revisions remain available for audit and rollback context.

### Cohort Operations Oversight

1. Admins can run the weekly cohort assignment process on demand.
2. Admins can inspect fallback-open activations on cohorts.
3. Admin visibility includes delivery health for assignment notifications.

## API Surface and Route Map

### User Routes

- `GET /api/peer-programming/room` — Resolve the caller's current cohort, topic guidance, and tier. Also returns `cohorts` (every running cohort for the week, with live member counts) so a member can see which other cohorts are running, the open cohort's `members` roster (`[{ userId, username }]`, usernames resolved via Clerk — see below) so cohort-mates can see who they are, plus `myCohortId`, `access` (`member` | `admin` | `listener`), and `isMember`. Accepts an optional `?cohortId=` to open another running cohort read-only: any signed-in member can listen in on a cohort they were not placed in (read-only), an admin opening another cohort gets `admin` access, and only an actual member of the opened cohort gets `member` access (the only access level that may post). Posting remains gated by `isCohortMember` on the message routes, so a listener can read but never write.
- `POST /api/peer-programming/messages` — Create a new top-level message. The caller must be a member of the target cohort; non-members are denied and the tier is set server-side (never trusted from the request body).
- `POST /api/peer-programming/messages/[messageId]/replies` — Reply to a message thread. Same cohort-membership check as the post route.
- `POST /api/peer-programming/feedback` — Submit structured feedback for the iteration loop.
- `POST /api/peer-programming/session/join` — Mint live video session credentials (GetStream) for the caller's own cohort. The cohort is resolved server-side from the signed-in member, so only a cohort member gets a call token and the call is always scoped to that member's cohort. Returns 404 when the caller has no cohort and 503 when Stream is not configured.

### Admin Routes

- `GET /api/peer-programming/admin/topics` — Return the topic published for the current week (the room reads the current week only), or null.
- `PUT /api/peer-programming/admin/topics` — Upsert weekly topic guidance for a week key (requires `weekStartDate`, `title`, `guidance`; optional `revisionNote`, `publish`).
- `POST /api/peer-programming/admin/assignments/run` — Run the weekly cohort assignment process. With no override it selects the last-7-days active set; an optional `{ allowManualOverride, activeUserIds }` body runs against an explicit user-id list.
- `GET /api/peer-programming/admin/cohorts` — Admin-only: every cohort across recent weeks (last 84 days, most recent first, capped at 200) with live member counts, the fallback-open flag, and each cohort's `members` roster (`[{ userId, username }]`, usernames resolved via Clerk — see below). Backs the admin "Cohorts" list so an admin can reach and manage any cohort they formed, even after the week rolls over (the member-scoped `/room` returns only the admin's own cohort, and the listen-in list stays current-week). Uses `listManagedCohorts`; the current-week `listActiveCohorts` still powers the member room/listen-in list.
- `GET /api/peer-programming/admin/single-open-cohort` — Admin-only: read the effective single standing, always-open Cohort 1 mode and where it resolves from. Returns `{ enabled, source, adminSetting, envFlagEnabled }` where `source` is `admin_setting` | `env_flag` | `default`. Resolution precedence: the persisted admin setting (`peer_programming_settings.single_open_cohort_enabled`) if set, then the env flag `PEER_PROGRAMMING_SINGLE_OPEN_COHORT`, then the built-in default (ON). Backs the admin "Single standing Cohort 1 mode" control.
- `POST /api/peer-programming/admin/single-open-cohort` — Admin-only, CSRF-guarded: set or clear the persisted toggle. Body `{ enabled }` where `true`/`false` is the admin's explicit choice (supersedes the env flag) and `null` clears the admin setting (revert to the env flag, then default). Upserts the one-row `peer_programming_settings` singleton and writes an admin audit row (`peer-programming.settings.single-open-cohort.set`). Returns the re-resolved `{ enabled, source, adminSetting, envFlagEnabled }`.

These admin routes are now surfaced by a real admin UI on both web and Android (see Web and Android Delivery Status). The web admin page (`/admin/peer-programming`) is admin-gated; it binds the topic and assignment routes, the `admin/cohorts` list, and the `admin/single-open-cohort` read/write toggle, and links each cohort to the room via `/apps/peer-programming?cohortId=<id>`.

### Internal Routes (scheduler-only)

- `POST /api/peer-programming/internal/assignments/run` — implemented at `app/api/internal/peer-programming/assignments/run/route.ts`. Runs the same weekly cohort assignment as the admin route against the last-7-days active set, but is not admin-gated: it is guarded by a shared-secret `Authorization: Bearer <CRON_SECRET>` header so only the scheduler can call it. Used by the `PeerProgramming — Weekly Cohort Assignment` GitHub Actions workflow (`.github/workflows/peer-programming-weekly-assignment.yml`), which runs early every Monday (UTC) and on manual dispatch. The run is idempotent per week (cohorts upserted per week+label, notifications idempotent per user+week), so a repeat call cannot double-form or double-notify. Audited as `peer-programming.cohort.weekly.select` with `actorId = peer-programming-scheduler` and `source = weekly_scheduler`. The manual admin run stays as a fallback/override.

## Data Model and Storage Contracts

### Canonical Identity and Extension Strategy

1. Canonical user profile identity is reused; no duplicate profile table.
2. Plugin extension state is linked by `user_id` (Clerk subject) and cohort id.
3. Participation tier resolution derives from auth state + cohort membership.

### Shared Data Dependency: active-member signal (`login_events`)

Weekly cohort assignment selects "active members" from the shared `login_events` table
(`lib/engagement/login-activity.ts`), which is the single dedicated sign-in table also
read by the Weekly Performance review — this plugin does not own it and must not create a
duplicate. The table is now populated by `recordLoginEvent`, called from the shared access
gate (`evaluatePluginAccess`) for every signed-in member, deduplicated to one row per
member per UTC day. Before this writer existed the table was always empty, so the default
assignment run found zero active members and could never form a cohort; an admin can still
form a cohort immediately with the manual user-id override.

### Tables Owned by This Plugin

1. `peer_programming_weekly_topics` — Weekly topic guidance (id, week_start_date, title, guidance, revision_note, status, created_by_user_id, published_by_user_id, published_at).
2. `peer_programming_cohorts` — Weekly cohorts (id, week_start_date, cohort_label, fallback_open, topic_id, assigned_by_user_id, is_standing). `is_standing` (BOOLEAN NOT NULL DEFAULT FALSE) marks the single standing, always-open Cohort 1 used in low-population mode (see "Single standing, always-open Cohort 1 mode" below); a partial-unique index `uq_peer_programming_cohorts_standing ON (is_standing) WHERE is_standing` guarantees at most one standing row. The standing row persists across weeks and is found by `is_standing = TRUE`, not by the current week. Ordinary weekly cohorts keep `is_standing = FALSE`.
3. `peer_programming_cohort_members` — Cohort membership (id, cohort_id, user_id). Index `idx_peer_programming_cohort_members_cohort_created ON (cohort_id, created_at)` keeps the per-cohort, join-time-ordered roster read (`listCohortMemberUserIds`) cheap as the single standing cohort accumulates every active member.
4. `peer_programming_messages` — Cohort messages with threaded replies (id, cohort_id, author_user_id, parent_message_id, body, tier). Index `idx_peer_programming_messages_cohort_created ON (cohort_id, created_at)` backs the room read (`listMessages`: `WHERE cohort_id = $1 ORDER BY created_at ASC LIMIT 300`); without it that read is a sequential scan + sort over the whole table, which under single standing Cohort 1 mode (all members' messages in one ever-growing cohort) eventually exceeds the DB statement timeout and fails the room load.
5. `peer_programming_feedback` — Structured feedback (id, cohort_id, user_id, issue_type, suggestion_category, release_surface, note).
6. `peer_programming_assignment_notifications` — Notification ledger (id, cohort_id, user_id, idempotency_key, payload, delivered_at).
7. `peer_programming_admin_audit_trail` — immutable admin-action audit trail (id, actor_id, command, policy_status, reason, target_type, target_id, metadata jsonb, created_at). One row per privileged peer-programming command, capturing the `allow`/`deny` outcome; written by the repository audit helper. **Retained** on account deletion for compliance (`retain` in `lib/account/deletion-registry.ts`), not removed with the member's own rows.
8. `peer_programming_settings` — one-row settings singleton for admin-flippable plugin toggles (singleton_id BOOLEAN PRIMARY KEY DEFAULT TRUE with `CHECK (singleton_id)` so only one row can exist, single_open_cohort_enabled BOOLEAN nullable, updated_by_user_id TEXT, updated_at TIMESTAMPTZ). `single_open_cohort_enabled` is the admin's stored choice for single standing, always-open Cohort 1 mode: `TRUE`/`FALSE` is an explicit choice that supersedes the env flag `PEER_PROGRAMMING_SINGLE_OPEN_COHORT`, and `NULL` (the default / unset) means fall back to the env flag, then the built-in default (ON). Read by `getPeerProgrammingSettings`/`resolveSingleOpenCohortMode`/`isSingleOpenCohortModeEnabled` and written by `setPeerProgrammingSingleOpenCohort` in `lib/peer-programming/repository.ts`. Not member-owned data; not seeded (absent row = unset = default ON). The async resolver `isSingleOpenCohortModeEnabled()` is what `getMyCohort`, `listActiveCohorts`, and `runWeeklyAssignment` now await to decide the mode.

### Storage and Persistence Constraints

1. Messages and replies are append-only and persist continuously.
2. Weekly cohort and membership rows are immutable after assignment completes.
3. Fallback-open transitions are recorded by toggling `fallback_open` on the cohort row.
4. Feedback records are retained for iteration analytics and audit.

## Security, Privacy, and Compliance Controls

1. Deny-by-default authorization on all commands via `requirePeerProgrammingReadAccess` / `requirePeerProgrammingAdminAccess`.
2. Tier enforcement for cohort member vs authenticated audience vs unauthenticated audience. **Writes are membership-gated server-side:** `POST /messages` and `POST /messages/[messageId]/replies` verify the caller is a member of the target cohort (`isCohortMember`) and set the message tier to `cohort_member` themselves; the client-supplied tier is ignored, so an authenticated non-member cannot post or self-label as a cohort member. `POST /session/join` resolves the cohort from the signed-in member, so live video is members-only and cohort-scoped.
3. CSRF confirmation header required on all mutations (`x-ctf-csrf: 1`) plus origin match.
4. Audit capture for allow/deny policy decisions and mutation results, including `not_cohort_member` denials on write and `no_cohort` / `stream_not_configured` denials on session join.
5. Data minimization for room rendering and feedback metadata.

## Web and Android Delivery Status

`web+android complete` (pixel-pass delivered). The web surface lives under `/apps/peer-programming` and the Android surface lives under `packages/mobile/src/features/peer-programming`.

**Send a cohort message on Android (2026-07-17, issue #1597):** the Android Session tab now has a message composer for cohort members, matching web. `pp-session-tab.tsx` renders a bottom-pinned text input + send button (hidden when the viewer is only listening in / read-only) that calls the existing `postMessage(cohortId, body)` in `api.ts` (`POST /api/peer-programming/messages` with `Content-Type: application/json` and `x-ctf-csrf: '1'`; the author is derived server-side from the Clerk bearer, never sent in the body). It enforces the same constraints as the web composer — non-empty and at most `PEER_PROGRAMMING_MAX_MESSAGE_LENGTH` (2000) characters — clears on success, disables while sending, shows a readable inline error on failure, and asks the parent (`PeerProgramming.tsx`) to re-pull the room (`load(true)`) so the new message appears. Previously the mobile Session tab rendered messages read-only with no way to post.

**Live video (web 2026-06-16, Android 2026-06-23):** the Session tab's video call is wired on web (including mobile-responsive web, which is how phones/iOS are served) via `POST /api/peer-programming/session/join` + `pp-session-call.tsx` (GetStream, per-cohort call), and now on Android (React Native) too. The Android Session tab (`packages/mobile/src/features/peer-programming/pp-session-tab.tsx`) has a "Join Session" button that calls the same join route through `joinSession()` in `api.ts` and renders the live call in `PeerProgrammingSessionCall.tsx` (reuses the Chyme `ChymeAudioRoom` lifecycle pattern and the `@stream-io/video-react-native-sdk` SDK: join, render one tile per participant, mute/camera controls, leave + teardown on unmount). Android live-video parity (issue #555) is complete.

**Admin surface (2026-06-06):** the admin page at `/admin/peer-programming` is now a real, mobile-responsive admin UI — it replaced the former plain-text stub. The web admin shell (`components/peer-programming/pp-admin-shell.tsx` + `pp-admin-topic-form.tsx` + `pp-admin-assignments.tsx` + `pp-admin-shared.ts`) is consistent with the other `/admin/{plugin}` screens (generic admin aesthetic; matches the what-works / skills-hunt admin layout, filter/action conventions, and CSRF mutation helper). It uses `hooks/use-is-mobile.ts` so it is usable on a phone. Two actions are wired, both backed by existing endpoints: (1) set/publish the weekly topic via `PUT /api/peer-programming/admin/topics` (with the current published topic loaded via `GET`), and (2) run the weekly cohort assignment via `POST /api/peer-programming/admin/assignments/run` (with an optional manual user-id override). The Android admin screen lives at `packages/mobile/src/features/peer-programming/AdminPeerProgramming.tsx` (+ `admin-api.ts`), is registered in `App.tsx`, binds the same three endpoints, and is admin-gated server-side (a non-admin sees an access notice). No new admin actions or commands were invented — only the existing endpoints are surfaced.

Contract note: the command contract file (`docs/contracts/PEER_PROGRAMMING_PLUGIN_COMMAND_CONTRACTS.yaml`) defines `admin.topic-guidance.set` / `admin.topic-guidance.get` (topics) and `cohort.weekly.select` (assignment run); the admin UI surfaces exactly these and adds no new commands. The audit command strings the routes emit (`peer-programming.topic.upsert`, `peer-programming.cohort.weekly.select`) differ in spelling from the contract command names — a pre-existing naming nuance, not introduced by this UI work, and worth reconciling in a later contract/audit pass. Web pixel pass complete: the shell (`peer-programming-shell.tsx` + `pp-*` sub-components) is aligned to `design/.../survivor-hub/PeerProgramming.tsx` (lucide icons, encrypted-session copy) within rule-116 limits; binds real `/api/peer-programming/room` + `/messages` + `/feedback`. Android pixel pass complete (2026-05-31): `PeerProgramming.tsx` rewritten to match `design/.../survivor-hub/MobilePeerProgramming.tsx` with real-data-only binding via `GET /api/peer-programming/room`; mock data retired (`MockPeerProgramming.tsx` is no longer imported); decomposed into `pp-loading.tsx`, `pp-public.tsx`, `pp-empty.tsx`, `pp-cohort-tab.tsx`, `pp-session-tab.tsx` subcomponents within rule-116 limits. Fabricated cohort list / global stats omitted per real-data-only rule. `api.ts` updated to call real backend routes with Clerk auth token.

## Seed Coverage Status

Deterministic PeerProgramming seed script: `ctf/scripts/seedPeerProgramming.mjs` (topics, cohorts, members, messages, feedback, notifications).

## Gaps and Known Technical Debt

1. Heuristic for partially-filled cohorts when active-user count is not divisible by 5 is implemented as best-effort packing; product sign-off on edge cases is pending.
2. Fallback-open is now derived from the live cohort roster: the room reports a cohort as open when it has fewer than 2 members, not only from the flag snapshotted at assignment time. A richer per-session presence signal (who is actually in the room right now) is still a possible future refinement but is no longer required for the basic "too small to be a group" rule.
3. Weekly cohort assignment now runs automatically once a week via the scheduler (the `PeerProgramming — Weekly Cohort Assignment` GitHub Actions workflow calling the secret-guarded `POST /api/peer-programming/internal/assignments/run` route), with the admin manual run kept as a fallback/override. Closes issue #554. The cron is OFF until `CRON_SECRET` and the existing `NEXT_PUBLIC_APP_URL` secret are set in the repository's Actions secrets and `CRON_SECRET` is matched in the app runtime — until then it skips with a visible warning rather than failing, and admins form cohorts from the admin screen.
4. Android (React Native) live video for the Session tab is delivered (2026-06-23, issue #555) — the Session tab joins the same per-cohort GetStream call as web. The Stream Video SDK needs native code, so it works in an EAS dev/production build, not Expo Go (the same constraint as Chyme and Lighthouse video). No automated test harness exists for live Stream calls on device — verification is manual.

## Change Log

- 2026-07-18: **Cohort target size raised from 5 to 12 to match the shipped copy.** The UI/marketing copy has long said "12 per cohort" (`peer-programming-shell.tsx` header, `peer-programming-public-shell.tsx`, `pp-sidebar.tsx`), but the code formed cohorts of 5 (`PEER_PROGRAMMING_COHORT_TARGET_SIZE = 5`), so the engine and the copy disagreed. Owner decision: 12 is the intended number — place up to 12 per weekly cohort because participation is voluntary and asynchronous, with roughly 5 expected to actively show up in a given week. Changed `PEER_PROGRAMMING_COHORT_TARGET_SIZE` to 12 (the only place the split size lives; `runWeeklyAssignment` slices by it). This only affects the weekly auto-split, which is currently paused while single standing Cohort 1 mode is on, so there is no live behavior change today. Updated the inventory and manual test script to say 12 (≈5 participating). No schema, route, or contract change.
- 2026-07-17: **History-aware back + admin↔member navigation (app-wide sweep).** The member
  shell's hand-rolled back chevron was replaced by the shared `BackChevronButton` — it returns to
  the previous in-app page and falls back to All Apps when there is no in-app history. The admin
  surface header gained the shared "Member view" pill (`PluginUserShellButton`) linking to
  `/apps/peer-programming`. UI-only; no schema, route, or contract change.
- 2026-07-18: **Code-review fixes: read path no longer writes membership; tier enum matches the contract.** (1) **Security (finding #1641).** `getMyCohort` previously did a membership WRITE in single-open mode — a find-or-create of the standing cohort plus a membership insert — inside a read. Any caller that reached it without the full access gate (e.g. the legacy `src/app/api/peer-programming/cohorts/route.ts`, which only checks `isAuthenticated` and passed `userId ?? ''`) could place a member, or write a row with an empty user id. Extracted the write into `joinStandingCohort(userId)` (no-op unless single-open mode and a non-empty user id), now called by the gated routes `GET /api/peer-programming/room` and `POST /api/peer-programming/session/join` **after** their access gate. `getMyCohort` is now read-only and returns the standing cohort only once the caller is already a member, so a plain read can never place anyone. Behavior for authorized members is unchanged (they still auto-join on opening the room or the session). (2) **Contract alignment (finding #1646).** `PeerProgrammingTier` used `public_audience`, but the command contract's `viewerTier` enum is `unauthenticated_audience`. Renamed the type value in `lib/peer-programming/types.ts` and `packages/mobile/src/features/peer-programming/api.ts` to match; the value is type-only and never persisted (the `tier` column only ever stores `cohort_member`), so no data change. The access-policy contract's separate `tenancy: same_workspace_or_public_audience` field is unrelated and unchanged. (3) Code-review findings #1643 (server-side `disconnectUser` in `stream.ts`), #1644 (weekly-topics `ON CONFLICT` constraint), #1645 (audit never called), and #1647 (`Array.prototype.flat` target) were reviewed and closed as not-applicable — respectively: the `disconnectUser` in `finally` is the shared house pattern across all nine `lib/*/stream.ts` minters (a change would be codebase-wide, not peer-programming-only); the unique index `peer_programming_weekly_topics_week_start_date_key` exists so the upsert's conflict target is valid; every mutation route already calls `insertPeerProgrammingAudit`; and the web TS target is ES2020 on Node ≥18 where `flat` exists. No schema, route, or contract-field change.
- 2026-07-17: **Send a cohort message on Android (issue #1597).** The Android Session tab (`packages/mobile/src/features/peer-programming/pp-session-tab.tsx`) gained a message composer for cohort members, closing the gap where the mobile Session tab was read-only. A bottom-pinned text input + send button calls the already-present `postMessage(cohortId, body)` client (`POST /api/peer-programming/messages`, headers `Content-Type: application/json` + `x-ctf-csrf: '1'`; author derived server-side from the Clerk bearer). Parity with the web composer: non-empty, max 2000 chars (`PEER_PROGRAMMING_MAX_MESSAGE_LENGTH`, now exported from `api.ts`), clears on success, disables while sending, readable inline error on failure. On success the parent (`PeerProgramming.tsx`) re-pulls the room via `load(true)` so the new message appears. The composer is hidden for listen-in / read-only viewers. UI-only; no schema, route, or contract change (the route already existed).
- 2026-07-17: **Contract: `cohort.weekly.select` `dataAccess` now lists `unlock_verification_submissions` (code-review finding #1590).** The admin assignment route (`POST /api/peer-programming/admin/assignments/run`) filters the recent-login set through `listUnlockedUserIds` (`lib/unlock/repository.ts`), which reads `unlock_verification_submissions` — only `approved_full` members may be placed into cohorts. That read predates this entry (added with the unlocked-members filter) but was never declared in the command contract's `dataAccess` list, so the contract under-reported what the command touches. Documentation-only: the contract now matches the code; no route, schema, or behavior change.
- 2026-07-17: **Code-review batch: route validation, contract-shape, and request-race fixes (findings #1585–#1589).**
  (1) `GET`/`POST /api/peer-programming/admin/single-open-cohort` now return the four contract
  fields (`enabled`, `source`, `adminSetting`, `envFlagEnabled`) flat at the top level **plus** the
  nested `mode` object the web admin shell already reads — the response previously nested everything
  under `mode` while the contract documented a flat shape (#1585). (2) `POST /api/peer-programming/feedback`
  refuses a `releaseSurface` outside the contract enum (`web` | `android`) with 400 instead of
  persisting any arbitrary string; a missing value still defaults to `web` (#1586).
  (3) `POST /api/peer-programming/messages/[messageId]/replies` now enforces the contract's
  `parentThreadRequired` rule: after the membership check, the parent message must exist **and**
  belong to the target cohort, else 404 `peer_programming_thread_not_found` (audited as a deny) — a
  fabricated or cross-cohort parent id can no longer create an orphan reply, and unknown vs
  cross-cohort ids are indistinguishable to the caller (#1587). New repository helper
  `getMessageById`. (4) `PUT /api/peer-programming/admin/topics` validates `weekStartDate` as a real
  `YYYY-MM-DD` UTC **Monday** (400 `peer_programming_invalid_week_key` otherwise) — room loads look
  topics up by `getWeekStartDate()`, which always produces a Monday, so a topic saved under any other
  date was invisible to members (#1588). (5) The web shell's `reloadRoom`/`openCohort` now share one
  retained `AbortController` (each new request aborts the previous one; aborted calls skip state
  writes), so rapid cohort switches or a switch racing a refresh can no longer settle state out of
  order or update after unmount (#1589). No schema change; response shape is an additive change to
  `admin.single-open-cohort.get/set` (route now matches the documented contract).
- 2026-07-14: **Added refresh controls (app-wide refresh rollout).** Web: shared `RefreshButton` in the desktop and mobile-responsive shell headers (`peer-programming-shell.tsx`), wired to a new `reloadRoom` callback that re-pulls the currently open room (messages, cohorts, roster) without flashing the full-screen loading state. Android: native pull-to-refresh via `RefreshControl` on the cohort tab's `ScrollView` (`pp-cohort-tab.tsx`, threaded from `PeerProgramming.tsx`), wired to a new background variant of `load` that skips the full loading state. UI-only; no schema, route, or contract change.
- 2026-06-27: **Cohorts tab: removed the redundant own-cohort row and fixed the misleading count.** Follow-up to the "enter your own cohort" change below, from user feedback that the tab was confusing. (1) The viewer's own cohort is now shown once — the top "Join Session" card — and is filtered out of the running-cohorts list (`RunningCohorts` now lists only `cohort.id !== myCohortId`). So the same cohort no longer appears twice with a second, redundant button; in single standing Cohort 1 mode (your cohort is the only one) the list section disappears entirely. The list heading is now "Other running cohorts", and its rows are only "Viewing" (the one you are listening in on) or "Listen in." You reach your own cohort's conversation from the Direct Line tab. (2) The top card previously showed "N participants" from an always-empty `participants` array (it was always "0 participants", which read as "no one is in this cohort" next to a populated roster). It now shows the cohort's true member count ("N members", from the cohort summary), matching the roster below. Removed the unused `participantCount` prop from `PeerProgrammingCohortsTab` and its shell call site. Web only. No route, schema, or contract change.
- 2026-06-27: **Fixed: could not enter your own cohort from the running-cohorts list.** In the web cohorts tab (`pp-cohorts-tab.tsx` `CohortListRow`), the action button was disabled whenever a row was the active room (`disabled={busy || isOpen}`). Your own cohort is the active room by default, so its button rendered as a disabled "Open" — there was no way to enter it (a user reported "I can't enter into the one that should be the only one open" for the single standing Cohort 1). The button now reads **"Enter"** for your own cohort and is always enabled: clicking it loads your cohort and switches to the Direct Line (via the existing `onOpenCohort(null)` path). Another cohort you are already listening in on now reads **"Viewing"** (disabled); any other cohort still reads **"Listen in."** This also removes the confusing double use of the word "Open" (the yellow fallback-open badge stays; the button no longer also says "Open"). Web only — the Android running-cohorts list already labels the current cohort "Viewing" and enters via its own tabs. No route, schema, or contract change.
- 2026-06-27: **Code-review sweep follow-ups (#1074, #1075, #1077, #1079, #1080).** No route, schema, or contract change. (1) Removed the duplicate `_lib.ts`: the canonical copy at `app/api/peer-programming/_lib.ts` was dead code (no route imported it) while every route imported the divergent `lib/peer-programming/_lib.ts`, whose `peerProgrammingErrorResponse` only mapped `assignment_not_found` and fell through to 503 for everything else. The surviving `lib/` copy now maps all error codes (`invalid_payload` → 400, `policy_denied` → 403, `assignment_not_found`/`not_found` → 404, else `reportError` + 503), so member/admin routes return the right status instead of 503; the unused `app/api/` copy was deleted. (2) `POST /admin/single-open-cohort` now treats a missing `enabled` key the same as `null` (clear the setting), so an empty body `{}` no longer 400s — matches the contract's optional `enabled`. (3) Added server-side max-length checks (returning 400) on `POST /messages` and `POST /messages/[messageId]/replies` against `PEER_PROGRAMMING_MAX_MESSAGE_LENGTH` (2000), and on `POST /feedback` against `PEER_PROGRAMMING_MAX_FEEDBACK_LENGTH` (1000); these constants existed but were never enforced. (4) Web chat now shows the real author name: `mapMessages` resolves each message's author from the cohort roster (`@username`, or a short `Member <id>` fallback, matching the mobile helper) and sets `Message.author`, so the chat no longer labels every message "Anonymous". Sweep findings #1073, #1076, #1078 reviewed and closed as not-applicable (membership already verified by the `getMyCohort` join; the access gate already rejects empty `userId`; the mobile admin screen already shows a spinner until the admin check returns, with no client-side role available to gate on).
- 2026-06-26: **Web room UI fixes: de-zoomed the live video tiles and removed dead sidebar controls.** (1) **Live session video was zoomed in.** The app does not import the Stream video SDK stylesheet, so `ParticipantView`'s inner `<video>` had no size and rendered at the camera's native resolution; the tile's `overflow: hidden` then cropped it to a corner, which looked zoomed in. Added scoped CSS in `pp-session-call.tsx` (class `.pp-participant-tile`) that sizes the Stream wrapper and its `<video>` to fill the tile and center-crop (`object-fit: cover`), so each participant is framed like a normal video-call tile. Scoped to our tiles only; no app-wide style change. Android is unaffected — the React Native Stream SDK sizes video natively. (2) **Dead sidebar controls removed.** The left sidebar's cohort filter list (`All Cohorts`, `My Cohort`, `Forming`, `Active`, `By Skill`) and the "Search cohorts…" box were carried over from the design mockup but never wired (no click handlers) — a user reported "the tabs go nowhere." Removed them (owner-approved); the sidebar now shows only the "How It Works" info panel. Implementing them for real is tracked in issue #1306 (most need a data model that does not exist yet — cohort status, skill grouping — and have little value while single standing Cohort 1 mode is on). No schema, route, or contract change.
- 2026-06-26: **Fixed the room failing to load ("Failed to load room") under single standing Cohort 1 mode.** The user-facing room page blanked to that error because `GET /api/peer-programming/room` returned non-OK and the shell hard-fails the whole page when the room fetch is non-OK. Two scale problems, both introduced/amplified by single standing Cohort 1 mode concentrating every active member and all their messages into one ever-growing cohort: (1) `peer_programming_messages` had no index on `cohort_id`, so `listMessages` (`WHERE cohort_id = $1 ORDER BY created_at ASC LIMIT 300`) did a sequential scan + sort over the whole table that eventually exceeded the DB statement timeout and threw → 503; (2) the room roster resolved **every** member's username via an external Clerk lookup on every load, unbounded work that also grew with the cohort. Fixes: added `idx_peer_programming_messages_cohort_created ON (cohort_id, created_at)` and `idx_peer_programming_cohort_members_cohort_created ON (cohort_id, created_at)` to `schema.sql` (`CREATE INDEX IF NOT EXISTS`, idempotent); capped the room roster to the earliest `PEER_PROGRAMMING_ROOM_ROSTER_LIMIT` (60) members (`buildCohortRosters` gained an optional `limitPerCohort`; the displayed total still comes from the true `cohort.memberCount`, so the count is unaffected — only the chip list is capped); and wrapped the roster build in the room route in try/catch so a slow or failing Clerk lookup degrades to an empty roster (logged via `reportError`) instead of failing the whole room — the same defense-in-depth applied to the Workforce dashboard. No route, contract, or response-shape change. Mirrors the earlier Workforce dashboard 503 fix.
- 2026-06-26: **In-app admin toggle for single standing, always-open Cohort 1 mode.** The mode is no longer driven only by the env flag. Added a one-row settings singleton `peer_programming_settings` (`singleton_id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton_id)`, `single_open_cohort_enabled BOOLEAN` nullable, `updated_by_user_id TEXT`, `updated_at TIMESTAMPTZ`) to `schema.sql` and `schema.demo.sql` with the `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE IF EXISTS … ADD COLUMN IF NOT EXISTS` pattern. New repository helpers `getPeerProgrammingSettings`, `setPeerProgrammingSingleOpenCohort`, and the async resolver `resolveSingleOpenCohortMode()` / `isSingleOpenCohortModeEnabled()` resolve the effective mode with precedence: (a) the persisted admin setting if set → use it; (b) else the env flag `PEER_PROGRAMMING_SINGLE_OPEN_COHORT` (read by the now env-only fallback `isPeerProgrammingSingleOpenCohortEnabled()` in `constants.ts`); (c) else default ON. The three behaviour call sites `getMyCohort`, `listActiveCohorts`, and `runWeeklyAssignment` now `await isSingleOpenCohortModeEnabled()` instead of the pure env read; behaviour with no admin setting and no env override is unchanged (ON). New admin route `app/api/peer-programming/admin/single-open-cohort/route.ts`: `GET` returns `{ enabled, source, adminSetting, envFlagEnabled }`; CSRF-guarded admin-only `POST { enabled: true|false|null }` upserts the singleton (null clears the admin setting) and audits as `peer-programming.settings.single-open-cohort.set`. Added a "Single standing Cohort 1 mode" control to `pp-admin-shell.tsx` (status badge, source label, Turn on / Turn off / Clear override, loading/error/success states). New command contracts `admin.single-open-cohort.get`/`.set`, matching access-policy and audit-event entries. Updated rule 123 to note the env flag is now a fallback under the admin setting. Web typecheck + eslint + EOF + inventory-drift checks clean.
- 2026-06-26: **Single standing, always-open Cohort 1 mode (owner directive, low population).** Added the server flag `PEER_PROGRAMMING_SINGLE_OPEN_COHORT`, read by one resolver `isPeerProgrammingSingleOpenCohortEnabled()` in `lib/peer-programming/constants.ts`; it **defaults ON** (unset/empty = ON; only `0`/`false` turns it OFF). Added an `is_standing BOOLEAN NOT NULL DEFAULT FALSE` column to `peer_programming_cohorts` in `schema.sql` and `schema.demo.sql` (`ALTER TABLE IF EXISTS … ADD COLUMN IF NOT EXISTS`) plus a partial-unique index `uq_peer_programming_cohorts_standing ON (is_standing) WHERE is_standing` so there can only ever be one standing row. New repository helper `ensureStandingCohort(actorId)` find-or-creates the single standing cohort (label `C1`, `fallback_open = TRUE`, `is_standing = TRUE`), idempotent and race-safe via `ON CONFLICT (is_standing) WHERE is_standing DO NOTHING`. When the mode is ON: `getMyCohort` resolves the standing cohort (regardless of week) and idempotently joins the requesting (already access-gated) member so any active member can post, not just listen; `listActiveCohorts`/`getCohortById`/`listManagedCohorts` include the standing cohort regardless of week; and `runWeeklyAssignment` (cron + admin manual run) pauses the weekly split — it ensures the standing cohort exists and idempotently joins all provided active members into it with the same per-user+week notifications, creating no `C2`/`C3` (returns `cohortsCreated: 1`). When the flag is OFF the original weekly cohorting is byte-for-byte unchanged. Documented the flag in `.claude/rules/123-environment-configuration-rules.mdc`. Updated the seed script to set `is_standing` explicitly. No new API route or command added. Web typecheck + eslint + EOF + inventory-drift checks clean.
- 2026-06-25: **Documented the `peer_programming_admin_audit_trail` table** (inventory-debt burn-down — documentation catch-up, no code change). Added it as item 7 in "Tables Owned by This Plugin": the immutable admin-action audit trail (one row per privileged command, `allow`/`deny` outcome captured), retained on account deletion for compliance. Verified against `schema.sql`, `lib/peer-programming/repository.ts`, and `lib/account/deletion-registry.ts`. Removed `peer_programming_admin_audit_trail` from `ctf/scripts/inventory-drift-allowlist.json`.
- 2026-06-23: **Android parity — live video Session tab (#555).** The React Native Session tab now joins the same per-cohort GetStream video call as web, replacing the static placeholder. (1) `joinSession()` in `packages/mobile/src/features/peer-programming/api.ts` calls `POST /api/peer-programming/session/join` through `authedFetch` (Clerk bearer + `x-ctf-csrf` header) and returns a typed result: `ok` with the credential shape (`cohortId`, `displayName`, `streamApiKey`, `streamCallId`, `streamUserId`, `streamToken`), `no-cohort` (404), `stream-disabled` (503), or `error`. (2) New `PeerProgrammingSessionCall.tsx` renders the live call with `@stream-io/video-react-native-sdk`, reusing the Chyme `ChymeAudioRoom` lifecycle pattern (create the `StreamVideoClient`, join the `default` call, enable camera + mic, render one de-duplicated tile per participant via `ParticipantView`, mute/camera/leave controls, and `leave()` + `disconnectUser()` on unmount). (3) `pp-session-tab.tsx` adds a "Join Session" button above the cohort text room, with loading, error (retry), 404 ("you're not in a cohort yet — join a cohort"), and 503 ("live video unavailable") states; leaving the call returns to the tab. A read-only listener (viewing another cohort) sees a short note instead of a join button, because the call is always the caller's own cohort. No new call is created — mobile members join the existing per-cohort call. Added quota note `ctf/docs/quota-impact/2026-06-23-mobile-peer-programming-session-video.md`. No schema or contract change — the join route, command/access/audit contracts, and `lib/peer-programming/stream.ts` already exist from the web work. Mobile typecheck + eslint (0 warnings) clean.
- 2026-06-23: **Cohort assignment is now unlocked-only (bug fix).** Weekly assignment selected from `getActiveUserIdsLastDays(7)` (everyone who signed in within 7 days) with no Unlock check, so a person who signed into v3 but never completed Unlock — e.g. a v2 account returning to v3 — was placed into a cohort and shown as a member. Added `listUnlockedUserIds(userIds)` to the Unlock repository (one query against `unlock_verification_submissions` for `access_tier = 'approved_full'`) and filtered the recent-login set through it in both assignment routes (`app/api/internal/peer-programming/assignments/run` and `app/api/peer-programming/admin/assignments/run`) before forming cohorts. The admin **manual override** path is left unfiltered (an explicit admin choice). Filtering lives in the routes (the composition layer) so the peer-programming repository stays decoupled from Unlock. No schema or contract change.
- 2026-06-23: **Show who is in a cohort — member rosters (owner request).** An admin (and a member) could see "2 members" but not *who*, because peer-programming stores only `user_id` on `peer_programming_cohort_members` and `peer_programming_messages` and v3 has no central username lookup (every other plugin snapshots a username when the user themselves acts; cohort assignment is a system action over ids, so it never captured names). Fix: resolve member ids to names authoritatively via the Clerk Backend API. New `lib/identity/resolve-usernames.ts` (`resolveUsernames(userIds)` → `createClerkClient().users.getUserList({ userId })`, best-effort, null on failure → caller shows a short id) and `lib/peer-programming/roster.ts` (`buildCohortRosters(cohortIds)` batches one Clerk lookup across all ids and returns `{ cohortId -> [{ userId, username }] }`); new repository helper `listCohortMemberUserIds`. `GET /api/peer-programming/admin/cohorts` now attaches each cohort's `members`, and `GET /api/peer-programming/room` attaches the open cohort's `members`. UI: the web admin "Cohorts" list (`pp-admin-shell.tsx`) and the member Cohorts tab (`pp-cohorts-tab.tsx`), and the React Native admin "Active cohorts" list (`AdminPeerProgramming.tsx`) and cohort tab (`pp-cohort-tab.tsx`), all render the roster (resolved `@username`, or a short `Member <id>` fallback). Membership is not secret (owner directive). Works for an assigned-but-inactive member (their name comes from their Clerk account, not from prior activity). No schema or contract change; reads existing tables plus a low-frequency Clerk lookup.
- 2026-06-23: **Android parity — member listen-in + admin manage-all-cohorts (#691).** The React Native shell now mirrors the web. (1) `fetchRoom(cohortId?)` (`packages/mobile/src/features/peer-programming/api.ts`) sends `?cohortId=` to open another cohort read-only, and `RoomData` gained `cohorts`, `myCohortId`, `access` (`member` | `admin` | `listener`), and `isMember` (with defensive defaults). (2) The Cohorts tab (`pp-cohort-tab.tsx`) shows a "Running cohorts this week" list with a "Listen in" action on each cohort the viewer is not currently in; `PeerProgramming.tsx` tracks the viewed cohort, shows a "Listening in … read-only" banner with a back/leave control, and no longer shows the empty state for a member with no cohort when there are cohorts to listen in on. (3) The session view (`pp-session-tab.tsx`) shows a "you're listening in — read-only" notice when `access !== 'member'` (the mobile session is already read-only — it has no composer to gate). (4) The admin screen (`AdminPeerProgramming.tsx` + `admin-api.ts` `fetchManagedCohorts`) adds an "Active cohorts" list (member counts + open flag) over `GET /api/peer-programming/admin/cohorts`. No schema or contract change — the routes are live.
- 2026-06-22: Weekly cohort assignment now runs automatically. Added a scheduler-only internal route `POST /api/peer-programming/internal/assignments/run` (`app/api/internal/peer-programming/assignments/run/route.ts`) that runs the same `runWeeklyAssignment` against the last-7-days active set, guarded by an `Authorization: Bearer <CRON_SECRET>` header instead of the admin gate, mirroring the Unlock reward-reconciliation pattern. A new GitHub Actions workflow (`.github/workflows/peer-programming-weekly-assignment.yml`) calls it early every Monday (UTC) and on manual dispatch; it skips with a visible warning (no red failure) when `CRON_SECRET` or the app URL is not set. The run is idempotent per week, so a repeat call cannot double-form or double-notify. Audited as `peer-programming.cohort.weekly.select` with `actorId = peer-programming-scheduler`, `source = weekly_scheduler`; the existing `cohort.weekly.select` access policy already allowed the `system` role. The manual admin run is unchanged as a fallback/override. No schema change. Closes #554. Web typecheck + build clean.
- 2026-06-21: Fixed the admin "Cohorts" list dropping cohorts after the week rolled over. The list was hard-scoped to the current week (`listActiveCohorts`), so a cohort an admin formed on a prior day silently disappeared — the owner reported "can't see the cohort I made." Added `listManagedCohorts` (every cohort in the last 84 days, most recent first, capped at 200) and pointed `GET /api/peer-programming/admin/cohorts` at it; the member room/listen-in list still uses the current-week `listActiveCohorts`. The admin shell renames the section to "Cohorts", shows "Week of <date>" on each row, and updates the empty-state copy. No schema change. Web typecheck and build clean. Android parity deferred.
- 2026-06-21: Admin manage-every-cohort and member listen-in. (1) **Listen-in:** any signed-in member can now open a running cohort they were not placed in and read along (read-only) — the room shell shows a "Running cohorts this week" list with a "Listen in" action on each cohort, including for members not yet assigned. (2) **Admin reach:** the `/admin/peer-programming` surface now has an "Active cohorts" list (every cohort for the week with member counts), each linking to the room via `/apps/peer-programming?cohortId=<id>`, so an admin can reach and manage any cohort after it forms — the admin is effectively included in every group. (3) **API:** `GET /api/peer-programming/room` now returns the full `cohorts` list plus `myCohortId`, `access` (`member` | `admin` | `listener`), and `isMember`, and accepts an optional `?cohortId=` to open another cohort read-only; new admin route `GET /api/peer-programming/admin/cohorts`. New repository functions `listActiveCohorts` and `getCohortById`. Posting is unchanged — still gated by `isCohortMember`, so listeners and admins viewing another cohort can read but the composer is replaced by a "you're listening in" notice. No schema change. Web typecheck clean. Android parity deferred (listen-in list + read-only cohort view on the Android shell) — tracked in the parity ticket on the PR.
- 2026-06-17: Restyled the `/admin/peer-programming` surface (`pp-admin-shell`, `pp-admin-topic-form`, `pp-admin-assignments`) to the shared dark admin design system (icon header with `ADMIN` badge, dark tokens, dark form inputs) per rule 131. Visual only — endpoints, CSRF handling, and validation unchanged. The mockup shows a session-moderation queue, but the real backend has only the weekly-topic form and the cohort-assignment runner, so the designed look was applied to those real controls rather than fabricating a queue. Web typecheck + eslint clean.
- 2026-06-16: Cohort-start fix, write-path hardening, and live video. (1) **Active-member writer:** added `recordLoginEvent` (`lib/engagement/login-activity.ts`), called from the shared access gate (`evaluatePluginAccess`), which records each signed-in member into the existing `login_events` table once per UTC day. Nothing wrote that table before, so the default weekly assignment always selected zero members and no cohort could form; both this plugin and the Weekly Performance review read the same table, so neither needs a duplicate. (2) **Topic upsert fix:** added a unique constraint/index on `peer_programming_weekly_topics(week_start_date)` in `schema.sql`; the admin "set weekly topic" upsert uses `ON CONFLICT (week_start_date)`, which previously failed with "Topic upsert unavailable" because no such constraint existed. (3) **Write membership enforcement:** `POST /messages` and `/replies` now verify cohort membership (`isCohortMember`) and set the tier server-side; non-members are denied with an audit row. (4) **Fallback-open** now reflects the live roster (open when fewer than 2 members), not only the assignment-time flag. (5) **Live video:** new `POST /api/peer-programming/session/join` + `lib/peer-programming/stream.ts` mint GetStream video credentials scoped to the caller's cohort; the web Session tab ("Join Session") now joins a real per-cohort video call (`pp-session-call.tsx`) instead of a static placeholder. (6) **Web data binding fix:** the web shell now reads the cohort/messages from the real `/room` shape and posts messages/feedback with the correct body and CSRF header (it previously read `room.cohortId` off the wrong shape, GET a non-existent `/messages`, and posted mismatched bodies, so the cohort never resolved client-side). Added the `session.join` command/access/audit contracts. Android live video is deferred (see Gaps). Web typecheck + eslint + build clean.
- 2026-06-12: The Android PeerProgramming API clients (`api.ts`, `admin-api.ts`) now use the shared authenticated fetch helper, which attaches the signed-in user's Clerk bearer token and reads the server address from runtime config (`APP_URL`), replacing plain fetch calls against hardcoded development URLs; the hand-passed token parameter (which the screens filled with the user id, not a real token) was removed from every function and call site. No schema, route, or contract change.
- 2026-06-06: Admin UI reconciliation. Replaced the plain-text `/admin/peer-programming` stub with a real, mobile-responsive admin surface: new web components `pp-admin-shell.tsx`, `pp-admin-topic-form.tsx`, `pp-admin-assignments.tsx`, `pp-admin-shared.ts` (under `components/peer-programming/`), aligned to the existing `/admin/{plugin}` aesthetic (what-works / skills-hunt) and within rule-116 file-size limits; uses `hooks/use-is-mobile.ts` for phone usability. Wired two actions, both backed by existing endpoints only: set/publish the weekly topic (`GET`/`PUT /api/peer-programming/admin/topics`) and run weekly cohort assignment (`POST /api/peer-programming/admin/assignments/run`, with an optional manual user-id override). Added the Android admin screen `AdminPeerProgramming.tsx` + `admin-api.ts`, registered in `App.tsx`, binding the same three endpoints and admin-gated server-side (non-admin sees an access notice). Page admin gate unchanged from the stub (`evaluatePluginAccess({ requireApprovedUserOrAdmin: true })` then redirect when not `isAdmin`). No new commands invented; noted the pre-existing audit-vs-contract command-name spelling nuance for a later reconciliation. Web typecheck + eslint clean; mobile tsc (TypeScript 5.9.3) + eslint clean; no `key` on a class-based RN host component; EOF format check passes.
- 2026-05-31: Android pixel pass — rewrote `PeerProgramming.tsx` to match `design/.../survivor-hub/MobilePeerProgramming.tsx`. Updated `api.ts` to call real `GET /api/peer-programming/room` endpoint (replaces fabricated `fetchCohorts` stub). Retired `MockPeerProgramming.tsx` import. Decomposed into `pp-loading.tsx`, `pp-public.tsx`, `pp-empty.tsx`, `pp-cohort-tab.tsx`, `pp-session-tab.tsx` within rule-116 limits. Color/spacing/type/nav match design canonical (#8B5CF6, dark background, bottom nav bar). Omitted design's fabricated cohort list and global stats (no real backing field); real data binding via cohort room endpoint only. TypeScript clean, EOF format clean, parity check passes.
- 2026-05-31: Seed runtime fix. `seedPeerProgramming.mjs` now opens its own `pg` Pool and defines a local `queryDb` helper instead of importing the TypeScript `packages/web/lib/db/postgres.ts`, which plain Node (e.g. the Node 20 seed/provision workflows) cannot load. Added `pool.end()` teardown. No change to seeded rows, schema, or API.
- 2026-05-30: Web pixel pass — aligned the shell to `design/.../survivor-hub/PeerProgramming.tsx` and decomposed the 366-line / complexity-46 monolith into modular sub-components (`pp-shared.ts`, `pp-loading.tsx`, `pp-icon-rail`, `pp-sidebar`, `pp-cohorts-tab`, `pp-session-tab`, `pp-chat-tab`, `pp-right-panel`, thin shell; extracted a `fetchRoomData` helper) within rule-116 limits. Swapped emoji icons for the design's lucide icons, aligned "Video session via GetStream" to the design's "Video session — encrypted", and dropped the fabricated "Forming: 2" sidebar badge. Dropped the unused `userId`/`isAdmin` props at the call site. No schema/route/contract changes.
- 2026-05-18: Inventory rewritten to enforce Rule 120 living-snapshot model. Removed "Web-First Delivery and Android Follow-Up" section and all web-first / Android-follow-up parity language; confirmed `web+android complete`. Replaced "planned" command groups and "Planned Domain Entities" with the actual shipped routes and tables. Synced table names with `ctf/schema.sql` and route list with `ctf/packages/web/app/api/peer-programming/`.
- 2026-02-24: Initial PeerProgramming CTF rewrite inventory created.


## Build Checklist

> **Reconciliation (2026-05-26):** the Delivery Status above is `web+android complete` (feature parity).
> Unchecked items below are obsolete web-first / Android-deferral planning artifacts and deferred MVP
> validation/release gates (Rule 118) — not missing implementation. The authoritative production bar
> (pixel-perfect to `design` + parity + gates + deploy) is tracked in
> `ctf/docs/developer/PRODUCTION_READINESS_PLAN.md`, which wins where it differs from this checklist.

### Scope and Boundary

- [ ] Confirm implementation scope is `ctf/` only.
  - Acceptance criteria:
    - No implementation work is required in `platform/`.
- [ ] Confirm plugin slug and command namespace lock.
  - Acceptance criteria:
    - Stable plugin slug is `peer-programming` across docs/contracts/routes.
- [ ] Confirm MVP functional scope lock.
  - Acceptance criteria:
    - Weekly active-user selection (login within 7 days), 5-user cohorts, assignment notifications, fallback-open behavior, room UI, threaded async text, tiered participation, feedback loop, and admin topic guidance are all explicitly accepted.

### �� Contract Lock

- [ ] Define plugin command contracts for v1.
  - Acceptance criteria:
    - Every command conforms to `.claude/rules/201-plugin-command-schema-template.mdc`.
- [ ] Define plugin access policy contracts for v1.
  - Acceptance criteria:
    - Every command has aligned role, attribute, consent/lawful basis, region, and deny conditions under `.claude/rules/202-plugin-access-policy-schema-template.mdc`.
- [ ] Define plugin audit contracts for v1.
  - Acceptance criteria:
    - Every command has allow/deny + result audit coverage under `.claude/rules/203-plugin-audit-schema-template.mdc`.
- [ ] Verify command parity across all three contract files.
  - Acceptance criteria:
    - Command set matches exactly across command, policy, and audit YAML.

### �� Cohort Selection and Assignment

- [ ] Implement weekly active-user selection based on login recency.
  - Acceptance criteria:
    - Selection includes only users with login activity in the prior 7 days.
- [ ] Implement cohort formation rules.
  - Acceptance criteria:
    - Target cohort size is 12 users per cohort (about 5 expected to actively participate).
    - Partial cohort handling is deterministic and documented.
- [ ] Implement assignment notification flow.
  - Acceptance criteria:
    - In-app notification event is generated for each assigned member.
    - Notification retries are idempotent.

### �� Room Experience and Persistence

- [ ] Implement cohort room state retrieval.
  - Acceptance criteria:
    - Room state includes active topic guidance, member summary, and fallback-open status.
- [ ] Implement async text-first thread posting.
  - Acceptance criteria:
    - Cohort members can create root posts.
- [ ] Implement threaded reply flow.
  - Acceptance criteria:
    - Replies are scoped to parent thread and ordered deterministically.
- [ ] Implement 24/7 persistence behavior.
  - Acceptance criteria:
    - Posts/replies remain available across reconnects and session restarts.

### �� Fallback and Tiered Participation

- [ ] Implement fallback-open activation path.
  - Acceptance criteria:
    - Fallback-open mode activates when fewer than 2 cohort members show.
- [ ] Implement participation tier resolver.
  - Acceptance criteria:
    - Access behavior is enforced across cohort member, authenticated audience, and unauthenticated audience tiers.
- [ ] Validate tier-based action restrictions.
  - Acceptance criteria:
    - Non-cohort and unauthenticated users are blocked from unauthorized write actions.

### �� Topic Guidance and Feedback Loop

- [ ] Implement admin weekly topic guidance set/get.
  - Acceptance criteria:
    - Topic guidance is scoped by week and available to room surfaces.
- [ ] Implement in-room feedback submit flow.
  - Acceptance criteria:
    - Feedback captures issue category and suggestion payload.
- [ ] Close iteration loop with review cadence.
  - Acceptance criteria:
    - Feedback summaries are reviewed weekly and linked to follow-up planning decisions.

### �� Web-First Delivery and Android Follow-Up

- [ ] Deliver MVP web-first release for all core commands.
  - Acceptance criteria:
    - Weekly selection, assignment notifications, room state, posting, replies, tier resolution, fallback-open, feedback, and topic guidance all function on web.
- [ ] Create Android follow-up parity tracker.
  - Acceptance criteria:
    - Each deferred Android item has owner, target date, risk, and closure criteria.
- [ ] Verify cross-platform semantic parity for completed capabilities.
  - Acceptance criteria:
    - Completed Android items match web command outcomes and deny reason behavior.

### �� Security, Audit, and Release Gates [MVP: VALIDATION DEFERRED — see Rule 118.]

- [ ] Policy deny-by-default posture design.
  - Acceptance criteria:
    - All commands document expected deny conditions for missing role/scope/tenancy or tier mismatch.
- [ ] Audit integrity design.
  - Acceptance criteria:
    - Allow and deny outcomes are documented with request/trace correlation requirements for each command.
- [ ] Contract and integration design documentation. [MANUAL TESTING DEFERRED FOR MVP — see Rule 118.]
  - Acceptance criteria:
    - Command schema and policy/audit behavior requirements are documented.
- [ ] Inventory and checklist synchronization.
  - Acceptance criteria:
    - Feature inventory + checklist are updated in same PR as scope or contract changes.

### Open Decisions Tracker

- [ ] Final fallback-open "show" detection signals (presence heartbeat vs message activity).
- [ ] Strategy for users left unassigned in low-activity weeks.
- [ ] Final Android parity deadline and release owner.

### Change Log

- 2026-02-24: Initial PeerProgramming rewrite checklist created with MVP feature gates, web-first release path, and Android follow-up parity tracking requirements.
