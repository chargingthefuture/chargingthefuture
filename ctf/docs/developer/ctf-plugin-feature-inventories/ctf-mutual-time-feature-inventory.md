# Mutual Time Plugin Feature Inventory

## Scope and Boundary

Mutual Time is a one-link meeting-time picker (spec #1780). An admin (the platform owner) creates an
event that has a single shareable link. Approved members open that link and pick up to three one-hour
windows — snapped to the half-hour — in their own timezone. When the survey closes, the app chooses the
window the most members can make (ties go to the earliest) and shows it, in each viewer's own timezone,
with a link to where the meeting happens (Chyme, Peer Programming, or Beacon).

- **In scope:** owner/admin event creation and manual close; a public shareable link with three viewer
  states (vote / result / sign-in gate); timezone-aware voting; the most-overlap algorithm; auto-close
  at a set close time; a rolling seven-day window of times while the survey is open.
- **Out of scope:** any ServiceCredits/money (there are none here); a public directory of events (events
  are shared as direct links, never listed); recurring events; native Android (web + mobile-responsive
  only, per rule 105 — Mutual Time is not on the Chyme keep-list).

## Intent and Outcome

Give the owner a Doodle-style way to find a time a group can meet, using one link shared on Quora or
Signal, without collecting anyone's calendar. The outcome is a single chosen one-hour window and a link
to the meeting surface; members who did not vote can still come listen in.

## User Features

1. **Vote on a shared link.** An approved member opens `/mutual-time/<slug>`, sees the event, and picks
   up to 3 one-hour windows they're free — in their own timezone, auto-detected and changeable (for a
   VPN or travel). Slots are shown as date chips with Morning/Afternoon/Evening groups; a member can
   revise or clear their picks any time while voting is open.
   The days on offer are always the next seven days counted from the moment they open the link, so a
   survey that has been open for a while still shows upcoming days, never days that have gone by.
2. **See the chosen time.** After the survey closes, the same link shows the winning time in the
   viewer's own timezone, how many members can make it, and a "Go to <plugin>" link to the meeting.
3. **Listen-in for everyone.** A signed-out or not-yet-approved visitor can still open the link: they
   see the event and a message that they can come listen in at whatever time is chosen — the link is
   their invite. They are shown a sign-in prompt if they want a say in the time.
4. **See the days and times before signing in.** Under that sign-in prompt, a visitor sees the real
   voting form — the same day chips and one-hour windows a member picks from — grayed out and not
   tappable, with the line "Here are the times on offer — sign in to pick yours". They can see exactly
   what they would be choosing from before they decide to sign in.
5. **Know where the meeting is, from the moment the link opens.** Every state of the shared link —
   before voting opens, while voting is open, for a signed-out visitor, and after the time is chosen —
   shows "We'll meet in <plugin>" with a button straight to that plugin (for example Chyme, at
   `/apps/chyme`). It no longer waits for the survey to close.
6. **A way back off the survey.** A signed-in member sees the standard top bar on the shared link —
   back chevron, brand icon, "Mutual Time", and the bug / settings / account controls — the same bar
   every other screen has. A signed-out visitor sees the shared back chevron next to the event name,
   and only when there is somewhere in-app to go back to.
7. **Copy the link.** Every surface has a Copy-link button (rule 130) for sharing the one event link.
8. **Told when a pick of theirs has gone by.** Because the days on offer roll forward, a time a member
   picked last week can fall behind the current moment. Their expired picks stop counting and are taken
   off their list, and the voting form tells them so — "One time you picked earlier has now passed, so
   it no longer counts. Pick from the days below and save again." — instead of dropping the vote
   silently. Their remaining upcoming picks are untouched.

## Admin Features

1. **Create an event** at `/apps/mutual-time`: optional title, optional description, a "Where we'll
   meet" plugin (Chyme, Peer Programming, or Beacon), and optional survey open/close date-times. Leaving close
   blank means the admin closes it manually.
2. **Manage events:** the dashboard lists the admin's events with voter counts, a status pill
   (scheduled / open / closed), Copy-link, View, "Close and choose the time", and — once closed — the
   chosen time and how many can make it.
