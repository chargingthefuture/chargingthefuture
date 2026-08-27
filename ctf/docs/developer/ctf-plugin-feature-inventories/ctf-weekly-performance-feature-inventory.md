# Weekly Performance Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Rewrite target only: `ctf/`
- Legacy `platform/` is reference-only and must not be modified.
- Plugin name: `Weekly Performance`
- Plugin slug / service key: `weekly-performance`
- This document defines plugin-owned rewrite scope for weekly performance review capabilities.

## Intent and Outcome

Weekly Performance is a plugin-owned analytics review surface for authorized operators.

This plugin must:

1. provide deterministic week-based performance reporting,
2. provide clear week-over-week comparison outputs,
3. enforce policy-safe admin access and action auditing,
4. provide stable read contracts for web and Android parity consumers.

---

## 1) User and Admin Feature Scope

### 1.1 User-Facing Scope

1. Weekly Performance is admin-only; there is no general user-facing dashboard.
2. Authorized non-admin read-only access is not currently exposed.

### 1.2 Admin Feature Scope

1. Saturday-based week selection (`yyyy-MM-dd`) with deterministic parsing and display range labels.
2. Previous/current/next week navigation with future-week guardrails.
3. Current-week live-state semantics with current-week-only polling and focus refetch behavior.
4. Weekly metrics card set for growth, user-state, and engagement outcomes (non-financial only).
5. Week-over-week comparison table with deterministic baseline fields for non-financial metrics.
6. Distinct loading, empty, missing-metrics, and error states for review safety.
7. Controlled export/report action surface if approved in contract lock.

## 2) API and Command Surface

### 2.1 Plugin Command Surface (Authoritative)

All command/access/audit contracts follow templates `201`/`202`/`203`.

Command groups:

1. `weekly-performance.week.list`
2. `weekly-performance.week.get`
3. `weekly-performance.metrics.get`
4. `weekly-performance.comparison.get`

### 2.2 HTTP Projection Routes

The route set below is the **shipped** surface (the earlier draft above named a
different, never-built `/admin/weeks/:weekStart/...` shape; the routes that
actually exist are listed here).

Read routes (admin or approved user). Each writes a `weekly_performance_audit_trail` row on an allow decision:

- `GET /api/weekly-performance/weeks` — a continuous run of weeks, newest first: every week from the current week (an ISO Monday start) back to the earliest of one year ago or the oldest tracked week, so the list never skips a week. The run stops at the week containing the platform launch date (`PLATFORM_LAUNCH_DATE_ISO` = 2026-06-12, `ctf/packages/web/lib/platform/launch.ts`), so the oldest week in the list is the week of Jun 8–14, 2026 and no pre-launch week is offered — the floor applies to stored rows too, so demo/seed data cannot pull the list back past launch. Stored weeks keep their real status; generated weeks with no row are `open` and read live per window. Audits `weekly-performance.week.list`.
- `GET /api/weekly-performance/weeks/[weekStart]` — canonical window metadata for an arbitrary week start date (`{weekStart, weekEnd, isCurrentWeek, status}`); this is the full `weekly-performance.week.get` surface (accepts any `weekStart`, validated as an ISO `YYYY-MM-DD` date), audits `weekly-performance.week.get`.
- `GET /api/weekly-performance/current-week` — convenience read of the **current** week plus active-user count (last 7 days); also audits `weekly-performance.week.get` (it is the current-week-only projection of that command, not the parameterized surface).
- `GET /api/weekly-performance/metrics?weekStartDate=...[&compareWeekStartDate=...]` — week metrics, or a week-over-week comparison when `compareWeekStartDate` is supplied; audits `weekly-performance.metrics.get` or `weekly-performance.comparison.get` per branch.

Admin-or-operations routes (`ensureWeeklyPerformanceAdmin` admits `isAdmin` or the `operations` role):

- `PUT /api/weekly-performance/admin/week-selection` — marks a week active (body `{ weekStartDate }`); requires the `x-ctf-csrf: '1'` header and writes a `weekly-performance.admin.week.select` audit row.

Internal (service-to-service, never member/browser callable):

- `POST /api/internal/weekly-performance/goal-snapshot` — records the current week's goal readings
  (GDP Community Value Index, Workforce recruited) into `weekly_performance_goal_snapshots` by
  computing the current week's metrics (the compute upserts the snapshot rows). Guarded by
  `Authorization: Bearer INTERNAL_SERVICE_SECRET` (same posture as `/api/internal/product-update`);
  501 when the secret is unconfigured, 401 on a bad token. Called daily by the scheduled workflow
  `.github/workflows/weekly-performance-goal-snapshot.yml` so goal history never depends on someone
  opening the dashboard that week (last capture of the week wins — the stored value converges to the
  week's closing reading). Contract: `weekly-performance.goal-snapshot.capture`.

## 3) Data Dependencies and Contracts

1. Aggregated users-domain metrics (new users, verification/approval totals).
2. Aggregated engagement-domain metrics (DAU/MAU and week comparison signals).
3. Aggregated plugin event metrics (approved non-financial weekly outcome signals).
4. Deterministic week-boundary contract (Saturday-start unless revised during lock).
5. Canonical metric definitions/versioning for all comparison fields.
6. Week payload contract includes explicit current-week and previous-week boundary metadata.

### 3.1 Owned storage tables

The aggregates above are persisted in two tables in `ctf/schema.sql`:

- `weekly_performance_metrics` — the per-week aggregate store. One row per metric: `id`, `week_start_date` (DATE), `metric_key`, `metric_value` (NUMERIC), `metric_unit`, `source_plugin`, `created_at`.
- `weekly_performance_audit_trail` — the admin allow/deny audit log. Columns: `id`, `actor_id`, `command`, `policy_status`, `reason`, `target_type`, `target_id`, `metadata` (jsonb), `created_at` — the audit coverage required by §4.4.
- `weekly_performance_goal_snapshots` — weekly memory for the dashboard's two goal rows (GDP
  Community Value Index toward 300B; Workforce recruited toward 2,000,000). Those are state metrics
  (a current total, not a windowed event), so week-over-week needs a stored reading per week: a read
  of the current week upserts the live value (last read of the week wins), and past weeks report
  their stored row. Columns: `metric_key` (TEXT), `week_start_date` (DATE), `metric_value`
  (NUMERIC), `captured_at` — primary key `(metric_key, week_start_date)`.

