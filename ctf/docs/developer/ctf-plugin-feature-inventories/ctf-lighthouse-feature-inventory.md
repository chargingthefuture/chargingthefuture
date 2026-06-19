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
2. **No profile is required to use LightHouse** (owner decision, 2026-06-12). Opening LightHouse goes
   straight to the browse screen — there is no "create a LightHouse profile" gate and no no-profile
   splash. (V3 uses one canonical identity with optional per-plugin extension data, not a standalone
   per-plugin profile you must create first; see rule 114.)
3. Role-adapted quick actions are preserved:
   - Seeker: browse properties, view matches.
   - Host: manage properties, view matches.
4. Announcements banner integration remains in user dashboard scope.

### 1.2 Profile Preferences (optional — never a gate)

Owner decision (2026-06-12): the standalone LightHouse profile **requirement is dropped**. A member is
never blocked from LightHouse for not having a profile. The seeker/host preference fields below are
**optional** extension data (housing needs, host status) a member may set later; they never gate
access, and nothing prompts a "create your profile" step on entry. The `lighthouse_profiles` table and
`/api/lighthouse/profile` route are retained for that optional data and for admin views, but are no
longer a precondition for browsing, hosting, or matching.

1. Optional shared preference fields: bio, phone number, signal URL, active status.
2. Optional seeker preference fields: housing needs, desired move-in date, budget min/max, desired
   country.
3. Optional host preference fields: `hasProperty` indicator.
4. Verification rendering and first-name display behavior are retained where a profile exists.

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
5. Property creation does not require a pre-existing host profile (owner decision, 2026-06-12). A
   member can list a property without first creating a LightHouse profile; any host preference data is
   captured as optional extension data, not a precondition.
6. **Member self-service hosting (owner decision, 2026-06-18).** Any member can list their own place
   from the member surface — a "List your place" tab (`lighthouse-host.tsx`, reached from the icon
   rail / mobile tab bar) with a create-listing form for the property fields above. There is no
   admin-vetting gate and **no separate host-profile form**: `createProperty` transparently provisions
   the member's host `lighthouse_profiles` row (`ON CONFLICT (user_id) DO NOTHING`/`has_property = TRUE`,
   never overwriting a seeker row), so listing IS what makes a member a host. The host identity shown
   on the surface is **composed from existing data** — username (from the auth gate), the member's
   Quora link (read from `unlock_verification_submissions.quora_profile_url` and returned on
   `GET /api/lighthouse/my-properties` as `host.quoraProfileUrl`), and the shared `TrustWidgetCard`
   (fetched from `GET /api/trust/user/self`) — never re-entered. The old "host-only" enforcement on
   create is removed; update/delete remain owner-scoped.

### 1.5 Matches Workflow

1. Matches route parity target (`/apps/lighthouse/matches`).
2. Seeker match request parity target with message and proposed move-in date.
3. Role-specific match list views for seekers and hosts are preserved.
4. Host accept/reject actions with host response are preserved.
5. Seeker cancellation permissions remain policy-controlled.
6. Status lifecycle parity target:
   - `pending`, `accepted`, `rejected`, `cancelled`, `completed`.
7. Duplicate active/pending request constraints remain required.

### 1.6 Blocks (User Safety)

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

