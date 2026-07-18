# How to use Charging the Future

_Last updated: 2026-07-18_

Charging the Future is a set of apps survivors use to work with and support each other, outside the Specterati economy. This guide walks through each part: what it does and how to use it.
Pick an app from the list below to jump to it.

## Directory

_Last updated: 2026-07-17_

Directory is part of the Charging the Future app.

Authenticated dashboard/profile experience for create, update, and delete profile operations.

Directory list and profile discovery experience for authenticated users.

Directory is no longer public-facing** (2026-05-18). The `isPublic` toggle was removed; every authenticated member sees every active, non-deleted profile. There is no anonymous projection route. Legacy public URLs are not redirected — backwards compatibility is intentionally not preserved.

Announcement consumption in user-visible contexts.

**How to use it**

1. Directory lists members and the skills they hold — it does not transact. These are the
2. can't-ship-broken checks. Member role unless noted.
3. List loads.** Open Directory as a signed-in member. Active, non-deleted profiles render — not a
4. spinner or an error — even if you have no profile of your own.

## Foundation

_Last updated: 2026-07-18_

Foundation is part of the Charging the Future app.

Provider discovery and search by service type, location, language, and trauma-informed criteria.

Survivor-provider 1:1 text messaging with delivery/read/seen semantics and file attachment support.

Voice and video session initiation and join for approved 1:1 participants.

Quote request lifecycle (requested → provider_responded → closed) with immutable timeline view. The 1:1 text/voice/video channel is scoped to an active connection/quote between exactly the two parties and opens with it; when the connection/quote reaches a terminal state (closed, declined, or ended) the chat closes — no new messages may be sent, both parties keep read-only access for a limited window, and message/session records are retained server-side for moderation/abuse evidence per the deletion contract. No 1:1 messaging exists outside an active connection/quote (platform rule 100, "Messaging Scope and Lifecycle").

**How to use it**

1. Foundation carries 1:1 support messaging and a paid live call — these are the can't-ship-broken
2. checks. Member role unless noted.
3. Provider search loads.** Open Foundation. The provider list renders with name, headline, and
4. bio, not a spinner or error.

## Chyme

_Last updated: 2026-07-17_

Chyme is part of the Charging the Future app.

Authenticated room bootstrap via `GET /api/chyme/room` with deterministic room provisioning (`chyme-main-room`) and participant upsert.

Companion text chat read/send via `GET /api/chyme/messages` and `POST /api/chyme/messages`, with DB persistence and Stream message fan-out through shared adapters.

Stream-backed room join/token flow via `POST /api/chyme/join`, using shared Stream wrappers in `packages/shared`.

Service-scoped deletion request via `DELETE /api/account/chyme-profile`.

**How to use it**