## 4) Security and Compliance Controls

1. Admin-only authorization for plugin admin read commands.
2. Server-side RBAC/ABAC checks and deny-by-default policy enforcement.
3. CSRF protection for mutation endpoints (the admin week-selection action).
4. Audit coverage for allow/deny decisions.
5. Privacy-safe field handling for sensitive operator metrics.

## 5) Web and Android Delivery Status

Delivery: **web + mobile-responsive complete**. **Android (React Native) surface removed 2026-07-20 (rule 105, PR #1742)** — this feature is now web-only, served by the installable web app (PWA). Week-selector behavior, current-week polling policy, empty/error semantics, metric definitions, formatting, and deny reasons are served on web (`/admin/weekly-performance` — the single surface). Historical parity detail: these were previously consistent with the former Android surface (`packages/mobile/src/features/weekly-performance`, now removed).

Single admin surface (2026-07-18, owner directive): there is exactly one web surface, the admin page `/admin/weekly-performance`, which serves the full dashboard (`weekly-performance-shell.tsx` — sidebar week history, grouped metric cards, comparison chart). `/apps/weekly-performance` renders nothing: it redirects admins to the admin page and still 404s everyone else (admin-only gate). The thin review shell `wp-admin-shell.tsx` and the admin↔member cross-links ("Member view" pill, "Admin" pill, sidebar "Manage weeks") were deleted.

Web pixel pass (design `c5d83c0`): the user-facing shell is rebuilt to `design/.../survivor-hub/WeeklyPerformance.tsx` and its Empty/Loading states — icon rail, week-history sidebar, metric cards, a this-week-vs-last-week comparison chart, and a week-summary right rail. Week selection drives `GET /api/weekly-performance/weeks`, `/current-week`, and `/metrics` (with `compareWeekStartDate` for per-metric deltas); admin export opens `GET /api/weekly-performance/export`. Real data only — the mockup's fabricated daily series became a real per-metric current-vs-compare chart scaled relative to the max value in view, metric labels are humanized from `metric_key` (no label column exists), and the unbacked "Top Apps" widget was omitted rather than faked. Decomposed into modular sub-components within the rule-116 limits.

Admin surface (2026-06-06): the admin page `app/admin/weekly-performance/page.tsx` was a thin server stub (it printed only the current week and the tracked-week count). It is now a real, mobile-responsive admin UI. The server page keeps the same admin gate as the other `app/admin/<plugin>/page.tsx` pages (`evaluatePluginAccess({ requireApprovedUserOrAdmin: true })`, then `redirect('/apps/weekly-performance')` when `!decision.isAdmin`) and renders a new client shell `components/weekly-performance/wp-admin-shell.tsx`. The shell uses `useIsMobile()` so the owner can run it on iOS: it lists tracked weeks and the current week, lets the admin pick a week and **set it active** (`PUT /api/weekly-performance/admin/week-selection` with `x-ctf-csrf: '1'`), shows that week's metrics, and offers the export action (`GET /api/weekly-performance/export`). Loading, empty, populated, and success/error feedback states are all handled. A matching Android admin screen (`packages/mobile/src/features/weekly-performance/AdminWeeklyPerformance.tsx`, design `MobileWeeklyPerformanceAdminView.tsx`) was added and registered in `App.tsx`; it is admin-gated client-side (`useAuth().user.isAdmin`), binds to the same routes via a new `selectActiveWeek` helper in `api.ts`, and keeps the Metrics and History tabs. The mockup's fabricated plugin-breakdown and daily bar chart are omitted (no backing API field), per real-data-only policy.

Android pixel pass (design `MobileWeeklyPerformance.tsx`, 2026-05-31): the mobile screen (`packages/mobile/src/features/weekly-performance/WeeklyPerformance.tsx`) is fully rewritten to align with the canonical mockup. A new `api.ts` is introduced, binding to the same three read routes used by web (`GET /api/weekly-performance/weeks`, `/current-week`, `/metrics`). Four states are implemented: Loading (brand phrases centered), Public/unauthenticated (blurred metric preview with lock overlay and sign-in CTA), Empty (week in progress with placeholder cards), and Populated (metrics grid + history tab). Metric cards are driven by known `metricKey` values (`member_count`, `signups`, `engagements`, `gdp_delta`); the mockup's "Daily Engagements" bar chart has no backing API field (metrics are weekly aggregates only) and is omitted per real-data-only policy. The admin Export action is not surfaced on mobile (admin-only server gate exists on web; mobile surfaces the admin badge and export hint in the history tab). All mock data retired. Export `WeeklyPerformance` preserved.

## 6) Seed Coverage Status

Weekly performance metrics are derived from upstream plugin tables (feed, login activity, level-up, etc.); no dedicated seed script is required. Local validation runs against fixtures produced by upstream plugin seed scripts.

Live numbers: weekly numbers are **always** computed live, matching the V2 dashboard, which aggregated on read for any selected week. There is no "close the week" step and no stored snapshot to wait for. `getWeekMetrics` returns `computeLiveWeekMetrics` (`lib/weekly-performance/live-metrics.ts`) for every week, counting the week window directly from upstream tables. The current week is labeled "Live" and keeps moving (silent 60s polling + focus refetch on web); every earlier week is a settled historical window with no "closed" state. The `weekly_performance_metrics` table and the `weekly-performance.metrics.get` route are unchanged; the read is simply always live (the table is no longer consulted for the dashboard).

The shipped metric set is the one locked on 2026-07-18 in `ctf/docs/developer/PLUGIN_VALUE_METRICS.md`, plus the
daily-active-members adoption row added 2026-08-15. Nothing revenue/financial is included (revenue, MRR, ARR, CLV)
— V3 is free to end users, so those have no meaning. Every metric is scoped to
`[week_start, week_start + 7 days)` unless noted, and each query is table-existence-guarded so a missing table
contributes 0 rather than failing the read. Card order on the dashboard is the order below.

Goals (state metrics — the current-week read stores a snapshot, past weeks report their stored row):

- `goal.gdp_value_index` — Community Value Index, toward the 300B goal (from the GDP plugin's live report).
- `goal.workforce_recruited` — active, non-deleted Directory profiles, toward the 2,000,000 goal.

Value delivered (each plugin's defining action, windowed on the event's own timestamp):

- `value.foundation_calls_answered` — answered Foundation calls with at least one block charged (aggregate only, rule 132).
- `value.socket_relay_requests_fulfilled` — SocketRelay fulfillments the requester closed as successful.
- `value.trust_transport_trips_completed` — trips both sides confirmed complete.
- `value.lighthouse_stays_completed` — Lighthouse matches now in `completed`.
- `value.chyme_tips_sent` — completed ServiceCredits transfers originated by Chyme (never self-to-self).
- `value.service_credits_peer_sends` — completed direct peer sends originated by ServiceCredits.
- `value.contributions_confirmed_usd` — confirmed real dollars this week (a sum, not a row count).
- `value.skills_hunt_nominations_accepted` — nominations a moderator accepted.
- `value.what_works_tools_approved` / `value.what_works_endorsements_given` — approved tools and endorsements given.
- `value.level_up_completions` / `value.level_up_trainer_payouts` — completed enrollments and trainer payouts.
- `value.recurring_ties_confirmed` — ties the counterparty confirmed.
- `value.peer_programming_active_posters` — distinct members who posted in their cohort.
- `value.beacon_broadcast_engagement` — distinct (member, broadcast) pairs that reacted or replied on a broadcast's Commons replay post.

Adoption (honest non-value rows):

- `adoption.active_members` — how many different members did something in the app during the week: the plain
  turnout headcount, and the number "Daily Active Members" is easiest to misread as.
- `adoption.daily_active_members` — average number of members active on a day of the week: member-days divided
  by the days of the window that have already started (1–7), so the live current week averages over the days it
  has actually had and every past week divides by 7. The divisor is computed in UTC, matching the day boundary
  the member-days are bucketed on.

Both turnout rows are built from the shared member-day set in `lib/engagement/member-activity.ts`. A member-day
is a (member, UTC day) pair on which that member did something the app recorded, drawn from the union of 37
member-attributed activity sources, each windowed on its own date column and `UNION`ed so a member seen in
several sources on one day is still one member-day. The sources are of three kinds:

- the sign-in record, `login_events` — the broadest single source, but only from 2026-06-16, the day it got
  its writer;
- what the member made or wrote: `click_log_incidents`, `mood_submissions`, `feed_community_posts`,
  `feed_community_replies`, `feed_community_post_reactions`, `peer_programming_messages`,
  `level_up_dispute_comments`;
- the per-plugin command trails, one row per command a member ran (reads included), carrying that member as
  the actor and the member's own request time: `weekly_performance_audit_trail`, `gdp_admin_audit_trail`,
  `workforce_admin_audit_trail`, `trust_admin_audit_trail`, `trust_transport_admin_audit_trail`,
  `trust_transport_status_events`, `socket_relay_admin_audit_trail`, `socket_relay_request_events`,
  `foundation_admin_audit_trail`, `foundation_quote_status_events`, `lighthouse_admin_audit_trail`,
  `service_credits_admin_audit_trail`, `peer_programming_admin_audit_trail`,
  `beacon_events_admin_audit_trail`, `safety_admin_audit_trail`, `contributor_access_audit_trail`,
  `recurring_activity_audit_trail`, `skills_hunt_audit_log`, `skills_taxonomy_change_events`,
  `level_up_audit_events`, `contributions_audit_log`, `directory_profile_change_events`,
  `account_restrictions_audit`, `unlock_audit_log`, `quora_deletion_survey_audit_log`,
  `quora_live_census_audit_log`, `feed_membership_events`, `announcement_membership_events`,
  `llm_inference_log`.

The command trails are what make the launch weeks readable: they have been written since each plugin shipped,
where `login_events` starts on 2026-06-16 and the content tables above stay empty for a member who reads and
reviews rather than posts.

Actor ids that are not a person are excluded by name (`NON_MEMBER_ACTIVITY_ACTOR_IDS`): the scheduled runs
(`skills-hunt-auto-mission-scheduler`, `level-up-auto-cohort-scheduler`, `unlock-incentive-system`,
`internal_service_credits_reclaimer`), the platform-authored Commons standing notice
(`system:commons-guidance`), and the `anonymous` / `system` fallbacks. Rows whose timestamp is written by a
counterparty or an admin rather than by the member (a trip completion, a nomination review, a disbursement),
and rows the platform scores about a member rather than records the member doing
(`trust_transport_risk_signals`), are deliberately not sources: those say something happened to the member,
not that the member turned up. Both rows are aggregate only — never a per-member figure — and both are
adoption, not value: turning up is not a plugin's defining action and carries no positive weight in value
scoring.
- `adoption.directory_findable_members` — claimed, active, skilled Directory profiles by week end (cumulative).
- `adoption.mood_checkins` / `adoption.mood_average` — Mood check-ins and their average (aggregate only — never an individual reading).
- `adoption.click_log_incidents` / `adoption.click_log_active_loggers` — ClickLog incidents and distinct loggers (aggregate only).

V2's "verified" and "approved" member counts are intentionally omitted: V3's `users` table is the Clerk mirror with no dependable verification/approval timestamp, so a time-correct per-week value can't be computed (real-data-only). Metric card labels are humanized from the key: the group prefix is dropped and the rest is title-cased, so `adoption.active_members` reads "Active Members" and `adoption.daily_active_members` reads "Daily Active Members".

## 7) Gaps and Known Technical Debt

1. Non-financial metric dictionary and formulas live in code; no canonical governance document captures the dictionary outside the implementation.
2. The `operations` role now passes the admin gate (week-selection) alongside `admin`, matching the access-policy contract `requiredRoles: [admin, operations]`. Read routes already admit any approved member.
3. Mood-related comparison fields are excluded from the current dictionary; whether to reintroduce them is an outstanding product question.
4. Contract gap: the shipped `PUT /api/weekly-performance/admin/week-selection` route (audit command `weekly-performance.admin.week.select`) is not represented in `docs/contracts/WEEKLY_PERFORMANCE_PLUGIN_COMMAND_CONTRACTS.yaml`, which lists only `week.list`, `week.get`, `metrics.get`, and `comparison.get`. The week-selection command should be added to the command/access/audit contracts.
5. The member-day union now reads 37 tables, and most of the command trails have no index on `created_at`, so
   each turnout read scans them. At today's row counts that is milliseconds and it is not worth a schema
   change yet, but if any command trail grows large the fix is a `created_at` index on it rather than dropping
   it from the source list.

## 8) Change Log

- 2026-08-27: **The launch weeks reported nobody, and a platform-authored post counted as a member
  (owner report: "all weeks should have at least one active user — I use the app every day, yet week
  one and others show no active users").** Two separate faults, both in what counts as a member
  turning up:
  (a) **The early weeks had no readable source.** `login_events` got its writer on 2026-06-16; the
  platform opened on 2026-06-12, so the first week the picker offers (Jun 8–14) and the first days of
  the second had no sign-in rows at all. The other six sources were narrow content tables — an owner
  who reads dashboards and reviews submissions logs no incident, posts nothing, and checks in
  nowhere — so a week someone used every day still read zero. The member-day set in
  `lib/engagement/member-activity.ts` now also reads the per-plugin command trails (30 tables, listed
  in section 6): each holds one row per command a member ran, reads included, with that member as the
  actor and the member's own request time on it, and each has been written since its plugin shipped.
  Those weeks now report what actually happened in them, and the reading no longer depends on a
  single table that started late.
  (b) **A non-person was being counted.** The Commons standing notice is authored by
  `system:commons-guidance` and written into `feed_community_posts`, an existing source, so it added
  a member to the headcount on the day it was written. Actor ids that are not people are now excluded
  by name (`NON_MEMBER_ACTIVITY_ACTOR_IDS`), covering the scheduled runs and the `anonymous` /
  `system` fallbacks as well.
  Also: the "which of these tables exist" probe went from one round trip per table on every call to
  one round trip covering all of them, remembered for the life of the process — otherwise widening the
  list would have multiplied that cost. `ctf/scripts/audit-active-members.mjs` mirrors the new source
  list and the actor exclusions, prints only the sources that contributed (37 rows of mostly zeroes
  buries the ones that matter) with a count of the quiet and missing ones, and says plainly when a
  week predates the sign-in writer so a zero there is not read as a broken write. A new unit test,
  `ctf/packages/web/lib/engagement/member-activity.test.ts`, checks that every source reaches the SQL,
  that the actor exclusions are bound, that the probe runs once, and that the audit script's copy of
  both lists still matches the module's. Added the new tables to the `dataAccess` lists of
  `weekly-performance.metrics.get`, `weekly-performance.comparison.get`, and `weekly-performance.week.get`
  (the last also names the member-day sources behind its `activeUsersLast7Days` field, which it had
  never listed). No schema, route, or access-policy change.

- 2026-08-26: **Turnout was undercounting whole members (owner report: "there are two daily active
  users and it says one").** Both turnout readings — the dashboard's `adoption.daily_active_members`
  row and the `/current-week` rolling `activeUsersLast7Days` — read `login_events` and nothing else.
  That table has exactly one writer: a fire-and-forget insert in
  `lib/engagement/login-activity.ts`, called from the shared access gate, whose failures were caught
  and dropped without a word. So any member whose sign-in row never landed was invisible to the
  dashboard even while the database held that member's own rows, timestamped, from the same day — a
  member logging ClickLog incidents every day could read as nobody. Three changes:
  (a) a new `lib/engagement/member-activity.ts` defines a member-day as a (member, UTC day) pair
  taken from the union of every member-attributed activity source (`login_events`,
  `click_log_incidents`, `mood_submissions`, `feed_community_posts`, `feed_community_replies`,
  `feed_community_post_reactions`, `peer_programming_messages`), each guarded on table existence;
  both turnout readings and PeerProgramming's cohort-forming active set now read it, so the
  dashboard and the cohort run can no longer disagree about who turned up.
  (b) the sign-in write itself is repaired: it no longer names the `(user_id, UTC-day)` index
  expression in its `ON CONFLICT` target — an inference target matching no index raises `42P10` and
  fails the insert outright, which is how a database whose index build stalled could end up
  recording nobody at all — and it now guards with `WHERE NOT EXISTS`, keeping a bare
  `ON CONFLICT DO NOTHING` as the race-closer where the index does exist. A failure is logged with
  its reason (rule 137) instead of vanishing.
  (c) a new adoption row, `adoption.active_members`, reports the plain headcount of members who
  turned up in the week, next to the average that reads as "Daily Active Members". The average's
  divisor also moved from `CURRENT_DATE` (database session timezone) to UTC, matching the day
  boundary the member-days use.
  `ctf/scripts/audit-active-members.mjs` prints a week's member-days per source so an operator can
  see which source a low number came from; it only runs `SELECT`s and never names a member.
  Registered `wp_adoption_active_members` and rewrote `wp_adoption_daily_active_members` in
  `ctf/config/canonical_metrics.yaml`; added `feed_community_posts` to the `dataAccess` lists of
  `weekly-performance.metrics.get` and `weekly-performance.comparison.get`. No schema, route, or
  access-policy change.

- 2026-08-15: **The dashboard reports daily active members again (owner report: "Weekly performance
  does not have a state on daily active users").** The 2026-07-18 rebuild dropped every sign-in
  number, so the dashboard could say what members had done but not how many of them turned up, and
  the only active-user figure left in the plugin was a rolling last-7-days count the
  `/current-week` route returns and no screen renders. A new adoption row,
  `adoption.daily_active_members`, is computed per selected week in
  `lib/weekly-performance/live-metrics.ts` from `login_events`: the average number of distinct
  members active on a day of that week, divided by the days of the window that have already started
  so the live current week is not watered down by days that have not happened yet. It reads as
  "Daily Active Members" in the Adoption section, joins the week-over-week comparison like every
  other row, and is aggregate only — never a per-member figure. It sits under Adoption rather than
  Value on purpose: logging in is not a plugin's defining action and still carries no weight in
  value scoring. Registered as `wp_adoption_daily_active_members` in
  `ctf/config/canonical_metrics.yaml`, and `login_events` is added to the `dataAccess` lists of
  `weekly-performance.metrics.get` and `weekly-performance.comparison.get`. No schema, route, or
  access-policy change. Section 6's metric list, which still described the pre-2026-07-18 set, is
  replaced with the shipped one.
- 2026-08-10: **The week history now starts at the launch week (owner report).** The picker listed
  weeks going back a year, so it offered windows from before the platform existed (Apr 2026 and
  earlier) that could only ever read zero. `listWeeks` (`lib/weekly-performance/repository.ts`) now
  floors both the generated run and the stored rows at the week containing the launch date, so the
  oldest entry is the week of Jun 8–14, 2026. The launch date moved out of the GDP shell into a
  platform-owned constant, `PLATFORM_LAUNCH_DATE_ISO` in `ctf/packages/web/lib/platform/launch.ts`;
  GDP's `COMMUNITY_VALUE_INDEX_SINCE_DATE_ISO` now reads that constant, so its on-screen line
  ("Cumulative since June 12, 2026") is unchanged and both surfaces can never disagree about the
  date. Selecting the launch week shows no week-over-week comparison, because there is no earlier
  week to compare against — the shell already handles the oldest week that way. No schema, route,
  or contract change.
- 2026-07-19: **Fixed the week picker's skipped weeks and ugly mobile labels; deleted the export feature (owner report).** (1) *Week list skipped weeks.* `listWeeks` (`lib/weekly-performance/repository.ts`) previously returned only stored weeks plus the synthesized current week, so the picker jumped straight from an old stored week to the current one. It now generates a continuous run of weeks — the current week (ISO Monday start) back to the earliest of one year ago or the oldest tracked week — unioned with stored weeks so none is dropped; generated weeks with no row read `open` and compute live per window. Both web and Android benefit (shared `/weeks` route). The week **start day is unchanged** (ISO Monday, per owner: v3 does not need the V2 Saturday boundary). (2) *Ugly mobile labels.* The mobile-responsive web week selector showed the raw ISO date (`Week of 2026-07-13`); it now shows the friendly range (`Week of Jul 13–19, 2026`) via `formatWeekRange`, matching desktop. (3) *Deleted the export feature.* Removed the `GET /api/weekly-performance/export` route, every Export button/hint (desktop header, desktop sidebar "Admin Controls" box, mobile-web header button, right-rail "Export available to admins" note, Android history "CSV export is admin-only" hint), the `weekly-performance.report.export` command/access/audit contract entries, and the now-unused `WEEKLY_PERFORMANCE_EXPORT_ENABLED` flag. With export gone the shell's `isAdmin` prop had no remaining UI effect and was dropped (the page still gates admin-only). No schema change.
- 2026-07-18: **Consolidated to a single admin surface (owner directive: "the member view should
  now be removed. Only an admin page for weekly performance").** `/admin/weekly-performance` now
  renders the full dashboard (`weekly-performance-shell.tsx`); the thin review shell
  (`wp-admin-shell.tsx`) is deleted. `/apps/weekly-performance` no longer renders a page — it
  redirects admins to `/admin/weekly-performance` and continues to 404 non-admins (the admin-only
  gate runs first). The admin↔member cross-links are gone with the second surface: the "Member
  view" pill, the dashboard's "Admin" pill, and the sidebar's "Manage weeks" link (all
  self-referential or dead after consolidation). A non-admin hitting `/admin/weekly-performance`
  is sent to `/apps` (there is no member shell to land on). UI/routing only; no schema, API-route,
  or contract change.
- 2026-07-18: **Dashboard rebuilt around the owner-locked value-metric table
  (`ctf/docs/developer/PLUGIN_VALUE_METRICS.md`).** The old near-useless metric set (login counts,
  feed counts, LevelUp *enrollments started*) is replaced in
  `ctf/packages/web/lib/weekly-performance/live-metrics.ts` by three sections, in card order:
  (1) **two goal rows** — GDP Community Value Index week-over-week toward the 300B goal (via the GDP
  plugin's live report) and Workforce recruited toward 2,000,000 (active Directory profiles), both
  snapshotted weekly in the new `weekly_performance_goal_snapshots` table (state metrics need memory
  for week-over-week; the current-week read upserts the live value, past weeks report their stored
  row); (2) **fifteen per-plugin value events** — each plugin's defining action (answered charged
  Foundation calls — aggregate only, rule 132; successful SocketRelay closes; mutually-confirmed
  TrustTransport trips; completed Lighthouse stays; Chyme tips; direct ServiceCredits peer sends;
  confirmed Contributions dollars; accepted SkillsHunt nominations; approved WhatWorks tools +
  endorsements; LevelUp completions + trainer payouts — replacing enrollments-started; confirmed
  Recurring Activity ties; distinct PeerProgramming posters; Beacon engagement per unique broadcast
  via the Commons replay post's reactions/replies); (3) **adoption rows** for Directory (findable
  members), Mood (check-ins + average, aggregate only), and ClickLog (aggregate incidents + distinct
  loggers). GentlePulse and Skills Taxonomy carry no dashboard stats (owner ruling). Web UI groups
  the cards under Goals / Value delivered / Adoption headings, with goal cards showing compact
  values and a progress bar toward the target (`wp-metric-cards.tsx`, `wp-shared.ts`, shared goal
  constants in `lib/weekly-performance/goal-constants.ts`). All 22 metrics are registered in the
  canonical metric registry (`ctf/config/canonical_metrics.yaml`, `wp_value_*` / `wp_adoption_*` /
  `wp_goal_*`), and the command contracts' `dataAccess` lists now name the real upstream reads.
  Android renders the new keys through its existing generic metric list (labels humanized from the
  key); the goal progress *bar* is web-only for now — tracked as a gap. Schema: one new table
  (`weekly_performance_goal_snapshots`), guarded CREATE/ALTER; `schema.demo.sql` regenerated.
  **History guarantees (owner requirement):** the fifteen value events and three adoption rows are
  never stored — any week, however old, recomputes live from the upstream rows, so week 1 vs week 53
  works forever and past weeks recalculate when data changes. The two goal rows are the exception
  (state totals), so a new internal route
  (`POST /api/internal/weekly-performance/goal-snapshot`, bearer `INTERNAL_SERVICE_SECRET`, contract
  `weekly-performance.goal-snapshot.capture`) is called daily by
  `.github/workflows/weekly-performance-goal-snapshot.yml` to record the current week's goal
  readings — goal history never depends on someone opening the dashboard that week.
- 2026-07-17: **History-aware back + admin↔member navigation (app-wide sweep).** The member
  shell's hand-rolled back chevron was replaced by the shared `BackChevronButton` — it returns to
  the previous in-app page and falls back to All Apps when there is no in-app history. The admin
  surface header gained the shared "Member view" pill (`PluginUserShellButton`) linking to
  `/apps/weekly-performance`. UI-only; no schema, route, or contract change.
- 2026-07-15: **Deleted the unreachable public visitor shell (code-review finding #1535).** Weekly
  Performance is admin-only, and the `/apps/[pluginSlug]` route 404s a non-admin before the
  public-shell branch runs, so `weekly-performance-public-shell.tsx` could never render — dead code,
  not a data leak (verified against `app/apps/[pluginSlug]/page.tsx`). Removed the component file and
  its `PUBLIC_VISITOR_SHELLS` registry entry (same treatment the Unlock public shell got). No route,
  schema, contract, or admin-surface change; admin behavior is identical.
- 2026-07-14: **Added refresh controls (app-wide refresh rollout).** Web: shared `RefreshButton` in the desktop dashboard header (`wp-dashboard-main.tsx`, via a new `onRefresh` prop) and the mobile-responsive shell header (`weekly-performance-shell.tsx`), wired to a new `refreshSelectedWeek` callback that silently re-pulls the selected week's metrics and comparison (same silent path as the current-week polling — no flash to the empty state). Android: native pull-to-refresh via `RefreshControl` on the screen's `ScrollView` in `WeeklyPerformance.tsx`; the metrics fetch was extracted into a `loadMetrics` useCallback shared by the week-change effect and the refresh (background mode skips the spinner). UI-only; no schema, route, or contract change.
- 2026-07-01: **Removed the dead nav glyphs from the desktop icon rail.** Owner report: the icon-rail glyphs (a chart, a trend line, a calendar) below the brand mark are not clickable. They were decorative `<div>`s wired to nothing — Weekly Performance is a single dashboard view, so there is nowhere for them to go (the week history already lives in the sidebar and the comparison chart in the main panel). Styled like buttons but inert, they read as broken. `wp-icon-rail.tsx` now renders the brand mark plus the shared `PluginRailFooter` only (back to all apps, account and settings, account menu — all real links), matching the same fix already shipped for Skills Taxonomy and Unlock. Desktop-only chrome; no schema, route, contract, or mobile change.
- 2026-06-29: **Added the V2 non-revenue metric set; cleaned up the admin shell.** Two owner reports. (1) *"Add the same metrics captured in v2 except revenue."* `computeLiveWeekMetrics` was expanded from 5 to 12 metrics, adding total/new members, DAU, MAU, lapsed-members (churn proxy), and aggregate mood (check-ins + average) — every non-financial metric V2 had. Revenue/MRR/ARR/CLV are excluded (V3 is free); verified/approved members are excluded because V3's Clerk-mirror `users` table has no dependable verification/approval timestamp. The web `humanizeMetricKey` now treats the namespace dot as a separator so labels read cleanly. (2) *"Admin dash has a duplicate header. Has active week setting which is wrong."* On mobile the admin shell (`wp-admin-shell.tsx`) rendered its own back/icon/title header on top of the shared `MobileScreenHeader`; that inner header is now desktop-only, leaving one header on each surface. The obsolete "Active week / Set as active week" control (and the per-week open/locked/published status it showed) was removed from both the web admin shell and the Android admin screen (`AdminWeeklyPerformance.tsx`) — since numbers are always live, the admin surface is now a plain pick-a-week-to-review-and-export tool; the current week is marked "Live". The Android admin screen also now renders any metric key generically instead of a fixed four-key allow-list. No schema or contract change: the `weekly-performance.admin.week.select` route and the `status` column still exist; the admin UI just no longer calls or surfaces them.
- 2026-06-29: **Removed the "closed week" concept — weekly numbers are always live (V2 parity).** Follow-up to the same-day auto-populate change below, per owner direction ("I never asked for closed weeks… V3 metrics dash should be the same as v2"). `getWeekMetrics` now always returns the live computation (the stored-snapshot precedence was dropped), so every week reports the real counts for its window the way V2 aggregated on read. The user dashboard no longer shows an open/locked/published status: the current week is marked **Live** (web header pill, sidebar pill, right-rail row; mobile header label and history badge) and past weeks are plain historical windows with no "Closed" badge. "Live" is now determined by whether the selected week is the current calendar week (compared against the server's `DATE_TRUNC('week', NOW())`), not a database status column. The web shell's silent 60s polling + focus refetch is keyed on the current week. The web mobile screen renders any metric key generically (humanized label) instead of a fixed four-key allow-list, so the live engagement metrics show on parity. No schema, route, or contract change — the `status` column and the admin week-selection plumbing are untouched; the dashboard simply stops surfacing a closed state.
- 2026-06-29: **Weekly numbers now auto-populate live.** The dashboard previously sat on a "metrics appear when the week closes" placeholder until an admin closed the week — but nothing ever wrote a snapshot, so the open week stayed empty. `getWeekMetrics` (`lib/weekly-performance/repository.ts`) now falls back to a new `computeLiveWeekMetrics` (`lib/weekly-performance/live-metrics.ts`) when a week has no stored rows: it counts the week window from upstream tables (active members from `login_events`, questions/answers/community posts from the feed tables, enrollments from `level_up_enrollments`), all non-financial and table-existence-guarded. A stored snapshot still takes precedence. The web shell (`components/weekly-performance/weekly-performance-shell.tsx`) now silently re-fetches the current (open) week every 60s and on tab focus so the numbers keep moving; closed weeks are not polled. Web and mobile in-progress empty-state copy updated to describe live numbers (the empty state is now effectively only a transient/error fallback, since the live path always returns the full metric set). No schema, route, or contract change — same `GET /api/weekly-performance/metrics` surface and audit behavior.
- 2026-06-27: **Closed the two deferred weekly-performance code-review findings (#1128, #1130).** (1) #1130 — added `GET /api/weekly-performance/weeks/[weekStart]`, the full `weekly-performance.week.get` surface: it accepts an arbitrary `weekStart` (validated as an ISO `YYYY-MM-DD` date) and returns `{weekStart, weekEnd, isCurrentWeek, status}` derived from the date (backed by a new `getWeekWindow` repository helper), 404 when the date resolves to no window, and writes a `weekly-performance.week.get` audit row. `/current-week` remains the current-week-only convenience projection of the same command. (2) #1128 — reconciled the `weekly-performance.report.export` command and access-policy contracts to the shipped behavior: the export is a synchronous inline JSON download (`{ok, weekStartDate, metrics}`), so the unbuilt `{exportId, status, artifactUrl, expiresAt}` output, the unbuilt `weekly_performance_exports` dataAccess entry, the never-read `format`/`includeComparison` inputs, the `exportFormatPolicy` attribute, and the `invalid_export_format` deny condition were removed; the route's real gate (`WEEKLY_PERFORMANCE_EXPORT_ENABLED`) is now reflected as the `export_disabled` deny condition. This is contract-to-reality alignment, not a feature removal — a real async artifact pipeline (with a `weekly_performance_exports` table) can be added later if wanted. No schema change.
- 2026-06-27: **Resolved the weekly-performance code-review sweep findings.** (1) Every read/export route now writes a `weekly_performance_audit_trail` row on an allow decision, so `week.list`, `week.get`, `metrics.get`, `comparison.get`, and `report.export` are all audited per the audit contract (was: only the admin week-selection mutation wrote an audit row). (2) The admin gate (`ensureWeeklyPerformanceAdmin`) now admits the `operations` role as well as `admin`, matching the access-policy contract `requiredRoles: [admin, operations]`. (3) The mobile regular screen now shows an "Access restricted" state for members without the admin/operations role instead of silent API failures; the mobile `AuthUser` now carries the normalized `role` claim. (4) The command and audit contract YAMLs were aligned to the shipped table names (`weekly_performance_week_windows` -> `weekly_performance_weeks`, `weekly_performance_metric_snapshots` -> `weekly_performance_metrics`, `weekly_performance_audit_log` -> `weekly_performance_audit_trail`) — documentation alignment only, no schema or table rename. (5) Web-shell fixes: `randomUUID` now uses the runtime-global `crypto.randomUUID()` (Edge-safe), the declining-metric card shows a downward-trend icon, and `ComparisonResponse.comparison` is typed optional/nullable to match the route. No schema change.
- 2026-06-25: **Documented the two owned storage tables** (inventory-debt burn-down — documentation catch-up, no code change). Added `weekly_performance_metrics` (per-week aggregate store) and `weekly_performance_audit_trail` (admin allow/deny audit log) to §3.1, each from its `schema.sql` definition. Removed these two tables from `ctf/scripts/inventory-drift-allowlist.json`.
- 2026-06-16: The active-member signal now has a writer. The current-week active-member count (`GET /current-week`) reads `login_events` via `countActiveUsersLastDays`, but nothing wrote that table, so the count was always 0. Added `recordLoginEvent` (`lib/engagement/login-activity.ts`), called from the shared access gate for every signed-in member (deduplicated to one row per member per UTC day), which now populates the table this review reads. No schema, route, or contract change here (the writer lives in shared engagement/auth code); the same fix unblocked PeerProgramming weekly cohort assignment, which reads the same table.
- 2026-06-16: The current week is now always shown, even before any metrics exist for it. Previously, when the `weekly_performance_weeks` table had no rows (the normal state in production until upstream metrics are recorded), `listWeeks()` returned an empty list and `getCurrentWeek()` returned `null`, so the admin surface rendered only a bare "No weeks are tracked yet" message. `lib/weekly-performance/repository.ts` now synthesizes the current week (open, derived from `DATE_TRUNC('week', NOW())`) at read time in both `listWeeks()` (via a `UNION` that adds the current week when absent) and `getCurrentWeek()` (via a `LEFT JOIN`), so the dashboard and admin shells render their normal structure with zero/empty values instead of a blank page. The synthesized week is persisted only when an admin sets it active: `selectWeek()` now inserts the row on first activation when no row exists yet (the table has no unique constraint on `week_start_date`, so an `UPDATE`-then-`INSERT` is used rather than an upsert). Web and Android both consume the same read routes, so this fixes parity for free. No schema or contract change.
- 2026-06-12: The Android Weekly Performance API client (`packages/mobile/src/features/weekly-performance/api.ts`) now uses the shared authenticated fetch helper, which attaches the signed-in user's Clerk bearer token and reads the server address from runtime config (`APP_URL`), replacing plain fetch calls against hardcoded development URLs. No schema, route, or contract change.
- 2026-06-06: Turned the Weekly Performance admin page from a thin stub into a real, mobile-responsive admin UI and added an Android admin screen. Web: `app/admin/weekly-performance/page.tsx` now renders the new client shell `components/weekly-performance/wp-admin-shell.tsx` (same admin gate as the other admin pages; `useIsMobile()` responsive); surfaces week selection (`PUT /api/weekly-performance/admin/week-selection`, CSRF header), the selected week's metrics (`GET /api/weekly-performance/metrics`), and export (`GET /api/weekly-performance/export`), with loading/empty/populated and success/error states. Android: added `AdminWeeklyPerformance.tsx` (design `MobileWeeklyPerformanceAdminView.tsx`), admin-gated and registered in `App.tsx`, with a `selectActiveWeek` helper added to `api.ts`. Fabricated plugin breakdown and daily bar chart from the mockup omitted (no backing API field). Noted the week-selection command/contract gap (section 7). No schema change.
- 2026-05-31: Android pixel pass (design `MobileWeeklyPerformance.tsx`). Rewrote `packages/mobile/src/features/weekly-performance/WeeklyPerformance.tsx` to align with canonical mockup; introduced `api.ts` binding to real routes (`/weeks`, `/current-week`, `/metrics`). Four states: Loading, Public, Empty, Populated. Metric cards keyed on real `metricKey` fields. Daily chart omitted (no backing API field). Mock data retired. No schema/API/contract change.
- 2026-05-29: Web UI circle-back (design `c5d83c0`; unblocked by the design re-pin). Rebuilt the user-facing weekly-performance shell from the baseline server summary to the full client dashboard in `WeeklyPerformance.tsx` (+ Empty/Loading), wired to the documented read routes and the admin export. Decomposed into modular sub-components (`wp-shared`, `wp-loading`, `wp-icon-rail`, `wp-sidebar`, `wp-metric-cards`, `wp-comparison-chart`, `wp-empty-main`, `wp-dashboard-main`, `wp-right-rail`, plus the shell). Real data only; the dummy daily chart became a real this-week-vs-last-week per-metric comparison and the unbacked "Top Apps" widget was omitted. No schema/API change.
- 2026-05-18: Replaced "Web and Android Parity Notes" with canonical "Web and Android Delivery Status" (`web+android complete`). Renamed "Open Decisions" to canonical "Gaps and Known Technical Debt" and removed Android-parity-milestone entry per Rule 105.
- 2026-02-25: Created initial Weekly Performance plugin inventory.
- 2026-02-25: Updated Weekly Performance plugin scope to remove financial/revenue metric reporting from dashboard parity.


## Build Checklist


### Scope and Boundary

- [ ] Confirm implementation scope is `ctf/` only.
  - Acceptance criteria:
    - No implementation work is required in `platform/`.
- [ ] Confirm plugin slug and namespace lock.
  - Acceptance criteria:
    - Stable plugin slug is `weekly-performance` across inventory, contracts, and routes.

### �� Contract Lock

- [ ] Define v1 plugin command contracts.
  - Acceptance criteria:
    - Command set conforms to `.claude/rules/201-plugin-command-schema-template.mdc`.
- [ ] Define v1 access policy contracts.
  - Acceptance criteria:
    - Each command includes role/attribute checks, legal basis metadata, and deny conditions under `.claude/rules/202-plugin-access-policy-schema-template.mdc`.
- [ ] Define v1 audit contracts.
  - Acceptance criteria:
    - Each command has allow/deny and result audit coverage under `.claude/rules/203-plugin-audit-schema-template.mdc`.
- [ ] Lock week-boundary and metric dictionary semantics.
  - Acceptance criteria:
    - Week start policy and non-financial metric formulas are documented and approved.

### �� Schema and Migrations

- [ ] Define weekly performance plugin tables/materializations in `ctf/migrations/`.
  - Acceptance criteria:
    - Week windows, metric snapshots, and comparison entities are represented.
- [ ] Define retention and rebuild strategy for aggregated metrics.
  - Acceptance criteria:
    - Retention class, recompute policy, and rollback/replay notes are documented.

### �� API and Policy Implementation

- [ ] Implement admin week list/get and metrics/comparison endpoints.
  - Acceptance criteria:
    - Required fields and deterministic ordering match command contracts.
    - `weekStart` parsing/validation and default-week behavior are deterministic and contract-documented.
- [ ] Implement current-week polling policy.
  - Acceptance criteria:
    - Polling and focus-refetch behavior are enabled only for current-week queries.
- [ ] Implement report export mutation path (if in locked scope).
  - Acceptance criteria:
    - Export action is policy-gated, replay-safe, and contract-tested.
- [ ] Enforce deny-by-default policy checks server-side.
  - Acceptance criteria:
    - Unauthorized role/scope access is denied with stable reason categories.

### �� Web and Mobile Parity

- [ ] Deliver web admin weekly review surface.
  - Acceptance criteria:
    - Week selector, metrics cards, and comparison table are functional and contract-aligned.
    - Previous/current/next controls enforce future-week guardrails.
    - Loading/empty/missing-metrics/error states are deterministic and testable.
- [ ] Deliver Android parity for approved operator read scope.
  - Acceptance criteria:
    - Android outputs equivalent metric values and week semantics for parity scope.
- [ ] Validate cross-platform consistency.
  - Acceptance criteria:
    - Error/deny semantics and metric formatting are equivalent across platforms.

### �� Security and Compliance

- [ ] Verify authz/authn controls for all plugin routes.
  - Acceptance criteria:
    - Admin-protected endpoints enforce server-side RBAC/ABAC and session requirements.
- [ ] Verify CSRF controls for mutation routes.
  - Acceptance criteria:
    - All state-changing endpoints reject missing/invalid CSRF tokens.
- [ ] Verify audit evidence coverage.
  - Acceptance criteria:
    - Allow/deny outcomes and report exports are captured with actor/action/outcome/timestamp correlation fields.

### �� Validation, Seeds, and Release Gates [MVP: VALIDATION DEFERRED — see Rule 118.]

- [ ] Command/access/audit parity design documentation.
  - Acceptance criteria:
    - Command names and required fields are documented across contract files.
- [ ] Week selection and comparison design documentation. [MANUAL TESTING DEFERRED FOR MVP — see Rule 118.]
  - Acceptance criteria:
    - Current/previous week calculation behavior is documented.
    - Current-week-only polling and focus-refetch behavior are documented.
- [ ] Deterministic seed fixtures for weekly metrics scenarios.
  - Acceptance criteria:
    - Seeded week datasets are reproducible via deterministic seed scripts/data.
- [ ] Release gate review.
  - Acceptance criteria:
    - Inventory + checklist are updated in the same PR as accepted scope changes.

### Open Decisions Tracker

- [ ] Final v1 export/report scope.
- [ ] Final Android operator parity breadth.
- [ ] Final non-financial metric set for v1 GA.
- [ ] Final mood-field inclusion decision for comparison outputs.

### Change Log

- 2026-02-25: Created initial Weekly Performance rewrite checklist with contract, schema, API/policy, parity, security/compliance, and validation/release phases.
- 2026-02-25: Updated checklist scope to enforce non-financial weekly metric parity for v1 dashboard reporting.
