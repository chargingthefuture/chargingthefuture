# SocketRelay Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Plugin name: `SocketRelay`
- Plugin slug: `socketrelay`
- Owned surfaces: `/apps/socketrelay` (web), `packages/mobile/src/features/socketrelay` (Android), `/api/socketrelay/*` routes, `socketrelay_*` tables.
- Not owned: identity (Clerk), ServiceCredits ledger (service-credits plugin), email/SMS transport (notifications integration).

## Intent and Outcome

SocketRelay is a request-and-fulfillment plugin with profile management, request lifecycle, fulfillment closure, participant chat, public sharing views, and admin moderation controls.

## 1) User Features

### 1.1 Dashboard and Request Lifecycle

1. Authenticated request dashboard with active and owned request views.
2. Request create/update/repost flows with deterministic status semantics. Owners can edit their
   own open requests from the feed (web); the edit reuses the post form and the existing
   `PUT /api/socketrelay/requests/:id` route.
3. Ownership-aware request visibility and action controls.
4. Tagging: each request carries 1-3 free-text tags (max 64 chars each; server normalizes
   whitespace and folds case-insensitive duplicates). Feed filter chips are derived from the tags
   actually in use, most-used first, capped at 10. The post form suggests tags already in use so
   vocabulary converges without a curated list (owner decision, 2026-06-12: guided free-form).

### 1.2 Profile Management

1. Profile read/create/update/delete flows under authenticated context.
2. Deterministic validation for user-editable profile fields.
3. Deletion flow with explicit reason and policy-compliant outcomes.

### 1.3 Fulfillment Lifecycle

1. Fulfillment claim flow for eligible requests.
2. Fulfillment detail and “my fulfillments” views.
3. Closure outcomes with canonical status taxonomy.

### 1.4 Fulfillment Chat

1. Participant-only chat retrieval and send flows for fulfillment threads.
2. Access control constrained to request owner and fulfiller.
3. Deterministic error semantics for unauthorized access paths.
4. Lifecycle: the chat is scoped to a single fulfillment between exactly the two participants (request owner + fulfiller) and opens with the fulfillment. When the fulfillment reaches a terminal state (completed, cancelled, disputed) the chat closes: no new messages may be sent, both parties keep read-only access for a limited window, and `socketrelay_messages` are retained server-side for moderation/abuse evidence per the deletion contract. No 1:1 messaging exists outside an active fulfillment (platform rule 100, "Messaging Scope and Lifecycle").

### 1.5 Public Sharing Surface

1. Public list and public detail views for shareable requests.
2. Public DTO projection with privacy-minimized fields only.
3. Anti-scraping and rate-limit behavior defined at contract level.

## 2) Admin Features

### 2.1 Requests and Fulfillments Oversight

1. Admin list/oversight views for requests and fulfillments.
2. Role-gated moderation actions for request lifecycle interventions.
3. Deterministic audit capture for sensitive admin mutations.

## 3) API Surface and Route Map

User/authenticated routes:

- `GET /api/socketrelay/profile`
- `POST /api/socketrelay/profile`
- `PUT /api/socketrelay/profile`
- `DELETE /api/socketrelay/profile`
- `GET /api/socketrelay/requests`
- `GET /api/socketrelay/requests/:id`
- `GET /api/socketrelay/my-requests`
- `POST /api/socketrelay/requests`
- `PUT /api/socketrelay/requests/:id`
- `POST /api/socketrelay/requests/:id/repost`
- `POST /api/socketrelay/requests/:id/fulfill`
- `GET /api/socketrelay/fulfillments/:id`
- `GET /api/socketrelay/my-fulfillments`
- `POST /api/socketrelay/fulfillments/:id/close` — requester-only resolve; body `{ outcome: 'successful' | 'no_longer_needed' | 'unsuccessful_reopen' | 'unsuccessful_close' }`. `unsuccessful_reopen` returns the request to `open`; the others close it. Helpers cannot resolve.
- `GET /api/socketrelay/fulfillments/:id/messages`
- `POST /api/socketrelay/fulfillments/:id/messages`

Public routes:

- `GET /api/socketrelay/public`
- `GET /api/socketrelay/public/:id`

Admin routes:

- `GET /api/socketrelay/admin/requests`
- `GET /api/socketrelay/admin/fulfillments`
- `DELETE /api/socketrelay/admin/requests/:id`

