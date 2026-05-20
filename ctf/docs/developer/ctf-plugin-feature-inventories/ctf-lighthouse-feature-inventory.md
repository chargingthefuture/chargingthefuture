# LightHouse Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Plugin name: `LightHouse`
- Plugin slug: `lighthouse`
- Owned surfaces: `/apps/lighthouse` (web), `packages/mobile/src/features/lighthouse` (Android), `/api/lighthouse/*` routes, `lighthouse_*` tables (including `lighthouse_blocks`).
- Not owned: identity (Clerk), directory profile primitives (Directory plugin).

---

## 1) User Features

### 1.1 Dashboard and Role-Based Entry

1. Route parity target for LightHouse home dashboard (`/apps/lighthouse`).
2. No-profile onboarding CTA is preserved.
3. Role-adapted quick actions are preserved:
   - Seeker: browse properties, view matches.
   - Host: manage properties, view matches.
4. Announcements banner integration remains in user dashboard scope.

### 1.2 Profile Create/Edit/Delete (Seeker + Host)

1. Authenticated profile create/read/update/delete parity is required.
2. Shared profile fields parity:
   - bio, phone number, signal URL, active status.
3. Seeker profile fields parity:
   - housing needs, desired move-in date, budget min/max, desired country.
4. Host profile fields parity:
   - `hasProperty` indicator.
5. Profile type lock behavior parity (non-admin users cannot arbitrarily change profile type).
6. Verification rendering parity and first-name display behavior are retained.

### 1.3 Property Browse and Detail

1. Browse route parity target (`/apps/lighthouse/browse`).
2. Property detail route parity target (`/apps/lighthouse/property/:id`).
3. Authenticated property list/detail behavior parity is required.
4. Detail view includes host reference metadata and listing details.
5. Seeker match-request action from detail is preserved.
6. Duplicate active/pending match-request prevention remains required.

### 1.4 Host Property Management

1. Host property routes parity:
   - `/apps/lighthouse/my-properties`
   - `/apps/lighthouse/property/new`
   - `/apps/lighthouse/property/edit/:id`
2. Host-only create/update/delete enforcement remains required.
3. Ownership checks for host property mutations remain required.
4. Property field parity target includes:
   - title, description, property type,
   - address, city, state, country, zip,
   - bedrooms, bathrooms,
   - monthly rent, available from,
   - amenities, house rules,
   - photos,
   - Airbnb profile URL,
   - active status.
5. Property creation flow requires host profile presence.

### 1.5 Matches Workflow

1. Matches route parity target (`/apps/lighthouse/matches`).
2. Seeker match request parity target with message and proposed move-in date.
3. Role-specific match list views for seekers and hosts are preserved.
4. Host accept/reject actions with host response are preserved.
5. Seeker cancellation permissions remain policy-controlled.
6. Status lifecycle parity target:
   - `pending`, `accepted`, `rejected`, `cancelled`, `completed`.
7. Duplicate active/pending request constraints remain required.

### 1.6 Announcements (User View)

1. Announcements route parity target (`/apps/lighthouse/announcements`).
2. Authenticated read of active, non-expired announcements is required.
3. Announcement type parity target:
   - `info | warning | maintenance | update | promotion`.

### 1.7 Blocks (User Safety)

1. `lighthouse_blocks` is in required v1 parity scope.
2. User-level block create/check/list/delete behaviors must be implemented through policy-controlled plugin contracts.
3. Block behavior must be reflected in match and related interaction surfaces where applicable.

## 2) Admin Features

### 2.1 Admin Dashboard and Data Views

1. Admin route parity target (`/apps/lighthouse/admin`).
2. Stats parity target:
   - seekers,
   - hosts,
   - properties,
   - active/completed matches.
3. Admin tables parity target for seekers, hosts, properties, matches.
4. Admin profile deep-link behavior is preserved.

### 2.2 Admin Profile Detail

1. Admin profile route parity target (`/apps/lighthouse/admin/profile/:id`).
2. User-enriched profile inspection parity is required.
3. Verification/contact/role-field inspection parity remains required.

### 2.3 Admin Property and Match Mutations

1. Admin property update parity target (`PUT /api/lighthouse/admin/properties/:id`).
2. Admin match update parity target (`PUT /api/lighthouse/admin/matches/:id`).
3. Admin moderation/status correction independent of host/seeker ownership remains required.
4. Admin writes must preserve authz + CSRF guarantees.

### 2.4 Admin Announcement Management

1. Admin announcements route parity target (`/apps/lighthouse/admin/announcements`).
2. Admin announcements CRUD/deactivation parity is required.
3. Cache refresh/revalidation after admin announcement mutations is required.

## 3) API Surface and Route Map

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

### 3.6 Blocks APIs (required v1)

- Route contract to be finalized during implementation planning.
- Required operations:
  - create block,
  - check block state,
  - list blocked users,
  - remove block.

## 4) Data Model and Storage Contracts

Required entities for parity scope:

1. `lighthouse_profiles`
2. `lighthouse_properties`
3. `lighthouse_matches`
4. `lighthouse_announcements`
5. `lighthouse_blocks`

Contract expectations:

1. Migration SQL remains the authoritative deploy contract for schema drift governance.
2. Shared contracts must align with migrations and plugin command boundaries.
3. Deletion behavior for host-linked records requires explicit contract lock before release.
4. Block storage contract must define deterministic conflict behavior with matching lifecycle.

## 5) Security, Privacy, and Compliance Controls

1. Auth required across LightHouse route families.
2. Admin-only gate for admin endpoints.
3. CSRF validation on sensitive writes (at minimum admin writes).
4. Ownership checks for host property mutations.
5. Role checks for seeker-only and host-only match actions.
6. Block operations must enforce authz and abuse-resistant policy controls.
7. LightHouse-specific rate-limit strategy remains a tracked hardening task for rewrite planning.

## 6) Web and Android Delivery Status

`web+android complete`. Core user journeys, admin moderation operations, and safety/privacy/compliance controls behave consistently across web (`/apps/lighthouse`) and Android (`packages/mobile/src/features/lighthouse`). UI conventions differ by platform; functional outcomes match.

## 7) Seed Coverage Status

`ctf/scripts/seedLighthousePhase2.mjs` seeds deterministic profile, property, match, and block fixtures for dev validation.

## 8) Gaps and Known Technical Debt

1. Host-profile deletion semantics for linked properties/matches follow a defensive cascade; FK-safe contract semantics are documented in code but have not been promoted to an explicit deletion contract.
2. Blocks route policy-error taxonomy is implemented inline; a shared error-code contract for block flows has not been published.
3. LightHouse-specific rate-limit and anti-scraping thresholds use shared platform defaults; a plugin-specific hardening contract is a known follow-up.

## 9) Change Log

- 2026-05-18: Replaced "Web and Android Parity Plan" with canonical "Web and Android Delivery Status" (`web+android complete`). Removed "Design References (Inventory Phase)" section (planning-phase artifact, not current state). Renamed "Open Decisions, Ambiguities, and Migration Risks" to canonical "Gaps and Known Technical Debt" and trimmed entries that were unimplemented-feature-as-debt.
- 2026-02-25: Created initial LightHouse CTF rewrite inventory.