### 3.5 Blocks APIs (required v1)

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
4. `lighthouse_blocks`
5. `lighthouse_property_accepted_currencies` — join (`property_id`, `currency_code` FK →
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

Android admin present (2026-06-06): `AdminLighthouse.tsx` + `admin-api.ts` added under `packages/mobile/src/features/lighthouse`, registered as the `lighthouse-admin` screen in `App.tsx`. It mirrors the shipped web admin page (`/admin/lighthouse`): the five admin counts (seekers, hosts, properties, active matches, completed matches) and a match moderation queue with approve / reject actions. It binds only existing endpoints — `GET /api/lighthouse/admin/stats`, `GET /api/lighthouse/admin/matches`, and `PUT /api/lighthouse/admin/matches/:matchId`. Admin access is enforced server-side; a 401/403 shows an "admins only" notice. The match update sends `x-ctf-csrf: '1'` and approve/reject are behind an explicit confirm gesture. The web admin page is already mobile-responsive (Tailwind `max-w-5xl` container with a `sm:`/`lg:` responsive stats grid and text sections), so no web layout change was needed. Endpoint/contract gap: the design mockup frames moderation as a "housing request" approve/reject queue, but the only state-changing endpoint is the match status update (`PUT /admin/matches/:matchId`); the Android screen binds that. Property/announcement admin mutations exist as endpoints but were not surfaced on Android in this pass (web admin currently shows them as read-only dataset snapshots).

## 7) Seed Coverage Status

`ctf/scripts/seedLighthouse.mjs` seeds deterministic profile, property, match, and block fixtures for dev validation.

## 8) Gaps and Known Technical Debt

1. Host-profile deletion semantics for linked properties/matches follow a defensive cascade; FK-safe contract semantics are documented in code but have not been promoted to an explicit deletion contract.
2. Blocks route policy-error taxonomy is implemented inline; a shared error-code contract for block flows has not been published.
3. LightHouse-specific rate-limit and anti-scraping thresholds use shared platform defaults; a plugin-specific hardening contract is a known follow-up.

## 9) Change Log

- 2026-06-18: Member self-service hosting (owner decision). The member surface had no way to create a listing and `createProperty` hard-denied (`policy_denied`) without a pre-existing admin-granted host profile — and there was no UI to become a host — so no one could list (0 hosts, 0 properties). Added a "List your place" tab to the member shell (`lighthouse-host.tsx`, wired into `lighthouse-icon-rail.tsx` + the mobile tab bar; `LighthouseShell` now receives `userId`/`username` from the plugin page) with a create-listing form posting to `POST /api/lighthouse/properties`. Removed the host-profile gate in `createProperty`; it now transparently provisions the member's host `lighthouse_profiles` row (`ON CONFLICT (user_id)`, never overwriting a seeker), so there is no separate host-profile form. Host identity is composed from existing data: username (auth gate), Quora link (new `getHostQuoraUrl`, read from `unlock_verification_submissions`, returned on `GET /api/lighthouse/my-properties` as `host.quoraProfileUrl`), and the shared `TrustWidgetCard` (`GET /api/trust/user/self`). Added the `lighthouse.property.create` command + access-policy contracts (roles: member, admin; `selfServiceHosting: enabled`, `hostProfileAutoProvisioned: true`). Web + mobile-responsive; Android RN host tab is a tracked follow-up. Schema unchanged (existing tables).
- 2026-06-18: Removed per-plugin announcements from LightHouse. The admin Announcements tab and its component (`lighthouse-admin-announcements.tsx`), the user/admin announcement routes (`/api/lighthouse/announcements`, `/api/lighthouse/admin/announcements` and its `:id` route), the repository announcement functions, and the `LighthouseAnnouncementInput` type were deleted. Announcements are now posted in one place — the Feed (`feed-announcements` plugin), which can target any plugin (including LightHouse) — so the Feed is the single place to post announcements about LightHouse. No schema change: LightHouse only ever read the shared `announcements` table by targeting (it has no `lighthouse_announcements` table in v3). Sections 1.6, 2.4, 3.5, and the data-model announcement entry were removed above to match.
- 2026-06-13: Web admin slice 3 — match moderation + announcements. Added a Cancel-match action on pending/accepted matches (`PUT /api/lighthouse/admin/matches/:id` with `status: 'cancelled'`, `x-ctf-csrf: '1'`) and a new Announcements tab (`components/lighthouse/lighthouse-admin-announcements.tsx`) that creates (`POST /api/lighthouse/admin/announcements`) and deletes (`DELETE /api/lighthouse/admin/announcements/:id`) admin announcements. Announcements split into their own component to keep the shell within the rule-116 size budget. No new endpoint, schema, or contract.
- 2026-06-13: Web admin slice 2 — property moderation. Added a Hide/Restore listing action to each property in the admin Properties tab. Because the admin property endpoint validates a full record, the action resends the property via the existing `PUT /api/lighthouse/admin/properties/:propertyId` (with `x-ctf-csrf: '1'`) with `isActive` flipped, then refreshes. Match status changes and announcement CRUD remain available via their endpoints but are not yet surfaced. No new endpoint, schema, or contract.
- 2026-06-13: Web admin design pass (slice 1 — read-only). Replaced the bare diagnostic `/admin/lighthouse` page with `components/lighthouse/lighthouse-admin-shell.tsx`, styled to the admin design system (header with icon + ADMIN badge, snapshot stat blocks, Properties/Matches tabs). Bound to the real backend — `getLighthouseAdminStats`, `listLighthousePropertiesAdmin`, `listLighthouseMatchesAdmin` — shown as styled read-only lists (property title/location/rent/active state; match status/parties/date). Moderation actions (hide/unhide a property via the full-payload `PUT`, announcement create/activate/delete, match status) are a follow-up slice. The mobile mockup depicts a "housing request" approve/reject queue that does not match LightHouse's real admin surface (listings + matches + announcements), so per the admin build rule the real data was styled instead. No new endpoint, schema, or contract.
- 2026-06-12: Dropped the LightHouse standalone-profile requirement (owner decision). Opening LightHouse showed a dead-end "Welcome to LightHouse — No profile found yet" splash that blocked the whole plugin with no way to create a profile; the browse/matches/chat screens never used the profile. The web shell's profile fetch, state, and gate were removed (PR #456) so LightHouse opens straight to browse. This inventory was updated to match: a profile is never required (§1.1, §1.2), and property creation no longer requires a host profile (§1.4). Per the single-profile architecture (rule 114), LightHouse uses the canonical identity; the `lighthouse_profiles` table and `/api/lighthouse/profile` route are retained only as optional seeker/host preference data and for admin views — never as an access gate. (Removing that table/route entirely would be a larger schema change affecting property/match flows; deferred, since it is no longer a gate.)
- 2026-06-12: Android API clients (`api.ts`, `admin-api.ts`, `fetchLighthouseStreamCredentials.ts`) now call the backend through the shared authenticated fetch wrapper (`authedFetch`): the signed-in member's Clerk bearer token is attached and the base URL comes from runtime config, replacing the plain dev-only fetch against hardcoded emulator/localhost URLs. The admin functions no longer take a token argument (the wrapper supplies the live token); `AdminLighthouse.tsx` call sites updated. The chat-credentials fetcher now looks up the member's accepted match first and posts to `/api/lighthouse/matches/{matchId}/chat` with the real id (the old hardcoded `active` path segment always returned 404), and reads the channel id from the route's `channelId` field. No backend, schema, or contract change.
- 2026-06-06: Android admin parity. Added `AdminLighthouse.tsx` + `admin-api.ts` and registered the `lighthouse-admin` screen in `App.tsx`. Mirrors the web admin page (`/admin/lighthouse`) against existing endpoints only: `GET /admin/stats` (the five counts), `GET /admin/matches`, and `PUT /admin/matches/:matchId` (approve/reject, confirm-gated, `x-ctf-csrf: '1'`). No backend added. Web admin page was already mobile-responsive (no layout change). Property/announcement admin mutations remain web-only for now.
- 2026-06-02: v2 to v3 schema rebuild. The live v2 database has an old LightHouse schema with `varchar` ids and `varchar` foreign keys (and a v2-only `lighthouse_announcements` table). The v3 canonical `schema.sql` declares these tables with `uuid` ids, and a `uuid` foreign key cannot reference a `varchar` key, so applying `schema.sql` against a v2 database aborted at the first such foreign key (`lighthouse_matches.property_id`) and left every table defined later in the file — including the comic plugin's tables — uncreated. Owner reviewed the small amount of v2 LightHouse data and chose to discard it (the single property is being recreated by hand and affected users contacted before launch). Added a guarded, idempotent pre-schema migration (`ctf/db/migrations/pre/0001_lighthouse_v2_to_v3_rebuild.sql`) that drops the drifted `lighthouse_profiles` / `lighthouse_properties` / `lighthouse_matches` (so `schema.sql` recreates them as `uuid`) and drops the v2-only `lighthouse_announcements` (not recreated). The migration only fires when the drift is present (`lighthouse_properties.id` is not `uuid`), so it is a no-op on a rebuilt or fresh database. The "Update Neon DB" workflow now applies `pre/` migrations, then `schema.sql`, then `post/` migrations; see `ctf/db/migrations/README.md`.
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

- 2026-06-19: Web fix — a member viewing their own listing in the property detail no longer sees "Apply Now"/"Message Host"; instead they see a "This is your listing." note and an "Edit listing" button. The host tab's "List your place" form now also edits an existing listing: it prefills from `GET /api/lighthouse/properties/:id` (full record, since the update is a full-column replace), saves via `PUT /api/lighthouse/properties/:id` (with `x-ctf-csrf`), and each row in "Your listings" gains an Edit button. Detail ownership is decided client-side by comparing the listing's `hostUserId` to the signed-in user (added `hostUserId` to the client `Property` type). No schema, route, or contract change.
- 2026-06-19: Android parity for the member self-service "List your place" host tab (web shipped earlier, #598). Added a `host` tab to the RN `LighthouseTabs` and built `LighthouseHost.tsx` + `LighthouseHostForm.tsx`, binding `GET /api/lighthouse/my-properties` (the host's own listings + composed Quora link) and `POST /api/lighthouse/properties` (with the `x-ctf-csrf` header). Mirrors the web host surface, including the composed host identity (username + Quora link — no separate host profile to fill). Two web-header items were not ported: the Trust widget (no mobile Trust primitive exists yet) and `photos`/`isActive` (the web host form does not collect them either). Real-data-only; no schema, route, or contract change. Mobile typecheck passes.
- 2026-02-25: Created initial LightHouse CTF rewrite checklist aligned to parity inventory scope, with v1 blocks inclusion, web+android parity gates, schema/deletion decision locks, and security/policy validation requirements.