3. **Audit log panel** at the bottom of the admin dashboard. Lists every admin action on Mutual Time
   newest first — opening an event, closing one — **including the ones that were refused, and why**
   ("Refused · Because the event was already closed"). Reads
   `GET /api/mutual-time/admin/audit-events?limit=200`; loads lazily on first expand.
3. **Close and choose:** closing runs the most-overlap algorithm and stamps the winning window. A survey
   with a set close time auto-closes when that time passes. Only windows still ahead of the moment of
   closing can win, so closing a long-open survey can never stamp a time that has already been and
   gone; if every vote had passed, the link says so and no time is chosen.
4. **A dot on the admin landing when there is something to act on.** The Mutual Time tile on `/admin`
   carries the shared "new to review" dot (see the non-plugin inventory §1.14) in two cases, both for
   the surveys this admin created: somebody picked times on one of their still-open surveys, or one of
   their surveys reached its close time and chose a time without them. That is the cue to open the
   dashboard and decide when to go live. A survey nobody has voted on raises nothing — it simply stays
   open until someone picks — and a survey the admin closed by hand raises nothing either. Opening the
   tile clears the dot.

## API Surface and Route Map

All routes under `ctf/packages/web/app/api/mutual-time/`:

- `GET /api/mutual-time/events` — the admin's own events (dashboard list). Admin-only. Auto-closes any
  due events before returning.
- `POST /api/mutual-time/events` — create an event (returns the event + slug). Admin-only. CSRF-guarded.
- `POST /api/mutual-time/events/[eventId]/close` — close a survey now and compute the winner. Admin-only
  (and the creator). CSRF-guarded.
- `GET /api/mutual-time/admin/audit-events` — admin read of `mutual_time_admin_audit_trail`, newest first. Optional `?limit=` (default 100, capped at 200). Returns `{ events }`. Backs the Audit log panel on the dashboard.
- `GET /api/mutual-time/event/[slug]` — **public** read of one event (title, description, status,
  candidate slots, result). Rate-limited per IP. A signed-in approved member also gets `viewer.canVote`,
  their own upcoming picks, and `viewer.expiredPicks` (how many of their picks were for times that have
  since passed); never returns anyone else's votes.
- `POST /api/mutual-time/event/[slug]/vote` — save (replace) the signed-in, Unlock-approved member's
  picks (up to 3 half-hour-snapped one-hour windows). CSRF-guarded. Rejected if the event is not open or
  a pick is not a valid candidate slot — which now includes a pick whose time passed while the form sat
  open (same error code, wording that names the reason).

## Data Model and Storage Contracts

Defined in `ctf/schema.sql` (CREATE TABLE IF NOT EXISTS + ALTER TABLE IF EXISTS ADD COLUMN IF NOT EXISTS
+ indexes):

0. `mutual_time_admin_audit_trail` — the durable admin audit trail (added 2026-08-28). Columns `id`,
   `actor_id`, `command`, `policy_status` (`allow`/`deny`), `reason`, `target_type`, `target_id`,
   `result` (`success`/`failure`), `error_category`, `metadata` (jsonb), `created_at`, indexed
   `(created_at DESC, actor_id, command)`. One row per admin action, written by
   `recordMutualTimeAdminAudit` on every outcome including a refusal. **Holds no voter identity** —
   the acting admin's id and the event acted on — so it is retained on account deletion.
1. `mutual_time_events`
   - One row per event, keyed by `id`, with a unique shareable `slug`. Columns: `created_by_user_id`
     (the admin creator), `title` (nullable), `description` (nullable), `meeting_plugin`
     (`chyme|peer-programming|beacon`), `window_start_date` (UTC date recorded at creation; it anchors
     the candidate window only for a closed survey — while a survey is open the window rolls forward
     from the current moment instead),
     `window_days` (default 7), `opens_at` (nullable — null opens immediately), `closes_at` (nullable —
     null closes manually), `status` (`open|closed`), `result_slot_start` (winning UTC slot, nullable),
     `result_can_make_it` (count, nullable), `created_at`, `closed_at` (nullable), `auto_closed`
     (boolean, default `FALSE` — `TRUE` when the survey closed itself at `closes_at` rather than an
     admin pressing Close; the admin-landing dot keys on it). Indexed by slug (unique) and by creator.
