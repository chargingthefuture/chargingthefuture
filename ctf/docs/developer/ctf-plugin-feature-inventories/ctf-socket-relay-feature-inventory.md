# SocketRelay Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Plugin name: `SocketRelay`
- Plugin slug: `socket-relay`
- Owned surfaces: `/apps/socket-relay` (web), `packages/mobile/src/features/socket-relay` (Android), `/api/socket-relay/*` routes, `socket_relay_*` tables.
- Not owned: identity (Clerk), ServiceCredits ledger (service-credits plugin), email/SMS transport (notifications integration).

## Intent and Outcome

SocketRelay is a request-and-fulfillment plugin with profile management, request lifecycle, fulfillment closure, participant chat, and admin moderation controls. It is **members-only** (v3): there is no public/anonymous board — every request is viewable only by signed-in members, including via a shared deep link.

## 1) User Features

### 1.1 Dashboard and Request Lifecycle

1. Authenticated request dashboard with active and owned request views. The main feed is scoped
   server-side to **open (claimable)** requests (`GET /api/socket-relay/requests?status=open`), so
   resolved and claimed posts never crowd open ones off the first page; a **"Load more"** button pulls
   the next page and appends it (de-duped by id). The "N open" header badge reflects the server-side
   total of open requests, not just the loaded page. The owner's own posts of every status stay
   reachable under the "Mine" filter, which sources the owner-scoped `my-requests` list.
2. Request create/update/repost flows with deterministic status semantics. Owners can edit their
   own open requests from the feed (web); the edit reuses the post form and the existing
   `PUT /api/socket-relay/requests/:id` route.
3. Ownership-aware request visibility and action controls. An expired post (open but past its 28-day
   life) drops out of the active feed for everyone **except its owner**: the owner always sees their own
   posts in the feed — including expired ones, dimmed, with an "Expired" pill and a Re-post button — so a
   post never silently vanishes from the poster's own view. This holds on web and Android.
4. Tagging: each request carries 1-3 free-text tags (max 64 chars each; server normalizes
   whitespace and folds case-insensitive duplicates). Feed filter chips are derived from the tags
   actually in use, most-used first, capped at 10. The post form suggests tags already in use so
   vocabulary converges without a curated list (owner decision, 2026-06-12: guided free-form).

### 1.2 Profile Management

