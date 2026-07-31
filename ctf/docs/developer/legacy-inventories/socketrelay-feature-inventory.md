# SocketRelay Plugin Feature Inventory (Legacy Reference)

## Scope

- Source analyzed (reference-only): `platform/`
- Rewrite target: `ctf/`
- Plugin name to retain: `SocketRelay`
- Guardrail honored: no edits in `platform/`

---

## Executive Summary

`SocketRelay` is a request-and-fulfillment plugin with:

- authenticated profile CRUD,
- request lifecycle management,
- fulfillment claiming and closure,
- in-context chat messaging,
- public shareable request browse/detail views,
- admin moderation and announcements.

It includes anti-scraping/rate-limit controls on public routes. Legacy implementation also contains schema and privacy mismatches that should be addressed in ctf rewrite.

---

## 1) User-Facing Features

### 1.1 Dashboard and Request Lifecycle

Evidence:

- `platform/client/src/pages/socket-relay/dashboard.tsx`
- `platform/server/routes/socket-relay.routes.ts`

Features:

1. Route: `/apps/socket-relay`.
2. Request list for active requests (`GET /api/socket-relay/requests`).
3. My requests list (`GET /api/socket-relay/my-requests`).
4. Request create (`POST /api/socket-relay/requests`) with `description` and `isPublic`.
5. Request update (`PUT /api/socket-relay/requests/:id`).
6. Repost expired request (`POST /api/socket-relay/requests/:id/repost`).

### 1.2 Profile Create/Edit/Delete

Evidence:

- `platform/client/src/pages/socket-relay/profile.tsx`
- `platform/server/routes/socket-relay.routes.ts`
- `platform/shared/schema/socket-relay/index.ts`

Features:

1. Profile read: `GET /api/socket-relay/profile`.
2. Profile create: `POST /api/socket-relay/profile`.
3. Profile update: `PUT /api/socket-relay/profile`.
4. Profile delete with reason: `DELETE /api/socket-relay/profile`.
5. Profile exposes city/state/country and verification flags.

### 1.3 Fulfillment and Close Outcomes

Evidence:

- `platform/client/src/pages/socket-relay/dashboard.tsx`
- `platform/server/routes/socket-relay.routes.ts`

Features:

1. Claim fulfillment: `POST /api/socket-relay/requests/:id/fulfill`.
2. My fulfillments listing: `GET /api/socket-relay/my-fulfillments`.
3. Fulfillment detail: `GET /api/socket-relay/fulfillments/:id`.
4. Close fulfillment: `POST /api/socket-relay/fulfillments/:id/close`.
5. Valid close statuses: `completed_success`, `completed_failure`, `canceled`.
6. Request status is updated to `closed` after fulfillment closure flow.

### 1.4 Fulfillment Chat

Evidence:

- `platform/client/src/pages/socket-relay/chat.tsx`
- `platform/server/routes/socket-relay.routes.ts`

Features:

1. Route: `/apps/socket-relay/chat/:id`.
2. Message fetch: `GET /api/socket-relay/fulfillments/:id/messages`.
3. Message send: `POST /api/socket-relay/fulfillments/:id/messages`.
4. Access controls ensure only request owner or fulfiller can view/send messages.

### 1.5 Public Sharing Surface

Evidence:

- `platform/client/src/routes/public-routes.tsx`
- `platform/client/src/pages/socket-relay/public-list.tsx`
- `platform/client/src/pages/socket-relay/public.tsx`
- `platform/server/routes/socket-relay.routes.ts`

Features:

1. Public routes:
   - `/apps/socket-relay/public`
   - `/apps/socket-relay/public/:id`
2. Public listing endpoint: `GET /api/socket-relay/public`.
3. Public detail endpoint: `GET /api/socket-relay/public/:id`.
4. Optional user filter query for public list.
5. Public pages present first-name-only identity in UI.

### 1.6 User Announcements

Evidence:

- `platform/client/src/pages/socket-relay/announcements.tsx`
- `platform/server/routes/socket-relay.routes.ts`

Features:

1. Announcements route: `/apps/socket-relay/announcements`.
2. User endpoint: `GET /api/socket-relay/announcements`.
3. Renders active, non-expired announcements.

---

## 2) Admin Features

### 2.1 Admin Requests and Fulfillments Oversight

Evidence:

- `platform/client/src/pages/socket-relay/admin.tsx`
- `platform/server/routes/socket-relay.routes.ts`

Features:

1. Admin route: `/apps/socket-relay/admin`.
2. Admin requests endpoint: `GET /api/socket-relay/admin/requests`.
3. Admin fulfillments endpoint: `GET /api/socket-relay/admin/fulfillments`.
4. Admin request deletion: `DELETE /api/socket-relay/admin/requests/:id`.

### 2.2 Admin Announcements Management

Evidence:

- `platform/client/src/pages/socket-relay/admin-announcements.tsx`
- `platform/server/routes/socket-relay.routes.ts`

Features:

1. Admin route: `/apps/socket-relay/admin/announcements`.
2. Admin announcement APIs:
   - `GET /api/socket-relay/admin/announcements`
   - `POST /api/socket-relay/admin/announcements`
   - `PUT /api/socket-relay/admin/announcements/:id`
   - `DELETE /api/socket-relay/admin/announcements/:id`