## 4) Data Model and Storage Contracts

Tables owned by this plugin:

1. `socketrelay_user_extension` — Per-user profile extension fields.
2. `socketrelay_requests` — Request lifecycle rows (status, ownership, repost lineage). Includes a
   `tags TEXT[] NOT NULL DEFAULT '{}'` column holding 1-3 free-text tags; the legacy `category TEXT`
   column is kept in sync with the first tag so older clients (and legacy rows, which read as
   `[category]`) keep working. Also includes a nullable `owner_username TEXT` column that captures the poster's chosen `@username` at request-creation time (denormalized from the Clerk session, exactly like `chyme_messages.username` and `feed_community_posts.author_username`), because v3 has no reliable server-side store of other users' usernames. This handle is surfaced in every view, including the not-signed-in / public projection — never "Anonymous" (owner decision, 2026-06-04). Includes a nullable `expires_at TIMESTAMPTZ` column: a post auto-expires 28 days after it is posted or last re-posted. Expiry is derived at read time (`isExpired` = open AND `expires_at` has passed), so no scheduled job flips a status; `created_at`/`updated_at` and `reopened_count` are unchanged. Create sets `expires_at = NOW() + 28 days`; `repostRequest` resets it; a claim on an expired-but-open post is rejected (`request_expired`).
3. `socketrelay_request_events` — Event log for request state transitions.
4. `socketrelay_fulfillments` — Fulfillment claims and outcomes per request.
5. `socketrelay_fulfillment_participants` — Participant access records for fulfillment chats.
6. `socketrelay_messages` — Participant-only chat messages on a fulfillment. The chat is transaction-scoped: after the fulfillment reaches a terminal state no new rows may be added; existing rows become read-only for the two participants for a limited window and are retained server-side for moderation/abuse evidence per the deletion contract (platform rule 100).
7. `socketrelay_admin_audit_trail` — Audit log for admin mutations.
8. `socketrelay_request_accepted_currencies` — join (`request_id`, `currency_code` FK → `currencies.code`) for any currencies an offered reward accepts.