2. `mutual_time_votes`
   - One row per (event, voter, slot): `event_id` (FK → `mutual_time_events(id)` `ON DELETE CASCADE`),
     `voter_user_id`, `slot_start_utc` (the one-hour window start), `created_at`. Unique on
     `(event_id, voter_user_id, slot_start_utc)`; indexed by `(event_id, slot_start_utc)` and by voter.
     Candidate slots are computed from the event window (`window_days` × 48 half-hour starts/day) and
     never stored — only cast votes are stored. The window is anchored by
     `candidateWindowStartMs` in `lib/mutual-time/repository.ts`: the next half-hour from now while the
     survey is open, the opening moment while it is scheduled, and `window_start_date` once it is
     closed. A stored vote whose `slot_start_utc` has passed stays in the table but is ignored
     everywhere — it is left out of the voter count, out of the winner computation, and out of the
     member's own pick list.

## Security, Privacy, and Compliance Controls

1. **Three access tiers.** Create/close: admin-only (`evaluatePluginAccess({ requiredRoles: ['admin'] })`;
   close also checks the actor is the event's creator). Vote: signed-in AND Unlock-approved
   (`minUnlockTier: 'approved_full'`). Read: public/anonymous, rate-limited per IP.
2. **Every admin action writes a durable row to `mutual_time_admin_audit_trail`** via
   `recordMutualTimeAdminAudit`, which also emits the observability line — on success, on a refusal,
   and on a persistence failure. Before 2026-08-28 `logMutualTimeAudit` wrote the event to the
   server's log alone, so closing an event people had put their time into left no record anyone
   could read back. The row names the event and the acting admin, never a voter. Voting keeps the
   log line alone: a row per member's picks would be volume, not accountability, and it is a
   member's action rather than an admin's.
3. **CSRF / same-origin.** Every mutation requires the `x-ctf-csrf: '1'` header and a same-origin check
   (`ensureMutationCsrf`). The admin event-list read (`GET /api/mutual-time/events`) additionally runs a
   same-origin `checkMutationOrigin` check (missing-Origin same-origin requests still pass) so a
   credentialed cross-origin page cannot read the admin's slugs/voter counts.
4. **Privacy.** Individual votes are never exposed publicly. The public read returns only aggregate
   fields (voter count; after close the winning slot + how many can make it) plus, for a signed-in
   approved member, that member's own picks for hydration.
5. **No credits.** No command reads or moves ServiceCredits.
6. **Deletion.** A member's votes, and any events they created (cascade), are removed on service/account
   deletion — declared in `lib/account/deletion-registry.ts` (`mutual-time`) and validated by
   `check-deletion-registry.mjs`. See `MUTUAL_TIME_PROFILE_AND_DELETION_CONTRACT.md`.
7. **Timezone safety.** Overlap is computed in UTC; each viewer's UI renders the same UTC candidate
   instants in their own timezone, so votes compare correctly across timezones (including half-hour zones).

### Trust Signal Coverage

**Trust signal: NOT APPLICABLE.** Mutual Time is scheduling metadata, not member participation evidence.
Availability votes are private (never shown to other members) and event creation is admin-only, so there
is nothing safe or meaningful to surface as a public Trust signal. Per rule 132, a read-only/aggregation
or admin-authored plugin records Trust as not-applicable rather than adding a numeric signal — no metric
is added to `TrustSignalMetrics`, `computeTrustSignalMetrics`, or `buildTrustEvidence`, and
`TRUST_SNAPSHOT_MODEL` is unchanged.

## Web and Android Delivery Status

- **Web:** complete — admin dashboard (`/apps/mutual-time`), the public one-link surface
  (`/mutual-time/[slug]`) with vote/result/gate states, and all API routes. The day chips and slot grid
  live in `components/mutual-time/mutual-time-slot-picker.tsx` so the voting form and the grayed-out
  preview on the sign-in gate are the same component, not two that can drift apart.
- **Mobile-responsive web:** complete — the same web components render at phone width (single-column
  layout, horizontally scrollable date chips, wrapping slot grid).
- **Android:** **out of scope (web-only per rule 105).** Mutual Time is not on the Chyme keep-list; there
  is intentionally no React Native surface. The meeting the result points to (Chyme / Peer Programming /
  Beacon) is where any native experience lives, not the scheduling.

## Seed Coverage Status

Deterministic seed at `ctf/scripts/seedMutualTime.mjs` (pnpm `seed:mutual-time`). Seeds two events — one
open ("Weekly check-in", no close date, spread of votes) and one closed ("Q3 onboarding", with a
computed winning time) — plus sample votes, using fixed slugs + `ON CONFLICT DO NOTHING` so it is
idempotent. The open event is anchored to the day the seed runs — its votes land on the days after it,
inside the rolling window, so the sample overlap is always still ahead and its votes are replaced on
each run rather than piling up. The closed event keeps a fixed past window (`2026-07-21`, 7 days), which
keeps that half reproducible; its stamped result stands.

## Gaps and Known Technical Debt

1. **Target meeting week is derived, not configured.** The candidate window is 7 days, rolling forward
   from the current moment while the survey is open (from the opening moment while it is scheduled).
   Letting the admin pick a specific target week separately from the survey open/close times is a
   documented follow-up — until then, an admin who needs a fixed week sets a close time and closes
   before it passes.
2. **A survey with no close time still needs a person to end it.** The rolling window keeps an
   unattended survey usable indefinitely, but nothing chooses a time on its own: the admin presses
   "Close and choose the time" (owner decision, 2026-08-12 — a default close date was considered and
   turned down). The admin-landing dot is the prompt that there is something to look at; the dashboard
   itself has no per-survey "new since you last looked" marker, because opening the tile clears the
   dot before the dashboard renders. Which survey is new has to be read off the voter counts.
3. **Full 24h candidate grid.** To let anyone in any timezone find a free hour, the candidate grid spans
   all 24 hours (48 half-hour starts/day). Members see them grouped by their local Night/Morning/
   Afternoon/Evening; a future refinement could let the admin bound the daily hours.
4. **No reminder/notification** when a time is chosen — members re-open the link to see the result. A
   push/notification tie-in is a possible follow-up.

## Change Log

- 2026-08-28: **Every Mutual Time admin action is recorded in a table an admin can read, including the ones that were refused.** Owner directive: every admin action is recorded, on every surface, from the day the surface ships. `lib/mutual-time/audit.ts` built the entire contract-shaped event and ended in `console.info` — a line in the server's log, which nothing can query, no screen can show, and which ages out of the host's retention window. Opening an event and closing one decide what members can put their time into, and closing one people had already voted in left nothing behind. New table `mutual_time_admin_audit_trail` (actor, command, policy status, reason, target, result, error category, metadata, timestamp; indexed newest-first by actor and command). New `recordMutualTimeAdminAudit` writes the row **and** the log line, and both admin mutation routes use it on every outcome. It never throws: an audit write that failed would otherwise turn a completed close into a 503 and have an admin repeat a close they had already made. New `GET /api/mutual-time/admin/audit-events` and an **Audit log** panel at the bottom of the admin dashboard, reading the most recent 200 with plain-language labels ("Opened an event", "Closed an event", "Refused · Because the event was already closed"). **Voting keeps the log line alone** — a row per member's picks would be volume, not accountability, and it is a member's action rather than an admin's, so the trail holds no voter identity. Verified against a scratch Postgres running the shipped `schema.sql` verbatim: the table and its index are created, the migration re-runs clean, and the shipped INSERT and SELECT round-trip an event opened, one closed, and a close refused because the event was already closed. Mutual Time's two routes leave the admin-audit-coverage burn-down list.
- 2026-07-20: **Initial build (spec #1780).** New plugin: `mutual_time_events` + `mutual_time_votes`
  tables; API routes under `/api/mutual-time/`; admin dashboard `/apps/mutual-time`; public one-link
  surface `/mutual-time/[slug]` (vote / result / sign-in-listen-in gate); timezone-aware voting (up to 3
  half-hour-snapped one-hour windows); most-overlap algorithm with earliest-time tiebreak and auto-close
  at a set close time; rose accent (`#F472B6`) registered; registry entry, deletion-registry entry,
  four contracts, seed, this inventory, and the test script. No credits; Trust N/A; web +
  mobile-responsive only. Built from the Replit design mockups as intent, recreated with the app's
  existing plugin-shell tokens per the production-era design policy.
- 2026-07-21: **Fix — plugin missing from the launcher.** The initial build registered Mutual Time in
  the code fallback registry (`lib/plugins/repository.ts`) but not in the inline `ctf_plugin_registry`
  seed in `schema.sql`. Because the launcher list (`listPluginRegistry`) reads the DB registry and only
  falls back when the DB is empty, Mutual Time was absent from the app launcher on any DB that already
  had the other plugins seeded — the `/apps/mutual-time` page worked by direct URL (via `getPluginBySlug`
  fallback), but there was no link to it, so admins could not reach the create/manage dashboard ("not
  linked anywhere; cannot create a poll"). Added the `mutual-time` row (nav_rank 250, visible) to the
  `schema.sql` registry seed. Takes effect when `schema.sql` is applied to the database on deploy.
- 2026-07-22: **Code-review fixes (issues #1803–#1809).** No behavior change to the happy path.
  (1) Audit lines now carry the contract's `policyDecision.evidence` (`role=admin`,
  `role=admin;owner=true`, `unlockTier=approved_full`) so the emitted audit satisfies
  `MUTUAL_TIME_PLUGIN_AUDIT_CONTRACTS.yaml` (#1807). (2) `GET /api/mutual-time/events` adds a same-origin
  check so the admin's event list cannot be read cross-origin (#1806). (3) The public vote view now
  reconciles the viewer's `canVote`/`picks` from the post-save refresh instead of the load-time snapshot
  (#1805). (4) `saveVote` rejects a non-string pick element as `invalidPayload` (distinct from a
  valid-but-unknown slot's `invalidSlot`) (#1804). (5) The admin list computes voter counts in one query
  (correlated subquery) instead of one round-trip per event (#1809). (6) Comments added explaining why
  `createEvent` always stores `status='open'` (scheduled is derived by `effectiveState`) (#1803) and the
  deliberate slug-vs-id route split (public slug surface vs admin id surface) (#1808).
- 2026-07-22: **Admin-only surfacing + admin-form overflow fix.** (1) Mutual Time is now in
  `ADMIN_ONLY_PLUGIN_SLUGS` (`lib/plugins/repository.ts`), so it no longer appears as a tile in a
  non-admin member's apps launcher — creation is admin-only and members only ever reach an event via its
  shared link, so a member-facing launcher tile was misleading. Admins still reach it from the admin area
  grid (`/admin`, added in #1829) and their own launcher; `/apps/mutual-time` stays reachable (page
  visibility unchanged). (2) The create-event form's "Survey opens / Survey closes" `datetime-local`
  fields were a two-column grid that overflowed the phone-width column ("falling off the page"); they now
  stack in a single column.
- 2026-07-22: **Admin-only route + shared top nav.** `/apps/mutual-time` is now admin-only: the page
  gates with `evaluatePluginAccess({ requiredRoles: ['admin'] })` and a non-admin gets a 404. The
  member-facing explainer (`mutual-time-member-info.tsx`) is deleted — there was no use for it, since
  members only ever reach an event through its shared link (`/mutual-time/<slug>`), never
  `/apps/mutual-time`. The admin dashboard now renders the shared `MobileScreenHeader` top nav (accent
  back chevron + brand icon + title + the bug/settings/avatar actions), matching every other page.
- 2026-08-09: **Beacon added to "Where we'll meet" + the date fields stopped running off the screen.**
  (1) `beacon` is now a third choice in the meeting-plugin list, alongside Chyme and Peer Programming:
  added to `MUTUAL_TIME_MEETING_PLUGINS`, to the display-name map (`Beacon`), to the command-contract
  enum and the audit contract's target context, and to the `meeting_plugin` check in `schema.sql`
  (plus a drop-and-re-add of `mutual_time_events_meeting_plugin_check` so a database created before
  today accepts the new value too). The result link points at `/apps/beacon`, the same
  `/apps/<slug>` shape as the other two. (2) The two "Survey opens / Survey closes" date-and-time
  fields ran past the right edge of the card on a phone. A grid column sized `1fr` keeps a floor of the
  item's own minimum width, and a `datetime-local` control reports a minimum wider than the phone-width
  column, so the column grew and took the field with it. The column is now `minmax(0, 1fr)`, each
  wrapper carries `minWidth: 0`, and the shared input style carries `maxWidth: 100%` — the fields line
  up with the title, description, and dropdown above them.
- 2026-08-09: **The shared link now previews the form, names the meeting place, and stops offering to
  clear picks nobody made.** All on `/mutual-time/<slug>`; no schema, contract, or API change.
  (1) A signed-out or not-yet-approved visitor used to see only a locked box. They now see the sign-in
  prompt with the real voting form below it — the same day chips and one-hour windows a member picks
  from — grayed out, not tappable, not keyboard-focusable, and skipped by screen readers, under the line
  "Here are the times on offer — sign in to pick yours". The reason to sign in is visible instead of
  described. (2) "We'll meet in <plugin>" with a button to that plugin now shows on every state of the
  link, not just after the survey closes: the gate, the not-yet-open state, and the voting form. The
  candidate slots and the meeting plugin were already in the public read, so nothing new is exposed.
  (3) The button under the grid read "Clear my picks" whenever nothing was selected — including on a
  first visit, where there was nothing to clear. It now tracks what the server holds separately from
  what is selected on screen: "Save my picks" when there is a selection, "Clear my picks" only when the
  member has saved picks and has deselected them all, and switched off with the hint "Pick a time above,
  then save." when there is neither. The day chips and slot grid moved to
  `components/mutual-time/mutual-time-slot-picker.tsx` so the voting form and the gate preview share one
  component.
- 2026-08-09: **The shared survey link now has a way back (rule 134).** `/mutual-time/<slug>` shipped
  with no back control at all — on a phone, and especially in the installed web app where there is no
  browser back button, a member who opened it was stranded. It is the one screen a signed-out stranger
  can open, so the two viewers get different chrome. A signed-in member now gets the shared
  `MobileScreenHeader` (back chevron, brand icon, "Mutual Time", and the bug / settings / account
  cluster), the same bar as every other screen. A signed-out visitor gets the shared
  `BackChevronButton` beside the event name instead, and only when `useSmartBack` reports in-app
  history: the full bar would offer them an account menu and a settings link they cannot use, and the
  one-level-up fallback would push them to the all-apps page, which needs an account. With no in-app
  history there is nothing in-app behind them and their browser's own back still works. No hand-rolled
  back control — both pieces are the shared ones. `MutualTimePublic` was also split into `EventHeader`
  and `EventBody` to stay under the complexity limit.
- 2026-08-12: **The days on offer now roll forward, so an open survey never goes out of date.** Reported
  by the owner: a survey created with no close time kept offering the same seven days after they had
  gone by, members could still pick a time in the past, and closing it would stamp that past time as
  the chosen one. Nothing about the survey ended by itself. The candidate window is no longer frozen at
  creation. One function, `candidateWindowStartMs` in `lib/mutual-time/repository.ts`, now decides where
  the window starts — the next half-hour from now while the survey is open, the opening moment while it
  is scheduled, the stored `window_start_date` once it is closed — and the public read, the vote guard,
  and the winner computation all go through it, so what a voter sees, what the server accepts, and what
  can win are the same set of times. `slots.ts` gained `generateSlotsFrom` and `rollingWindowStartMs`
  and lost `generateCandidateSlots`. Votes for times that have passed stay in the table but are ignored:
  left out of `computeWinner` (`slot_start_utc > NOW()`), out of the open-survey voter count, and out of
  `getViewerPicks`, which now also returns how many of the member's picks expired so the form can say so
  ("One time you picked earlier has now passed…") rather than dropping them silently — the owner chose
  telling the voter over rolling their picks forward or letting past picks keep counting. A survey
  closed after all its votes had passed now says that on the link instead of "closed with no votes".
  Saving a pick that has just passed returns the same `MUTUAL_TIME_INVALID_SLOT` code with wording that
  says which of the two it is. Auto-close was deliberately left alone (owner decision, same date): a
  survey with no close time still waits for the admin to close it, and the rolling window is what keeps
  it usable in the meantime. The seed's open event is anchored to the day it runs and its votes are
  replaced each run; the closed event keeps its fixed past window. No schema change, no contract change,
  no API-shape change beyond the added `viewer.expiredPicks` count.

- 2026-08-12: **The admin landing tells the admin when a survey needs them (owner request).** Until now
  an admin had to open `/apps/mutual-time` and check by eye to learn that anyone had voted, or that a
  survey with a close time had chosen its own time — and that is exactly what tells them when to go
  live and run the meeting. Mutual Time is now wired into the shared admin-landing dot
  (`lib/admin/area-attention.ts`, non-plugin inventory §1.14) with two signals, both limited to the
  surveys this admin created: votes cast on one of their still-open surveys since they last opened the
  area (counting only picks still ahead of now, matching the rolling window), and one of their surveys
  having passed its close time and chosen a time on its own. The second query treats "past `closes_at`
  but still stored as open" the same as "already closed", because a survey only flips when someone next
  reads it — otherwise a survey nobody had opened since its close time would never raise the dot. A
  survey nobody has voted on raises nothing and stays open until someone picks; a survey the admin
  closed by hand raises nothing either (owner decision, same date). This is the first area signal
  scoped to one admin, so the registry now accepts `{ sql, scopedToAdmin: true }` entries that also get
  the admin's user id as `$2`; existing string entries are untouched. One schema addition,
  `mutual_time_events.auto_closed` (boolean, default `FALSE`, set by `closeAndComputeTx`), so the two
  ways a survey ends can be told apart — an admin who pressed Close does not need telling.
  `schema.demo.sql` regenerated. No contract or API-shape change.

Ordered, dependency-based (no phases). Each item done in this initial build.

### Data + server
- [x] Add `mutual_time_events` and `mutual_time_votes` to `ctf/schema.sql` (CREATE IF NOT EXISTS + ALTER
  ADD COLUMN IF NOT EXISTS + indexes). Acceptance: schema-drift gate passes.
- [x] `lib/mutual-time/` — constants, types, pure slot generation/validation (`slots.ts`), slug,
  meeting-plugin map, audit, and the repository (create/list/close/read/vote + most-overlap algorithm).
  Acceptance: web typecheck clean.
- [x] Register deletion in `lib/account/deletion-registry.ts`. Acceptance: `check-deletion-registry.mjs`
  passes.

### API
- [x] `app/api/mutual-time/_lib.ts` (admin gate, vote gate, CSRF, error mapping).
- [x] Routes: `events` (GET/POST), `events/[eventId]/close` (POST), `event/[slug]` (GET public),
  `event/[slug]/vote` (POST). Acceptance: inventory-drift gate passes (routes documented above).

### Web UI
- [x] Register the `mutual-time` accent (`#F472B6`) in `lib/theme/theme-tokens.ts`.
- [x] `components/mutual-time/` — shared tokens/timezone helpers, admin dashboard, public
  vote/result/gate surface, member-info panel.
- [x] Pages: `app/apps/mutual-time/page.tsx` (admin/member/gate), `app/mutual-time/[slug]/page.tsx`
  (public, three viewer states). Acceptance: renders loading/empty/populated/closed states.
- [x] Add the plugin to `lib/plugins/repository.ts` (`fallbackPluginRegistry`).

### Docs + seed + registration
- [x] Contracts: command, access-policy, audit, profile-and-deletion.
- [x] Seed script + `package.json` `seed:mutual-time` target.
- [x] Test-script manifest entry + `mutual-time-test-script.md`.
- [x] This inventory (all sections + Trust N/A).
