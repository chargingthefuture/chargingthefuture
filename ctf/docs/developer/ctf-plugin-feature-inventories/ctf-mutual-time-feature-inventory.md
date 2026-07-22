# Mutual Time Plugin Feature Inventory

## Scope and Boundary

Mutual Time is a one-link meeting-time picker (spec #1780). An admin (the platform owner) creates an
event that has a single shareable link. Approved members open that link and pick up to three one-hour
windows — snapped to the half-hour — in their own timezone. When the survey closes, the app chooses the
window the most members can make (ties go to the earliest) and shows it, in each viewer's own timezone,
with a link to where the meeting happens (Chyme or Peer Programming).

- **In scope:** owner/admin event creation and manual close; a public shareable link with three viewer
  states (vote / result / sign-in gate); timezone-aware voting; the most-overlap algorithm; auto-close
  at a set close time.
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
2. **See the chosen time.** After the survey closes, the same link shows the winning time in the
   viewer's own timezone, how many members can make it, and a "Go to <plugin>" link to the meeting.
3. **Listen-in for everyone.** A signed-out or not-yet-approved visitor can still open the link: they
   see the event and a message that they can come listen in at whatever time is chosen — the link is
   their invite. They are shown a sign-in prompt if they want a say in the time.
4. **Copy the link.** Every surface has a Copy-link button (rule 130) for sharing the one event link.

## Admin Features

1. **Create an event** at `/apps/mutual-time`: optional title, optional description, a "Where we'll
   meet" plugin (Chyme or Peer Programming), and optional survey open/close date-times. Leaving close
   blank means the admin closes it manually.
2. **Manage events:** the dashboard lists the admin's events with voter counts, a status pill
   (scheduled / open / closed), Copy-link, View, "Close and choose the time", and — once closed — the
   chosen time and how many can make it.
3. **Close and choose:** closing runs the most-overlap algorithm and stamps the winning window. A survey
   with a set close time auto-closes when that time passes.

## API Surface and Route Map

All routes under `ctf/packages/web/app/api/mutual-time/`:

- `GET /api/mutual-time/events` — the admin's own events (dashboard list). Admin-only. Auto-closes any
  due events before returning.
- `POST /api/mutual-time/events` — create an event (returns the event + slug). Admin-only. CSRF-guarded.
- `POST /api/mutual-time/events/[eventId]/close` — close a survey now and compute the winner. Admin-only
  (and the creator). CSRF-guarded.
- `GET /api/mutual-time/event/[slug]` — **public** read of one event (title, description, status,
  candidate slots, result). Rate-limited per IP. A signed-in approved member also gets `viewer.canVote`
  and their own picks; never returns anyone else's votes.
- `POST /api/mutual-time/event/[slug]/vote` — save (replace) the signed-in, Unlock-approved member's
  picks (up to 3 half-hour-snapped one-hour windows). CSRF-guarded. Rejected if the event is not open or
  a pick is not a valid candidate slot.

## Data Model and Storage Contracts

Defined in `ctf/schema.sql` (CREATE TABLE IF NOT EXISTS + ALTER TABLE IF EXISTS ADD COLUMN IF NOT EXISTS
+ indexes):

1. `mutual_time_events`
   - One row per event, keyed by `id`, with a unique shareable `slug`. Columns: `created_by_user_id`
     (the admin creator), `title` (nullable), `description` (nullable), `meeting_plugin`
     (`chyme|peer-programming`), `window_start_date` (UTC date the 7-day candidate window begins),
     `window_days` (default 7), `opens_at` (nullable — null opens immediately), `closes_at` (nullable —
     null closes manually), `status` (`open|closed`), `result_slot_start` (winning UTC slot, nullable),
     `result_can_make_it` (count, nullable), `created_at`, `closed_at` (nullable). Indexed by slug
     (unique) and by creator.
2. `mutual_time_votes`
   - One row per (event, voter, slot): `event_id` (FK → `mutual_time_events(id)` `ON DELETE CASCADE`),
     `voter_user_id`, `slot_start_utc` (the one-hour window start), `created_at`. Unique on
     `(event_id, voter_user_id, slot_start_utc)`; indexed by `(event_id, slot_start_utc)` and by voter.
     Candidate slots are computed from the event window (`window_start_date` + `window_days`, 48
     half-hour starts/day) and never stored — only cast votes are stored.

## Security, Privacy, and Compliance Controls

1. **Three access tiers.** Create/close: admin-only (`evaluatePluginAccess({ requiredRoles: ['admin'] })`;
   close also checks the actor is the event's creator). Vote: signed-in AND Unlock-approved
   (`minUnlockTier: 'approved_full'`). Read: public/anonymous, rate-limited per IP.
2. **CSRF / same-origin.** Every mutation requires the `x-ctf-csrf: '1'` header and a same-origin check
   (`ensureMutationCsrf`). The admin event-list read (`GET /api/mutual-time/events`) additionally runs a
   same-origin `checkMutationOrigin` check (missing-Origin same-origin requests still pass) so a
   credentialed cross-origin page cannot read the admin's slugs/voter counts.
3. **Privacy.** Individual votes are never exposed publicly. The public read returns only aggregate
   fields (voter count; after close the winning slot + how many can make it) plus, for a signed-in
   approved member, that member's own picks for hydration.
4. **No credits.** No command reads or moves ServiceCredits.
5. **Deletion.** A member's votes, and any events they created (cascade), are removed on service/account
   deletion — declared in `lib/account/deletion-registry.ts` (`mutual-time`) and validated by
   `check-deletion-registry.mjs`. See `MUTUAL_TIME_PROFILE_AND_DELETION_CONTRACT.md`.
6. **Timezone safety.** Overlap is computed in UTC; each viewer's UI renders the same UTC candidate
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
  (`/mutual-time/[slug]`) with vote/result/gate states, and all API routes.
- **Mobile-responsive web:** complete — the same web components render at phone width (single-column
  layout, horizontally scrollable date chips, wrapping slot grid).
- **Android:** **out of scope (web-only per rule 105).** Mutual Time is not on the Chyme keep-list; there
  is intentionally no React Native surface. The meeting the result points to (Chyme / Peer Programming)
  is where any native experience lives, not the scheduling.

## Seed Coverage Status

Deterministic seed at `ctf/scripts/seedMutualTime.mjs` (pnpm `seed:mutual-time`). Seeds two events — one
open ("Weekly check-in", no close date, spread of votes) and one closed ("Q3 onboarding", with a
computed winning time) — plus sample votes, using fixed slugs + `ON CONFLICT DO NOTHING` so it is
idempotent. Fixed candidate window (`2026-07-21`, 7 days) keeps the seed deterministic.

## Gaps and Known Technical Debt

1. **Target meeting week is derived, not configured.** The candidate window is a fixed 7 days starting
   from when voting opens (or creation). Letting the admin pick the target week separately from the
   survey open/close times is a documented follow-up.
2. **Full 24h candidate grid.** To let anyone in any timezone find a free hour, the candidate grid spans
   all 24 hours (48 half-hour starts/day). Members see them grouped by their local Night/Morning/
   Afternoon/Evening; a future refinement could let the admin bound the daily hours.
3. **No reminder/notification** when a time is chosen — members re-open the link to see the result. A
   push/notification tie-in is a possible follow-up.

## Change Log

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
- 2026-07-22: **Code-review fixes (issues #1803–#1809).** No behaviour change to the happy path.
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

## Build Checklist

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
