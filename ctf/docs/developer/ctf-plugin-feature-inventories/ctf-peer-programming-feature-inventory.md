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
2. Assigns up to 5 users per cohort,
3. Records in-app assignment notifications for every assignment cycle with idempotent delivery,
4. Opens fallback access when fewer than 2 cohort members are present,
5. Provides a cohort room optimized for async text with threaded replies,
6. Preserves messages and thread context continuously (24/7 persistence),
7. Enforces tiered participation across cohort member, authenticated audience, and unauthenticated audience,
8. Captures structured feedback for iteration,
9. Supports admin-defined weekly topic guidance.

---

## Target User Features

### Weekly Cohort Assignment

1. Weekly active-user selection includes only accounts with login activity in the prior 7 days.
2. Cohorts are formed with a target size of 5 users per cohort.
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

## Target Admin Features

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

These admin routes are now surfaced by a real admin UI on both web and Android (see Web and Android Delivery Status). The web admin page (`/admin/peer-programming`) is admin-gated; it binds the topic and assignment routes and the `admin/cohorts` list, and links each cohort to the room via `/apps/peer-programming?cohortId=<id>`.

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
2. `peer_programming_cohorts` — Weekly cohorts (id, week_start_date, cohort_label, fallback_open, topic_id, assigned_by_user_id).
3. `peer_programming_cohort_members` — Cohort membership (id, cohort_id, user_id).
4. `peer_programming_messages` — Cohort messages with threaded replies (id, cohort_id, author_user_id, parent_message_id, body, tier).
5. `peer_programming_feedback` — Structured feedback (id, cohort_id, user_id, issue_type, suggestion_category, release_surface, note).
6. `peer_programming_assignment_notifications` — Notification ledger (id, cohort_id, user_id, idempotency_key, payload, delivered_at).

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

**Live video (web 2026-06-16, Android 2026-06-23):** the Session tab's video call is wired on web (including mobile-responsive web, which is how phones/iOS are served) via `POST /api/peer-programming/session/join` + `pp-session-call.tsx` (GetStream, per-cohort call), and now on Android (React Native) too. The Android Session tab (`packages/mobile/src/features/peer-programming/pp-session-tab.tsx`) has a "Join Session" button that calls the same join route through `joinSession()` in `api.ts` and renders the live call in `PeerProgrammingSessionCall.tsx` (reuses the Chyme `ChymeAudioRoom` lifecycle pattern and the `@stream-io/video-react-native-sdk` SDK: join, render one tile per participant, mute/camera controls, leave + teardown on unmount). Android live-video parity (issue #555) is complete.

**Admin surface (2026-06-06):** the admin page at `/admin/peer-programming` is now a real, mobile-responsive admin UI — it replaced the former plain-text stub. The web admin shell (`components/peer-programming/pp-admin-shell.tsx` + `pp-admin-topic-form.tsx` + `pp-admin-assignments.tsx` + `pp-admin-shared.ts`) is consistent with the other `/admin/{plugin}` screens (generic admin aesthetic; matches the whatworks / skills-hunt admin layout, filter/action conventions, and CSRF mutation helper). It uses `hooks/use-is-mobile.ts` so it is usable on a phone. Two actions are wired, both backed by existing endpoints: (1) set/publish the weekly topic via `PUT /api/peer-programming/admin/topics` (with the current published topic loaded via `GET`), and (2) run the weekly cohort assignment via `POST /api/peer-programming/admin/assignments/run` (with an optional manual user-id override). The Android admin screen lives at `packages/mobile/src/features/peer-programming/AdminPeerProgramming.tsx` (+ `admin-api.ts`), is registered in `App.tsx`, binds the same three endpoints, and is admin-gated server-side (a non-admin sees an access notice). No new admin actions or commands were invented — only the existing endpoints are surfaced.

Contract note: the command contract file (`docs/contracts/PEER_PROGRAMMING_PLUGIN_COMMAND_CONTRACTS.yaml`) defines `admin.topic-guidance.set` / `admin.topic-guidance.get` (topics) and `cohort.weekly.select` (assignment run); the admin UI surfaces exactly these and adds no new commands. The audit command strings the routes emit (`peer-programming.topic.upsert`, `peer-programming.cohort.weekly.select`) differ in spelling from the contract command names — a pre-existing naming nuance, not introduced by this UI work, and worth reconciling in a later contract/audit pass. Web pixel pass complete: the shell (`peer-programming-shell.tsx` + `pp-*` sub-components) is aligned to `design/.../survivor-hub/PeerProgramming.tsx` (lucide icons, encrypted-session copy) within rule-116 limits; binds real `/api/peer-programming/room` + `/messages` + `/feedback`. Android pixel pass complete (2026-05-31): `PeerProgramming.tsx` rewritten to match `design/.../survivor-hub/MobilePeerProgramming.tsx` with real-data-only binding via `GET /api/peer-programming/room`; mock data retired (`MockPeerProgramming.tsx` is no longer imported); decomposed into `pp-loading.tsx`, `pp-public.tsx`, `pp-empty.tsx`, `pp-cohort-tab.tsx`, `pp-session-tab.tsx` subcomponents within rule-116 limits. Fabricated cohort list / global stats omitted per real-data-only rule. `api.ts` updated to call real backend routes with Clerk auth token.

