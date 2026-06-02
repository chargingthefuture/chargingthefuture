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
2. `lighthouse_properties` — includes `monthly_rent` (listed amount) and `rent_currency`
   (FK → `currencies(code)`; the currency the rent is listed in). Backfilled to `USD` for existing
   non-null rents; Canadian listings with no cost yet keep NULL.
3. `lighthouse_matches`
4. `lighthouse_announcements`
5. `lighthouse_blocks`
6. `lighthouse_property_accepted_currencies` — join (`property_id`, `currency_code` FK →
   `currencies`) listing every currency a property accepts. "Accepts ServiceCredits" is true iff a
   row with `currency_code='SC'` exists here — it is never derived from `rent_currency`.

Multi-currency / no-fiat-parity (issue #120):

1. Rent is shown in its own `rent_currency`; a fiat rent may appear beside a separate "Accepts
   ServiceCredits" badge (two distinct fields) — never as a ServiceCredits↔fiat equivalence.
2. ServiceCredits (`currencies.code='SC'`) renders as the label "ServiceCredits", never the bare code,
   and never at a fiat figure.

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

`web+android complete` (feature parity). Core user journeys, admin moderation operations, and safety/privacy/compliance controls behave consistently across web (`/apps/lighthouse`) and Android (`packages/mobile/src/features/lighthouse`). UI conventions differ by platform; functional outcomes match.

Web pixel pass: `LighthouseShell` is aligned to `design/.../survivor-hub/LightHouse.tsx` and its Loading mockup. Emoji glyphs were replaced with the mockup's lucide-react icons; the missing filter sidebar (data-backed filters: All / Available Now / Accepts Credits, with real stats) and the right panel (Pricing Guide + Privacy by Design + an informational Emergency Housing note) were added; the property detail moved from a modal to the mockup's full-page view; and a skeleton loading state was added. Filters/stats and counts derive from real data only (no fabricated counts; the mockup's "Verified Only / Female-only / Emergency" filters and "5 slots" count are not backed by the current data model and were omitted rather than faked). The shell was decomposed into modular sub-components (`lighthouse-icon-rail`, `lighthouse-filter-sidebar`, `lighthouse-right-panel`, `lighthouse-browse`, `lighthouse-matches`, `lighthouse-chat`, `lighthouse-property-detail`, `lighthouse-loading-skeleton`, `shared`) so each unit stays within the rule-116 limits. API wiring is unchanged.

Android pixel pass (2026-05-31): The React Native `packages/mobile/src/features/lighthouse` feature is pixel-aligned to `design/.../survivor-hub/MobileLightHouse.tsx` and its Loading/Empty/Public state mockups. The old single-screen `LighthouseScreen.tsx` and flat `LighthouseTabs.tsx` were rewritten and decomposed into eight focused units: `LighthouseLoadingState`, `LighthouseEmptyState`, `LighthousePublicState`, `LighthouseListHeader`, `LighthousePropertyCard`, `LighthousePropertyDetail`, `LighthouseScreen` (browse orchestrator), and `LighthouseMatches`. Colors (#0F1117 background, #EAB308 accent, #090B0F dark surface, rgba borders), type scale, spacing, and iconography (Ionicons) match the design mockup. The bottom nav (Browse / Matches / Chat) matches the mockup's nav pattern. All data binds to real API fields from `/api/lighthouse/properties` and `/api/lighthouse/matches`; mockup elements with no backing schema field (ratings, "Credits ✓" badge, emoji thumbnails, emergency slot count) are omitted rather than faked. Matches tab shows real match status, move-in date, message, and host response. `LighthouseMatches.tsx` was updated to use `fetchMatches()` from the shared `api.ts` (removing the duplicated inline fetch). `index.ts` re-exports `LighthouseTabs as Lighthouse` unchanged so `App.tsx` import requires no changes.

## 7) Seed Coverage Status

`ctf/scripts/seedLighthouse.mjs` seeds deterministic profile, property, match, and block fixtures for dev validation.

## 8) Gaps and Known Technical Debt

1. Host-profile deletion semantics for linked properties/matches follow a defensive cascade; FK-safe contract semantics are documented in code but have not been promoted to an explicit deletion contract.
2. Blocks route policy-error taxonomy is implemented inline; a shared error-code contract for block flows has not been published.
3. LightHouse-specific rate-limit and anti-scraping thresholds use shared platform defaults; a plugin-specific hardening contract is a known follow-up.

## 9) Change Log

- 2026-06-02: Schema drift reconciliation. Added an idempotent migration so databases that created `lighthouse_properties.id` as `TEXT` (before the canonical `UUID` type) are converted to `UUID` in place. This was blocking the whole-database schema apply: the `UUID` foreign key on `lighthouse_property_accepted_currencies` could not reference a `TEXT` key, so the apply aborted there and every table defined later in `schema.sql` (including the comic plugin's tables) was never created in production. The migration only runs when the live type is not already `uuid`; any non-UUID id value is reissued a fresh UUID (no foreign key references these ids at that point). No change to the canonical schema or to application behavior; on a fresh database it is a no-op.
- 2026-05-31: Android pixel pass. Rewrote and decomposed the mobile feature (`packages/mobile/src/features/lighthouse`) to match `design/.../survivor-hub/MobileLightHouse.tsx` and its state mockups. Eight focused components created (`LighthouseLoadingState`, `LighthouseEmptyState`, `LighthousePublicState`, `LighthouseListHeader`, `LighthousePropertyCard`, `LighthousePropertyDetail`, `LighthouseScreen`, `LighthouseMatches`). Colors, spacing, type scale, and bottom nav match the mockup. All data bound to real API fields; mockup-only elements (ratings, credits badge, emoji thumbnails, emergency slot count) omitted. `LighthouseMatches` refactored to use `fetchMatches()` from shared `api.ts`. TypeScript and lint gates pass clean; EOF and parity gates pass.
- 2026-05-29: Web UI circle-back. Aligned `LighthouseShell` to the `LightHouse.tsx` mockup and its Loading state: replaced emoji with lucide icons, added the filter sidebar (real data-backed filters/stats) and the right panel (Pricing Guide + Privacy by Design + emergency note), moved the property detail from a modal to the mockup's full-page view, and added a skeleton loading state. Copy matches the design-sync `c5d83c0` revision: no user-facing "GetStream" wording (privacy copy reads "end-to-end encrypted"; the GetStream badges are removed). Decomposed the previously oversized shell (274 lines / complexity 29) into modular sub-components and cleared lint debt (typed the chat credentials, removed the unused `isAdmin`/`role`/`announcements` and the empty catch binding; dropped the unused props). API wiring unchanged.
- 2026-05-18: Replaced "Web and Android Parity Plan" with canonical "Web and Android Delivery Status" (`web+android complete`). Removed "Design References (Inventory Phase)" section (planning-phase artifact, not current state). Renamed "Open Decisions, Ambiguities, and Migration Risks" to canonical "Gaps and Known Technical Debt" and trimmed entries that were unimplemented-feature-as-debt.
- 2026-02-25: Created initial LightHouse CTF rewrite inventory.


## Build Checklist

> **Reconciliation (2026-05-26):** the Delivery Status above is `web+android complete` (feature parity).
> Unchecked items below are obsolete web-first / Android-deferral planning artifacts and deferred MVP
> validation/release gates (Rule 118) — not missing implementation. The authoritative production bar
> (pixel-perfect to `design` + parity + gates + deploy) is tracked in
> `ctf/docs/developer/PRODUCTION_READINESS_PLAN.md`, which wins where it differs from this checklist.

### Scope and Boundary

- [ ] Confirm implementation scope is `ctf/` only.
  - Acceptance criteria:
    - No implementation work is required in `platform/`.
- [ ] Confirm plugin identity and naming.
  - Acceptance criteria:
    - Rewrite artifacts use plugin slug `lighthouse` in CTF folder naming.
    - Plugin name remains `LightHouse` in product-facing contexts.
- [ ] Confirm inventory/checklist artifact pairing is complete.
  - Acceptance criteria:
    - `ctf-lighthouse-feature-inventory.md` exists and is current.
    - This checklist is updated in the same PR as behavior/contract scope changes.
- [ ] Confirm v1 scope lock for required parity.
  - Acceptance criteria:
    - Included: profile CRUD, property browse/detail, host property CRUD, match lifecycle, announcements, admin operations, blocks.
    - No net-new non-parity discovery features are introduced without explicit approval.

### �� Decision Lock and Contract Baseline

- [ ] Lock canonical schema authority for LightHouse rewrite.
  - Acceptance criteria:
    - Migration SQL and shared contracts have one explicit source-of-truth workflow.
    - Schema-drift gate expectations are documented.
- [ ] Lock host-profile deletion semantics for linked data.
  - Acceptance criteria:
    - FK-safe behavior for linked properties/matches is approved.
    - User-facing outcomes and audit expectations are documented.
- [ ] Lock blocks policy contract for v1.
  - Acceptance criteria:
    - Block lifecycle operations (create/check/list/delete) are approved.
    - Match/interactions behavior under block state is explicitly documented.
- [ ] Lock web+android parity obligations for critical LightHouse flows.
  - Acceptance criteria:
    - Critical user/admin/safety flows are marked parity-required across web and Android.

### �� Data, Migration, and Contract Readiness

- [ ] Implement canonical schema contracts for LightHouse entities.
  - Acceptance criteria:
    - `lighthouse_profiles`, `lighthouse_properties`, `lighthouse_matches`, `lighthouse_announcements`, and `lighthouse_blocks` are represented in canonical contracts.
- [ ] Validate migration compatibility and replay safety.
  - Acceptance criteria:
    - Migrations apply cleanly in local and CI workflows.
    - Drift checks pass for schema and contract artifacts.
- [ ] Finalize API projection contract map.
  - Acceptance criteria:
    - Profile/property/match/announcement/admin/blocks route contracts are versioned and documented.

### �� API and Policy Gate Implementation

- [ ] Enforce auth requirements across LightHouse user routes.
  - Acceptance criteria:
    - Unauthenticated attempts return deterministic deny outcomes.
- [ ] Enforce role and ownership constraints.
  - Acceptance criteria:
    - Host ownership checks protect property mutations.
    - Seeker/host action boundaries for match lifecycle are server-enforced.
- [ ] Enforce admin-role plus CSRF controls on admin writes.
  - Acceptance criteria:
    - Admin property/match/announcement mutations reject missing or invalid CSRF tokens.
- [ ] Implement blocks policy enforcement.
  - Acceptance criteria:
    - Block relationships are respected in affected interaction paths.
    - Policy-deny behavior is deterministic and documented.

### �� Web Delivery

- [ ] Implement dashboard parity with role-based entry behavior.
  - Acceptance criteria:
    - No-profile onboarding and role-specific CTA paths are complete.
    - Announcements banner behavior follows contract.
- [ ] Implement profile flow parity (create/read/update/delete).
  - Acceptance criteria:
    - Seeker/host field differences and validation constraints are complete.
    - Profile delete flow behavior matches approved deletion contract.
- [ ] Implement property and match journey parity.
  - Acceptance criteria:
    - Browse/detail, host management, and match lifecycle paths are complete.
    - Duplicate match request prevention behavior is preserved.
- [ ] Implement admin surface parity.
  - Acceptance criteria:
    - Admin stats, profile views, moderation updates, and announcement management are complete.
- [ ] Implement blocks UX parity.
  - Acceptance criteria:
    - User block create/check/list/delete interactions are accessible and policy-aligned.

### �� Android Delivery Parity

- [ ] Implement Android parity for core user flows.
  - Acceptance criteria:
    - Profile/property/match/announcement outcomes are equivalent to web behavior.
- [ ] Implement Android parity for required admin flows.
  - Acceptance criteria:
    - In-scope admin moderation outcomes are equivalent to web policy outcomes.
- [ ] Implement Android parity for blocks behavior.
  - Acceptance criteria:
    - Blocks lifecycle and enforcement behavior mirror shared contract outcomes.

### �� Security, Validation, Seeds, and Release Gates [MVP: VALIDATION DEFERRED — see Rule 118.]

- [ ] API contracts design documentation for all route families.
  - Acceptance criteria:
    - Profile/property/match/announcement/admin/blocks endpoints are documented.
- [ ] Policy-critical security controls design documentation.
  - Acceptance criteria:
    - Authz, CSRF, role, ownership, and block-policy handling is documented.
- [ ] LightHouse critical journey design documentation.
  - Acceptance criteria:
    - Seeker, host, and admin primary paths are documented with stable selectors.
- [ ] Web + Android parity design scope. [PARITY TESTING DEFERRED FOR MVP — see Rule 118.]
  - Acceptance criteria:
    - Parity-required flows are documented for post-MVP testing.
- [ ] Release readiness documentation. [EVIDENCE COLLECTION DEFERRED FOR MVP — see Rule 118.]
  - Acceptance criteria:
    - Migration and seed documentation is complete; evidence collection deferred to post-MVP.

### Docs Lifecycle

- [ ] Keep LightHouse inventory/checklist synchronized with accepted scope changes.
  - Acceptance criteria:
    - `ctf-lighthouse-feature-inventory.md` and this checklist are updated in the same PR when behavior/contracts change.
- [ ] Implementation tracking. [EVIDENCE CAPTURE DEFERRED FOR MVP — see Rule 118.]
  - Acceptance criteria:
    - Implementation status is tracked; evidence collection deferred to post-MVP.

### Change Log

- 2026-02-25: Created initial LightHouse CTF rewrite checklist aligned to parity inventory scope, with v1 blocks inclusion, web+android parity gates, schema/deletion decision locks, and security/policy validation requirements.
