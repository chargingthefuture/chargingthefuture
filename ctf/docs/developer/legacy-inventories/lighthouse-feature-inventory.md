# LightHouse Plugin Feature Inventory (Legacy Reference)

## Scope

- Source analyzed (reference-only): `platform/`
- Rewrite target: `ctf/`
- Plugin name to retain: `LightHouse`
- Guardrail honored: no edits in `platform/`

---

## Executive Summary

`LightHouse` is a housing coordination plugin for survivors and hosts. It includes:

- authenticated profile management for seekers and hosts,
- host property listing management,
- seeker-host matching lifecycle,
- authenticated announcements,
- admin operations for profiles/properties/matches/announcements,
- role and CSRF protections on sensitive writes.

This inventory captures implemented behavior in the legacy code and highlights migration gaps/ambiguities for ctf rewrite planning, including the currently unwired block model.

---

## 1) User-Facing Features

### 1.1 Dashboard and Role-Based Entry

Evidence:

- `platform/client/src/pages/lighthouse/dashboard.tsx`
- `platform/server/routes/lighthouse/lighthouse-profile.routes.ts`
- `platform/server/routes/lighthouse/lighthouse-match.routes.ts`

Features:

1. Route: `/apps/lighthouse`.
2. If no profile exists, user sees onboarding CTA to create profile.
3. If profile exists, dashboard shows role-adapted shortcuts:
   - Seeker: browse properties, view matches.
   - Host: manage properties, view matches.
4. Dashboard includes announcements banner integration from LightHouse announcement API.

### 1.2 Profile Create/Edit/Delete (Seeker + Host)

Evidence:

- `platform/client/src/pages/lighthouse/profile.tsx`
- `platform/server/routes/lighthouse/lighthouse-profile.routes.ts`
- `platform/shared/schema/lighthouse/index.ts`

Features:

1. Profile create: `POST /api/lighthouse/profile`.
2. Profile read: `GET /api/lighthouse/profile`.
3. Profile update: `PUT /api/lighthouse/profile`.
4. Profile delete with reason support: `DELETE /api/lighthouse/profile`.
5. Shared fields include bio, phone, signal URL, active status.
6. Seeker-only fields include housing needs, desired move-in date, budget min/max, desired country.
7. Host-only field includes `hasProperty` indicator.
8. Profile type lock for non-admin edits in UI (admin can alter type in UI flow).
9. Verified badge rendered using merged profile/user verification state.
10. Name display uses first name from user account (server sync behavior).

Validation and constraints (from schema/routes):

- `profileType`: `seeker | host`.
- `bio` max length 500.
- `phoneNumber` max length 20.
- `signalUrl` URL-validated.
- `desiredCountry` constrained to shared country enum when provided.

### 1.3 Property Browse and Details

Evidence:

- `platform/client/src/pages/lighthouse/browse.tsx`
- `platform/client/src/pages/lighthouse/property-detail.tsx`
- `platform/server/routes/lighthouse/lighthouse-property.routes.ts`

Features:

1. Browse route: `/apps/lighthouse/browse`.
2. Property detail route: `/apps/lighthouse/property/:id`.
3. List endpoint returns active properties for authenticated users.
4. Property detail includes host profile references and listing metadata.
5. Seeker can request match from property detail.
6. Duplicate request prevention exposed to UI (request conflicts on existing active/pending match).

### 1.4 Host Property Management

Evidence:

- `platform/client/src/pages/lighthouse/my-properties.tsx`
- `platform/client/src/pages/lighthouse/property-form.tsx`
- `platform/server/routes/lighthouse/lighthouse-property.routes.ts`

Features:

1. Host properties route: `/apps/lighthouse/my-properties`.
2. Property create route: `/apps/lighthouse/property/new`.
3. Property edit route: `/apps/lighthouse/property/edit/:id`.
4. Host-only create/update/delete enforced server-side.
5. Ownership checks prevent hosts from mutating others’ listings.
6. Property fields include:
   - title/description/propertyType,
   - address/city/state/country/zip,
   - bedrooms/bathrooms,
   - monthlyRent,
   - availableFrom,
   - amenities,
   - houseRules,
   - photos,
   - Airbnb profile URL,
   - active status.
7. UI requires host profile before property creation flow.

### 1.5 Matches Workflow