## Seed Coverage Status

Deterministic PeerProgramming seed script: `ctf/scripts/seedPeerProgramming.mjs` (topics, cohorts, members, messages, feedback, notifications).

## Gaps and Known Technical Debt

1. Heuristic for partially-filled cohorts when active-user count is not divisible by 5 is implemented as best-effort packing; product sign-off on edge cases is pending.
2. Fallback-open is now derived from the live cohort roster: the room reports a cohort as open when it has fewer than 2 members, not only from the flag snapshotted at assignment time. A richer per-session presence signal (who is actually in the room right now) is still a possible future refinement but is no longer required for the basic "too small to be a group" rule.
3. Weekly cohort assignment now runs automatically once a week via the scheduler (the `PeerProgramming — Weekly Cohort Assignment` GitHub Actions workflow calling the secret-guarded `POST /api/peer-programming/internal/assignments/run` route), with the admin manual run kept as a fallback/override. Closes issue #554. The cron is OFF until `CRON_SECRET` and the existing `NEXT_PUBLIC_APP_URL` secret are set in the repository's Actions secrets and `CRON_SECRET` is matched in the app runtime — until then it skips with a visible warning rather than failing, and admins form cohorts from the admin screen.
4. Android (React Native) live video for the Session tab is delivered (2026-06-23, issue #555) — the Session tab joins the same per-cohort GetStream call as web. The Stream Video SDK needs native code, so it works in an EAS dev/production build, not Expo Go (the same constraint as Chyme and Lighthouse video). No automated test harness exists for live Stream calls on device — verification is manual.

## Change Log

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
- 2026-06-06: Admin UI reconciliation. Replaced the plain-text `/admin/peer-programming` stub with a real, mobile-responsive admin surface: new web components `pp-admin-shell.tsx`, `pp-admin-topic-form.tsx`, `pp-admin-assignments.tsx`, `pp-admin-shared.ts` (under `components/peer-programming/`), aligned to the existing `/admin/{plugin}` aesthetic (whatworks / skills-hunt) and within rule-116 file-size limits; uses `hooks/use-is-mobile.ts` for phone usability. Wired two actions, both backed by existing endpoints only: set/publish the weekly topic (`GET`/`PUT /api/peer-programming/admin/topics`) and run weekly cohort assignment (`POST /api/peer-programming/admin/assignments/run`, with an optional manual user-id override). Added the Android admin screen `AdminPeerProgramming.tsx` + `admin-api.ts`, registered in `App.tsx`, binding the same three endpoints and admin-gated server-side (non-admin sees an access notice). Page admin gate unchanged from the stub (`evaluatePluginAccess({ requireApprovedUserOrAdmin: true })` then redirect when not `isAdmin`). No new commands invented; noted the pre-existing audit-vs-contract command-name spelling nuance for a later reconciliation. Web typecheck + eslint clean; mobile tsc (TypeScript 5.9.3) + eslint clean; no `key` on a class-based RN host component; EOF format check passes.
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
    - Every command conforms to `.github/instructions/201-plugin-command-schema-template.mdc`.
- [ ] Define plugin access policy contracts for v1.
  - Acceptance criteria:
    - Every command has aligned role, attribute, consent/lawful basis, region, and deny conditions under `.github/instructions/202-plugin-access-policy-schema-template.mdc`.
- [ ] Define plugin audit contracts for v1.
  - Acceptance criteria:
    - Every command has allow/deny + result audit coverage under `.github/instructions/203-plugin-audit-schema-template.mdc`.
- [ ] Verify command parity across all three contract files.
  - Acceptance criteria:
    - Command set matches exactly across command, policy, and audit YAML.

### �� Cohort Selection and Assignment

- [ ] Implement weekly active-user selection based on login recency.
  - Acceptance criteria:
    - Selection includes only users with login activity in the prior 7 days.
- [ ] Implement cohort formation rules.
  - Acceptance criteria:
    - Target cohort size is 5 users per cohort.
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