**Superseded — no SocketRelay profile surface exists or is planned.** Member identity and location
live once on the shared Directory profile (recorded 2026-07-11: "Member location itself lives once
on the directory profile"); the shell reads `GET /api/directory/profile`, and a per-request location
only defaults from it. History: the v2 legacy app had a full profile CRUD page (retired with the
legacy tree, 2026-04-12); the v3 shell's profile read/gate was removed in the 2026-05-10 pixel pass
and never rebuilt. The four-verb `/api/socket-relay/profile` route family remains with zero callers,
parked on the orphan-route allowlist — burn down by retiring it (with its contracts) rather than
building a UI for it, unless the owner asks for a plugin-specific profile.

### 1.3 Fulfillment Lifecycle

1. Fulfillment claim flow for eligible requests.
2. Fulfillment detail and “my fulfillments” views.
3. Closure outcomes with canonical status taxonomy.
4. **Record a favor as a regular one, without leaving SocketRelay (2026-08-03).** The Direct Line carries
   an "Is this ongoing?" prompt while the favor is live and after it is closed successfully: pick how often and how it
   is settled, and it records an ongoing favor arrangement with the other member, who confirms it in the
   Recurring Activity app. Only on a successful close — an unsuccessful or canceled favor is not an
   arrangement.

### 1.4 Fulfillment Chat

1. Participant-only chat retrieval and send flows for fulfillment threads.
2. Access control constrained to request owner and fulfiller.
3. Deterministic error semantics for unauthorized access paths.
4. Lifecycle: the chat is scoped to a single fulfillment between exactly the two participants (request owner + fulfiller) and opens with the fulfillment. When the fulfillment reaches a terminal state (completed, canceled, disputed) the chat closes: no new messages may be sent, both parties keep read-only access for a limited window, and `socket_relay_messages` are retained server-side for moderation/abuse evidence per the deletion contract. No 1:1 messaging exists outside an active fulfillment (platform rule 100, "Messaging Scope and Lifecycle").
5. Direct Line list: the Direct Line tab shows one row per request the member is currently waiting on or talking through — every **active** fulfillment (a live conversation, whether they posted the request or offered to help) plus their own **still-open, non-expired** requests as pending placeholders ("waiting for a helper", no chat until a helper claims it). Canceled/closed fulfillments and claimed/closed requests drop out (a claimed request is already represented by its active fulfillment). This is composed client-side from `my-fulfillments` + `my-requests` (no new route or table); it is presentation only and does not change chat access or the messaging lifecycle above.
6. Live chat surface (web + Android): each active Direct Line opens the real requester <-> helper Stream chat. Web renders it inline (`sr-chat.tsx` / `StreamChatPanel`); Android opens it from an "Open chat" button on each Direct Line card into a full-screen modal (`SocketRelayDirectLineChat.tsx`, reusing the shared `StreamChatView`). Both connect to the **same** per-fulfillment Stream channel (`socket-relay-fulfillment-<id>`) via `POST /api/socket-relay/fulfillments/:id/chat`; mobile opens no new channel type, just a second client. Resolve controls stay alongside the chat.

### 1.5 Members-Only Visibility (no public board)

1. Every request is viewable only by a signed-in member. There is **no public/anonymous board** in
   v3 — a request the poster shares as a deep link (`/apps/socket-relay?request=<id>`) still requires
   the recipient to sign in to view it. (This supersedes the v2 "public sharing" surface: the anonymous
   `GET /api/socket-relay/public` and `GET /api/socket-relay/public/:id` routes were removed 2026-07-26.)
2. The member feed and the single-request detail (`GET /api/socket-relay/requests/:id`) agree: any
   signed-in member may view any request. The old `is_public` visibility gate on the detail route (a v2
   remnant that returned 403 to a non-owner on a non-public request the feed already listed) is gone.
3. The `is_public` column is retained on `socket_relay_requests` but is **inert** — nothing reads it to
   decide who can see a request. It is no longer user-toggled (the "make public" control was removed
   2026-06-12) and no longer affects any read path.

## 2) Admin Features

### 2.1 Requests and Fulfillments Oversight

1. Admin list/oversight views for requests and fulfillments.
2. Role-gated moderation actions for request lifecycle interventions.
3. Deterministic audit capture for sensitive admin mutations.

## 3) API Surface and Route Map

User/authenticated routes:

- `GET /api/socket-relay/profile`
- `POST /api/socket-relay/profile`
- `PUT /api/socket-relay/profile`
- `DELETE /api/socket-relay/profile`
- `GET /api/socket-relay/requests` — member feed. Optional `?status=open` (comma-separated statuses) scopes the list to claimable posts; `?page`/`?pageSize` paginate (feed uses `status=open`, pageSize 20, with a "Load more" button). Absent/unknown `status` returns the full-status list.
- `GET /api/socket-relay/requests/:id` — single request, members-only. Any signed-in member may view any request (no `is_public` gate); 404 for a missing request.
- `GET /api/socket-relay/my-requests`
- `POST /api/socket-relay/requests`
- `PUT /api/socket-relay/requests/:id`
- `POST /api/socket-relay/requests/:id/repost`
- `POST /api/socket-relay/requests/:id/fulfill`
- `GET /api/socket-relay/fulfillments/:id`
- `GET /api/socket-relay/my-fulfillments`
- `POST /api/socket-relay/fulfillments/:id/close` — requester-only resolve; body `{ outcome: 'successful' | 'no_longer_needed' | 'unsuccessful_reopen' | 'unsuccessful_close' }`. `unsuccessful_reopen` returns the request to `open`; the others close it. Helpers cannot resolve.
- `GET /api/socket-relay/fulfillments/:id/messages`
- `POST /api/socket-relay/fulfillments/:id/messages`
- `POST /api/socket-relay/service-credits` ← `{ toUserId, amount, message?, idempotencyKey? }` → `{ ok, transaction }` — send ServiceCredits from the signed-in member to `toUserId` from a SocketRelay surface (e.g. settling a fulfilled request in credits). Read-access gated (`requireSocketRelayReadAccess`) + CSRF (`x-ctf-csrf: '1'`); `amount` must be a positive number (else 400). Uses the shared ServiceCredits `createTransfer` primitive with `originPlugin: 'socket-relay'`, `reasonCode: 'socket-relay.transfer'` (idempotent on `(sender, idempotencyKey)`; a default key is derived when none is supplied). SocketRelay owns no credits ledger — the movement is recorded only in the canonical ServiceCredits tables (per the "Not owned" boundary above). Declared as command `socket-relay.service-credits.send` (command + access-policy + audit contracts) so the cross-plugin data access path is explicit, and the route emits a `socket-relay.service-credits.send` audit row on success.

Public routes: **none** (removed 2026-07-26). SocketRelay is members-only in v3 — the former anonymous
`GET /api/socket-relay/public` and `GET /api/socket-relay/public/:id` routes, the `SocketRelayPublicRequest`
projection, and the `listPublicRequests` / `getPublicRequestById` repository functions were all removed.

Admin routes:

- `GET /api/socket-relay/admin/requests`
- `GET /api/socket-relay/admin/fulfillments`
- `DELETE /api/socket-relay/admin/requests/:id`

## 4) Data Model and Storage Contracts

Tables owned by this plugin:

1. `socket_relay_user_extension` — Per-user profile extension fields.
2. `socket_relay_requests` — Request lifecycle rows (status, ownership, repost lineage). Includes a
   `tags TEXT[] NOT NULL DEFAULT '{}'` column holding 1-3 free-text tags; the legacy `category TEXT`
   column is kept in sync with the first tag so older clients (and legacy rows, which read as
   `[category]`) keep working. Also includes a nullable `owner_username TEXT` column that captures the poster's chosen `@username` at request-creation time (denormalized from the Clerk session, exactly like `chyme_messages.username` and `feed_community_posts.author_username`), because v3 has no reliable server-side store of other users' usernames. This handle is surfaced in every (members-only) view — never "Anonymous" (owner decision, 2026-06-04). Includes a nullable `expires_at TIMESTAMPTZ` column: a post auto-expires 28 days after it is posted or last re-posted. Expiry is derived at read time (`isExpired` = open AND `expires_at` has passed), so no scheduled job flips a status; `created_at`/`updated_at` and `reopened_count` are unchanged. Create sets `expires_at = NOW() + 28 days`; `repostRequest` resets it; a claim on an expired-but-open post is rejected (`request_expired`). Location columns `city`, `state`, `country` (each nullable `TEXT`) hold the request's location. In the create form these default from the member's own directory profile (the shared member profile — `GET /api/directory/profile`), but they are fully editable and clearable per request, because a request can be for a different place than where the member lives (a second property, a cross-city errand, a package delivery abroad). `city` stays "city or neighborhood only, never an exact address" for privacy.
3. `socket_relay_request_events` — Event log for request state transitions.
4. `socket_relay_fulfillments` — Fulfillment claims and outcomes per request. Includes nullable `requester_username` / `fulfiller_username TEXT` columns, the two participants' `@usernames` captured at claim time (mirrors `socket_relay_requests.owner_username`) so the Direct Line chat renders real participant names instead of a raw user id — v3 has no server-side store of other members' handles. Null for legacy rows or members with no handle.
5. `socket_relay_fulfillment_participants` — Participant access records for fulfillment chats.
6. `socket_relay_messages` — Participant-only chat messages on a fulfillment. The chat is transaction-scoped: after the fulfillment reaches a terminal state no new rows may be added; existing rows become read-only for the two participants for a limited window and are retained server-side for moderation/abuse evidence per the deletion contract (platform rule 100). Carries a unique index `socket_relay_messages_idempotency_uidx (fulfillment_id, sender_user_id, client_message_id)` that backs the send route's `ON CONFLICT` idempotency (without it Postgres rejects the upsert with 42P10).
7. `socket_relay_admin_audit_trail` — Audit log for admin mutations.
8. `socket_relay_request_accepted_currencies` — join (`request_id`, `currency_code` FK → `currencies.code`) for any currencies an offered reward accepts.

Multi-currency (issue #120): SocketRelay is mutual aid and posts are free, so `socket_relay_requests`
gains OPTIONAL `price_amount` + `price_currency` (FK → `currencies.code`) for the rare case a reward is
offered. "Free" renders from the ABSENCE of a price (NULL `price_amount`), never as `$0`. "Accepts
ServiceCredits" is true only when a `socket_relay_request_accepted_currencies` row with `currency_code='SC'`
exists — never derived from `price_currency`. No ServiceCredits amount is shown at a fiat equivalent.

Storage and projection rules:

1. Request and fulfillment status transitions are explicit and replay-safe via the `request_events` log. Every mutating path writes an event in the same transaction as the row change: `request_created`, `request_updated` (edits), `request_claimed`, and `fulfillment_closed` / `fulfillment_reopened`. A helper-canceled reopen (`unsuccessful_reopen`) also resets the 28-day `expires_at` so the re-opened post is not immediately expired.
2. There is a single members-only DTO (`SocketRelayRequest`, carrying `ownerUsername`) for the feed
   list and the single-request detail — no separate public projection. The v2 privacy-minimized public
   DTO (`SocketRelayPublicRequest`) and its two anonymous routes were removed 2026-07-26; every read
   path is behind the member read gate.
3. Mutation operations enforce deterministic storage outcomes and audit-friendly metadata.
4. Admin request removal is transactional: because these tables have no FK cascade, the delete clears the request plus its fulfillments, participants, and request-events itself (no orphans), retains `socket_relay_messages` as moderation evidence (rule 100), and writes the `socket-relay.admin.request.delete` audit row **in the same transaction** — the removal never commits without its audit record (if the audit insert fails, the whole delete rolls back). See the deletion contract.

## 5) Security, Privacy, and Compliance Controls

1. Auth guards on all routes — every read and write is behind the member read gate (`requireSocketRelayReadAccess`); there are no anonymous routes (the v2 public board was removed 2026-07-26).
2. Admin authorization on all admin routes.
3. CSRF checks on admin write routes with explicit contract behavior.
4. Members-only visibility: any signed-in member may view any request (feed list and detail agree); the `is_public` column no longer gates reads.
5. Audit logging for sensitive admin mutations and policy-denied outcomes. Member mutations also emit audit rows: request create, fulfillment claim, fulfillment resolve, fulfillment message send (with participant-membership and moderation evidence), and the SocketRelay-initiated ServiceCredits transfer (`socket-relay.service-credits.send`, the financial mutation).
6. Participant-only routes return 403 (not 404) when the fulfillment exists but the caller is not a participant, so existence is not leaked; 404 is reserved for a genuinely missing fulfillment.

## 6) Web and Android Delivery Status

Delivery: **web + mobile-responsive complete**. **Android (React Native) surface removed 2026-07-20 (rule 105, PR #1742)** — this feature is now web-only, served by the installable web app (PWA). Web surface lives under `/apps/socket-relay`. Historical parity detail: a former Android surface lived under `packages/mobile/src/features/socket-relay` (now removed); public projection, lifecycle status, and CSRF behaviors were behaviorally consistent across platforms.

Web pixel pass (design `c5d83c0`): the `/apps/socket-relay` shell is rebuilt to `design/.../survivor-hub/SocketRelay.tsx` (feed / post / chat tabs, sidebar category filters + live stats, right impact panel) and its Loading/Empty states. The prior shell was broken against the real backend — it read `GET /api/socket-relay/requests` as a bare array (the route returns `{ items, page, pageSize, total }`) and POSTed `{ type, description, location, credits, urgency }` with no CSRF header, none of which the backend accepts. The rebuilt shell uses the real `SocketRelayRequest` model (`title`, `details`, `category`, `city`, `isPublic`, `status`), unwraps the paged response, claims via `POST /requests/:id/fulfill`, and lists fulfillment chats via `my-fulfillments` + `fulfillments/:id/chat`, with `x-ctf-csrf` on mutations. The mockup's need/offer/credits/urgency framing is not backed by the data model and was omitted rather than faked. Decomposed into modular sub-components within the rule-116 limits. No schema/API change.

Android pixel pass (design `MobileSocketRelay.tsx`): `packages/mobile/src/features/socket-relay/SocketRelay.tsx` rebuilt to the `MobileSocketRelay.tsx` mockup — exact colors/spacing/type/icons/layout translated from web-React to RN primitives. New `api.ts` added, binding to `GET /api/socket-relay/requests` (unwraps `{ items, ... }` paged response), `POST /api/socket-relay/requests` (with `x-ctf-csrf: 1`), and `POST /api/socket-relay/requests/:id/fulfill` (with `x-ctf-csrf: 1`). Sub-components: `SocketRelayLoading.tsx` (loading state), `SocketRelayEmpty.tsx` (empty state), `SocketRelayPublic.tsx` (unauthenticated state). Mock file retired (already empty). The mockup's need/offer distinction, urgency badge, and credits counter are not backed by the `SocketRelayRequest` model and are omitted per real-data-only policy.

Android admin parity (design `MobileSocketRelayAdmin.tsx`): `packages/mobile/src/features/socket-relay/AdminSocketRelay.tsx` mirrors the web admin at `app/admin/socket-relay/page.tsx`. New `admin-api.ts` binds the existing admin routes only (no new backend): `GET /api/socket-relay/admin/requests`, `GET /api/socket-relay/admin/fulfillments`, `GET /api/socket-relay/admin/announcements`, and `DELETE /api/socket-relay/admin/requests/:id` (with `x-ctf-csrf: 1`). Shows the same four stat cards the web page shows (total requests, open requests, fulfillments, active fulfillments) plus request/fulfillment/announcement lists. Admin access is enforced server-side; a 401/403 on any read renders an "admins only" notice. The single destructive action (delete request) requires an explicit confirm dialog before the call. Registered in `App.tsx` as the `socket-relay-admin` feature. The mockup's approve/reject affordance is omitted — no approve/reject request endpoint exists (the only request-state admin mutation the backend exposes is delete); see Gaps.

Android Direct Line chat (issue #1596): the mobile "Direct Lines" tab now reaches full parity with the web live chat. Previously it listed active fulfillments with resolve actions only and had no messaging surface. Each Direct Line card gained an "Open chat" button that opens `SocketRelayDirectLineChat.tsx` in a full-screen modal; that screen mints Stream credentials from `POST /api/socket-relay/fulfillments/:id/chat` (via the new `fetchFulfillmentChatCredentials` in `api.ts`, `x-ctf-csrf: 1`, matching the web call) and connects the shared `StreamChatView` to the **same** per-fulfillment channel the web opens (`socket-relay-fulfillment-<id>`) — @mentions, in-channel search, link previews, reply threads and reactions included. No new channel type, route, schema, or contract change; the existing resolve buttons are kept. Quota note: `ctf/docs/quota-impact/2026-07-17-mobile-socket-relay-direct-line-chat.md`.

Web admin mobile-responsive: confirmed. `app/admin/socket-relay/page.tsx` is a server-rendered read-only dashboard already built with responsive utility classes (`max-w-5xl`, `px-6`, `grid gap-4 sm:grid-cols-2 lg:grid-cols-4`). At the 768px phone breakpoint the stat grid collapses to a single stacked column and the snapshot/endpoint sections stack; there is no fixed multi-column layout to fix, so no change was needed.

## 7) Seed Coverage Status

`ctf/scripts/seedSocketRelay.mjs` seeds deterministic request lifecycle (including the `tags` array
alongside the legacy `category`) and fulfillment outcomes for dev validation.

## 8) Gaps and Known Technical Debt

1. Audit retention policy for `socket_relay_admin_audit_trail` follows the platform default; a plugin-specific retention contract has not been finalized.
2. ~~The design mockup (`MobileSocketRelayAdmin.tsx`) shows per-request approve/reject moderation, but the backend exposes no approve/reject request endpoint.~~ Reclassified as a dropped mockup affordance, not a gap (2026-08-04): no approve/reject endpoint has ever existed, posts publish without pre-moderation by design (admin delete is the only request-state mutation), and design mockups are reference-only under the production-era policy (rule 127). Do not build an approve/reject flow unless the owner asks for pre-moderation.
3. Android requests now go through the shared `authedFetch` wrapper (Clerk bearer token, base URL from runtime config) like chyme/currency; earlier the SocketRelay mobile client used plain dev-only `fetch`. The admin client (`admin-api.ts`) and the chat-credentials fetcher (`fetchFulfillmentChatCredentials` in `api.ts`) now use the same wrapper. Ownership detection still leans on `GET /api/socket-relay/my-requests` (a card is "mine" if its id appears in that list) because the client does not compare user ids locally; one extra request per feed load.

## 9) Change Log

- 2026-08-05: **Member blocks enforced (issue #809 task 4).** The browse feed
  (`GET /api/socket-relay/requests`) now hides posts whose owner is blocked (either direction)
  relative to the signed-in viewer — owner-scoped "Mine" lists and admin lists stay complete — and
  `claimRequest` refuses a blocked pair with the new `blocked_pair` → `SOCKET_RELAY_BLOCKED_PAIR`
  mapping (403, neutral copy "This request is not available to you." so the block never reveals
  itself; checked before the idempotent-retry branch so a blocked retry cannot resurrect an old
  claim). `member_blocks` added to the `socket-relay.fulfillment.claim` contract `dataAccess`. No
  schema change.
- 2026-08-04: **Two false gaps reclassified as decisions (inventory audit).** (1) §1.2 Profile
  Management described a profile CRUD surface as in-scope; history shows the v2 profile page was
  retired with the legacy app and the v3 profile read was removed in the 2026-05-10 pixel pass, with
  the recorded direction that identity/location live on the shared Directory profile — §1.2 now says
  so, and the orphaned `/api/socket-relay/profile` route family is marked for retirement, not for a
  UI. (2) Gap #2 (admin approve/reject) is a mockup affordance with no backing endpoint ever;
  reclassified as dropped per the production-era design policy. Docs only.
- 2026-08-04: **Favors now count toward the Community Value Index at the value their post names.** A
  post can name an offered value since issue #120 (`price_amount`/`price_currency`), but the GDP
  value layer still counted every SocketRelay favor as one `FREE` point — both the projected
  open-board figure (open/claimed, unexpired posts) and the real index (favors closed
  `successful`) — so a post offering 15 ServiceCredits or 30 USD read as 1. Both GDP sources
  (`ctf/packages/web/lib/gdp/projection.ts`, `ctf/packages/web/lib/gdp/recognition.ts`, mirrored in
  `ctf/scripts/recognizeGdp.mjs`) now count a priced post at its posted amount in its posted value
  type and an unpriced or amount-less post (Free, Barter) at one point. Change lives entirely in the
  GDP plugin's read layer — no SocketRelay schema, route, or contract change; details in the GDP
  inventory change log.

- 2026-08-03: **A favor that got done can be recorded as ongoing without leaving SocketRelay.** The same
  neighbor collecting the same prescription every month is a standing arrangement, not a string of
  one-offs. The Direct Line now shows the shared "Is this ongoing?" prompt
  (`components/shared/mark-recurring-control.tsx`) on a LIVE fulfillment as well as one closed
  successfully — a member usually knows a favor is standing while it is still happening — pre-set to the
  favor sector and to the other participant. Not on an unsuccessful or canceled close: that is not an
  arrangement. It hides itself once an arrangement with that member exists. It creates the usual pending Recurring Activity row with
  `origin_plugin = 'socket-relay'`; because SocketRelay already recognizes each completed favor on its
  own, a declared ServiceCredits value on one of these lines is recognized as a relationship rather than
  counted twice. UI only — no SocketRelay schema, route, or contract change.
- 2026-08-02: **Deletion burn-down batch 4.** On account deletion, `socket_relay_request_events` rows you appear on are pseudonymized (`actor_user_id` → `deleted_member`): the lifecycle trail belongs to the request it narrates, which may be another member's surviving record — same shape as the fulfillment pseudonymization from #2054.
- 2026-08-02: **A departing member's id no longer survives on the other party's rows (owner
  directive).** Account deletion removed `socket_relay_fulfillments` by `requester_user_id` only, so a member who deleted their
  account left their raw Clerk id sitting in the counterparty's view forever — the row belongs to the
  other person, so deleting it was never the answer. New `pseudonymize` deletion action: the row
  stays, `fulfiller_user_id` is overwritten with the shared constant `deleted_member` and the handle captured at claim time (`fulfiller_username`) is cleared. A single constant
  rather than a per-user token, because a token would still link that person's rows to each other.
  Deliberately not applied to abuse evidence, reviewer/admin audit columns, or
  `member_blocks.blocked_user_id` (overwriting it could unblock someone) — each recorded in the
  deletion contract. `check-deletion-registry.mjs` validates the new action and its cleared columns
  against `schema.sql`; verified it fails on a bad column name. No schema change.
- 2026-08-01: **Direct Line now names the other person (owner report).** Past conversations became
  visible earlier the same day, but opening one still did not say who had offered to help: the header
  read "Your request — you're talking with the helper" with no name, and kept saying "talking with"
  on a canceled line where nobody is talking. `listMyFulfillments` now joins both participants' first
  + last name from `directory_profiles` alongside the usernames already captured at claim time
  (`SrFulfillment.requesterName` / `.fulfillerName`). New shared `srCounterpartLabel()` renders
  `Name (@handle)`, falling back to the handle alone, and to nothing when the member has neither —
  deliberately never to the Clerk id, which is not an identity to a member. The chat header now reads
  e.g. `Your request · Helper: Jane Doe (@jane) · Canceled`, and each row in the conversation list
  carries the same label so an owner can see who offered without opening them one at a time.
  Read-only display change; no route, schema, or contract change.
- 2026-08-01: **In-app "for Targeted Individuals" notice added, then removed the same day (owner
  directive).** A notice was briefly rendered above the feed, on the post form, and on the signed-out
  public shell. The owner removed it: the board sits behind Unlock verification, so everyone reading
  it is already a verified member and the warning had no audience there. The exposure it was written
  for is the **public tester job posting** (issue #2037), which anyone can read without an account —
  that is where the warning lives, and it stays there. `sr-targets-only-notice.tsx` is deleted.
- 2026-08-01: **Past Direct Lines are visible again, and the admin fulfillment list is readable
  without a lookup (owner report).** Two faults, one story: two members offered to help on a request,
  both claims were later canceled, and the owner had no way left to see who either person was.
  (1) `buildDirectLines` dropped every non-active fulfillment, so a canceled claim erased the only
  pointer a member had to that conversation — the request returns to `open`, the feed reads "no helper
  yet", and the helper became unreachable. Past (closed/canceled) lines are now listed after the live
  ones and the waiting placeholders. Nothing new is exposed: the chat routes gate on participation,
  not status, so a participant could always open these; the list simply stopped pointing at them.
  (2) The admin Fulfillments tab printed the request UUID and two raw Clerk user ids.
  `listAdminFulfillments` now joins the request title/status and each participant's first + last name
  from `directory_profiles` (`SocketRelayFulfillment.requesterName` / `.fulfillerName`), and the shell
  shows name (handle), falling back to the handle and only then to the raw id. Read-only display
  change; no route, schema, or contract change.
- 2026-07-31: **Stored status values respelled to US English (owner-directed).** `socket_relay_requests.status` and `socket_relay_fulfillments.status` now store `canceled`; existing rows are migrated by the idempotent US-spelling data migration block at the end of `ctf/schema.sql`. Code, contracts, and docs were renamed in the same PR.
- 2026-07-26: **Direct Line is a single-column list→detail on phone (layout fix).** The Direct Line tab rendered a fixed two-column master-detail (a 240px conversation rail beside the open conversation). On the phone-width app (rule 105, the only layout) that squeezed the detail pane to ~150px, so the pending/chat text wrapped to one or two words per line ("No helper / yet"). It is now a single full-width column: the conversation list, and — once a row is tapped — the open conversation (chat or the "waiting for a helper" pane) full-width with a **"‹ All conversations"** back control. The notification deep-link still opens straight into its conversation; Back returns to the list. Presentation only (`sr-chat.tsx` + the shell's `onBack` wiring); no schema, route, or contract change.
- 2026-07-26: **Code-review batch 2 — atomic admin-delete audit, claim idempotency, resolve-gate confirmation, safer Stream channel fallback.** (a) The admin request delete now writes its `socket-relay.admin.request.delete` audit row **inside the same transaction** as the delete (via a shared `socketRelayAuditInsert` used by both `insertSocketRelayAudit` and the delete path), so a removal can never commit without its audit record — if the audit insert fails, the delete rolls back (#1887). (b) `claimRequest` is now idempotent on retry: a network retry that finds the request already `claimed` **by the same actor** returns that actor's existing active fulfillment instead of erroring with `request_not_claimable` (another member's claim still errors), honoring the `idempotency: true` the claim command contract already declares (#1888). (c) Confirmed the resolve route is already safe: `requireSocketRelayReadAccess` → `evaluatePluginAccess` enforces the `approved_full` unlock tier (the member bar) or admin, so a non-member cannot reach `resolveFulfillment`, which itself enforces requester-or-admin — no code change (#1884, closed not-applicable). (d) `ensureSocketRelayFulfillmentChannel` no longer silently masks a genuine `channel.create()` failure: it still falls back to `watch()` for the benign already-exists case, but when `watch()` also fails it reports the original create error and rethrows (#1889). No schema change; audit/idempotency behavior now matches the already-declared contracts.
- 2026-07-26: **Code-review batch — audit evidence, chat-credential guard, tag-trim notice, parse-input dedup.** Low-risk cleanup from the code-review sweep. (a) The three member-mutation audit rows now carry the evidence fields their audit contracts ask for: `socket-relay.request.create` adds `roleCheck`/`payloadValidationCheck`, `socket-relay.fulfillment.claim` adds `claimabilityCheck`/`ownerSeparationCheck`, and `socket-relay.service-credits.send` adds `recipientUserId`/`amountPositiveCheck` (#1885, #1886, #1883) — reaching each audit call proves those checks passed, so the values are recorded as passed. (b) The web Direct Line now renders the Stream chat only when `streamToken` and `streamUserId` are both present (dropping the `as string` casts), so a partial credentials response falls back to the empty pane instead of handing `undefined` to the Stream SDK (#1882). (c) The post form's tag editor shows a brief "Tag trimmed to 64 characters." notice when it shortens an over-long tag, instead of silently changing the input (#1890). (d) `parseTags` / `parsePriceAmount` / `parseRequestInput` were duplicated in the create and update routes; they now live once in `lib/socket-relay/parse-input.ts` so the two paths cannot drift (#1891). No schema, route, or contract change; audit metadata now matches the already-declared contract.

- 2026-07-26: **Members-only visibility (no public board) + open-scoped feed with "Load more".** Two owner-directed fixes. (1) **Visibility drift.** The list and single-request routes disagreed: the feed (`GET /requests`) showed every request to any signed-in member, but the detail route (`GET /requests/:id`) still ran a v2 `is_public` gate and returned 403 to a non-owner on a non-public request the feed had just listed. Per the owner ruling — v3 has no public post; only signed-in members can view, including a shared deep link — the detail route's `is_public` visibility check is removed (any signed-in member may view any request), and the anonymous public board is deleted: `GET /api/socket-relay/public`, `GET /api/socket-relay/public/:id`, the `SocketRelayPublicRequest` DTO, and the `listPublicRequests` / `getPublicRequestById` / `mapPublicRequestRow` functions are gone. The `is_public` column is retained but inert (no read path consults it; it was already un-toggled since 2026-06-12). (2) **Feed pagination.** `listRequests` gained an optional `statuses` filter and `GET /requests` an optional `?status=` param; the web feed now asks for `status=open` (claimable) so resolved/claimed posts don't crowd open ones off the first 20, with a **"Load more"** button that appends the next page (de-duped by id). The "N open" badge reads the server-side open total. "Mine" already sources `my-requests` (all statuses), so a member's own resolved/claimed posts stay reachable. Schema: none (`is_public` kept). Contracts/test-script/inventory updated.

- 2026-07-26: **Full code-review sweep of SocketRelay — correctness & reliability batch.** From a comprehensive review (the automated sweep timed out before the contracts/last files). Fixes: (a) the "Mine" feed filter now sources the owner-scoped `my-requests` list (fetched at pageSize 100) instead of the 20-item global feed, so a member's own older posts no longer vanish from "Mine" (they were being hidden once 20 newer board-wide posts existed, blocking Edit/Re-post); (b) the resolve route now returns proper status codes — a helper trying to resolve gets 403 (`actor_not_requester`), an already-resolved fulfillment gets 409 (`fulfillment_not_active`), and a bad `outcome` gets 400 (`invalid_outcome`) — instead of a 503 that also fired a false server-error alert; (c) `repostRequest` is now transactional with a `FOR UPDATE` lock and a `status <> 'claimed'` predicate (closing a claim-vs-repost race the earlier unlocked guard left open) and writes a `request_reposted` lifecycle event (closes #1881); (d) the claim-time Stream channel call is now best-effort — a Stream outage no longer fails an already-committed claim, drops its audit row, or loses the "someone offered to help" notification (the chat route self-heals the channel); (e) `updateRequest` guards against a concurrent delete (clean `request_not_found` instead of a 500); (f) the feed empty state now says "No matches" for a search/filter with no results instead of falsely claiming the board is empty; (g) the `?fulfillment=` deep-link param is stripped after handoff so a refresh doesn't re-force the Direct Line tab; (h) added the missing unique index backing `socket_relay_messages`' `ON CONFLICT` idempotency (the send route would otherwise throw 42P10). Verified false: #1367 (`updateRequest` already emits its `request_updated` event). Schema: one unique index (no columns/data). Contract-doc drift (undeclared profile/repost/admin-delete commands, resolve audit event, deletion-contract fictional tables, a few `dataAccess` mismatches) is tracked as a separate follow-up.

- 2026-07-26: **Direct Line audit part 2 — real counterparty names + repost guard.** (1) The Direct Line chat showed the other participant as a raw `user-xxxxxxxx` id: the chat-credentials route re-upserted both Stream users with a null display name on every open, overwriting the requester's handle set at claim. Fixed by capturing both `@usernames` on the fulfillment at claim time — new nullable `requester_username` / `fulfiller_username` columns on `socket_relay_fulfillments` (requester = the request's `owner_username`; fulfiller = the claimer's own username, threaded through `claimRequest` from the fulfill route). The channel-creation call (at claim and on every chat open) now reads these stored handles, so both participants render with a real name and a later open never degrades them. (2) `repostRequest` had no status guard and its route was unguarded, so a `claimed` request could be re-posted — blanking `claimed_fulfillment_id` and setting the request `open` while leaving its fulfillment `active` (a request that is simultaneously a live Direct Line and a "waiting for a helper" row, and re-claimable). It now rejects a repost of a `claimed` request (`request_not_repostable`, 409 with a readable message) — the requester must resolve the Direct Line first. Schema: two nullable columns (no data migration). Seed updated to populate the handles.
- 2026-07-26: **Direct Line audit — notification deep link + correct feed status for claimed requests.** Two fixes from a member-reported bug where the "someone offered to help" notification landed on the feed and a claimed request read as closed. (1) The claim notification now deep-links to the specific Direct Line: `linkPath` is `/apps/socket-relay?fulfillment=<id>` (was the bare `/apps/socket-relay`), and the web shell reads `?fulfillment=<id>` once its data loads and opens that conversation on the Direct Line tab (falling back to the Direct Line tab if the fulfillment is no longer active). (2) The feed request card no longer shows "✓ closed" for a `claimed` request — a claimed request now reads **"Being helped"** (its conversation is live on the Direct Line), and a `canceled` request reads "Canceled"; only a genuinely `closed` request shows "✓ closed". UI/link only; no schema, route, or contract change.
- 2026-07-26: **A too-long tag now gets a 400 that names the limit (#1104 follow-up).** The web post form already trims a tag to 64 characters, but a direct API call with a longer tag fell into the catch-all check in `validateRequestInput` and came back with the generic "Invalid request payload." message, which does not say what to fix. `POST /api/socket-relay/requests` and `PUT /api/socket-relay/requests/:id` now check the tag lengths first (shared `hasOverlongTag` in `lib/socket-relay/repository.ts`, the same rule `validateRequestInput` applies) and answer with "Each tag must be 64 characters or fewer." The status (400) and error code (`SOCKET_RELAY_INVALID_PAYLOAD`) are unchanged, and no previously-accepted payload is now rejected. No schema, route, or contract change.
- 2026-07-20: **Notifications producer.** Claiming a request now emits a best-effort notification (`notifySafe`, `socket-relay.request.claimed`, category `safety`) to the requester — deduped on the fulfillment id, never to the claimer. Emitted from the fulfill route. No schema/contract change.
- 2026-07-20: **Account deletion now clears the member's Stream chat copy (privacy).** SocketRelay fulfillment-thread chat is sent directly into Stream Chat under the Stream user `socket-relay-<userId>`, so Stream kept an independent copy that the Postgres-only account-deletion registry never removed (Stream retains messages with no expiry by default). Registered `deleteSocketRelayStreamData(userId)` (in `lib/socket-relay/stream.ts` — hard-deletes the Stream user with `mark_messages_deleted`; never throws) into the shared account-deletion external-cleanup hook (`lib/account/external-cleanup-registry.ts`), which the orchestrator runs after the DB transaction commits on every whole-account deletion path (full-account route, internal delete, Clerk webhook), best-effort (a Stream outage is logged, never blocks the deletion). No schema/route/contract change.
- 2026-07-17: **History-aware back + admin↔member navigation (app-wide sweep).** The member
  shell's hand-rolled back chevron was replaced by the shared `BackChevronButton` — it returns to
  the previous in-app page and falls back to All Apps when there is no in-app history. The admin
  surface header gained the shared "Member view" pill (`PluginUserShellButton`) linking to
  `/apps/socket-relay`. UI-only; no schema, route, or contract change.
- 2026-07-17: **Android Direct Line live chat (issue #1596).** The mobile "Direct Lines" tab previously listed active fulfillments with resolve buttons only and had no messaging surface, while web already rendered a real Stream chat per fulfillment. Added an "Open chat" button to each Direct Line card that opens a new full-screen modal (`SocketRelayDirectLineChat.tsx`) reusing the shared mobile `StreamChatView`; a new `fetchFulfillmentChatCredentials` in `api.ts` mints Stream credentials from the existing `POST /api/socket-relay/fulfillments/:id/chat` (`x-ctf-csrf: 1`, matching the web call) and connects to the **same** per-fulfillment Stream channel the web opens (`socket-relay-fulfillment-<id>`) — no new channel type, route, schema, or contract; resolve controls unchanged. Quota-impact note: `ctf/docs/quota-impact/2026-07-17-mobile-socket-relay-direct-line-chat.md` (Green — reuses the existing channel, only marginal extra Stream client connections). Member <-> member messaging over Stream; access is enforced server-side (participants only, 403 otherwise).
- 2026-07-16: **Owner always sees their own posts in the web feed (incl. expired), and clearer public-visibility copy.** The web shell feed filter (`socket-relay-shell.tsx`) previously hid every expired post outside the "Mine" filter, so an owner's expired post disappeared from the main "All" feed and its Re-post control was only reachable under "Mine". Now an expired post is hidden from everyone *except its owner* — the owner sees their own posts (active and expired, the latter with the Expired pill + Re-post) in every feed view, matching the Android app. Separately, reworded the misleading "Privacy Minimized — Public requests never include identifying information" copy (right panel, post form, and the Android privacy card): a public request *does* show the poster's `@handle`, and whether a request is public is the poster's own choice, so the copy now reads "You choose what's public … a public request shows your @handle, title, and tags — not the details you write." UI/copy only; no schema, route, or contract change.
- 2026-07-14: **Added refresh controls (app-wide refresh rollout).** Web: shared `RefreshButton` in the desktop and mobile-responsive shell headers (`socket-relay-shell.tsx`), wired to `fetchData(false)` so the feed, my-requests, and fulfillments re-pull without flashing the full-screen loading state. Android: native pull-to-refresh via `RefreshControl` on the feed `ScrollView` in `SocketRelay.tsx`, wired to a new background variant of `loadFeed` that skips the full loading state. UI-only; no schema, route, or contract change.
- 2026-07-11: **Request location (city/state/country) defaults from the member's directory profile, overridable per request (web).** Added `state`/`country` columns to `socket_relay_requests` alongside the existing `city` (schema + regenerated `schema.demo.sql`), wired through `RequestRow`/`mapRequestRow`/`mapPublicRequestRow`, `SocketRelayRequest`/`SocketRelayPublicRequest`/`SocketRelayRequestInput`, the create/update routes and repository SQL, and the web `SrRequest` type. The web post form (`sr-post.tsx`) gained shared `CountrySelect`/`StateField` controls; the shell (`socket-relay-shell.tsx`) best-effort loads the member's own directory location (`GET /api/directory/profile`) and seeds a new, untouched post draft with it — fully editable and clearable, because a request can be for a different place than where the member lives (a second property, a cross-city errand, a package abroad). The feed card and the feed search now use the combined "City, State, Country". Member location itself lives once on the directory profile (the shared member profile); this is a per-request location that *defaults* from it, not a copy. **Android parity deferred** — mobile posting still works city-only (server accepts it); mobile location editing needs the searchable mobile country picker (cf. #1380). No credit/money change.
- 2026-07-05: **Resolved the second batch of socket-relay code-review findings (#1366–#1371).** Correctness: a helper-canceled reopen (`unsuccessful_reopen`) now resets `expires_at` to `NOW() + 28 days` so the re-opened post is not immediately expired (#1366); `updateRequest` now writes a `request_updated` event in the same transaction as the edit, so the lifecycle log is no longer silent on edits (#1367, command contract `dataAccess` updated); `claimRequest` now passes readable display names to the Stream channel (requester `@username` from the request row, formatted short id for the fulfiller) instead of raw UUIDs (#1369); `validateProfileInput` returns a genuine boolean via `Boolean(...)` (#1371); removed the no-op `disconnectUser()` calls on the server-side (secret-keyed) Stream clients in `stream.ts` (#1370). Safety/determinism: `adminDeleteRequest` is now transactional — it clears the request plus its fulfillments, participants, and request-events (these tables have no FK cascade, so this prevents orphaned rows), retains `socket_relay_messages` as moderation evidence per the deletion contract, and the route continues to audit the removal (#1368). No schema change (no FKs added). Deletion contract and command contract updated.
- 2026-07-04: **Resolved the open socket-relay code-review findings.** Security/correctness: the chat-credentials route now returns 403 (not 404) when a fulfillment exists but the caller is not a participant, so it no longer leaks existence and matches the sibling routes (#1344); the SocketRelay-initiated ServiceCredits transfer is now declared as command `socket-relay.service-credits.send` (command + access-policy + audit contracts) and the route emits an audit row on success, closing the undeclared-access / unaudited-financial-mutation gap (#1342); the message-send audit now carries the `participantMembershipCheck` / `moderationCheck` evidence the audit contract asks for (#1101). Parity/safety: the web admin "Remove request" action now confirms before deleting, matching the mobile admin (#1343); the mobile feed no longer hides the owner's own expired posts when the my-requests load fails — it falls back to showing all expired posts so the owner is never locked out of re-posting (#1346). Cleanup: deleted the dead `SocketRelayStreamTab.tsx` + `fetchSocketRelayStreamCredentials.ts` (unreferenced; picked the first active fulfillment and rendered an out-of-scope video panel — the live Direct Line is `SocketRelayDirectLines`) (#1345). Verified already-correct and closed: the resolve audit event (#1103) and the mobile `createRequest` idempotencyKey (#1098) were already present in the code. No schema or table change.
- 2026-07-01: **Direct Line list now shows pending requests and hides canceled/closed lines; branded chat empty state.** Previously a Direct Line row only existed once a helper claimed a request, and the list also kept every canceled/closed fulfillment — so a member with two open requests but only one past claim saw a single, confusingly canceled row and nothing for the other request. The Direct Line list is now "one row per request you're waiting on or talking through": every **active** fulfillment plus the member's own **still-open, non-expired** requests as pending placeholders ("waiting for a helper"); canceled/closed fulfillments and claimed/closed requests drop out. A pending row is not chattable — selecting it shows a "No helper yet" pane explaining the request is still open on the feed and the Direct Line opens when someone offers. Composed client-side from `my-fulfillments` + `my-requests` (`?pageSize=100`) in `socket-relay-shell.tsx` via a new `buildDirectLines` helper and `SrDirectLine` union in `sr-shared.ts`; `sr-chat.tsx` renders both row kinds. Mobile parity: `SocketRelayDirectLines.tsx` fetches `listMyRequests()` alongside `listMyFulfillments()` and renders active fulfillment cards plus pending-request cards, dropping non-active fulfillments. Separately, the shared `StreamChatPanel` replaces Stream's built-in "No chats here yet…" message-list empty state with an on-brand card ("No messages yet" + a nudge to send the first message) via a custom `EmptyStateIndicator`, which benefits every plugin that uses the panel. No schema, route, or contract change; presentation only, no change to chat access or the messaging lifecycle.
- 2026-06-27: **Resolved the socket-relay code-review sweep findings (#1097–#1104).** Security: moved the CSRF check ahead of the auth gate on `POST /api/socket-relay/service-credits` so it matches every other mutation route (#1097); added the missing CSRF check to `POST /api/socket-relay/fulfillments/:id/chat` — both the web shell and mobile credential fetch already send `x-ctf-csrf: '1'` (#1102). Audit trail: the four member lifecycle mutations now emit an audit row via `insertSocketRelayAudit`, matching the audit contract — `socket-relay.request.create` (#1100), `socket-relay.fulfillment.claim` (#1099), `socket-relay.fulfillment.message.send` (#1101), and `socket-relay.fulfillment.resolve` (#1103). Correctness: the mobile `createRequest` now sends a stable `idempotencyKey` in the POST body instead of relying on the server's non-deterministic fallback (#1098); the tag editors on web (`sr-post` TagEditor) and mobile (`SocketRelayTagInput`) truncate a tag to the server's `MAX_TAG_LENGTH` (64) before adding it, so a too-long tag can no longer pass the form and bounce off the API (#1104). No schema, table, or route change; no new contract command (the audited commands already exist in the command/access/audit contracts).
- 2026-06-26: **Renamed the plugin `socketrelay` → `socket-relay` (hard cutover, no aliases).** Kebab-case everywhere it is a slug, folder, route, command, or contract-file prefix: the app shell is now `/apps/socket-relay`, the admin surface `/admin/socket-relay`, every API route `/api/socket-relay/*`, every command `socket-relay.*`, and the four contract files are `SOCKET_RELAY_*`. The web component dir, the web lib dir, and the mobile feature dir moved to `socket-relay`; the jammed component files became `socket-relay-*.tsx`. The eight DB tables moved to the matching snake_case prefix — `socket_relay_user_extension`, `socket_relay_requests`, `socket_relay_request_accepted_currencies`, `socket_relay_request_events`, `socket_relay_fulfillments`, `socket_relay_fulfillment_participants`, `socket_relay_messages`, `socket_relay_admin_audit_trail` — with the price-consistency CHECK constraint and its index renamed to match. `schema.sql` and `schema.demo.sql` run `ALTER TABLE IF EXISTS … RENAME TO …` before the `CREATE … IF NOT EXISTS` blocks (and drop the legacy-named constraint) so an existing DB keeps its rows and a fresh DB builds the new names directly; no data loss. The `SOCKETRELAY_*` SCREAMING_SNAKE constant family (page-size/length limits, `SOCKET_RELAY_ERROR_CODE` and its string values) moved to `SOCKET_RELAY_*`; the observability `area` tag is now `socket-relay`. Cross-plugin refs updated: the Trust completed-trades/opened-requests signals (`engagement-socket-relay-trades` / `engagement-socket-relay-requests`) and Trust contract dataAccess, GDP recognition (`recognition.ts` + `recognizeGdp.mjs` + GDP contract dataAccess), member-presence derivation + deep link, the account-deletion registry, the plugin registry slug + schema seed row, the concierge intent/featured slug, the parity contract slug + mobileFeatureDirs, and the theme accent keys (web + mobile). The pre-existing `'socket-relay' → 'socketrelay'` alias in `repository.ts` was removed (the slug is now canonical). PascalCase `SocketRelay…` identifiers and the `SocketRelay` display name are intentionally unchanged. No behavior change.
- 2026-06-25: **Documented the service-credits route** (inventory-debt burn-down — documentation catch-up, no code change). Added `POST /api/socket-relay/service-credits` (send credits caller→`toUserId` via the shared `createTransfer` primitive with `originPlugin: 'socket-relay'`; read-access gated + CSRF; SocketRelay owns no credits ledger) to the §3 user-routes list. Verified against the route handler. Removed it from `ctf/scripts/inventory-drift-allowlist.json` — this was the **last** allowlisted item, so the inventory-drift allowlist is now empty and the gate enforces full table/route documentation coverage.
- 2026-06-19: The requester now decides how a claimed request resolves, and the Direct Line shows context. Previously **either** participant could close a fulfillment (which closed the whole request), there was no requester-facing resolve UI, and the chat showed a bare "Fulfillment <uuid>" with no idea what it was about. Now: `resolveFulfillment` (replacing `closeFulfillment`) enforces that **only the requester or an admin** can resolve, with four outcomes — `successful` / `no_longer_needed` close the request; `unsuccessful_reopen` cancels the helper and returns the request to `open` for others; `unsuccessful_close` closes it (outcome stored in `close_reason`). The `POST /fulfillments/:id/close` route now requires an `outcome` and is gated to the requester (or an admin). The web chat (`sr-chat`) shows the request title + your role (your request vs you're helping), a clearer empty state, the four resolve actions for the requester, and a "only the requester can close" note for helpers; `my-fulfillments` now joins the request title/status for that context. Added `socket-relay.fulfillment.resolve` to the command + access-policy contracts. Also fixed the left rail (the brand mark duplicated the Feed tab's Share2 glyph → now a distinct Radio mark; removed the dead Bell/Settings buttons; static "S" avatar → live Clerk account menu). Android parity for the requester resolve flow is deferred (web first). No schema change.
- 2026-06-18: Removed per-plugin announcements from SocketRelay. Deleted the admin Announcements tab and its inline post/delete form from `socket-relay-admin-shell.tsx` (with the draft state and create/delete functions), the user/admin announcement routes (`/api/socket-relay/announcements`, `/api/socket-relay/admin/announcements` and its `:id` route), the repository announcement functions (`listSocketRelayAdminAnnouncements`, `createSocketRelayAdminAnnouncement`, `updateSocketRelayAdminAnnouncement`, `deleteSocketRelayAdminAnnouncement`, `listAnnouncementsForSocketRelayUser`) and the announcement validator, and the `SocketRelayAnnouncementInput` type. The Android admin (`AdminSocketRelay.tsx` + `admin-api.ts`) no longer reads the announcements endpoint either. Announcements are now posted in one place — the Feed (`feed-announcements` plugin), which can target any plugin (including SocketRelay) — so the Feed is the single place to post announcements about SocketRelay. No schema change: SocketRelay only ever read the shared `announcements` table by targeting (it has no SocketRelay-specific announcements table). Sections 1.6, 2.2, and the announcement route entries were removed above to match.
- 2026-06-13: Web admin design pass. Replaced the bare diagnostic `/admin/socket-relay` page with `components/socket-relay/socket-relay-admin-shell.tsx`, styled to the admin design system (header with icon + ADMIN badge, snapshot stat blocks, Requests / Fulfillments / Announcements tabs). Bound to the real backend — `listAdminRequests`, `listAdminFulfillments`, `listSocketRelayAdminAnnouncements`. Real actions wired to existing endpoints (with `x-ctf-csrf: '1'`): remove a request (`DELETE /api/socket-relay/admin/requests/:id`), post an announcement (`POST /api/socket-relay/admin/announcements`), and delete an announcement (`DELETE /api/socket-relay/admin/announcements/:id`); fulfillments are a read-only list. No new endpoint, schema, or contract.
- 2026-06-12: Removed the "Make this request publicly visible" toggle from the post form (web `sr-post.tsx`; Android had no visible toggle). SocketRelay is community-only — there is no public board, so the option was misleading. Requests are now members-only (`isPublic` defaults to `false` on both web and Android); the now-redundant "Members only" feed badge was removed. Also made the web post form show friendly, field-specific validation (title, details, at least one tag, and an amount when a priced value type is chosen) before submitting, so a member never sees the raw server "Invalid request payload" message. No schema, route, or contract change (the `is_public` column stays; it is just no longer user-toggled).
- 2026-06-12: Adopted the shared currency selector on "Post a Request" (issue #420). A request can now name **how it's settled** — default **Free** (mutual aid), or ServiceCredits / fiat / crypto / Barter. Data model: `socket_relay_requests.price_currency` (FK → `currencies.code`) and `price_amount` are now written/read; the price-consistency check was relaxed so an amount-less named type (Free, Barter — `requires_amount=false`) is allowed (currency set, amount null), alongside "no value type" (both null) and "priced" (positive amount + currency). API: `POST /api/socket-relay/requests` (create) and `PUT /api/socket-relay/requests/:id` (update) parse `priceCurrency`/`priceAmount` and validate them against the catalog via `isValidRequestPrice` (amount required only for priced types; also enforced in the repository write path). UI: the web post form (`sr-post.tsx`) and Android (`SocketRelay.tsx`) show the value-type selector with the amount input hidden for Free/Barter; the feed shows a settlement badge (`settlementLabel` — never the bare `SC` code, never a fiat equivalent for ServiceCredits). Free/Barter exchanges become a Community Value Index source once recognition is wired (issue #121).
- 2026-06-12: Android admin client (`admin-api.ts`) and the chat-credentials fetcher (`fetchSocketRelayStreamCredentials.ts`) now go through the shared authenticated fetch wrapper (`authedFetch`) like `api.ts` already does: the Clerk bearer token is attached and the base URL comes from runtime config, replacing the plain dev-only fetch against hardcoded emulator/localhost URLs. The admin functions no longer take a token argument (the wrapper supplies the live token); `AdminSocketRelay.tsx` call sites updated. The chat-credentials fetcher now looks up the member's active fulfillment via `GET /my-fulfillments` and posts to `/api/socket-relay/fulfillments/{id}/chat` with the real id (the old hardcoded `active` path segment always returned 404), and reads the channel id from the route's `channelId` field. No backend, schema, or contract change.
- 2026-06-12 (second pass): Multi-tag model + edit flow + Android filter parity (owner decision: guided free-form tagging). Schema: added `tags TEXT[] NOT NULL DEFAULT '{}'` to `socket_relay_requests`; `category` stays in sync with the first tag for older clients, and legacy rows read as `[category]`. Server: `normalizeTags` (trim, collapse whitespace, fold case-insensitive duplicates), validation of 1-3 tags at 64 chars each; `POST /requests` and `PUT /requests/:id` accept a `tags` array or the legacy single `category` string. Contracts: `socket-relay.request.create` bumped to 1.1.0; new `socket-relay.request.update` entry. Seed script writes `tags`. Web shell: post form gained a chip-based tag editor (cap 3) with in-use suggestions; feed cards show all tags; owners get an Edit button that reuses the post form against the existing PUT route; tag filtering matches any tag, chips capped at the 10 most-used. Android: same tag editor (`SocketRelayTagInput.tsx` + `tags.ts` helpers), tag badges, and — new for parity — the search box and tag filter chips the web feed already had, plus the edit-own-request flow: ownership is derived from `GET /my-requests` (see Gaps note 5), own open cards show "Edit Your Request", and the post form doubles as the edit form against `PUT /requests/:id` (new `updateRequest`/`listMyRequests` bindings in `api.ts`).
- 2026-06-12: Tag system rework (owner request). Removed the hardcoded category chip list (and its "Mental Health" entry) from the web shell. Filter chips in the feed (phone layout) and sidebar (desktop) are now derived from the tags actually present in loaded requests, most-used first, via `deriveCategories` in `sr-shared.ts`; filtering is case-insensitive. The post form field is relabeled "Tag" with anything-goes placeholder copy on web and Android. The request `category` column and the API contract are unchanged (free text, 1–64 chars, still required). UI-only; no schema/API/contract change.
- 2026-06-06: Android admin parity (design `MobileSocketRelayAdmin.tsx`). Added `packages/mobile/src/features/socket-relay/AdminSocketRelay.tsx` + `admin-api.ts`, registered as the `socket-relay-admin` feature in `App.tsx`. Mirrors the web admin (`app/admin/socket-relay/page.tsx`): four stat cards plus request, fulfillment, and announcement lists, binding the existing routes only — `GET /admin/requests`, `GET /admin/fulfillments`, `GET /admin/announcements`, and `DELETE /admin/requests/:id` (with `x-ctf-csrf: 1`). Server-side admin gate; 401/403 renders an "admins only" notice. Delete request requires a confirm dialog. Confirmed the web admin page is already mobile-responsive (responsive Tailwind grid, stacks at the 768px breakpoint) — no web change required. Omitted approve/reject (no backing endpoint) and announcement create (plugin targeting not accepted by the POST route); both noted in Gaps. No schema/API/contract change.
- 2026-05-31: Android pixel pass (design `MobileSocketRelay.tsx`). Created `api.ts` bound to real web routes (GET requests, POST requests with CSRF, POST fulfill with CSRF). Rebuilt `SocketRelay.tsx` to mockup (`MobileSocketRelay.tsx`) in RN primitives; added `SocketRelayLoading.tsx`, `SocketRelayEmpty.tsx`, `SocketRelayPublic.tsx` sub-components. Mock file retired (was already empty). Omitted: need/offer type distinction, urgency badge, credits counter — not in `SocketRelayRequest` model. Delivery status: Android ✅.
- 2026-05-29: Web UI circle-back (design `c5d83c0`). Rebuilt the `/apps/socket-relay` shell to the `SocketRelay.tsx` mockup + Loading/Empty; fixed runtime bugs in the prior shell (read the paged `requests` response as a bare array; POSTed non-existent `type`/`description`/`location`/`credits` fields without CSRF). The rebuild uses the real request/claim/fulfillment model + `x-ctf-csrf` header and unwraps `{ items, ... }`; decomposed into modular sub-components within rule-116 limits; the mockup's unbacked need/offer/credits/urgency framing was omitted. No schema/API change.
- 2026-05-18: Inventory updated to enforce Rule 120 living-snapshot model. Removed "Web-First Delivery Strategy and Android Deferrals" section, "Docs Lifecycle" meta section, and planning-state framing. Replaced narrative data model bullets with the actual `socket_relay_*` tables. Confirmed `web+android complete` and dedicated seed script.
- 2026-02-25: Created initial SocketRelay CTF rewrite inventory.


## Build Checklist

> **Reconciliation (2026-05-26):** the Delivery Status above was `web+android complete` (feature parity) at the time; the Android surface was removed 2026-07-20 (rule 105, PR #1742) and this feature is now **web-only**.
> Unchecked items below are obsolete web-first / Android-deferral planning artifacts and deferred MVP
> validation/release gates (Rule 118) — not missing implementation. The authoritative production bar
> (pixel-perfect to `design` + parity + gates + deploy) is tracked in
> `ctf/docs/developer/PRODUCTION_READINESS_PLAN.md`, which wins where it differs from this checklist.
>
> **Superseded 2026-07-26:** every "public projection / public API routes / public DTO privacy" item
> below is obsolete — v3 is members-only and the anonymous public board was removed. Ignore those
> items; see §1.5 (Members-Only Visibility) and the Change Log.

### Scope and Boundary

- [ ] Confirm implementation scope is `ctf/` only.
  - Acceptance criteria:
    - No implementation tasks target `platform/`.
- [ ] Confirm plugin identity is locked.
  - Acceptance criteria:
    - Plugin name is `SocketRelay`.
    - Plugin slug is `socket-relay`.
- [ ] Confirm legacy docs remain untouched.
  - Acceptance criteria:
    - `ctf/docs/developer/socket-relay-feature-inventory.md` is unchanged.
    - `ctf/docs/developer/socket-relay-rewrite-checklist.md` is unchanged.

### �� Decision Lock

- [ ] Lock web-first delivery policy.
  - Acceptance criteria:
    - Web is the default MVP release gate.
- [ ] Lock Android deferral policy.
  - Acceptance criteria:
    - Android parity items are tracked with owner, due date, and risk note.
    - Android parity is not treated as a strict MVP parity gate.
- [ ] Resolve open contract ownership questions.
  - Acceptance criteria:
    - Schema authority, DTO authority, and module ownership are explicitly assigned.

### �� Contract and Schema Lock

- [ ] Finalize profile/request/fulfillment/message/announcement contracts.
  - Acceptance criteria:
    - Route payloads, status enums, and validation outcomes are explicit.
- [ ] Finalize request and fulfillment lifecycle semantics.
  - Acceptance criteria:
    - Status transitions and actor permissions are deterministic.
- [ ] Finalize public projection contract.
  - Acceptance criteria:
    - Public DTO contains only approved privacy-minimized fields.
- [ ] Finalize schema/seed alignment contract.
  - Acceptance criteria:
    - Shared schema, migrations, and seeds align on fields and constraints.

### �� API and Policy Controls

- [ ] Implement user/authenticated API routes for core lifecycle flows.
  - Acceptance criteria:
    - Profile, request, fulfillment, and message paths match planned contracts.
- [ ] Implement public API routes with abuse controls.
  - Acceptance criteria:
    - Public list/detail routes enforce privacy projection and rate controls.
- [ ] Implement admin moderation and announcement routes.
  - Acceptance criteria:
    - Admin routes are role-gated and auditable.
- [ ] Enforce CSRF consistency on admin writes.
  - Acceptance criteria:
    - All admin write endpoints enforce identical CSRF contract behavior.

### �� Web MVP Delivery (Release Gate)

- [ ] Deliver dashboard and request lifecycle UX.
  - Acceptance criteria:
    - Create/update/repost/claim flows complete with deterministic status UX.
- [x] ~~Deliver profile CRUD UX.~~ Superseded (2026-08-04): identity/location live on the shared Directory profile — see §1.2. No SocketRelay profile surface will be built.
  - Acceptance criteria:
    - Validation, delete confirmation, and post-delete behavior are stable.
- [ ] Deliver fulfillment chat UX.
  - Acceptance criteria:
    - Participant-only access and failure states are deterministic.
- [ ] Deliver public list/detail and announcement UX.
  - Acceptance criteria:
    - Public privacy contract and announcement filtering behavior are correct.

### �� Android Deferrals Tracking (Not Strict Parity Gate)

- [ ] Define Android in-scope and deferred SocketRelay surfaces.
  - Acceptance criteria:
    - Each deferred item has owner, due date, and risk note.
- [ ] Ensure Android uses the same API/policy outcomes as web for shipped flows.
  - Acceptance criteria:
    - Deny/allow semantics match web for implemented Android features.
- [ ] Maintain deferral closure tracker.
  - Acceptance criteria:
    - Tracker is updated in each PR that changes Android scope.

### �� Risk Mitigation and Hardening

- [ ] Mitigate **schema drift** risk.
  - Acceptance criteria:
    - CI gates detect drift across shared schema, migrations, and seeds.
- [ ] Mitigate **public DTO privacy mismatch** risk.
  - Acceptance criteria:
    - Contract and validation gate fail on non-approved public field exposure.
- [ ] Mitigate **cross-module boundary bleed** risk.
  - Acceptance criteria:
    - Route-to-module ownership map is explicit and validated.
- [ ] Mitigate **validation weakness** risk.
  - Acceptance criteria:
    - Critical lifecycle and policy-negative paths are covered by manual validation walkthroughs.
- [ ] Mitigate **CSRF consistency ambiguity** risk.
  - Acceptance criteria:
    - One uniform CSRF policy contract is enforced and verified for admin writes.

### �� Validation, Seeds, and Release Gates [MVP: VALIDATION DEFERRED — see Rule 118.]

- [ ] API groups design documentation against contracts.
  - Acceptance criteria:
    - Success, validation, unauthorized, forbidden, and not-found paths are documented.
- [ ] Lifecycle integration design documentation.
  - Acceptance criteria:
    - Request → fulfillment → close and chat access constraints are documented.
- [ ] Privacy and abuse-control design documentation for public routes.
  - Acceptance criteria:
    - DTO projection and anti-scraping/rate-limit behavior are documented.
- [ ] Release readiness documentation.
  - Acceptance criteria:
    - Schema and seed documentation is complete.

### Docs Lifecycle (Rule 120)

- [ ] Keep this checklist and `ctf-socket-relay-feature-inventory.md` synchronized.
  - Acceptance criteria:
    - Feature add/remove/behavioral changes update both docs in the same PR.
- [ ] Implementation tracking. [EVIDENCE CAPTURE DEFERRED FOR MVP — see Rule 118.]
  - Acceptance criteria:
    - Implementation status is tracked; evidence collection deferred to post-MVP.
- [ ] Track removals in inventory changelog/deprecations notes.
  - Acceptance criteria:
    - Removed scope is date-stamped and not silently deleted.

### Change Log

- 2026-08-03: **Root cause of the "Message Failed · Unauthorized" outage found — a Stream channel-type setting, not app code.** With the reason now shown on screen (entry below), the Direct Line reported: `SendMessage failed with error: "pending messages not enabled for this app"`. `mark_messages_pending` is switched on for the `messaging` channel type, so Stream tries to hold every message for review, but the Stream app does not have the pending-messages feature — so it refuses **every** send, from **every** member, on **every** chat that uses that channel type (SocketRelay Direct Line, LightHouse, TrustTransport, PeerProgramming, Foundation, Beacon). Nothing in this repo can cause or cure it; the repair is to turn "Mark Messages Pending" off for the channel type in the Stream dashboard. Added `ctf/packages/web/scripts/check-stream-channel-config.mjs` (`pnpm --dir ctf/packages/web run check:stream-channel-config`) which reads the channel-type settings back and names any that block sending, with `--fix` to turn the blocking setting off. Read-only without `--fix`; never prints a key or secret. No schema, route, or contract change.
- 2026-08-03: **A refused Direct Line message now says why (owner report — the failure came back after the connection fix below).** "Message Failed · Unauthorized" is the chat library's label for *any* send Stream refuses with a 403 — not a member of the conversation, conversation frozen, sender banned, or the Stream app at a plan limit — and the library throws away Stream's own explanation, so neither the member nor the logs could tell those apart. The library also renders the composer without ever checking whether the member is allowed to post, so a conversation that can only fail still looks writable. Now: the panel reads the member's capabilities when the conversation opens (they already arrive with the existing `watch()` call — no extra request) and, when posting is not allowed, replaces the composer with a plain reason instead of a composer that is guaranteed to fail; a refused send shows the reason Stream gave, above the composer; and both are recorded with the capability list, the frozen flag, the channel id, and which Stream app answered. Server side, the SocketRelay chat route now confirms Stream really holds both participants as members of the conversation (one `queryMembers` read per open) and records a mismatch — membership is what grants the right to post, so a silent mismatch there is exactly what a refused send looks like. New shared helper `lib/shared/stream-chat-send-state.ts` (10 unit tests). Applies to every plugin chat, not only SocketRelay. No schema, route, or contract change.
- 2026-08-02: **Direct Line send no longer fails "Message Failed · Unauthorized" (owner report).** Root cause was in the shared browser-side Stream Chat connection, not in SocketRelay itself: every chat surface shared one Stream client per API key (`StreamChat.getInstance`), while each surface signs in as its own Stream user (`socket-relay-<id>`, the Commons live layer's `feed-<id>`, etc.). Whichever surface connected last silently re-signed-in the shared client as its own user, so an open Direct Line could end up sending as a user who is not in the conversation — Stream rejects that send with a 403 and the member sees "Message Failed · Unauthorized" (the same failure earlier reported on canceled Direct Lines, which had been masked by the read-only notice rather than fixed at the root). Fixed by a new connection manager (`lib/shared/stream-chat-connection.ts`) that keeps one client **per (API key, Stream user)** — a surface can no longer re-sign-in or disconnect another surface's connection — used by both `StreamChatPanel` (all plugin chats) and the Commons live layer (`lib/hub/live-stream.ts`). No schema, route, or contract change. **Android parity — share control on each request card (#435).** The React Native feed (`SocketRelay.tsx`) now renders the shared mobile `ShareLink` under each request card's meta line, mirroring the web feed (`sr-feed.tsx`), which already shares each request. The link is an absolute deep link `${getApiBaseUrl()}/apps/socket-relay?request=<id>` (the same target the web feed copies); the mobile control copies or shares through the OS share sheet. The URL is built from the same `APP_URL` runtime config the API calls resolve against; if it is unset the card renders no share control rather than crashing. UI-only; no schema, route, or contract change. (Honoring `?request=<id>` to scroll the feed straight to the shared request — on both web and mobile — remains a follow-up; today the link opens the SocketRelay feed, auth-gated, on the destination device.)
- 2026-06-23: **Android parity for 28-day auto-expiry + re-post.** The React Native SocketRelay feed (`packages/mobile/src/features/socket-relay/SocketRelay.tsx`) now reads the `expiresAtIso` / `isExpired` fields (added to the mobile `SocketRelayRequest` type) and treats expired posts as inactive: other members' expired posts drop out of the feed, and the "I Can Help" button is disabled (shows "Expired") as a guard. A member's own expired post stays on the feed with an **Expired** pill and a **Re-post** button (new `repostRequest()` client → existing `POST /api/socket-relay/requests/:id/repost`, which resets the 28-day clock and is swapped into the feed in place) alongside **Edit**. `fulfillRequest` now surfaces the server error code, so a claim that races an expiry (`request_expired`, 409) reloads the feed instead of failing silently. No schema, route, or contract change. Closes the Android parity ticket (#740).
- 2026-06-21: Posts auto-expire after 28 days, with a re-post button, and own-post editing is easier to reach on a phone (owner request). Schema: added a nullable `expires_at TIMESTAMPTZ` to `socket_relay_requests` (`schema.sql` + regenerated `schema.demo.sql`, additive `ALTER … ADD COLUMN IF NOT EXISTS`, plus a one-time `UPDATE … = created_at + INTERVAL '28 days'` to backfill existing rows). Expiry is derived at read time (`isExpired` = open AND `expires_at` past), so no scheduled job is needed; `createRequest` sets `expires_at = NOW() + 28 days` and `repostRequest` resets it. `claimRequest` now rejects a claim on an expired-but-open post (`request_expired`, new error code mapped to a friendly 409). Types (`SocketRelayRequest`, web `SrRequest`) gained `expiresAtIso` + `isExpired`. Web feed (`sr-feed.tsx` / `socket-relay-shell.tsx`): expired posts drop out of the active feed and the "X open" count; a member now has a leading **Mine** filter chip to find their own posts on any screen size, where an expired own post shows an **Expired** pill with **Re-post** (resets the 28-day clock via the existing `POST /requests/:id/repost`) and **Edit**. No new API route or contract — the repost route already existed; this wires it into the member UI. Android parity deferred (tracked below).
- 2026-06-04: Owner decision — SocketRelay is **not anonymous**. A request poster / chat participant is identified by their **`@username`** (the unique handle they chose at sign-up), and that `@username` is what's shown **even in the not-signed-in / public view** (a chosen handle, not a real name, so it is safe to surface publicly). This supersedes the design mockups' "Anonymous" poster treatment (design catch-up tracked as gap D5 in the design-prompt issue #312).
- 2026-06-04: Implemented the public `@username`. Added a nullable `owner_username TEXT` column to `socket_relay_requests` that captures the poster's username at request-creation time (denormalized from the Clerk session, like `chyme_messages.username` and `feed_community_posts.author_username`); the create function writes `gate.auth.username`. Both the authenticated `SocketRelayRequest` DTO and the public `SocketRelayPublicRequest` projection now carry `ownerUsername`. Web (`sr-feed` request cards) and Android (`SocketRelay` feed cards) render `@username` with a neutral `user-<id>` fallback when no username was captured. Schema (`schema.sql` + `schema.demo.sql`, additive `ALTER TABLE … ADD COLUMN IF NOT EXISTS`), repository, types, create route, and both client surfaces updated.
- 2026-06-02: Removed the unused `display_name` column from `socket_relay_user_extension` (and the `displayName` field from `SocketRelayProfile`/`SocketRelayProfileInput`, the profile route parser, and the repository reads/writes). Nothing rendered it; SocketRelay identifies people by their Clerk `@username` (built in the relay/chat routes), so the stored display name was dead. Dropped via `db/migrations/post/0003_socket_relay_drop_display_name.sql` (guarded, re-runnable). Part of removing the v2 "display name" convention from v3.
- 2026-06-01: Enforced the SocketRelay price invariant at the DB level — added a guarded `socket_relay_requests_price_consistency_check` CHECK so a request either has no price (both NULL) or a positive amount in a named currency (the "Free = no price, never `$0`" rule). Follow-up to the #120 review.
- 2026-06-01: Multi-currency (issue #120): added OPTIONAL `price_amount` + `price_currency` (FK → `currencies.code`) to `socket_relay_requests` and a `socket_relay_request_accepted_currencies` join. "Free" renders from the absence of a price, never `$0`. Documented the no-fiat-parity rule. Schema + inventory only; the currency UI is design-gated.

- 2026-02-25: Created initial SocketRelay CTF rewrite checklist with web-first release gating, tracked Android deferrals, lifecycle requirements, and explicit mitigation gates for legacy-known risks.
- 2026-05-31: Documented the transaction-scoped messaging lifecycle per platform rule 100 ("Messaging Scope and Lifecycle"): the per-fulfillment 1:1 chat closes on terminal fulfillment state (read-only window + `socket_relay_messages` retained for moderation/abuse evidence); no messaging outside an active fulfillment. Aligning the deletion contract to mirror this retention is a tracked follow-up.