Evidence:

- `platform/client/src/pages/lighthouse/matches.tsx`
- `platform/server/routes/lighthouse/lighthouse-match.routes.ts`
- `platform/server/storage/plugins/lighthouse-storage.ts`

Features:

1. Matches route: `/apps/lighthouse/matches`.
2. Seeker can create match request (`POST /api/lighthouse/matches`) with message and proposed move-in date.
3. Host and seeker see role-specific views of their relevant matches.
4. Host can accept/reject matches and provide host response.
5. Seeker can cancel pending/active match based on route rules.
6. Match status lifecycle includes: `pending`, `accepted`, `rejected`, `canceled`, `completed`.
7. Server checks duplicate active/pending request combinations.

### 1.6 Announcements (User View)

Evidence:

- `platform/client/src/pages/lighthouse/announcements.tsx`
- `platform/server/routes/lighthouse/lighthouse-announcement.routes.ts`

Features:

1. Announcements route: `/apps/lighthouse/announcements`.
2. Authenticated read endpoint returns active, non-expired announcements.
3. Types used by UI/API: `info | warning | maintenance | update | promotion`.

---

## 2) Admin Features

### 2.1 Admin Dashboard and Data Tables

Evidence:

- `platform/client/src/pages/lighthouse/admin.tsx`
- `platform/server/routes/lighthouse/lighthouse-admin.routes.ts`

Features:

1. Admin route: `/apps/lighthouse/admin`.
2. Stats cards for seekers, hosts, properties, active/completed matches.
3. Tabular views for:
   - seekers,
   - hosts,
   - properties,
   - matches.
4. Admin profile deep links open profile detail route.

### 2.2 Admin Profile Detail View

Evidence:

- `platform/client/src/pages/lighthouse/admin-profile-view.tsx`
- `platform/server/routes/lighthouse/lighthouse-admin.routes.ts`

Features:

1. Admin route: `/apps/lighthouse/admin/profile/:id`.
2. Shows user-enriched profile details for admin review.
3. Supports inspection of verification, contact, and role-specific fields.

### 2.3 Admin Property and Match Mutations

Evidence:

- `platform/server/routes/lighthouse/lighthouse-admin.routes.ts`

Features:

1. Admin property update endpoint: `PUT /api/lighthouse/admin/properties/:id`.
2. Admin match update endpoint: `PUT /api/lighthouse/admin/matches/:id`.
3. Allows moderation/status correction independent of host/seeker ownership.
4. Writes require admin auth + CSRF validation.

### 2.4 Admin Announcement Management

Evidence:

- `platform/client/src/pages/lighthouse/admin-announcements.tsx`
- `platform/server/routes/lighthouse/lighthouse-announcement.routes.ts`

Features:

1. Admin route: `/apps/lighthouse/admin/announcements`.
2. List announcements: `GET /api/lighthouse/admin/announcements`.
3. Create announcement: `POST /api/lighthouse/admin/announcements`.
4. Update announcement: `PUT /api/lighthouse/admin/announcements/:id`.
5. Deactivate announcement: `DELETE /api/lighthouse/admin/announcements/:id`.
6. UI supports create/edit/deactivate with cache refresh.

---

## 3) API Surface (Discovered)

### 3.1 Profile APIs

- `GET /api/lighthouse/profile`
- `POST /api/lighthouse/profile`
- `PUT /api/lighthouse/profile`
- `DELETE /api/lighthouse/profile`

### 3.2 Property APIs

- `GET /api/lighthouse/properties`
- `GET /api/lighthouse/properties/:id`
- `GET /api/lighthouse/my-properties`
- `POST /api/lighthouse/properties`
- `PUT /api/lighthouse/properties/:id`
- `DELETE /api/lighthouse/properties/:id`

### 3.3 Match APIs

- `GET /api/lighthouse/matches`
- `POST /api/lighthouse/matches`
- `PUT /api/lighthouse/matches/:id`

### 3.4 Admin APIs

- `GET /api/lighthouse/admin/stats`
- `GET /api/lighthouse/admin/profiles`
- `GET /api/lighthouse/admin/seekers`
- `GET /api/lighthouse/admin/hosts`
- `GET /api/lighthouse/admin/properties`
- `GET /api/lighthouse/admin/matches`
- `PUT /api/lighthouse/admin/properties/:id`
- `PUT /api/lighthouse/admin/matches/:id`

