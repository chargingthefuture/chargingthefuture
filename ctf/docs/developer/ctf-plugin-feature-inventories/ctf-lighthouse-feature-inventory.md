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
5. **Seeker self-service screen (2026-07-14).** A "Your details" tab
   (`lighthouse-seeker-profile.tsx`, reached from the icon rail on desktop and the mobile tab bar)
   lets a member fill and save the seeker preference fields above via `POST /api/lighthouse/profile`
   (`x-ctf-csrf: '1'`). It is **not** a gate for browsing or hosting, but requesting a stay needs an
   **active** profile, so the "Request to stay" action points a member with none here.
6. **A member can be both a host and a seeker (owner decision, 2026-07-14).** Hosting and requesting
   stays are NOT mutually exclusive and are not separate accounts. A member who has listed a place can
   also fill in the "Your details" form and request stays. The profile row is no longer type-locked:
   saving seeker details on a host account keeps the member's host flag (`has_property` is sticky) and
   does not relabel their `profile_type`, and the match endpoint only requires an **active** profile
   (not `profile_type = 'seeker'`). A member still cannot request a stay on their own listing (UI hides
   the action; the endpoint is the backstop).

### 1.3 Property Browse and Detail

1. Browse route parity target (`/apps/lighthouse/browse`).
2. Property detail route parity target (`/apps/lighthouse/property/:id`).
3. Authenticated property list/detail behavior parity is required.
4. Detail view includes host reference metadata and listing details.
5. Seeker "Request to stay" action from the detail view is **implemented on web (desktop + mobile-responsive); the native Android surface was removed 2026-07-20 (rule 105, PR #1742)**
   (2026-07-14): it posts `POST /api/lighthouse/matches` with an optional message and preferred
   move-in date. A member with no active profile is routed to the "Your details" screen first;
   duplicate and blocked cases are shown inline. The action is hidden on the member's own listing.
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
   - monthly rent, **rent currency** (the currency the rent is listed in, chosen with the shared
     `CurrencySelect`; defaults to `USD`),
   - **accepted currencies** (a checklist built from `GET /api/currencies`; each checked code is
     persisted to `lighthouse_property_accepted_currencies`. Checking ServiceCredits means the listing
     accepts ServiceCredits — this is a separate field from the rent currency, never derived from it),
   - available from,
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
2. Seeker match request is **implemented on web (desktop + mobile-responsive); it shipped 2026-07-14 and also had an Android surface, which was removed 2026-07-20 (rule 105, PR #1742)** — the "Request to stay"
   action on a listing (web `lighthouse-property-detail.tsx`; Android `LighthouseRequestToStay.tsx`)
   posts `POST /api/lighthouse/matches` with an optional message and preferred move-in date, opening
   the private match chat channel on host acceptance. The no-seeker-profile (`policy_denied`),
   duplicate (`duplicate_match`), and blocked-pair (`blocked_pair`) cases are surfaced inline.
3. Role-specific match list views for seekers and hosts are preserved.
4. Host accept/reject actions with host response are preserved.
5. Seeker cancellation permissions remain policy-controlled.
6. Status lifecycle parity target:
   - `pending`, `accepted`, `rejected`, `canceled`, `completed`.
7. Duplicate active/pending request constraints remain required.
8. **Record an accepted match as ongoing, without leaving LightHouse (2026-08-03).** An accepted match
   carries an "Is this ongoing?" prompt: pick how often and how it is settled, and it records an ongoing
   housing arrangement with the other side of that match. They confirm it in the Recurring Activity app.
   A money arrangement records no amount — only that it happens and how often. The prompt hides itself
   when an arrangement with that member is already recorded, so the pair is never recorded twice from
   two apps.

### 1.6 Blocks (User Safety) — served by the product-wide member block

LightHouse does not have its own blocking feature. Blocking is one product-wide thing a member does
once, from anywhere, and it holds everywhere — see §1.6 of `ctf-non-plugin-feature-inventory.md` for
the model, the routes, and the manage-list. LightHouse's job is to honor it:

1. **Block a host from the listing.** The listing detail carries the shared "Block member" action
   (`components/blocks/block-member-button.tsx`, `POST /api/account/blocks`), shown on any listing
   that is not the member's own. It is where a seeker actually meets a host, so it is where blocking
   belongs. The dialog carries the same optional safety escalation as everywhere else.
2. **A blocked host's listings are hidden.** `GET /api/lighthouse/properties` passes the browsing
   member to `listProperties`, which leaves out any listing whose host is blocked in either
   direction. Blocking from the listing detail sends the member back to browse and re-reads the list,
   so the blocked host's places disappear straight away.
3. **A blocked pair cannot request a stay.** Creating a match request checks `member_blocks` in both
   directions inside the same transaction and fails with `blocked_pair` (403). The check also still
   reads the plugin's older `lighthouse_blocks` table so pre-existing rows keep working. The refusal
   message is deliberately neutral — "This listing is not available to you." — because a block is
   never disclosed to the person who was blocked; it replaced the unreachable-until-now internal
   wording "Match blocked by pair policy."
4. **`lighthouse_blocks` is read-only history.** The plugin's own block routes
   (`GET`/`POST /api/lighthouse/blocks`, `DELETE …/blocks/[blockedUserId]`, `GET …/blocks/check`)
   were removed on 2026-08-03: nothing ever called them, so no member could create a LightHouse
   block, while the product-wide block they *were* using went unenforced here. The table is kept and
   still read by the match-request check (and still cleared on account deletion), but nothing writes
   it any more.

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
- `GET /api/lighthouse/admin/audit-events` — admin-gated (`requireLighthouseAdminAccess`) list of audit-trail rows (`listLighthouseAuditEvents`, `?limit=` default 100), reading `lighthouse_admin_audit_trail`.

### 3.5 Blocks APIs — none; LightHouse has no block routes of its own

Blocking runs entirely through the account-level routes (`GET`/`POST /api/account/blocks`,
`DELETE /api/account/blocks/[blockedUserId]`), documented in §1.6 of
`ctf-non-plugin-feature-inventory.md`. The four LightHouse-specific block routes that used to be
listed here were removed on 2026-08-03 — see §1.6 above.

### 3.6 ServiceCredits

- `POST /api/lighthouse/service-credits` — send ServiceCredits from the caller to `toUserId` (body `{ toUserId, amount, message?, idempotencyKey? }`; `amount` must be > 0; CSRF-guarded). Delegates to the shared `createTransfer` with `originPlugin: 'lighthouse'` and `reasonCode: 'lighthouse.transfer'`; an idempotency key is auto-generated when none is supplied.

## 4) Data Model and Storage Contracts

Required entities for parity scope:

1. `lighthouse_profiles`
2. `lighthouse_properties` — includes `monthly_rent` (listed amount) and `rent_currency`
   (FK → `currencies(code)`; the currency the rent is listed in). Backfilled to `USD` for existing
   non-null rents; Canadian listings with no cost yet keep NULL.
3. `lighthouse_matches`
4. `lighthouse_blocks` — read-only history since 2026-08-03. Nothing writes it any more (the plugin's
   own block routes were removed); the match-request check still reads it alongside `member_blocks`
   so rows written before then keep taking effect, and account deletion still clears it.
5. `lighthouse_property_accepted_currencies` — join (`property_id`, `currency_code` FK →
   `currencies`) listing every currency a property accepts. "Accepts ServiceCredits" is true iff a
   row with `currency_code='SC'` exists here — it is never derived from `rent_currency`.
6. `lighthouse_user_extension` — the plugin extension keyed by `user_id` (PK); holds the
   service-scoped deletion marker `service_deleted_at` (nullable) and `updated_at`.
7. `lighthouse_admin_audit_trail` — the audit log. Columns: `id`, `actor_id`, `command`,
   `policy_status` (`allow`/`deny`), `reason`, `target_type`, `target_id`, `metadata` (jsonb),
   `created_at`. Written by `insertLighthouseAudit` (e.g. on block create/delete) and read by
   `GET /api/lighthouse/admin/audit-events`.

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

Delivery: **web + mobile-responsive complete** (feature parity). **Android (React Native) surface removed 2026-07-20 (rule 105, PR #1742)** — this feature is now web-only, served by the installable web app (PWA). Core user journeys, admin moderation operations, and safety/privacy/compliance controls are served on web (`/apps/lighthouse`). Historical parity detail: these behaved consistently with the former Android surface (`packages/mobile/src/features/lighthouse`, now removed).

Member seeker flow wired (2026-07-14, web + mobile-responsive + android): the seeker preference profile and the seeker match request — whose endpoints (`/api/lighthouse/profile`, `POST /api/lighthouse/matches`) existed and worked but had no member UI — are now reachable on both platforms. No schema, route, or contract change (existing endpoints only).

- **Web** (`lighthouse-seeker-profile.tsx`, `lighthouse-property-detail.tsx`): a "Your details" tab sets the seeker profile, and a "Request to stay" action on the listing detail creates the match request, routing a member with no active seeker profile to "Your details" first.
- **Android (React Native)** (`packages/mobile/src/features/lighthouse/LighthouseSeekerProfile.tsx`, `LighthouseRequestToStay.tsx`): the same two surfaces. A "Your details" tab was added to `LighthouseTabs.tsx`; the property detail (`LighthousePropertyDetail.tsx`) gained the "Request to stay" action (hidden on the member's own listing via `currentUserId`), and the browse screen (`LighthouseScreen.tsx`) switches to the "Your details" tab when the endpoint reports no seeker profile. New mobile API client methods (`fetchProfile`, `upsertSeekerProfile`, `createMatchRequest` in `api.ts`) bind the existing endpoints with `x-ctf-csrf: '1'`.

Web pixel pass: `LighthouseShell` is aligned to `design/.../survivor-hub/LightHouse.tsx` and its Loading mockup. Emoji glyphs were replaced with the mockup's lucide-react icons; the missing filter sidebar (data-backed filters: All / Available Now / Accepts Credits, with real stats) and the right panel (Pricing Guide + Privacy by Design + an informational Emergency Housing note) were added; the property detail moved from a modal to the mockup's full-page view; and a skeleton loading state was added. Filters/stats and counts derive from real data only (no fabricated counts; the mockup's "Verified Only / Female-only / Emergency" filters and "5 slots" count are not backed by the current data model and were omitted rather than faked). The shell was decomposed into modular sub-components (`lighthouse-icon-rail`, `lighthouse-filter-sidebar`, `lighthouse-right-panel`, `lighthouse-browse`, `lighthouse-matches`, `lighthouse-chat`, `lighthouse-property-detail`, `lighthouse-loading-skeleton`, `shared`) so each unit stays within the rule-116 limits. API wiring is unchanged.

Android pixel pass (2026-05-31): The React Native `packages/mobile/src/features/lighthouse` feature is pixel-aligned to `design/.../survivor-hub/MobileLightHouse.tsx` and its Loading/Empty/Public state mockups. The old single-screen `LighthouseScreen.tsx` and flat `LighthouseTabs.tsx` were rewritten and decomposed into eight focused units: `LighthouseLoadingState`, `LighthouseEmptyState`, `LighthousePublicState`, `LighthouseListHeader`, `LighthousePropertyCard`, `LighthousePropertyDetail`, `LighthouseScreen` (browse orchestrator), and `LighthouseMatches`. Colors (#0F1117 background, #EAB308 accent, #090B0F dark surface, rgba borders), type scale, spacing, and iconography (Ionicons) match the design mockup. The bottom nav (Browse / Matches / Chat) matches the mockup's nav pattern. All data binds to real API fields from `/api/lighthouse/properties` and `/api/lighthouse/matches`; mockup elements with no backing schema field (ratings, "Credits ✓" badge, emoji thumbnails, emergency slot count) are omitted rather than faked. Matches tab shows real match status, move-in date, message, and host response. `LighthouseMatches.tsx` was updated to use `fetchMatches()` from the shared `api.ts` (removing the duplicated inline fetch). `index.ts` re-exports `LighthouseTabs as Lighthouse` unchanged so `App.tsx` import requires no changes.

Android admin present (2026-06-06): `AdminLighthouse.tsx` + `admin-api.ts` added under `packages/mobile/src/features/lighthouse`, registered as the `lighthouse-admin` screen in `App.tsx`. It mirrors the shipped web admin page (`/admin/lighthouse`): the five admin counts (seekers, hosts, properties, active matches, completed matches) and a match moderation queue with approve / reject actions. It binds only existing endpoints — `GET /api/lighthouse/admin/stats`, `GET /api/lighthouse/admin/matches`, and `PUT /api/lighthouse/admin/matches/:matchId`. Admin access is enforced server-side; a 401/403 shows an "admins only" notice. The match update sends `x-ctf-csrf: '1'` and approve/reject are behind an explicit confirm gesture. The web admin page is already mobile-responsive (Tailwind `max-w-5xl` container with a `sm:`/`lg:` responsive stats grid and text sections), so no web layout change was needed. Endpoint/contract gap: the design mockup frames moderation as a "housing request" approve/reject queue, but the only state-changing endpoint is the match status update (`PUT /admin/matches/:matchId`); the Android screen binds that. Property/announcement admin mutations exist as endpoints but were not surfaced on Android in this pass (web admin currently shows them as read-only dataset snapshots).

## 7) Seed Coverage Status

`ctf/scripts/seedLighthouse.mjs` seeds deterministic profile, property, match, and block fixtures for dev validation.

## 8) Gaps and Known Technical Debt

1. Host-profile deletion semantics for linked properties/matches follow a defensive cascade; FK-safe contract semantics are documented in code but have not been promoted to an explicit deletion contract.
2. ~~Blocks route policy-error taxonomy is implemented inline; a shared error-code contract for block flows has not been published.~~ **Closed (2026-08-03):** LightHouse no longer has block routes of its own, so there is no plugin-specific block error taxonomy left to publish. Blocking runs on the account-level routes; the only block-related code left here is the read check on a match request, which returns the existing `blocked_pair` (403).
3. LightHouse-specific rate-limit and anti-scraping thresholds use shared platform defaults; a plugin-specific hardening contract is a known follow-up.
4. **Chat threads on an existing match are not re-checked against a later block.** A block stops a
   *new* stay request and hides the host's listings, but a match that was already accepted keeps its
   Stream chat channel. Cutting an existing thread when one side blocks the other needs a decision on
   what happens to the match itself (canceled? left in place, muted?), so it is recorded here rather
   than guessed at.

## 9) Change Log

- 2026-08-03: **An accepted match can be recorded as ongoing without leaving LightHouse.** Housing is the
  clearest case of something that carries on month after month, and LightHouse only ever sees the moment
  the host says yes. The matches tab now shows the shared "Is this ongoing?" prompt
  (`components/shared/mark-recurring-control.tsx`) on an accepted/completed match, pre-set to the housing
  sector and to the other side of that match, so the member records the ongoing arrangement right there
  instead of being sent to the Recurring Activity plugin to search for the same person by hand. It
  creates the usual pending row, which the other member confirms in that plugin; the row records
  `origin_plugin = 'lighthouse'`. `LighthouseMatches` gained an optional `viewerUserId` prop (to name the
  other side); no LightHouse schema, route, or contract change.
- 2026-08-03: **LightHouse is now a GDP recognition source, and its available homes feed the projected
  figure (owner decision).** The 2026-07-04 entry below moved *recurring* rent to the Recurring Activity
  plugin; that stands, and it is precisely why LightHouse can now be recognized without holding a
  running rent total. An accepted housing arrangement is a real settled exchange, so
  `lighthouse_matches` in `accepted` or `completed`, joined to its listing, contributes **one month** of
  `monthly_rent` in `rent_currency` to the Community Value Index (`lighthouse-housing` source in
  `ctf/packages/web/lib/gdp/recognition.ts` and the mirrored query in `ctf/scripts/recognizeGdp.mjs`).
  Every month after the first belongs to Recurring Activity, where the pair declares the ongoing
  relationship, so the two sources cover different periods of the same tenancy and no month is counted
  twice. A match counts once whether it sits in `accepted` or `completed` — one arrangement, one row. A
  listing with no priced rent (`monthly_rent` 0/NULL — the host form's "0 for ServiceCredits / free")
  records no amount anywhere, so an accepted match on one counts as a single FREE exchange rather than
  an invented amount. Separately, active listings with no accepted match feed the GDP dashboard's
  projected "Value waiting to happen" figure at the same one-month unit, so a home moves out of the
  projected number and into the real index the moment a host accepts; pending match requests are not
  counted on their own (a home with three people asking is still one home). No LightHouse schema,
  route, or contract change — `monthly_rent`/`rent_currency` remain listing fields and LightHouse still
  has no settlement table. Recorded in the GDP inventory and in `dashboard.snapshot.get` `dataAccess`.
- 2026-08-03: **Blocking a member now actually works in LightHouse; the plugin's own block routes are
  gone.** LightHouse had a full block backend of its own — create, list, delete, pair-check, audited
  and CSRF-guarded — that no screen had ever called, so no member could create a LightHouse block and
  the `lighthouse_blocks` check on a stay request could never fire. Meanwhile the product-wide member
  block that members *do* use (`member_blocks`, `/api/account/blocks`, shipped on web and Android) was
  not read here at all: blocking someone left them free to ask to stay at your place, and left their
  listings sitting in your browse list. Changed: (a) the match-request transaction now checks
  `member_blocks` in both directions, `UNION ALL` with the legacy `lighthouse_blocks` rows, still
  throwing `blocked_pair` → 403; (b) `listProperties` takes the browsing member and leaves out
  listings whose host is blocked either way, wired from `GET /api/lighthouse/properties`; (c) the
  listing detail carries the shared `BlockMemberButton` (the reusable control that until now was
  exported but attached to no member surface), and blocking sends the member back to a re-read browse
  list; (d) removed the four unused routes (`GET`/`POST /api/lighthouse/blocks`,
  `DELETE …/blocks/[blockedUserId]`, `GET …/blocks/check`), the repository functions behind them
  (`createBlock`, `listBlocks`, `removeBlock`, `isBlockedPair`, `mapBlock`, `LighthouseBlockRow`), the
  `LighthouseBlock` type, and the now-unreachable `blockNotFound` / `selfBlock` error codes and their
  entries in the five route error tables; (e) dropped the `lighthouse.block.create` command from the
  command, access-policy, and audit contracts; (f) took the four routes off
  `ctf/scripts/orphan-route-allowlist.json`. `lighthouse_blocks` is kept as read-only history — no
  schema change, and account deletion still clears it.- 2026-08-02: **Deletion burn-down batch 2: matches and blocks join the deletion registry.** On
  account deletion, `lighthouse_matches` rows where the member was the seeker are deleted (their own
  stay requests) and rows where they were the host are pseudonymized (`host_user_id` →
  `deleted_member`; the record stays with the seeker, mirroring the SocketRelay fulfillment pattern
  from #2054). `lighthouse_blocks` rows are deleted on both sides: the member's own block list, and
  blocks pointing at the departing account (whose purpose ends with the account; the table's UNIQUE
  pair would also break under a shared placeholder). Caught by the deletion-coverage gate added in
  #2056. Contract updated to match.
- 2026-07-31: **Stored status value respelled to US English (owner-directed).** `lighthouse_matches.status` now stores `canceled`; the CHECK constraint was swapped to accept the US spelling and existing rows are migrated by the idempotent US-spelling data migration block at the end of `ctf/schema.sql`. Code, contracts, and docs were renamed in the same PR.
- 2026-07-20: **Notifications producer.** A new match request now emits a best-effort notification (`notifySafe`, `lighthouse.match.requested`, category `safety`) to the host of the listing — deduped on the match id, never to the requester. Emitted from `POST /api/lighthouse/matches`. No schema/contract change.
- 2026-07-20: **Account deletion now clears the member's Stream chat copy (privacy).** Lighthouse match-thread chat is sent directly into Stream Chat under the Stream user `lighthouse-<userId>`, so Stream kept an independent copy that the Postgres-only account-deletion registry never removed (Stream retains messages with no expiry by default). Registered `deleteLighthouseStreamData(userId)` (in `lib/lighthouse/stream.ts` — hard-deletes the Stream user with `mark_messages_deleted`; never throws) into the shared account-deletion external-cleanup hook (`lib/account/external-cleanup-registry.ts`), which the orchestrator runs after the DB transaction commits on every whole-account deletion path (full-account route, internal delete, Clerk webhook), best-effort (a Stream outage is logged, never blocks the deletion). No schema/route/contract change.
- 2026-07-17: **History-aware back + admin↔member navigation (app-wide sweep).** The member
  shell's hand-rolled back chevron was replaced by the shared `BackChevronButton` — it returns to
  the previous in-app page and falls back to All Apps when there is no in-app history. The admin
  surface header gained the shared "Member view" pill (`PluginUserShellButton`) linking to
  `/apps/lighthouse`. UI-only; no schema, route, or contract change.
- 2026-07-15: **Android parity — Country/State pickers on the native host form (#1380).** The mobile host form (`packages/mobile/src/features/lighthouse/LighthouseHostForm.tsx`) now replaces its two free-text Country and State/region fields with the shared `CountryPicker` / `StateFieldMobile` (`packages/mobile/src/components/LocationPickers.tsx`, over the `src/lib/geo/locations.ts` mirror) — the same searchable country list and US-state-list-vs-free-text behavior as the web `CountrySelect` / `StateField`. Country renders before State so the state control can switch to the US-state list when the country is the United States. Stored values stay plain names, so the `PropertyCreateInput` `country`/`state` contract is unchanged; no API, schema, or contract change.
- 2026-07-14: **A member can be both a host and a seeker (owner decision — reverses the same-day host/seeker exclusivity).** No schema, route, or contract change. The 2026-07-14 seeker flow shipped a rule that a host account could not also request stays ("hosting and seeking are separate accounts; ask an admin to switch your role"); the owner did not approve that for v3. Removed it end to end: `upsertProfile` no longer throws `policy_denied` on a profile-type change — for a non-admin it now **keeps** the existing `profile_type` (so saving seeker details on a host account does not relabel it) and makes `has_property` sticky (`has_property = existing OR incoming`) so it is never cleared; `createMatchRequest` now requires only an **active** profile, not `profile_type = 'seeker'`, so a host can request stays; and the "Your details" screen (web `lighthouse-seeker-profile.tsx` + mobile `LighthouseSeekerProfile.tsx`) always shows the editable form instead of the "this account hosts, so it can't also request stays" notice. Added a server-side self-match backstop (a member cannot request a stay on their own listing).
- 2026-07-14: **Android (React Native) parity for the seeker flow.** No schema, route, or contract change; existing endpoints only. Mirrors the web seeker flow shipped the same day onto `packages/mobile/src/features/lighthouse`: a "Your details" tab (`LighthouseSeekerProfile.tsx`, added to `LighthouseTabs.tsx`) sets the seeker profile, and a "Request to stay" action (`LighthouseRequestToStay.tsx`, rendered by `LighthousePropertyDetail.tsx` for non-owners) creates the match request. `LighthouseScreen.tsx` passes the signed-in `currentUserId` (so the action is hidden on the member's own listing) and switches to the "Your details" tab when the endpoint reports no seeker profile (`policy_denied`). New API client methods `fetchProfile`, `upsertSeekerProfile`, and `createMatchRequest` (`api.ts`) bind `GET/POST /api/lighthouse/profile` and `POST /api/lighthouse/matches` with `x-ctf-csrf: '1'`; a host who tries to save a seeker profile sees the same "hosting and seeking are separate" notice as web. This closes the parity follow-up noted in the web entry below.
- 2026-07-14: **Wired the member seeker flow — seeker profile screen + "Request to stay" (web + mobile-responsive).** No schema, route, or contract change; existing endpoints only. Two member-facing endpoints had no UI and were unreachable: `GET/POST/PUT/DELETE /api/lighthouse/profile` (the seeker/host preference profile) and `POST /api/lighthouse/matches` (the match request). As a result a member could browse and host but never request a stay — the match endpoint requires an active `seeker` `lighthouse_profiles` row, and nothing let a member create one. Added: (1) a "Your details" tab (`lighthouse-seeker-profile.tsx`, wired into `lighthouse-icon-rail.tsx` and the mobile tab bar; `Tab` in `shared.ts` gains `"profile"`) that GETs the profile to prefill and POSTs the seeker fields with `x-ctf-csrf: '1'` — a member who already hosts sees a "hosting and seeking are separate" notice instead of a form the type-lock would deny; (2) a "Request to stay" action replacing the inert "Apply Now"/"Message Host" placeholders on the listing detail (`lighthouse-property-detail.tsx`), posting `POST /api/lighthouse/matches` with an optional message and preferred move-in date, and routing a member with no active seeker profile to "Your details" (the endpoint returns `policy_denied` in that case). The shell refreshes the Matches tab after a successful request. (Android RN parity landed the same day — see the entry above.)
- 2026-07-14: **Added refresh controls (app-wide refresh rollout).** Web: shared `RefreshButton` in the desktop and mobile-responsive shell headers (`lighthouse-shell.tsx`); the mount fetch was extracted into a `fetchAll` callback shared by the initial load and the button, so a refresh re-pulls listings, matches, and the currency catalog without the full-screen loading skeleton. Android: native pull-to-refresh via `RefreshControl` on the listings FlatList (`LighthouseScreen.tsx`); the load was extracted into a shared callback with a background-refresh variant. UI-only; no schema, route, or contract change.
- 2026-07-06: **Country/State are dropdowns on the web host form (data cleanliness).** No schema, route, or contract change. The create/edit listing form now uses a shared `CountrySelect` and `StateField` (`components/shared/location-select.tsx`, backed by `lib/geo/locations.ts`) instead of free-text Country and State/region boxes: Country is a full country dropdown; State is the US state list when Country is the United States, otherwise a free-text region box. Stored values stay the plain names, so existing free-text rows still display (a legacy value not in the list is added as an extra option). Android parity followed (2026-07-15, #1380): the native host form uses the same selection via the shared `CountryPicker` / `StateFieldMobile` (`packages/mobile/src/components/LocationPickers.tsx`).
- 2026-07-05: **Native (Android) listing currency display parity (closes #1376).** No schema, route, or contract change. The native `LighthouseProperty` read model gained `rentCurrency` and `acceptedCurrencies` (the API already returned them); a mobile LightHouse currency helper (`currency.ts`) mirrors the web `formatRentParts`/`acceptedCurrencyLabels`. The native listing card, listing detail, and the host "Your listings" rows now render rent in its own currency (a ServiceCredits price shows "N ServiceCredits", never a "$"), and the detail lists the full accepted-currency set. The catalog comes from `GET /api/currencies` (reused mobile `fetchCurrencies`). This closes the parity item deferred on 2026-07-05.
- 2026-07-05: **Listing price/currency/type display polish (web + mobile-responsive).** No schema, route, or contract change:
  - Browse card and listing detail render the rent with the amount large and a long currency label (e.g. "ServiceCredits") small, instead of the whole string at the price font size — a ServiceCredits price no longer overflows or breaks mid-word at phone width (`formatRentParts` in `shared.ts`).
  - The listing detail now shows the full set of accepted currencies (ServiceCredits first), not just a single "Accepts ServiceCredits" badge (`acceptedCurrencyLabels`).
  - Property **type** is now a defined picker — House, Room in a house, Apartment, Camper (`LIGHTHOUSE_PROPERTY_TYPES`) — in both the web (`lighthouse-host.tsx`) and mobile (`LighthouseHostForm.tsx`) host forms, replacing the free-text field. The type is surfaced as a chip in the web and native listing detail. Legacy free-text values still display and are preserved on edit.
  - Native (Android) listing card/detail still show a `$`-prefixed price and no accepted-currency list; that display parity is tracked in #1376 (needs a mobile currency catalog).
- 2026-07-04: **Recurring rent recognition moved to the Recurring Activity plugin (issue #885).** No LightHouse schema, route, or contract change. LightHouse's `monthly_rent`/`rent_currency` stay listing-only (the asking price, never a settled amount), and LightHouse does NOT gain a settlement table. Instead, an ongoing rent relationship is captured in the new `recurring-activity` plugin as a member's self-declared, counterparty-confirmed activity tagged sector `housing` — counted toward GDP by number for fiat (no amount ever stored) and by declared value for ServiceCredits. This closes #885 without LightHouse holding any recurring fiat-payment record.
- 2026-06-27: **Code-review sweep fixes (issues #1060, #1064, #1071).** No schema or contract change:
  - The member shell's Browse tab now reads `GET /api/lighthouse/properties` (all active public listings) instead of `GET /api/lighthouse/my-properties` (the user's own listings), so a seeker with no listings of their own sees available housing. The Host tab still loads the user's own listings itself (#1071).
  - `createMatchRequest` no longer inserts the literal placeholder `'pending'` into `stream_channel_id` and then overwrites it with a second `UPDATE`. The match id is generated up front, the Stream channel is provisioned first, and the real channel id is written in a single `INSERT`, so a committed match always carries its real channel id and a transaction retry cannot leave a `'pending'` placeholder or attempt a duplicate channel creation (#1060).
  - Removed the unused `lib/lighthouse/audit.ts` (`logLighthouseAudit`), which only wrote to the application log and was never called; the durable audit path is `insertLighthouseAudit` writing to `lighthouse_admin_audit_trail` (#1064).
- 2026-06-26: **Code-review sweep fixes (issues #1012–#1019).** Security/correctness hardening across the plugin, no schema or contract change:
  - `POST /api/lighthouse/matches/:matchId/chat` now returns 403 unless the match status is `accepted`, so a pending/rejected/canceled/completed match can no longer provision a live Stream channel or token (#1012).
  - `POST /api/lighthouse/service-credits` runs the CSRF gate before the auth/DB lookup, matching every other mutation handler in the plugin (#1014).
  - `PUT /api/lighthouse/admin/matches/:matchId` rejects an unknown `status` with 400 instead of silently coercing it to `pending` (#1016).
  - `lighthouse.block.create`, `lighthouse.match.request.create`, and `lighthouse.profile.upsert` now emit a `deny` audit event on policy denials (self-block, blocked-pair, duplicate, ownership, policy), not only on the success path — aligning with the audit contract's `allow_or_deny` status. Self-block is now pre-checked before the DB round-trip (#1013, #1017, #1018).
  - Mobile `fetchLighthouseStreamCredentials` validates all four Stream credential fields before returning, failing loudly on a missing field instead of passing a null into the chat panel (#1015).
  - Mobile `LighthouseHostForm` gained `rentCurrency` (default `USD`) and `acceptedCurrencies` (with a ServiceCredits toggle) to match the web host form's `lighthouse.property.create` payload (#1019).
- 2026-06-25: **Documented the implemented blocks/audit/ServiceCredits routes and two tables** (inventory-debt burn-down). §3.5 replaced its "contract to be finalized" placeholder with the shipped blocks routes (`GET`/`POST /api/lighthouse/blocks`, `DELETE …/blocks/[blockedUserId]`, `GET …/blocks/check`); added `GET /api/lighthouse/admin/audit-events` to §3.4 and a new §3.6 for `POST /api/lighthouse/service-credits`. Added `lighthouse_user_extension` and `lighthouse_admin_audit_trail` to §4. Each verified against the route handlers and `schema.sql`. Removed these two tables and five routes from the inventory-drift allowlist. Documentation only; no code change.
- 2026-06-20: Multi-currency for property listings (issue #120). The host create/edit form
  (`lighthouse-host.tsx`) no longer assumes USD: it adds a **Rent currency** picker (shared
  `CurrencySelect`, defaults to `USD`) next to Monthly rent, and an **Accepted currencies** checklist
  (built once from `GET /api/currencies`; each option toggles a code, ServiceCredits shown by its
  label) with a hint that checking ServiceCredits means the listing accepts ServiceCredits. The
  create/update API contract gained two optional inputs — `rentCurrency` (string|null) and
  `acceptedCurrencies` (string[]) — read in `parsePropertyInput` on both `POST /api/lighthouse/properties`
  and `PUT /api/lighthouse/properties/:id`. `createProperty` writes `rent_currency` and inserts one
  validated row per accepted code into `lighthouse_property_accepted_currencies` (unknown/inactive
  codes skipped) in the same transaction; `updateProperty` sets `rent_currency` and REPLACEs the
  accepted set (delete-then-insert) in its transaction. Reads (`listProperties`, `getPropertyById`,
  `listMyProperties`, `listLighthousePropertiesAdmin`) attach `acceptedCurrencies` and a server-computed
  `acceptsServiceCredits` (true iff an accepted code joins to `currencies.is_service_credits = TRUE`),
  so `LighthouseProperty` now carries `rentCurrency`, `acceptedCurrencies`, and `acceptsServiceCredits`.
  Display: the browse card and property detail format rent in its own currency (fiat symbol, or the
  ServiceCredits label — never a "$" for ServiceCredits; 0 = "Free"; blank when unset) using a
  `code -> Currency` map the shell fetches once from `/api/currencies`; the "Accepts ServiceCredits"
  badge and the Credits filter now read `acceptsServiceCredits` (legacy `credits` field kept as a
  fallback). The admin hide/unhide resend preserves both currency fields. `lighthouse.property.create`
  command contract `inputSchema` and `dataAccess` updated to include the currency fields and the
  `lighthouse_property_accepted_currencies` table. No schema change (the columns/table already shipped).
- 2026-06-18: Member self-service hosting (owner decision). The member surface had no way to create a listing and `createProperty` hard-denied (`policy_denied`) without a pre-existing admin-granted host profile — and there was no UI to become a host — so no one could list (0 hosts, 0 properties). Added a "List your place" tab to the member shell (`lighthouse-host.tsx`, wired into `lighthouse-icon-rail.tsx` + the mobile tab bar; `LighthouseShell` now receives `userId`/`username` from the plugin page) with a create-listing form posting to `POST /api/lighthouse/properties`. Removed the host-profile gate in `createProperty`; it now transparently provisions the member's host `lighthouse_profiles` row (`ON CONFLICT (user_id)`, never overwriting a seeker), so there is no separate host-profile form. Host identity is composed from existing data: username (auth gate), Quora link (new `getHostQuoraUrl`, read from `unlock_verification_submissions`, returned on `GET /api/lighthouse/my-properties` as `host.quoraProfileUrl`), and the shared `TrustWidgetCard` (`GET /api/trust/user/self`). Added the `lighthouse.property.create` command + access-policy contracts (roles: member, admin; `selfServiceHosting: enabled`, `hostProfileAutoProvisioned: true`). Web + mobile-responsive; Android RN host tab is a tracked follow-up. Schema unchanged (existing tables).
- 2026-06-18: Removed per-plugin announcements from LightHouse. The admin Announcements tab and its component (`lighthouse-admin-announcements.tsx`), the user/admin announcement routes (`/api/lighthouse/announcements`, `/api/lighthouse/admin/announcements` and its `:id` route), the repository announcement functions, and the `LighthouseAnnouncementInput` type were deleted. Announcements are now posted in one place — the Feed (`feed-announcements` plugin), which can target any plugin (including LightHouse) — so the Feed is the single place to post announcements about LightHouse. No schema change: LightHouse only ever read the shared `announcements` table by targeting (it has no `lighthouse_announcements` table in v3). Sections 1.6, 2.4, 3.5, and the data-model announcement entry were removed above to match.
- 2026-06-13: Web admin slice 3 — match moderation + announcements. Added a Cancel-match action on pending/accepted matches (`PUT /api/lighthouse/admin/matches/:id` with `status: 'canceled'`, `x-ctf-csrf: '1'`) and a new Announcements tab (`components/lighthouse/lighthouse-admin-announcements.tsx`) that creates (`POST /api/lighthouse/admin/announcements`) and deletes (`DELETE /api/lighthouse/admin/announcements/:id`) admin announcements. Announcements split into their own component to keep the shell within the rule-116 size budget. No new endpoint, schema, or contract.
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

> **Reconciliation (2026-05-26):** the Delivery Status above was `web+android complete` (feature parity) at the time; the Android surface was removed 2026-07-20 (rule 105, PR #1742) and this feature is now **web-only**.
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
- [x] Lock blocks policy contract for v1. **Done 2026-08-03 — the answer is that LightHouse has no
      block contract of its own.** Create/list/delete belong to the product-wide member block
      (§1.6 of `ctf-non-plugin-feature-inventory.md`); what LightHouse owns is honoring it, written
      out in §1.6 above: listings hidden from a blocked host, and `blocked_pair` (403) on a stay
      request between a blocked pair.
- [ ] Lock web+android parity obligations for critical LightHouse flows.
  - Acceptance criteria:
    - Critical user/admin/safety flows are served on web (desktop + mobile-responsive); the native Android surface was removed 2026-07-20 (rule 105, PR #1742), so this feature is now web-only.

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
- [x] Implement blocks policy enforcement. **Done 2026-08-03.** The match-request transaction reads
      `member_blocks` in both directions (plus the legacy `lighthouse_blocks` rows) and throws
      `blocked_pair` → 403; browse leaves out listings from a blocked host. Deterministic: both are
      plain SQL checks on the read/write path, not a client-side filter.

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
- [x] Implement blocks UX parity. **Done 2026-08-03.** The listing detail carries the shared "Block
      member" action; the list of who you have blocked, and unblocking, live in one place for the
      whole product at `/account/blocks` rather than being rebuilt per plugin.

### �� Android Delivery Parity

- [ ] Implement Android parity for core user flows.
  - Acceptance criteria:
    - Profile/property/match/announcement outcomes are equivalent to web behavior.
- [ ] Implement Android parity for required admin flows.
  - Acceptance criteria:
    - In-scope admin moderation outcomes are equivalent to web policy outcomes.
- [x] Implement Android parity for blocks behavior. **Not applicable since 2026-07-20.** LightHouse
      has no native Android surface (rule 105, PR #1742), so there is nothing to mirror. Android does
      ship the product-wide block (`packages/mobile/src/features/blocks/`), which is the same block
      this plugin enforces.

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

- 2026-06-27: Audit fix (#1066) — `insertLighthouseAudit` now writes the full audit-contract envelope into the `lighthouse_admin_audit_trail.metadata` jsonb column: `eventId`, `commandVersion`, `policyDecision` (status + reason + structured `evidence`), `targetContext.workspaceId`, top-level `requestId` and `traceId`, and a `result` block, with the caller's own metadata nested under `metadata`. Previously the stored record carried only the flat columns and so did not match `LIGHTHOUSE_PLUGIN_AUDIT_CONTRACTS.yaml`. The new envelope fields are optional at the call site and default to `unknown` / `none` / `{}` (mirrors the directory audit pattern, #1143), so the serialized payload always matches the contract shape with no caller churn. `listLighthouseAuditEvents` reads the envelope back and detects the older flat shape for backward compatibility. No schema migration, no new route, no contract change (the contract already declared these fields — this brings the code into line with it).
- 2026-06-19: Web fix — a member viewing their own listing in the property detail no longer sees "Apply Now"/"Message Host"; instead they see a "This is your listing." note and an "Edit listing" button. The host tab's "List your place" form now also edits an existing listing: it prefills from `GET /api/lighthouse/properties/:id` (full record, since the update is a full-column replace), saves via `PUT /api/lighthouse/properties/:id` (with `x-ctf-csrf`), and each row in "Your listings" gains an Edit button. Detail ownership is decided client-side by comparing the listing's `hostUserId` to the signed-in user (added `hostUserId` to the client `Property` type). No schema, route, or contract change.
- 2026-06-19: Android parity for the member self-service "List your place" host tab (web shipped earlier, #598). Added a `host` tab to the RN `LighthouseTabs` and built `LighthouseHost.tsx` + `LighthouseHostForm.tsx`, binding `GET /api/lighthouse/my-properties` (the host's own listings + composed Quora link) and `POST /api/lighthouse/properties` (with the `x-ctf-csrf` header). Mirrors the web host surface, including the composed host identity (username + Quora link — no separate host profile to fill). Two web-header items were not ported: the Trust widget (no mobile Trust primitive exists yet) and `photos`/`isActive` (the web host form does not collect them either). Real-data-only; no schema, route, or contract change. Mobile typecheck passes.
- 2026-02-25: Created initial LightHouse CTF rewrite checklist aligned to parity inventory scope, with v1 blocks inclusion, web+android parity gates, schema/deletion decision locks, and security/policy validation requirements.