Multi-currency (issue #120): SocketRelay is mutual aid and posts are free, so `socketrelay_requests`
gains OPTIONAL `price_amount` + `price_currency` (FK → `currencies.code`) for the rare case a reward is
offered. "Free" renders from the ABSENCE of a price (NULL `price_amount`), never as `$0`. "Accepts
ServiceCredits" is true only when a `socketrelay_request_accepted_currencies` row with `currency_code='SC'`
exists — never derived from `price_currency`. No ServiceCredits amount is shown at a fiat equivalent.

Storage and projection rules:

1. Request and fulfillment status transitions are explicit and replay-safe via the `request_events` log.
2. Public projection contracts are separated from authenticated/admin DTOs (privacy-minimized fields only on public routes). The public projection (`SocketRelayPublicRequest`, served by `GET /api/socketrelay/public` and `GET /api/socketrelay/public/:id`) now includes `ownerUsername` so the poster's `@username` is shown to signed-out visitors (owner decision, 2026-06-04). The authenticated `SocketRelayRequest` DTO also carries `ownerUsername`.
3. Mutation operations enforce deterministic storage outcomes and audit-friendly metadata.

## 5) Security, Privacy, and Compliance Controls

1. Auth guards on all private user routes.
2. Admin authorization on all admin routes.
3. CSRF checks on admin write routes with explicit contract behavior.
4. Privacy-minimized DTO projection for public responses.
5. Anti-scraping and rate-limiting controls on public endpoints.
6. Audit logging for sensitive admin mutations and policy-denied outcomes.

## 6) Web and Android Delivery Status

`web+android complete`. Web surface lives under `/apps/socketrelay`; Android surface lives under `packages/mobile/src/features/socketrelay`. Public projection, lifecycle status, and CSRF behaviors are behaviorally consistent across platforms.

Web pixel pass (design `c5d83c0`): the `/apps/socketrelay` shell is rebuilt to `design/.../survivor-hub/SocketRelay.tsx` (feed / post / chat tabs, sidebar category filters + live stats, right impact panel) and its Loading/Empty states. The prior shell was broken against the real backend — it read `GET /api/socketrelay/requests` as a bare array (the route returns `{ items, page, pageSize, total }`) and POSTed `{ type, description, location, credits, urgency }` with no CSRF header, none of which the backend accepts. The rebuilt shell uses the real `SocketRelayRequest` model (`title`, `details`, `category`, `city`, `isPublic`, `status`), unwraps the paged response, claims via `POST /requests/:id/fulfill`, and lists fulfillment chats via `my-fulfillments` + `fulfillments/:id/chat`, with `x-ctf-csrf` on mutations. The mockup's need/offer/credits/urgency framing is not backed by the data model and was omitted rather than faked. Decomposed into modular sub-components within the rule-116 limits. No schema/API change.

Android pixel pass (design `MobileSocketRelay.tsx`): `packages/mobile/src/features/socketrelay/SocketRelay.tsx` rebuilt to the `MobileSocketRelay.tsx` mockup — exact colors/spacing/type/icons/layout translated from web-React to RN primitives. New `api.ts` added, binding to `GET /api/socketrelay/requests` (unwraps `{ items, ... }` paged response), `POST /api/socketrelay/requests` (with `x-ctf-csrf: 1`), and `POST /api/socketrelay/requests/:id/fulfill` (with `x-ctf-csrf: 1`). Sub-components: `SocketRelayLoading.tsx` (loading state), `SocketRelayEmpty.tsx` (empty state), `SocketRelayPublic.tsx` (unauthenticated state). Mock file retired (already empty). The mockup's need/offer distinction, urgency badge, and credits counter are not backed by the `SocketRelayRequest` model and are omitted per real-data-only policy.

Android admin parity (design `MobileSocketRelayAdmin.tsx`): `packages/mobile/src/features/socketrelay/AdminSocketRelay.tsx` mirrors the web admin at `app/admin/socketrelay/page.tsx`. New `admin-api.ts` binds the existing admin routes only (no new backend): `GET /api/socketrelay/admin/requests`, `GET /api/socketrelay/admin/fulfillments`, `GET /api/socketrelay/admin/announcements`, and `DELETE /api/socketrelay/admin/requests/:id` (with `x-ctf-csrf: 1`). Shows the same four stat cards the web page shows (total requests, open requests, fulfillments, active fulfillments) plus request/fulfillment/announcement lists. Admin access is enforced server-side; a 401/403 on any read renders an "admins only" notice. The single destructive action (delete request) requires an explicit confirm dialog before the call. Registered in `App.tsx` as the `socketrelay-admin` feature. The mockup's approve/reject affordance is omitted — no approve/reject request endpoint exists (the only request-state admin mutation the backend exposes is delete); see Gaps.

Web admin mobile-responsive: confirmed. `app/admin/socketrelay/page.tsx` is a server-rendered read-only dashboard already built with responsive utility classes (`max-w-5xl`, `px-6`, `grid gap-4 sm:grid-cols-2 lg:grid-cols-4`). At the 768px phone breakpoint the stat grid collapses to a single stacked column and the snapshot/endpoint sections stack; there is no fixed multi-column layout to fix, so no change was needed.

## 7) Seed Coverage Status

`ctf/scripts/seedSocketRelay.mjs` seeds deterministic request lifecycle (including the `tags` array
alongside the legacy `category`) and fulfillment outcomes for dev validation.

## 8) Gaps and Known Technical Debt

1. Anti-scraping rate limit thresholds on `/api/socketrelay/public` are conservative defaults; production-grade abuse signal classification is a known follow-up.
2. Audit retention policy for `socketrelay_admin_audit_trail` follows the platform default; a plugin-specific retention contract has not been finalized.
3. The design mockup (`MobileSocketRelayAdmin.tsx`) shows per-request approve/reject moderation, but the backend exposes no approve/reject request endpoint — the only admin request-state mutation is `DELETE /api/socketrelay/admin/requests/:id`. The Android admin mirrors delete only; an approve/reject command/contract + route would be needed to back that mockup affordance.
4. Android requests now go through the shared `authedFetch` wrapper (Clerk bearer token, base URL from runtime config) like chyme/currency; earlier the SocketRelay mobile client used plain dev-only `fetch`. The admin client (`admin-api.ts`) and the chat-credentials fetcher (`fetchSocketRelayStreamCredentials.ts`) now use the same wrapper. Ownership detection still leans on `GET /api/socketrelay/my-requests` (a card is "mine" if its id appears in that list) because the client does not compare user ids locally; one extra request per feed load.

## 9) Change Log

- 2026-06-19: The requester now decides how a claimed request resolves, and the Direct Line shows context. Previously **either** participant could close a fulfillment (which closed the whole request), there was no requester-facing resolve UI, and the chat showed a bare "Fulfillment <uuid>" with no idea what it was about. Now: `resolveFulfillment` (replacing `closeFulfillment`) enforces that **only the requester or an admin** can resolve, with four outcomes — `successful` / `no_longer_needed` close the request; `unsuccessful_reopen` cancels the helper and returns the request to `open` for others; `unsuccessful_close` closes it (outcome stored in `close_reason`). The `POST /fulfillments/:id/close` route now requires an `outcome` and is gated to the requester (or an admin). The web chat (`sr-chat`) shows the request title + your role (your request vs you're helping), a clearer empty state, the four resolve actions for the requester, and a "only the requester can close" note for helpers; `my-fulfillments` now joins the request title/status for that context. Added `socketrelay.fulfillment.resolve` to the command + access-policy contracts. Also fixed the left rail (the brand mark duplicated the Feed tab's Share2 glyph → now a distinct Radio mark; removed the dead Bell/Settings buttons; static "S" avatar → live Clerk account menu). Android parity for the requester resolve flow is deferred (web first). No schema change.
- 2026-06-18: Removed per-plugin announcements from SocketRelay. Deleted the admin Announcements tab and its inline post/delete form from `socketrelay-admin-shell.tsx` (with the draft state and create/delete functions), the user/admin announcement routes (`/api/socketrelay/announcements`, `/api/socketrelay/admin/announcements` and its `:id` route), the repository announcement functions (`listSocketRelayAdminAnnouncements`, `createSocketRelayAdminAnnouncement`, `updateSocketRelayAdminAnnouncement`, `deleteSocketRelayAdminAnnouncement`, `listAnnouncementsForSocketRelayUser`) and the announcement validator, and the `SocketRelayAnnouncementInput` type. The Android admin (`AdminSocketRelay.tsx` + `admin-api.ts`) no longer reads the announcements endpoint either. Announcements are now posted in one place — the Feed (`feed-announcements` plugin), which can target any plugin (including SocketRelay) — so the Feed is the single place to post announcements about SocketRelay. No schema change: SocketRelay only ever read the shared `announcements` table by targeting (it has no SocketRelay-specific announcements table). Sections 1.6, 2.2, and the announcement route entries were removed above to match.
- 2026-06-13: Web admin design pass. Replaced the bare diagnostic `/admin/socketrelay` page with `components/socketrelay/socketrelay-admin-shell.tsx`, styled to the admin design system (header with icon + ADMIN badge, snapshot stat blocks, Requests / Fulfillments / Announcements tabs). Bound to the real backend — `listAdminRequests`, `listAdminFulfillments`, `listSocketRelayAdminAnnouncements`. Real actions wired to existing endpoints (with `x-ctf-csrf: '1'`): remove a request (`DELETE /api/socketrelay/admin/requests/:id`), post an announcement (`POST /api/socketrelay/admin/announcements`), and delete an announcement (`DELETE /api/socketrelay/admin/announcements/:id`); fulfillments are a read-only list. No new endpoint, schema, or contract.
- 2026-06-12: Removed the "Make this request publicly visible" toggle from the post form (web `sr-post.tsx`; Android had no visible toggle). SocketRelay is community-only — there is no public board, so the option was misleading. Requests are now members-only (`isPublic` defaults to `false` on both web and Android); the now-redundant "Members only" feed badge was removed. Also made the web post form show friendly, field-specific validation (title, details, at least one tag, and an amount when a priced value type is chosen) before submitting, so a member never sees the raw server "Invalid request payload" message. No schema, route, or contract change (the `is_public` column stays; it is just no longer user-toggled).
- 2026-06-12: Adopted the shared currency selector on "Post a Request" (issue #420). A request can now name **how it's settled** — default **Free** (mutual aid), or ServiceCredits / fiat / crypto / Barter. Data model: `socketrelay_requests.price_currency` (FK → `currencies.code`) and `price_amount` are now written/read; the price-consistency check was relaxed so an amount-less named type (Free, Barter — `requires_amount=false`) is allowed (currency set, amount null), alongside "no value type" (both null) and "priced" (positive amount + currency). API: `POST /api/socketrelay/requests` (create) and `PUT /api/socketrelay/requests/:id` (update) parse `priceCurrency`/`priceAmount` and validate them against the catalog via `isValidRequestPrice` (amount required only for priced types; also enforced in the repository write path). UI: the web post form (`sr-post.tsx`) and Android (`SocketRelay.tsx`) show the value-type selector with the amount input hidden for Free/Barter; the feed shows a settlement badge (`settlementLabel` — never the bare `SC` code, never a fiat equivalent for ServiceCredits). Free/Barter exchanges become a Community Value Index source once recognition is wired (issue #121).
- 2026-06-12: Android admin client (`admin-api.ts`) and the chat-credentials fetcher (`fetchSocketRelayStreamCredentials.ts`) now go through the shared authenticated fetch wrapper (`authedFetch`) like `api.ts` already does: the Clerk bearer token is attached and the base URL comes from runtime config, replacing the plain dev-only fetch against hardcoded emulator/localhost URLs. The admin functions no longer take a token argument (the wrapper supplies the live token); `AdminSocketRelay.tsx` call sites updated. The chat-credentials fetcher now looks up the member's active fulfillment via `GET /my-fulfillments` and posts to `/api/socketrelay/fulfillments/{id}/chat` with the real id (the old hardcoded `active` path segment always returned 404), and reads the channel id from the route's `channelId` field. No backend, schema, or contract change.
- 2026-06-12 (second pass): Multi-tag model + edit flow + Android filter parity (owner decision: guided free-form tagging). Schema: added `tags TEXT[] NOT NULL DEFAULT '{}'` to `socketrelay_requests`; `category` stays in sync with the first tag for older clients, and legacy rows read as `[category]`. Server: `normalizeTags` (trim, collapse whitespace, fold case-insensitive duplicates), validation of 1-3 tags at 64 chars each; `POST /requests` and `PUT /requests/:id` accept a `tags` array or the legacy single `category` string. Contracts: `socketrelay.request.create` bumped to 1.1.0; new `socketrelay.request.update` entry. Seed script writes `tags`. Web shell: post form gained a chip-based tag editor (cap 3) with in-use suggestions; feed cards show all tags; owners get an Edit button that reuses the post form against the existing PUT route; tag filtering matches any tag, chips capped at the 10 most-used. Android: same tag editor (`SocketRelayTagInput.tsx` + `tags.ts` helpers), tag badges, and — new for parity — the search box and tag filter chips the web feed already had, plus the edit-own-request flow: ownership is derived from `GET /my-requests` (see Gaps note 5), own open cards show "Edit Your Request", and the post form doubles as the edit form against `PUT /requests/:id` (new `updateRequest`/`listMyRequests` bindings in `api.ts`).
- 2026-06-12: Tag system rework (owner request). Removed the hardcoded category chip list (and its "Mental Health" entry) from the web shell. Filter chips in the feed (phone layout) and sidebar (desktop) are now derived from the tags actually present in loaded requests, most-used first, via `deriveCategories` in `sr-shared.ts`; filtering is case-insensitive. The post form field is relabeled "Tag" with anything-goes placeholder copy on web and Android. The request `category` column and the API contract are unchanged (free text, 1–64 chars, still required). UI-only; no schema/API/contract change.
- 2026-06-06: Android admin parity (design `MobileSocketRelayAdmin.tsx`). Added `packages/mobile/src/features/socketrelay/AdminSocketRelay.tsx` + `admin-api.ts`, registered as the `socketrelay-admin` feature in `App.tsx`. Mirrors the web admin (`app/admin/socketrelay/page.tsx`): four stat cards plus request, fulfillment, and announcement lists, binding the existing routes only — `GET /admin/requests`, `GET /admin/fulfillments`, `GET /admin/announcements`, and `DELETE /admin/requests/:id` (with `x-ctf-csrf: 1`). Server-side admin gate; 401/403 renders an "admins only" notice. Delete request requires a confirm dialog. Confirmed the web admin page is already mobile-responsive (responsive Tailwind grid, stacks at the 768px breakpoint) — no web change required. Omitted approve/reject (no backing endpoint) and announcement create (plugin targeting not accepted by the POST route); both noted in Gaps. No schema/API/contract change.
- 2026-05-31: Android pixel pass (design `MobileSocketRelay.tsx`). Created `api.ts` bound to real web routes (GET requests, POST requests with CSRF, POST fulfill with CSRF). Rebuilt `SocketRelay.tsx` to mockup (`MobileSocketRelay.tsx`) in RN primitives; added `SocketRelayLoading.tsx`, `SocketRelayEmpty.tsx`, `SocketRelayPublic.tsx` sub-components. Mock file retired (was already empty). Omitted: need/offer type distinction, urgency badge, credits counter — not in `SocketRelayRequest` model. Delivery status: Android ✅.
- 2026-05-29: Web UI circle-back (design `c5d83c0`). Rebuilt the `/apps/socketrelay` shell to the `SocketRelay.tsx` mockup + Loading/Empty; fixed runtime bugs in the prior shell (read the paged `requests` response as a bare array; POSTed non-existent `type`/`description`/`location`/`credits` fields without CSRF). The rebuild uses the real request/claim/fulfillment model + `x-ctf-csrf` header and unwraps `{ items, ... }`; decomposed into modular sub-components within rule-116 limits; the mockup's unbacked need/offer/credits/urgency framing was omitted. No schema/API change.
- 2026-05-18: Inventory updated to enforce Rule 120 living-snapshot model. Removed "Web-First Delivery Strategy and Android Deferrals" section, "Docs Lifecycle" meta section, and planning-state framing. Replaced narrative data model bullets with the actual `socketrelay_*` tables. Confirmed `web+android complete` and dedicated seed script.
- 2026-02-25: Created initial SocketRelay CTF rewrite inventory.


## Build Checklist

> **Reconciliation (2026-05-26):** the Delivery Status above is `web+android complete` (feature parity).
> Unchecked items below are obsolete web-first / Android-deferral planning artifacts and deferred MVP
> validation/release gates (Rule 118) — not missing implementation. The authoritative production bar
> (pixel-perfect to `design` + parity + gates + deploy) is tracked in
> `ctf/docs/developer/PRODUCTION_READINESS_PLAN.md`, which wins where it differs from this checklist.

### Scope and Boundary

- [ ] Confirm implementation scope is `ctf/` only.
  - Acceptance criteria:
    - No implementation tasks target `platform/`.
- [ ] Confirm plugin identity is locked.
  - Acceptance criteria:
    - Plugin name is `SocketRelay`.
    - Plugin slug is `socketrelay`.
- [ ] Confirm legacy docs remain untouched.
  - Acceptance criteria:
    - `ctf/docs/developer/socketrelay-feature-inventory.md` is unchanged.
    - `ctf/docs/developer/socketrelay-rewrite-checklist.md` is unchanged.

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
- [ ] Deliver profile CRUD UX.
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

- [ ] Keep this checklist and `ctf-socketrelay-feature-inventory.md` synchronized.
  - Acceptance criteria:
    - Feature add/remove/behavioral changes update both docs in the same PR.
- [ ] Implementation tracking. [EVIDENCE CAPTURE DEFERRED FOR MVP — see Rule 118.]
  - Acceptance criteria:
    - Implementation status is tracked; evidence collection deferred to post-MVP.
- [ ] Track removals in inventory changelog/deprecations notes.
  - Acceptance criteria:
    - Removed scope is date-stamped and not silently deleted.

### Change Log

- 2026-06-23: **Android parity for 28-day auto-expiry + re-post.** The React Native SocketRelay feed (`packages/mobile/src/features/socketrelay/SocketRelay.tsx`) now reads the `expiresAtIso` / `isExpired` fields (added to the mobile `SocketRelayRequest` type) and treats expired posts as inactive: other members' expired posts drop out of the feed, and the "I Can Help" button is disabled (shows "Expired") as a guard. A member's own expired post stays on the feed with an **Expired** pill and a **Re-post** button (new `repostRequest()` client → existing `POST /api/socketrelay/requests/:id/repost`, which resets the 28-day clock and is swapped into the feed in place) alongside **Edit**. `fulfillRequest` now surfaces the server error code, so a claim that races an expiry (`request_expired`, 409) reloads the feed instead of failing silently. No schema, route, or contract change. Closes the Android parity ticket (#740).
- 2026-06-21: Posts auto-expire after 28 days, with a re-post button, and own-post editing is easier to reach on a phone (owner request). Schema: added a nullable `expires_at TIMESTAMPTZ` to `socketrelay_requests` (`schema.sql` + regenerated `schema.demo.sql`, additive `ALTER … ADD COLUMN IF NOT EXISTS`, plus a one-time `UPDATE … = created_at + INTERVAL '28 days'` to backfill existing rows). Expiry is derived at read time (`isExpired` = open AND `expires_at` past), so no scheduled job is needed; `createRequest` sets `expires_at = NOW() + 28 days` and `repostRequest` resets it. `claimRequest` now rejects a claim on an expired-but-open post (`request_expired`, new error code mapped to a friendly 409). Types (`SocketRelayRequest`, web `SrRequest`) gained `expiresAtIso` + `isExpired`. Web feed (`sr-feed.tsx` / `socketrelay-shell.tsx`): expired posts drop out of the active feed and the "X open" count; a member now has a leading **Mine** filter chip to find their own posts on any screen size, where an expired own post shows an **Expired** pill with **Re-post** (resets the 28-day clock via the existing `POST /requests/:id/repost`) and **Edit**. No new API route or contract — the repost route already existed; this wires it into the member UI. Android parity deferred (tracked below).
- 2026-06-04: Owner decision — SocketRelay is **not anonymous**. A request poster / chat participant is identified by their **`@username`** (the unique handle they chose at sign-up), and that `@username` is what's shown **even in the not-signed-in / public view** (a chosen handle, not a real name, so it is safe to surface publicly). This supersedes the design mockups' "Anonymous" poster treatment (design catch-up tracked as gap D5 in the design-prompt issue #312).
- 2026-06-04: Implemented the public `@username`. Added a nullable `owner_username TEXT` column to `socketrelay_requests` that captures the poster's username at request-creation time (denormalized from the Clerk session, like `chyme_messages.username` and `feed_community_posts.author_username`); the create function writes `gate.auth.username`. Both the authenticated `SocketRelayRequest` DTO and the public `SocketRelayPublicRequest` projection now carry `ownerUsername`. Web (`sr-feed` request cards) and Android (`SocketRelay` feed cards) render `@username` with a neutral `user-<id>` fallback when no username was captured. Schema (`schema.sql` + `schema.demo.sql`, additive `ALTER TABLE … ADD COLUMN IF NOT EXISTS`), repository, types, create route, and both client surfaces updated.
- 2026-06-02: Removed the unused `display_name` column from `socketrelay_user_extension` (and the `displayName` field from `SocketRelayProfile`/`SocketRelayProfileInput`, the profile route parser, and the repository reads/writes). Nothing rendered it; SocketRelay identifies people by their Clerk `@username` (built in the relay/chat routes), so the stored display name was dead. Dropped via `db/migrations/post/0003_socketrelay_drop_display_name.sql` (guarded, re-runnable). Part of removing the v2 "display name" convention from v3.
- 2026-06-01: Enforced the SocketRelay price invariant at the DB level — added a guarded `socketrelay_requests_price_consistency_check` CHECK so a request either has no price (both NULL) or a positive amount in a named currency (the "Free = no price, never `$0`" rule). Follow-up to the #120 review.
- 2026-06-01: Multi-currency (issue #120): added OPTIONAL `price_amount` + `price_currency` (FK → `currencies.code`) to `socketrelay_requests` and a `socketrelay_request_accepted_currencies` join. "Free" renders from the absence of a price, never `$0`. Documented the no-fiat-parity rule. Schema + inventory only; the currency UI is design-gated.

- 2026-02-25: Created initial SocketRelay CTF rewrite checklist with web-first release gating, tracked Android deferrals, lifecycle requirements, and explicit mitigation gates for legacy-known risks.
- 2026-05-31: Documented the transaction-scoped messaging lifecycle per platform rule 100 ("Messaging Scope and Lifecycle"): the per-fulfillment 1:1 chat closes on terminal fulfillment state (read-only window + `socketrelay_messages` retained for moderation/abuse evidence); no messaging outside an active fulfillment. Aligning the deletion contract to mirror this retention is a tracked follow-up.