### 3.5 Announcement APIs

- `GET /api/lighthouse/announcements`
- `GET /api/lighthouse/admin/announcements`
- `POST /api/lighthouse/admin/announcements`
- `PUT /api/lighthouse/admin/announcements/:id`
- `DELETE /api/lighthouse/admin/announcements/:id`

---

## 4) Data Model and Storage Behaviors

Evidence:

- `platform/shared/schema/lighthouse/index.ts`
- `platform/server/storage/plugins/lighthouse-storage.ts`
- `platform/schema.sql`

Core entities:

1. `lighthouse_profiles`
2. `lighthouse_properties`
3. `lighthouse_matches`
4. `lighthouse_announcements`
5. `lighthouse_blocks` (present in shared schema/storage interface)

Storage-level behaviors:

1. Stats aggregation for admin cards.
2. Match retrieval by seeker and by property context.
3. Announcement deactivate behavior uses soft-active toggle.
4. Profile deletion attempts cascade/anonymization logic for linked records.
5. Block operations exist in storage interface/implementation (`create/check/list/delete`).

---

## 5) Security and Policy Controls

Evidence:

- `platform/server/auth.ts`
- `platform/server/csrf.ts`
- `platform/server/routes/lighthouse/*.routes.ts`
- `platform/server/routes/index.ts`

Implemented controls:

1. Auth required across LightHouse route modules.
2. Admin-only gate for admin endpoints.
3. CSRF validation on admin writes.
4. Host ownership checks for property mutation routes.
5. Role checks for seeker-only and host-only match actions.

Observed note:

- No dedicated LightHouse-specific rate limiter/anti-scraping middleware is applied directly in LightHouse route modules.

---

## 6) Routing and UI Surface

Evidence:

- `platform/client/src/routes/plugin-routes.tsx`

Discovered app routes:

1. `/apps/lighthouse`
2. `/apps/lighthouse/profile`
3. `/apps/lighthouse/browse`
4. `/apps/lighthouse/property/new`
5. `/apps/lighthouse/property/edit/:id`
6. `/apps/lighthouse/property/:id`
7. `/apps/lighthouse/my-properties`
8. `/apps/lighthouse/matches`
9. `/apps/lighthouse/announcements`
10. `/apps/lighthouse/admin`
11. `/apps/lighthouse/admin/announcements`
12. `/apps/lighthouse/admin/profile/:id`

---

## 7) Test and Seed Coverage Signals

Evidence:

- `platform/test/api/lighthouse.test.ts`
- `platform/test/e2e/lighthouse.spec.ts`
- `platform/scripts/seedLighthouse.ts`

Observed:

1. API tests are largely request-shape assertions and do not strongly verify route/storage integration.
2. E2E coverage exists for profile/dashboard/property/browse/matches/admin paths but includes skip-heavy auth assumptions.
3. Some E2E selectors drift from current UI test IDs.
4. Seed script creates seekers/hosts/properties/matches/announcements and documents potential schema drift workarounds.

---

## 8) Gaps, Ambiguities, and Migration Risks

1. **Schema drift:**
   - `platform/shared/schema/lighthouse/index.ts` vs `platform/schema.sql` differ (e.g., nullable expectations and table coverage).
2. **Blocks surface mismatch:**
   - `lighthouse_blocks` exists in shared schema/storage but no LightHouse route/UI wiring was found.
   - Include as explicit rewrite decision/gap item (per user direction).
3. **Deletion behavior risk:**
   - Host-profile deletion path attempts anonymization for dependent records and may conflict with FK constraints.
4. **Test reliability mismatch:**
   - API tests are shallow; E2E selectors partially out-of-date.
5. **Seed/schema consistency risk:**
   - Seed script includes notes indicating schema/database mismatch scenarios.

---

## 9) Rewrite Inputs (for ctf planning)

Before implementing ctf LightHouse, lock these decisions:

1. Canonical schema source of truth (shared schema vs SQL migration artifacts).
2. Blocks scope for v1:
   - implement route/UI support, or
   - explicitly defer with documented contract boundary.
3. Profile deletion semantics for host-linked properties/matches under FK constraints.
4. Test strategy baseline (contract-level API tests and stable E2E selectors).
