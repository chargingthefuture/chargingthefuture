# SocketRelay Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Rewrite target only: `ctf/`
- Legacy `platform/` is reference-only and must not be modified.
- Plugin name: `SocketRelay`
- Plugin slug: `socketrelay`
- This document is a planning-state inventory (not implementation evidence).

Legacy reference preservation:

- Keep `ctf/docs/developer/socketrelay-feature-inventory.md` unchanged as legacy reference.
- Keep `ctf/docs/developer/socketrelay-rewrite-checklist.md` unchanged as legacy reference.
- This document is the authoritative CTF rewrite planning source for SocketRelay.

## Intent and Outcome

SocketRelay in CTF is planned as a request-and-fulfillment plugin with profile management, request lifecycle, fulfillment closure, participant chat, public sharing views, and admin moderation controls.

Decision locks for planning:

1. Web-first delivery is the default execution path.
2. Android parity is tracked through explicit deferrals and closure dates.
3. Android parity is not a strict MVP release gate.
4. Legacy behavior informs planning, but rewrite contracts are defined in `ctf/` only.

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

1. Canonical domain entities: profiles, requests, fulfillments, messages, announcements.
2. Request and fulfillment status transitions are explicit and replay-safe.
3. Public projection contracts are separated from authenticated/admin DTOs.
4. Mutation operations enforce deterministic storage outcomes and audit-friendly metadata.
5. Seed fixtures are deterministic for request lifecycle, fulfillment outcomes, and announcement states.

## 5) Security, Privacy, and Compliance Controls

1. Auth guards on all private user routes.
2. Admin authorization on all admin routes.
3. CSRF checks on admin write routes with explicit contract behavior.
4. Privacy-minimized DTO projection for public responses.
5. Anti-scraping and rate-limiting controls on public endpoints.
6. Audit logging for sensitive admin mutations and policy-denied outcomes.

## 6) Web-First Delivery Strategy and Android Deferrals

1. Web delivery is the primary MVP release gate for SocketRelay.
2. Android implementation follows web contracts and policy outcomes.
3. Android gaps are tracked as explicit deferrals with owner, due date, and risk note.
4. Deferred Android items do not block MVP release unless explicitly escalated.

## 7) Seed Coverage Status

Seed script requirement: Provide a deterministic plugin seed script with dummy development data for manual plugin validation in dev environments.

## 8) Gaps, Ambiguities, and Known Technical Debt

Known risks carried from legacy inventory:

1. **Schema drift** risk across shared schema, SQL migrations, and seed assumptions.
2. **Public DTO privacy mismatch** risk between intended projection and actual exposed fields.
3. **Cross-module boundary bleed** risk in route/module ownership.
4. **Coverage weakness** risk for lifecycle, policy denial, and regression paths.
5. **CSRF consistency ambiguity** risk on admin write protections.

Open planning decisions:

1. Final canonical authority for schema contracts and drift gate ownership.
2. Final public DTO field-level privacy contract approval.
3. Final module ownership map for SocketRelay routes in CTF.
4. Final Android deferral closure timeline and escalation threshold.

## 9) Docs Lifecycle (Rule 120)

1. Keep this CTF rewrite inventory updated in the same PR as accepted feature changes.
2. On add/remove/behavioral changes, update active sections immediately.
3. If a feature is removed, move it to changelog/deprecations notes with date and rationale.
4. Maintain clear separation between this CTF rewrite inventory and legacy reference docs.

## 10) Change Log

- 2026-02-25: Created initial SocketRelay CTF rewrite planning inventory with web-first delivery, tracked Android deferrals, lifecycle sections, and legacy risk carry-forward.