1. The one shared audio room — these are the can't-ship-broken checks. Member role unless noted.
2. Room loads.** Open Chyme as a signed-in member. The room ("Chyme Main Room: Exit the
3. Gauntlet"), the participant list, and the chat panel render — not a spinner or an error.
4. Join the call.** Press join. You connect to the live audio room, start muted, and can mute

## SocketRelay

_Last updated: 2026-07-17_

SocketRelay is part of the Charging the Future app.

Authenticated request dashboard with active and owned request views.

Request create/update/repost flows with deterministic status semantics. Owners can edit their

own open requests from the feed (web); the edit reuses the post form and the existing

`PUT /api/socket-relay/requests/:id` route.

**How to use it**

1. Sign in as a member. Navigate to the SocketRelay feed on web and open the SocketRelay screen on Android. The feed loads without a JS error, shows a list of seeded requests (not a blank page and not a raw `{ items, page, pageSize, total }` JSON dump), and each card shows a title and at least one tag.
2. web ☐ android ☐
3. While signed out (or in a fresh incognito window on web / signed-out state on Android), open the SocketRelay feed. The app shows a public or sign-in-gated state rather than crashing or exposing authenticated data.
4. web ☐ android ☐

## Beacon

_Last updated: 2026-07-14_

Beacon is part of the Charging the Future app.

Watch publicly.** Anyone with the link watches the live broadcast (HLS), no sign-in.

Idle state.** When nothing is live, a calm "No live event right now" screen (with the last

replay, if any).

Live chat (members).** Signed-in members post chat messages during the event; anonymous viewers

**How to use it**

1. One-way admin broadcast; public watch, sign-in to chat. Member role unless noted.
2. Idle state loads.** Open `/apps/beacon` when nothing is live. A calm "No live event right now"
3. screen renders, with the last replay if one exists. No spinner stuck, no error.
4. Anyone can watch, no sign-in.** Sign out and open `/apps/beacon`. The viewer surface still loads

## PeerProgramming

_Last updated: 2026-07-18_

PeerProgramming is part of the Charging the Future app.

Weekly active-user selection includes only accounts with login activity in the prior 7 days.

Cohorts are formed with a target size of 5 users per cohort.

Assignment status and cohort metadata are visible in the user room entry surface.

In-app notifications are generated when users are assigned to a cohort.

**How to use it**

1. These are the checks that must pass before anything else is worth testing.
2. Room loads for a seeded member**
3. Sign in as a seeded member. Navigate to `/apps/peer-programming` (web) or open the PeerProgramming screen (android). The room loads without an error banner. A cohort or the "you're not in a cohort yet" / empty state is visible within a few seconds.
4. web ☐ android ☐

## Mood

_Last updated: 2026-07-17_

Mood is part of the Charging the Future app.

Plugin route for mood check (`/apps/mood`).

Authenticated user can submit a mood check via `POST /api/mood/submissions`.

Mood scale validation (`1..5`) is enforced.

Submission response does not include severe-value safety trigger fields.

**How to use it**

1. Member role unless noted.
2. Check-in screen loads.** Open Mood. The check-in form (mood picker + optional note) renders, not a
3. spinner or error.
4. Submit a mood check.** Pick a mood value (1–5), submit. The submission is accepted and the screen

## GentlePulse

_Last updated: 2026-07-14_

GentlePulse is part of the Charging the Future app.

Plugin route for meditation library (`/apps/gentle-pulse`).

Meditation listing with pagination (`limit`, `offset`).

Sort modes: `newest`, `most-rated`, `highest-rating`.

Tag-based filtering.

**How to use it**

1. Member role unless noted.
2. Library loads.** Open GentlePulse. The meditation library renders with items (title, description),
3. not a spinner or error.
4. Play records.** Play a meditation. The play is recorded and the media URL opens.

## WhatWorks

_Last updated: 2026-07-14_

WhatWorks is part of the Charging the Future app.

Browse the shared list: active problems, each with its approved tools (emoji, name, type, a short

"why it works" note, a verified count, and a direct purchase link).

Mark a tool **Helpful** ("this helped me") — a one-per-survivor endorsement whose tally renders as

"N survivors verified"; toggle off to withdraw it.

**How to use it**

1. One shared survivor-verified list of tools by problem. Member role unless noted.
2. List loads.** Open `/apps/what-works` signed in. Active problems render, each with its approved
3. tools — emoji, name, a short "why it works" note, a verified count, and a purchase link. No
4. spinner stuck, no error.

## SkillsHunt

_Last updated: 2026-07-17_

SkillsHunt is part of the Charging the Future app.

List active, upcoming, and closed SkillsHunt rounds.

View round details including scoring config, rules, and dates.

Submit entries only during active windows.

Submit display name (2–100 chars, alphanumeric + spaces), bio (max 280 chars), Quora profile URL, taxonomy-selected skills, optional proposed (free-text) skills, and claimed professions *(deferred — not in the locked Wave 1 design)*.

**How to use it**

1. CS-1 — Rounds list loads for a signed-in member**
2. Open `/apps/skills-hunt` (web) and the SkillsHunt screen (Android). Confirm at least one seeded round appears with a name and status visible. No error state, no blank screen.
3. web ☐ android ☐
4. CS-2 — Scout tab / nomination form is reachable**

## Workforce

_Last updated: 2026-07-18_

Workforce is part of the Charging the Future app.

Live dashboard: Population, Workforce Total, Total Headcount Target, Recruited, Recruitment Progress, Sector Gaps, Skill Level Breakdown, and Top Training Gaps.

Demand is population-scale: `population × participation_rate` (workforce config), spread across sectors by each sector's Skills Taxonomy `workforce_share`, then split across the sector's job titles. Supply is read live from Directory: members = active profiles; recruited = the V2 aspirational 3-way match (profiles matching a bucket by sector, job title, or a skill registered under the job title), with the top-line recruited mirroring V2 as the count of all active profiles. Gap = demand − recruited. See section 5 for the exact definition.

Drilldowns by sector, skill level, and occupation (the per-occupation training gaps).

Deterministic loading/empty/error states for the core screens.

**How to use it**

1. Workforce is a read-only live tracker — these are the can't-ship-broken checks. Member role unless noted.
2. Dashboard loads with numbers.** Open the Workforce dashboard. Population, Workforce Total,
3. Total Headcount Target, and Recruited all render as numbers, not a spinner or error.
4. Top-line numbers reconcile.** Recruited equals the count of all active Directory members, and

## Skills Taxonomy

_Last updated: 2026-07-18_

Skills Taxonomy is part of the Charging the Future app.

See the app to use Skills Taxonomy.

**How to use it**

1. This plugin owns the shared list of sectors, job titles, and skills the rest of the app reads. These
2. are the can't-ship-broken checks.
3. Hierarchy loads.** Open the Skills Taxonomy browser as a signed-in member. The three-level tree
4. (sector

## ServiceCredits

_Last updated: 2026-07-14_

ServiceCredits is part of the Charging the Future app.

See the app to use ServiceCredits.

**How to use it**

1. These are the checks that must pass before any other case is meaningful.
2. Wallet loads for a seeded member**
3. Sign in as a seeded member account. Navigate to the ServiceCredits section (web: `/service-credits`; android: ServiceCredits screen). The wallet tab must appear showing an available balance figure (a number of credits, not a currency symbol) and no error state.
4. web ☐ android ☐

## Contributions

_Last updated: 2026-07-14_

Contributions is part of the Charging the Future app.

Submit a contribution claim of one of three kinds:

Gift card** (`amazon`, `apple`, or `dennys`): the member states the amount (over 0, at most

USD) and their own Signal contact (URL or phone number — reduces fraud). It can be a physical

or a digital gift card. The gift-card **code is never collected or stored anywhere** — the member

**How to use it**

1. Voluntary fundraiser drives; thank-you credits, never money. Member role unless noted.
2. Drive loads.** Open `/apps/contributions` signed in. The current cycle and collective progress
3. render — USD raised, comments, stars, contributor count — toward the owner-set goals. No spinner
4. stuck, no error.

## LevelUp

_Last updated: 2026-07-14_

LevelUp is part of the Charging the Future app.

Cohort listing with filters for `track`, `status`, and `startDate`.

Cohort detail view with curriculum, milestones, and enrollment affordance.

Enrollment flow with optional deposit policy and escrow split per milestone.

User dashboard with wallet balance, LevelUp escrow totals, active enrollments, and recent transactions.

**How to use it**

1. Learning cohorts with escrow-backed milestones — these are the can't-ship-broken checks. Member role
2. unless noted.
3. Cohort list loads.** Open LevelUp. Cohorts render with track, status, seats, and required
4. deposit — not a spinner or error.

## TrustTransport

_Last updated: 2026-07-14_

TrustTransport is part of the Charging the Future app.

Single landing decision flow for:

Ride,

Package,

Food.

**How to use it**

1. Plugin loads for a signed-in member**
2. Open `/apps/trust-transport` (web) or the TrustTransport screen (android). You should see the booking surface — mode selector, origin/destination fields, and your existing requests listed. No crash, no blank screen.
3. web ☐ android ☐
4. Plugin is auth-gated — unauthenticated users cannot access it**

## LightHouse

_Last updated: 2026-07-17_

LightHouse is part of the Charging the Future app.

Route parity target for LightHouse home dashboard (`/apps/lighthouse`).

No profile is required to use LightHouse** (owner decision, 2026-06-12). Opening LightHouse goes

straight to the browse screen — there is no "create a LightHouse profile" gate and no no-profile

splash. (V3 uses one canonical identity with optional per-plugin extension data, not a standalone

**How to use it**

1. Member role unless noted.
2. Opens straight to browse.** Open LightHouse. It lands on the property browse screen — no
3. "create a LightHouse profile" gate and no no-profile splash.
4. Listings load.** The browse list shows available active properties with real fields (title,

## ClickLog

_Last updated: 2026-07-14_

ClickLog is part of the Charging the Future app.

Log incident (with optional location/notes)

View incident count and history

Delete own incidents

Mobile and web parity

**How to use it**

1. A private, sign-in-only incident counter — these confirm logging works and stays private to the
2. member. Member role unless noted.
3. Counter loads.** Open ClickLog. The total count and recent-incident list render with real
4. numbers, not a spinner or error.

## Recurring Activity

_Last updated: 2026-07-14_

Recurring Activity is part of the Charging the Future app.

Declare a new recurring activity with another member (owner side): counterparty + sector + currency +

cadence, plus an optional ServiceCredits value only when the currency is ServiceCredits. Created as

`pending`.

Confirm or decline a pending activity another member recorded with you (counterparty side). Only a

**How to use it**

1. Sign in as a seeded member and navigate to `/apps/recurring-activity` (web) or open Recurring Activity on Android. The hub loads and shows at least the two confirmed seeded activities (one fiat housing tie, one ServiceCredits service tie).
2. web ☐ android ☐
3. The seeded ServiceCredits service activity shows `50 SC / month` — a declared value is visible. The seeded fiat housing activity shows a currency label and cadence but **no fiat amount anywhere on the row**.
4. web ☐ android ☐

## GDP

_Last updated: 2026-07-16_

GDP is part of the Charging the Future app.

See the app to use GDP.

**How to use it**

1. Transparency-reporting plugin — these confirm the community figure shows and never reads as a
2. per-wallet money value. Member role unless noted.
3. Dashboard loads.** Open the GDP report. The headline community figure and total member count
4. render with numbers, not a spinner or error. There is no "active members" stat.

The code is open source at https://github.com/chargingthefuture/chargingthefuture.
