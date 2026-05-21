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
2. `socketrelay_requests` — Request lifecycle rows (status, ownership, repost lineage).
3. `socketrelay_request_events` — Event log for request state transitions.
4. `socketrelay_fulfillments` — Fulfillment claims and outcomes per request.
5. `socketrelay_fulfillment_participants` — Participant access records for fulfillment chats.
6. `socketrelay_messages` — Participant-only chat messages on a fulfillment.
7. `socketrelay_admin_audit_trail` — Audit log for admin mutations.

Storage and projection rules:

1. Request and fulfillment status transitions are explicit and replay-safe via the `request_events` log.
2. Public projection contracts are separated from authenticated/admin DTOs (privacy-minimized fields only on public routes).
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

## 7) Seed Coverage Status

`ctf/scripts/seedSocketRelayPhase2.mjs` seeds deterministic request lifecycle, fulfillment outcomes, and announcement states for dev validation.

## 8) Gaps and Known Technical Debt

1. Anti-scraping rate limit thresholds on `/api/socketrelay/public` are conservative defaults; production-grade abuse signal classification is a known follow-up.
2. Audit retention policy for `socketrelay_admin_audit_trail` follows the platform default; a plugin-specific retention contract has not been finalized.

## 9) Change Log

- 2026-05-18: Inventory updated to enforce Rule 120 living-snapshot model. Removed "Web-First Delivery Strategy and Android Deferrals" section, "Docs Lifecycle" meta section, and planning-state framing. Replaced narrative data model bullets with the actual `socketrelay_*` tables. Confirmed `web+android complete` and dedicated seed script.
- 2026-02-25: Created initial SocketRelay CTF rewrite inventory.


## Build Checklist


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

### Phase 0 — Decision Lock

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

### Phase 1 — Contract and Schema Lock

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

### Phase 2 — API and Policy Controls

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

### Phase 3 — Web MVP Delivery (Release Gate)

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

### Phase 4 — Android Deferrals Tracking (Not Strict Parity Gate)

- [ ] Define Android in-scope and deferred SocketRelay surfaces.
  - Acceptance criteria:
    - Each deferred item has owner, due date, and risk note.
- [ ] Ensure Android uses the same API/policy outcomes as web for shipped flows.
  - Acceptance criteria:
    - Deny/allow semantics match web for implemented Android features.
- [ ] Maintain deferral closure tracker.
  - Acceptance criteria:
    - Tracker is updated in each PR that changes Android scope.

### Phase 5 — Risk Mitigation and Hardening

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

### Phase 6 — Validation, Seeds, and Release Gates [MVP: VALIDATION DEFERRED — see Rule 118.]

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

- 2026-02-25: Created initial SocketRelay CTF rewrite checklist with web-first release gating, tracked Android deferrals, lifecycle requirements, and explicit mitigation gates for legacy-known risks.
