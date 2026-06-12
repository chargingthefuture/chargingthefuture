# SocketRelay Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Plugin name: `SocketRelay`
- Plugin slug: `socketrelay`
- Owned surfaces: `/apps/socketrelay` (web), `packages/mobile/src/features/socketrelay` (Android), `/api/socketrelay/*` routes, `socketrelay_*` tables.
- Not owned: identity (Clerk), service credits ledger (service-credits plugin), email/SMS transport (notifications integration).

## Intent and Outcome

SocketRelay is a request-and-fulfillment plugin with profile management, request lifecycle, fulfillment closure, participant chat, public sharing views, and admin moderation controls.

## 1) User Features

### 1.1 Dashboard and Request Lifecycle

1. Authenticated request dashboard with active and owned request views.
2. Request create/update/repost flows with deterministic status semantics.
3. Ownership-aware request visibility and action controls.

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

### 1.6 User Announcements

1. Authenticated announcement consumption surface.
2. Active/non-expired announcement filtering by policy contract.

## 2) Admin Features

### 2.1 Requests and Fulfillments Oversight

1. Admin list/oversight views for requests and fulfillments.
2. Role-gated moderation actions for request lifecycle interventions.
3. Deterministic audit capture for sensitive admin mutations.

### 2.2 Announcement Management

1. Admin list/create/update/deactivate announcement flows.
2. Server-enforced admin authorization on write paths.
3. Policy-consistent mutation outcomes and audit events.

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
- `POST /api/socketrelay/fulfillments/:id/close`
- `GET /api/socketrelay/fulfillments/:id/messages`
- `POST /api/socketrelay/fulfillments/:id/messages`
- `GET /api/socketrelay/announcements`

Public routes:

- `GET /api/socketrelay/public`
- `GET /api/socketrelay/public/:id`

Admin routes:

- `GET /api/socketrelay/admin/requests`
- `GET /api/socketrelay/admin/fulfillments`
- `DELETE /api/socketrelay/admin/requests/:id`
- `GET /api/socketrelay/admin/announcements`
- `POST /api/socketrelay/admin/announcements`
- `PUT /api/socketrelay/admin/announcements/:id`
- `DELETE /api/socketrelay/admin/announcements/:id`

## 4) Data Model and Storage Contracts

Tables owned by this plugin:

1. `socketrelay_user_extension` — Per-user profile extension fields.
2. `socketrelay_requests` — Request lifecycle rows (status, ownership, repost lineage). Includes a nullable `owner_username TEXT` column that captures the poster's chosen `@username` at request-creation time (denormalized from the Clerk session, exactly like `chyme_messages.username` and `feed_community_posts.author_username`), because v3 has no reliable server-side store of other users' usernames. This handle is surfaced in every view, including the not-signed-in / public projection — never "Anonymous" (owner decision, 2026-06-04).
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

`ctf/scripts/seedSocketRelay.mjs` seeds deterministic request lifecycle, fulfillment outcomes, and announcement states for dev validation.

## 8) Gaps and Known Technical Debt

1. Anti-scraping rate limit thresholds on `/api/socketrelay/public` are conservative defaults; production-grade abuse signal classification is a known follow-up.
2. Audit retention policy for `socketrelay_admin_audit_trail` follows the platform default; a plugin-specific retention contract has not been finalized.
3. The design mockup (`MobileSocketRelayAdmin.tsx`) shows per-request approve/reject moderation, but the backend exposes no approve/reject request endpoint — the only admin request-state mutation is `DELETE /api/socketrelay/admin/requests/:id`. The Android admin mirrors delete only; an approve/reject command/contract + route would be needed to back that mockup affordance.
4. Mobile-created announcements cannot be targeted to the SocketRelay plugin: `POST /api/socketrelay/admin/announcements` does not accept a `targeting` field, and `listSocketRelayAdminAnnouncements` only returns announcements whose targeting includes `socketrelay`. The Android admin therefore reads announcements (`GET`) but does not offer a create form, since a created announcement would not appear in the plugin-scoped list.

## 9) Change Log

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

- 2026-06-04: Owner decision — SocketRelay is **not anonymous**. A request poster / chat participant is identified by their **`@username`** (the unique handle they chose at sign-up), and that `@username` is what's shown **even in the not-signed-in / public view** (a chosen handle, not a real name, so it is safe to surface publicly). This supersedes the design mockups' "Anonymous" poster treatment (design catch-up tracked as gap D5 in the design-prompt issue #312).
- 2026-06-04: Implemented the public `@username`. Added a nullable `owner_username TEXT` column to `socketrelay_requests` that captures the poster's username at request-creation time (denormalized from the Clerk session, like `chyme_messages.username` and `feed_community_posts.author_username`); the create function writes `gate.auth.username`. Both the authenticated `SocketRelayRequest` DTO and the public `SocketRelayPublicRequest` projection now carry `ownerUsername`. Web (`sr-feed` request cards) and Android (`SocketRelay` feed cards) render `@username` with a neutral `user-<id>` fallback when no username was captured. Schema (`schema.sql` + `schema.demo.sql`, additive `ALTER TABLE … ADD COLUMN IF NOT EXISTS`), repository, types, create route, and both client surfaces updated.
- 2026-06-02: Removed the unused `display_name` column from `socketrelay_user_extension` (and the `displayName` field from `SocketRelayProfile`/`SocketRelayProfileInput`, the profile route parser, and the repository reads/writes). Nothing rendered it; SocketRelay identifies people by their Clerk `@username` (built in the relay/chat routes), so the stored display name was dead. Dropped via `db/migrations/post/0003_socketrelay_drop_display_name.sql` (guarded, re-runnable). Part of removing the v2 "display name" convention from v3.
- 2026-06-01: Enforced the SocketRelay price invariant at the DB level — added a guarded `socketrelay_requests_price_consistency_check` CHECK so a request either has no price (both NULL) or a positive amount in a named currency (the "Free = no price, never `$0`" rule). Follow-up to the #120 review.
- 2026-06-01: Multi-currency (issue #120): added OPTIONAL `price_amount` + `price_currency` (FK → `currencies.code`) to `socketrelay_requests` and a `socketrelay_request_accepted_currencies` join. "Free" renders from the absence of a price, never `$0`. Documented the no-fiat-parity rule. Schema + inventory only; the currency UI is design-gated.

- 2026-02-25: Created initial SocketRelay CTF rewrite checklist with web-first release gating, tracked Android deferrals, lifecycle requirements, and explicit mitigation gates for legacy-known risks.
- 2026-05-31: Documented the transaction-scoped messaging lifecycle per platform rule 100 ("Messaging Scope and Lifecycle"): the per-fulfillment 1:1 chat closes on terminal fulfillment state (read-only window + `socketrelay_messages` retained for moderation/abuse evidence); no messaging outside an active fulfillment. Aligning the deletion contract to mirror this retention is a tracked follow-up.
