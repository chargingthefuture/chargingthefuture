# LightHouse Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Rewrite target only: `ctf/`
- Legacy `platform/` is reference-only and must not be modified.
- Unified plugin scope slug: `lighthouse`
- Plugin name to retain: `LightHouse`.
- This document is a parity-planning inventory for CTF rewrite (not implementation evidence yet).

Authoritative legacy reference:

- `ctf/docs/developer/lighthouse-feature-inventory.md`

Scope decisions locked for this rewrite inventory phase:

1. CTF rewrite parity inventory is tracked in `ctf-plugin-feature-inventories` per lifecycle rules.
2. `lighthouse_blocks` is required in v1 parity scope.
3. Attached UI mockups are included now as design-direction references for inventory planning.

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

## 6) Web and Android Parity Plan

1. Core LightHouse user journeys must deliver equivalent web and Android behavior.
2. Core admin operations required for moderation must maintain equivalent policy outcomes across web and Android.
3. UI layout may differ by platform conventions, but functional outcomes must match.
4. Safety/privacy/compliance-critical controls cannot be platform-incomplete at release.

## 7) Seed Coverage Status

Seed script requirement: Provide a deterministic plugin seed script with dummy development data for manual plugin validation in dev environments.

## 8) Design References (Inventory Phase)

User-provided references are accepted now for inventory direction and should guide IA/layout decisions during implementation kickoff:

1. Rental booking marketplace browse/list + map split-view concepts.
2. Property details visual hierarchy and card-system references.
3. Mobile-first listing and dashboard concepts.


## 9) Open Decisions, Ambiguities, and Migration Risks

1. Canonical schema lock across migrations/shared contracts must be confirmed before implementation starts.
2. Host-profile deletion semantics for linked properties/matches require explicit FK-safe contract decisions.
3. Blocks route contract and policy error taxonomy need final lock before endpoint implementation.
4. Legacy reliability drift indicates parity acceptance must rely on refreshed selectors and contract-level coverage.
5. Rate-limiting/anti-scraping strategy for LightHouse endpoints should be finalized as part of rewrite hardening.

## 10) Change Log

- 2026-02-25: Created initial LightHouse CTF rewrite parity inventory in required `ctf-plugin-feature-inventories` folder; locked v1 scope for blocks, captured web+Android parity obligations, and included user-provided UI mockups as inventory-phase design references.