3. Admin action logging is emitted for create/update/deactivate.

---

## 3) API Surface (Discovered)

### 3.1 Profile APIs

- `GET /api/socket-relay/profile`
- `POST /api/socket-relay/profile`
- `PUT /api/socket-relay/profile`
- `DELETE /api/socket-relay/profile`

### 3.2 Request APIs

- `GET /api/socket-relay/requests`
- `GET /api/socket-relay/requests/:id`
- `GET /api/socket-relay/my-requests`
- `POST /api/socket-relay/requests`
- `PUT /api/socket-relay/requests/:id`
- `POST /api/socket-relay/requests/:id/repost`

### 3.3 Fulfillment and Message APIs

- `POST /api/socket-relay/requests/:id/fulfill`
- `GET /api/socket-relay/fulfillments/:id`
- `GET /api/socket-relay/my-fulfillments`
- `POST /api/socket-relay/fulfillments/:id/close`
- `GET /api/socket-relay/fulfillments/:id/messages`
- `POST /api/socket-relay/fulfillments/:id/messages`

### 3.4 Public APIs

- `GET /api/socket-relay/public`
- `GET /api/socket-relay/public/:id`

### 3.5 Announcement/Admin APIs

- `GET /api/socket-relay/announcements`
- `GET /api/socket-relay/admin/announcements`
- `POST /api/socket-relay/admin/announcements`
- `PUT /api/socket-relay/admin/announcements/:id`
- `DELETE /api/socket-relay/admin/announcements/:id`
- `GET /api/socket-relay/admin/requests`
- `GET /api/socket-relay/admin/fulfillments`
- `DELETE /api/socket-relay/admin/requests/:id`

---

## 4) Data Model and Storage Behaviors

Evidence:

- `platform/shared/schema/socket-relay/index.ts`
- `platform/server/storage/plugins/socket-relay-storage.ts`
- `platform/schema.sql`

Core entities:

1. `socket_relay_profiles`
2. `socket_relay_requests`
3. `socket_relay_fulfillments`
4. `socket_relay_messages`
5. `socket_relay_announcements`

Storage-level behaviors:

1. Request expiration and repost support.
2. Fulfillment creation and close status transitions.
3. Access-scoped message retrieval by fulfillment.
4. Profile delete workflow includes anonymization-oriented behavior in storage layer.

---

## 5) Security and Policy Controls

Evidence:

- `platform/server/routes/socket-relay.routes.ts`
- `platform/server/dataObfuscation.ts`
- `platform/server/rateLimiter.ts`

Implemented controls:

1. Auth guards for private user routes.
2. Admin guards for admin routes.
3. CSRF checks on admin write routes.
4. Public anti-scraping delays and rotation on public list routes.
5. Public route rate limiters: listing and item-level.

---

## 6) Routing and UI Surface

Evidence:

- `platform/client/src/routes/plugin-routes.tsx`
- `platform/client/src/routes/public-routes.tsx`

Protected routes:

1. `/apps/socket-relay`
2. `/apps/socket-relay/profile`
3. `/apps/socket-relay/announcements`
4. `/apps/socket-relay/chat/:id`
5. `/apps/socket-relay/admin`
6. `/apps/socket-relay/admin/announcements`

Public routes:

1. `/apps/socket-relay/public`
2. `/apps/socket-relay/public/:id`

---

## 7) Test and Seed Coverage Signals

Evidence:

- `platform/test/api/socket-relay.test.ts`
- `platform/test/e2e/socket-relay.spec.ts`
- `platform/test/client/pages/socket-relay/profile.test.tsx`
- `platform/scripts/seedSocketRelay.ts`

Observed:

1. API and E2E test files exist.
2. Many API tests are mock/request-shape assertions, not full handler integration.
3. E2E coverage includes skip-heavy auth assumptions and selector fragility risks.
4. Seed script contains rich scenario data including mixed public/private requests and fulfillment chat messages.

---

## 8) Gaps, Ambiguities, and Migration Risks

1. **Schema drift across sources (blocker risk):**
   - `socket_relay_profiles` differs between Drizzle schema, SQL, and seed payload assumptions (e.g., `displayName` usage).
2. **Public privacy projection mismatch:**
   - Public API payload contains `firstName` and `lastName`, while UI policy is first-name-only rendering.
3. **Cross-module boundary bleed:**
   - Directory announcement routes are implemented inside `socket-relay.routes.ts`, increasing module ownership ambiguity.
4. **Tests are partially scaffold-level:**
   - A meaningful subset of API/E2E tests validate mock shape instead of robust route/storage behavior.
5. **CSRF policy consistency ambiguity:**
   - Admin writes are protected, but broader mutation-CSRF expectations should be explicitly defined in ctf contracts.

---

## 9) Rewrite Inputs (for ctf planning)

Before implementing ctf SocketRelay, lock these decisions:

1. Canonical schema source of truth across shared schema, SQL migrations, and seed payloads.
2. Public response DTO privacy contract (field-level projection).
3. Module ownership boundaries (SocketRelay-only routes vs cross-plugin route placement).
4. Test strategy uplift from mock-shape assertions to contract/integration confidence.
5. CSRF policy baseline for state-changing endpoints.
