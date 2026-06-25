# Foundation Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Rewrite target: `ctf/`
- Plugin slug: `foundation`
- Foundation delivers trauma-informed survivor-provider 1:1 connection workflows (text, voice, video) with policy-controlled access, audit trails, and GetStream-backed scalability.
- Legacy `platform/` is reference-only; not modified.

## Intent and Outcome

Foundation provides trauma-informed survivors with deterministic access to vetted providers for 1:1 text/voice/video connection, quote requests, and continuity history. Connections are policy-controlled, auditable, and scoped to Stream Maker-tier quotas with quota-aware degradation.

## Target User Features

1. Provider discovery and search by service type, location, language, and trauma-informed criteria.
2. Survivor-provider 1:1 text messaging with delivery/read/seen semantics and file attachment support.
3. Voice and video session initiation and join for approved 1:1 participants.
4. Quote request lifecycle (requested → provider_responded → closed) with immutable timeline view. The 1:1 text/voice/video channel is scoped to an active connection/quote between exactly the two parties and opens with it; when the connection/quote reaches a terminal state (closed, declined, or ended) the chat closes — no new messages may be sent, both parties keep read-only access for a limited window, and message/session records are retained server-side for moderation/abuse evidence per the deletion contract. No 1:1 messaging exists outside an active connection/quote (platform rule 100, "Messaging Scope and Lifecycle").
5. Connection and quote history lists scoped by actor ownership.
6. In-app notifications for messages, quote state changes, and missed calls.
7. Notification preferences and quiet-hour controls.

## Target Admin Features

1. Capacity policy control under Stream Maker-tier limits with threshold handling (green/yellow/orange/red).
2. Degrade controls for non-critical behavior under quota pressure.
3. Operational review of denied command decisions and reason-code trends.
4. Policy diagnostics for consent, region, and role-driven denials.
5. Rate-limit tuning by command family.
6. Quota threshold transition alerts and recovery controls.

## API Surface and Route Map

User routes:

- `GET /api/foundation/providers/search` — each item also carries the provider's read-only instant-call availability (`instantCallEnabled`, `instantCallRateCredits`, `instantCallIntervalMinutes`, mirrored from `foundation_user_extension`); the response also returns `viewerUserId` so the client can hide "Connect now" on the viewer's own card (issue #808). The call lifecycle and billing are later tasks of #808.
- `GET`/`PUT /api/foundation/provider/instant-call` — the signed-in provider's own instant-call settings (opt-in toggle, rate in ServiceCredits, per-block interval). Settings only; no call or billing (issue #808).
- `POST /api/foundation/connections/threads`
- `GET /api/foundation/connections/threads/:threadId/token` — re-mint fresh Stream credentials for a participant re-opening an existing thread's Direct Line (creates no new channel; returns 404 to non-participants).
- `POST /api/foundation/connections/threads/:threadId/messages`
- `POST /api/foundation/connections/threads/:threadId/calls`
- `POST /api/foundation/quotes`
- `POST /api/foundation/quotes/:quoteRequestId/state`
- `GET /api/foundation/quotes/history`
- `GET /api/foundation/connections/history`
- `PUT /api/foundation/notifications/preferences`
- `POST /api/foundation/notifications/:notificationEventId/ack`

Admin routes:

- `POST /api/foundation/admin/rate-limits/evaluate`
- `PUT /api/foundation/admin/capacity-policy`
- `GET /api/foundation/admin/audit-events`

## Data Model and Storage Contracts

Foundation-owned domain entities (canonical in `ctf/schema.sql`):

1. `foundation_user_extension` — per-user Foundation state keyed by `user_id`: `profile_visibility`, `notification_preferences` (JSONB), `accessibility_runtime_prefs` (JSONB), `trauma_informed_defaults` (JSONB), `service_deleted_at`. Notification opt-in/opt-out is stored here as JSONB — there is no separate `foundation_notification_preferences` table. Instant 1:1 call settings (issue #808) also live here: `instant_call_enabled` (`BOOLEAN NOT NULL DEFAULT FALSE`), `instant_call_rate_credits` (`INTEGER`, nullable — whole ServiceCredits per block, only meaningful when enabled, >= 1 enforced in the app), and `instant_call_interval_minutes` (`INTEGER NOT NULL DEFAULT 10`, per-block length in minutes, app-validated to 5–60). Settings only — ringing/call/billing are later tasks. `GET /api/foundation/providers/search` now LEFT JOINs these three columns so the viewer-facing provider list mirrors each provider's instant-call availability read-only (issue #808, "Connect now" button).
2. `foundation_connection_threads` — 1:1 survivor-provider threads; one per pair via the unique `thread_key` (sorted `survivor:provider`), set by the repository and the seed.
3. `foundation_thread_participants` — Thread participant roster.
4. `foundation_message_metadata` — Message history with delivery/read state.
5. `foundation_call_sessions` — Voice/video call session records.
6. `foundation_quote_requests` — Quote request lifecycle records.
7. `foundation_quote_status_events` — Quote state transition log.
8. `foundation_notification_events` — Notification delivery history.
9. `foundation_rate_limit_counters` — Per-command rate limiting state.
10. `foundation_capacity_policies` — Admin-configured capacity limits and thresholds.
11. `foundation_admin_audit_trail` — Admin action audit log.
12. `foundation_provider_accepted_currencies` — join (`user_id`, `currency_code` FK → `currencies.code`) for the currencies a provider accepts.
13. `foundation_provider_skills` — join (`user_id`, `skill_id` → `skills_taxonomy_skills.id`) of the skills a provider has opted in to be contacted about. This is the "willing to offer SAID skill" signal that distinguishes Foundation from the Directory: provider search only surfaces members with at least one row here, and `skill_id` is constrained (in the repository) to skills the member lists on their own claimed Directory profile.

Multi-currency (issue #120): a provider can list a service rate on their profile — `foundation_user_extension`
gains `rate_amount` + `rate_currency` (FK → `currencies.code`). The quote process stays free-text/manual this
version (no structured quote amount, so no price fields on `foundation_quote_requests`). "Accepts ServiceCredits"
is true only when a `foundation_provider_accepted_currencies` row with `currency_code='SC'` exists — never
derived from `rate_currency`. No ServiceCredits amount is shown at a fiat equivalent.

Quota threshold level (green/yellow/orange/red) is derived at evaluation time from the capacity policy and rate-limit counters; it is not a stored table (there is no `foundation_quota_threshold_states`).

Cross-plugin read dependencies (read-only):

- `directory_profiles` — Provider discovery eligibility checks (Foundation MUST NOT write to Directory).

## Security, Privacy, and Compliance Controls

1. Server-side policy enforcement for roles, consent, region restrictions, and deny conditions.
2. Deny-by-default for cross-tenant and unauthorized cross-region access.
3. Audit logging for all commands with allow/deny outcomes and decision evidence.
4. Data minimization for history and notification payloads.
5. Redaction/tokenization for sensitive communication metadata in logs.
6. Plugin-scoped deletion and full-account deletion handling distinct per Rule 114.
7. Stream integration via shared wrappers in `packages/shared` (no direct Stream API calls).
8. Rate limiting and command-level throttling for high-frequency actions.
9. Quota-aware degradation: preserve core send/receive/active thread reliability under red quota threshold.

## Web and Android Delivery Status

- **Web:** delivered. `FoundationShell` (`ctf/packages/web/components/foundation/`) renders the survivor-facing experience against the live Foundation API — provider search/browse (`displayName`, `headline`, `bio`), provider profile, real two-step quote request (open connection thread → create quote on it), the **Direct Line** chat (Stream-backed 1:1 messaging on the connection thread), and quote history with lifecycle status. After a successful Request Quote the member lands directly in the Direct Line (using the Stream credentials the thread POST returned), and each Quotes row re-opens its Direct Line by fetching fresh credentials from `GET /api/foundation/connections/threads/:threadId/token`. Decomposed under Rule 116 into `foundation-ui`, `foundation-rails`, `foundation-panels`, `foundation-profile`, `foundation-direct-line`, and the orchestrating `foundation-shell`. Aligned to the canonical `survivor-hub/Foundation` design mockup; mockup-only fields with no backing API (star rating, job counts, hourly price, availability, inflated platform stats) are intentionally omitted rather than mocked, per the real-data-only rule.
- **Android:** delivered (pixel pass, 2026-05-31). The mobile feature binds the real Foundation API — see below.

Android pixel pass delivered 2026-05-31. Mobile feature (`ctf/packages/mobile/src/features/foundation/`) rewritten to match the `MobileFoundation*.tsx` mockup. Real backend bindings mirror the merged web shell (PR #182):

- `GET /api/foundation/providers/search` — provider list with `profileId`, `providerUserId`, `displayName`, `headline`, `bio`, and `offeredSkills` (`[{ id, name }]`). Only providers who have opted in to offer at least one skill (`foundation_provider_skills`) are returned. Optional `skillId` query param restricts to providers offering that exact skill.
- `GET /api/foundation/provider/skills` — the signed-in member's own Directory skills, each flagged `offered` (whether they have opted in to be contacted about it).
- `PUT /api/foundation/provider/skills { skillIds }` (`x-ctf-csrf: 1`) — replace the member's offered-skills set; only skills on their own claimed Directory profile are accepted. Returns the accepted `offeredSkillIds`.
- `GET /api/foundation/provider/instant-call` — the signed-in member's own instant 1:1 call settings: `{ enabled, rateCredits, intervalMinutes }`. A member with no row yet reads the off default (`enabled: false`, `rateCredits: null`, `intervalMinutes: 10`).
- `PUT /api/foundation/provider/instant-call { enabled, rateCredits, intervalMinutes }` (`x-ctf-csrf: 1`) — save the member's instant-call settings. When `enabled`, `rateCredits` must be a whole number >= 1 and `intervalMinutes` a whole number in 5–60; bad input returns a 400 with `FOUNDATION_INVALID_PAYLOAD`. Returns the saved `{ enabled, rateCredits, intervalMinutes }`.
- `GET /api/foundation/quotes/history` — quote history items with `id`, `providerId`, `providerName`, `status`, `createdAt`.
- Quote creation flow: `POST /api/foundation/connections/threads { providerId }` → `POST /api/foundation/quotes { threadId, serviceType }`, both with `x-ctf-csrf: 1` header.

Omitted (no backing field): trade filter chips, star ratings, price/rate, job count, availability dot, credits badge, platform stats. These are mockup fixtures only; no real API field exists for them.

`MockFoundation.tsx` has been removed (it was an unused placeholder; the real screens are `Foundation` / `FoundationLoading` / `FoundationEmpty` / `FoundationPublic`).

## Seed Coverage Status

Deterministic Foundation seed script: `ctf/scripts/seedFoundation.mjs`.

Seeded content (deterministic):
- A provider Directory profile (fixed UUID).
- One survivor-provider connection thread (keyed by `thread_key`).
- One notification event.

## Gaps and Known Technical Debt

1. Final quote payload schema by service category requires explicit product + compliance documentation (currently implementation-driven).
2. Voice/video fallback interaction copy finalization pending survivor-advisory review.
3. Notification channel rollout order and region targeting remain operational decisions.
4. Capacity policy defaults based on monthly demand assumptions need ongoing validation.

## Change Log

- 2026-06-24: **Foundation "Connect now" button + consent preview (issue #808, task 2 — entry point only).** Surfaces a provider's instant-call availability to viewers and adds the consent/cost-preview step, building on the merged settings layer (task 1). Read-only addition: `GET /api/foundation/providers/search` now LEFT JOINs `foundation_user_extension` and includes `instantCallEnabled`, `instantCallRateCredits`, and `instantCallIntervalMinutes` per provider, plus a top-level `viewerUserId` so the client can hide the button on the viewer's own card — no new table, no write path, no money movement, same Unlock read gate as the existing search. New `ProviderView`/`FoundationProviderSearchItem` fields mirror those three. New web component `components/foundation/foundation-connect-now.tsx`: a "Connect now" button (rendered on Browse cards and the provider detail only when the provider has it enabled with a valid whole-credit rate and the viewer is not that provider) that shows the rate as "X ServiceCredits / N min", and a consent dialog previewing the per-block rate, a plain-language disclaimer (this starts a live paid 1:1 call; you're charged per block; you can end it anytime) and a consent checkbox. Because the call lifecycle (task 3) and per-block billing (task 4) do not exist yet, the dialog's final "Start call" action is rendered **disabled** with an honest inline note that live calling arrives in the next update — it never calls an endpoint, never stubs a call, and never throws. Works at phone width. Updated the `foundation.search.providers` command contract output schema + dataAccess (`foundation_user_extension`). Android (React Native) parity deferred — see the Parity Ticket on the PR. The call lifecycle and billing remain later tasks of #808.
- 2026-06-24: **Direct Line chat surface (web).** Request Quote already created a connection thread plus a Stream chat channel, but there was no UI to open and chat in it — the only component that rendered it (`components/foundation/Foundation.tsx`) was orphaned (nothing imported it). Wired up the real Direct Line: after a successful Request Quote the member lands straight in the Direct Line (using the Stream credentials the thread POST returned, `StreamChatPanel` tinted with the Foundation accent, a "Direct Line" heading and a Back control) instead of silently bouncing to Quotes; and each Quotes row now has a **Direct Line** control that re-opens that thread's chat. New backend route `GET /api/foundation/connections/threads/:threadId/token` (`requireFoundationReadAccess` + participant check via `foundation_thread_participants`) re-mints fresh Stream credentials for an existing thread, returning 404 to non-participants and 503 on persistence/Stream failure; new repository helper `getThreadCredentialsForParticipant`. New UI component `components/foundation/foundation-direct-line.tsx` (post-quote + re-open-from-quotes flows, with loading/error/not-a-participant states). Removed the orphaned `Foundation.tsx`. Command/access contracts add `foundation.connection.thread.token.create`. No schema change — the channel already exists from the quote handoff; this only surfaces it. Stream quota-impact note: `ctf/docs/quota-impact/2026-06-24-foundation-direct-line.md`.
- 2026-06-24: Provider instant 1:1 call settings (issue #808, task 1 — settings layer only). A Foundation provider can opt in to take an immediate, paid, time-metered 1:1 call. This task adds only the provider's settings: an on/off toggle, the rate in whole ServiceCredits, and the per-block interval in minutes. Added three columns to `foundation_user_extension` — `instant_call_enabled` (`BOOLEAN NOT NULL DEFAULT FALSE`), `instant_call_rate_credits` (`INTEGER`, nullable), `instant_call_interval_minutes` (`INTEGER NOT NULL DEFAULT 10`). New member-owned routes `GET`/`PUT /api/foundation/provider/instant-call` read and save the settings; on write, the rate must be a whole number >= 1 when enabled and the interval a whole number in 5–60 (otherwise a 400 `FOUNDATION_INVALID_PAYLOAD`). Repository functions `getOwnInstantCallSettings` / `setOwnInstantCallSettings` (upsert into `foundation_user_extension`, matching `upsertNotificationPreferences`). New web UI section "Instant connection" in `components/foundation/foundation-instant-call-settings.tsx` (rendered above the offer-skills list) with the toggle, rate/interval inputs, a plain disclaimer, and an explicit Save. Added the two command and access-policy contracts (`foundation.provider.instant-call.get` / `.set`). No call, ring, or billing logic in this task — those are later tasks. Android (React Native) parity deferred. Schema + API + repository + web UI + contracts.
- 2026-06-23: **Android parity — provider offered-skills (#566).** The React Native Foundation feature now mirrors the web offer-skills opt-in. New best-effort clients in `packages/mobile/src/features/foundation/api.ts`: `fetchOfferableSkills()` / `setOfferedSkills(skillIds)` over `GET`/`PUT /api/foundation/provider/skills`, and `fetchProviders` gained a `skillId` filter param; the `Provider` type gained `offeredSkills` (`[{ id, name }]`). A new **Offer skills** tab (`Foundation.tsx`) lists the member's own Directory skills as toggle chips and saves the chosen set. Provider cards (`FoundationProviderCard.tsx`) render offered-skill chips that tap to filter the browse list by that skill (with a clear-filter banner), and the provider detail (`FoundationProviderDetail.tsx`) lists "Willing to be contacted about". RN UI only — all endpoints already existed; no schema, route, or contract change.
- 2026-06-17: Removed the Foundation kill switch (owner decision — unapproved agentic addition). Dropped `foundation_capacity_policies.kill_switch_enabled` (`schema.sql` + `schema.demo.sql` add a guarded `DROP COLUMN IF EXISTS`), the `killSwitchEnabled` field on `FoundationCapacityPolicy` and the capacity-policy update input/route validation, the `assertConnectionThreadCapacity` early-deny that blocked new connection threads when enabled, and the toggle in the Foundation admin shell. Part of a product-wide kill-switch removal (also feed and Workforce). Rate-limit and quota-state controls are unchanged.
- 2026-06-16: Provider offered-skills opt-in (web UI). Built on the backend below, with the owner's `bypass design` (built functionally from the design guide using the Foundation accent + plugin-shell tokens). A new **Offer skills** tab (`components/foundation/foundation-offer-skills.tsx`, in the IconRail + mobile tab bar) lets a member toggle which of their own Directory skills they'll be contacted about (`GET`/`PUT /api/foundation/provider/skills`, optimistic save). The **Browse** panel shows each provider's offered-skill chips; tapping a chip filters search by that `skillId` with a clear-filter banner, and the provider detail view lists "Willing to be contacted about". Android (React Native) parity deferred — see the Parity Ticket on the PR.
- 2026-06-16: Provider offered-skills opt-in (backend). Foundation now expresses "I'm skilled **and** willing to be contacted to offer it," which the Directory does not. Added `foundation_provider_skills` (`user_id`, `skill_id`); provider search (`GET /api/foundation/providers/search`) now returns only members with at least one offered skill, supports an optional `skillId` filter, and includes each provider's `offeredSkills`. New member-owned routes `GET`/`PUT /api/foundation/provider/skills` list and replace the offered set (only skills on the member's own claimed Directory profile are accepted). Added the table to the deletion registry (hard delete by `user_id`). Schema + API + repository.
- 2026-06-13: Web admin design pass. Replaced the bare diagnostic `/admin/foundation` page with `components/foundation/foundation-admin-shell.tsx`, styled to the admin design system (header with icon + ADMIN badge, snapshot stat blocks, capacity-policy panel). Bound to the real backend — `getFoundationDashboard` counts and the editable `getCapacityPolicy`. The policy panel edits quota state, the kill switch, and the five rate-limit numbers, saving via the existing `PUT /api/foundation/admin/capacity-policy` (with `x-ctf-csrf: '1'`). The mobile mockup (`MobileFoundationAdmin.tsx`) depicts a "gig moderation" queue that does not match Foundation's real admin surface (capacity/rate-limit governance), so per the admin build rule the real data/controls were styled instead — no fabricated gig queue. No new endpoint, schema, or contract.
- 2026-06-12: The Android Foundation API client (`packages/mobile/src/features/foundation/api.ts`) now uses the shared authenticated fetch helper, which attaches the signed-in user's Clerk bearer token and reads the server address from runtime config (`APP_URL`), replacing plain fetch calls against hardcoded development URLs. No schema, route, or contract change.
- 2026-06-10: Brought `seedFoundation.mjs` back in line with the current `directory_profiles` shape. The provider profile insert still wrote the retired `display_name` column and the dropped `is_public` column (removed by `post/0001` on 2026-06-02), so a fresh seed against the migrated schema would fail. The insert now writes `first_name`/`last_name` ('Seed'/'Provider') and no longer references `is_public`, with the `ON CONFLICT` update list matched. No schema or behaviour change — seed data only.
- 2026-06-01: Multi-currency (issue #120): added `rate_amount` + `rate_currency` (FK → `currencies.code`) to `foundation_user_extension` (provider rate on the profile) and a `foundation_provider_accepted_currencies` join. The quote process stays free-text/manual (no price fields on quotes). Documented the no-fiat-parity rule. Schema + inventory only; the currency UI is design-gated.
- 2026-06-01: Fixed the demo seed (`ctf/scripts/seedDemo.mjs`) so it can be re-run for a different demo participant. The Foundation connection thread row uses a fixed demo id but a `thread_key` derived from the owner; the insert previously only handled a `thread_key` conflict, so re-seeding with a new owner hit an unhandled primary-key collision and aborted the whole seed. The insert now upserts on the primary key and refreshes `thread_key`. No schema change — same table, same columns.
- 2026-05-31: Web pixel pass. Rebuilt `FoundationShell` to match the canonical `survivor-hub/Foundation` design mockup and bind to real API contracts only. Fixed three pre-existing data bugs: provider search now reads `{ items }` (was treating the response as a raw array), quote history now calls `GET /api/foundation/quotes/history` (was calling the GET-less `/api/foundation/quotes`), and "Request Quote" now performs the real two-step flow (POST `/connections/threads` then POST `/quotes` with `x-ctf-csrf: 1`) instead of posting an unsupported `{ providerId, description }` body. Decomposed the shell into five Rule-116-compliant files. Dropped mockup fields with no backing API (rating, jobs, price, availability, hard-coded platform stats). Web px flipped to ✅ in the readiness table.
- 2026-05-31: Android pixel pass complete. Mobile feature rewritten to `MobileFoundation*.tsx` mockup spec. Real API bindings for provider search, quote history, and two-step quote creation (thread + quote POST, both with CSRF header). `MockFoundation.tsx` retired. Omitted mockup-only fields (rating, price, availability, credits, job count, platform stats) — no backing API field. Gates passed: tsc (pre-existing expo/tsconfig.base constraint noted), EOF clean, parity check green.
- 2026-05-17: Updated inventory to enforce Rule 120 living-snapshot model. Removed Phase language (Delivery Phasing sections), Planned section headers, and planning ambiguities. Confirmed web+android complete delivery status. Clarified technical debt (quote schema, fallback copy, notification strategy, capacity assumptions) as known limitations, not unimplemented features.
- 2026-02-24: Created initial Foundation CTF rewrite inventory with full-v1 scope for search, 1:1 text/voice/video, quote lifecycle, history, notifications, rate limiting, and scalability.


## Build Checklist


### Scope and Boundary

- [ ] Confirm implementation scope is `ctf/` only.
  - Acceptance criteria:
    - No implementation changes are required in `platform/`.
- [ ] Confirm plugin ID and command namespace.
  - Acceptance criteria:
    - All contracts/routes use stable slug `foundation`.
- [ ] Confirm Directory boundary contract.
  - Acceptance criteria:
    - Foundation reads Directory data through read-only projections only.
    - No Foundation command can mutate Directory behavior/data.

### �� Contract and Policy Lock

- [ ] Lock Foundation command contracts for full-v1.
  - Acceptance criteria:
    - Every command includes `pluginId`, `command`, `version`, `purpose`, `retentionClass`, and `idempotency`.
- [ ] Lock Foundation access policy contracts.
  - Acceptance criteria:
    - Every command policy includes `consentRequirements`, `regionRestrictions`, `highRiskFlags`, and `denyConditions`.
- [ ] Lock Foundation audit contracts.
  - Acceptance criteria:
    - Every command has audit shape covering allow/deny decisions and policy evidence checks.
- [ ] Confirm Stream Maker-tier governance alignment.
  - Acceptance criteria:
    - Contracts and inventory align with `.claude/rules/110-stream-maker-tier-rules.mdc` threshold model and fallback rules.

### �� Schema, Migrations, and Retention

- [ ] Define Foundation extension/domain schema and migrations under `ctf/migrations/`.
  - Acceptance criteria:
    - Schema includes thread/message/call/quote/notification/rate-limit/audit entities.
- [ ] Define quote lifecycle state model (`requested`, `provider_responded`, `closed`).
  - Acceptance criteria:
    - Invalid transitions are blocked and auditable.
- [ ] Define retention classes for communication, transactional, and audit entities.
  - Acceptance criteria:
    - Retention tags are documented and mapped in contracts and schema notes.
- [ ] Prepare rollback and replay notes.
  - Acceptance criteria:
    - Migration replay and rollback steps are captured for PR evidence.

### �� Core Service and Command Execution

- [ ] Implement provider search service using Directory read-only projections.
  - Acceptance criteria:
    - Search/filter/ranking does not write to Directory domain.
- [ ] Implement 1:1 text thread create/send flows.
  - Acceptance criteria:
    - Thread membership is strictly survivor-provider pair only.
- [ ] Implement 1:1 voice/video session creation and policy checks.
  - Acceptance criteria:
    - Participant cap, duration cap, and region pinning checks are enforced.
- [ ] Implement quote create and state-transition commands.
  - Acceptance criteria:
    - Lifecycle transitions are deterministic and fully auditable.
- [ ] Implement history and notification command family.
  - Acceptance criteria:
    - Actor ownership checks prevent cross-user history access.

### �� Rate Limiting, Quotas, and Scalability

- [ ] Implement command-level rate limiting for high-frequency actions.
  - Acceptance criteria:
    - Messaging/search/notification and quote updates enforce bounded request rates.
- [ ] Implement Stream usage meters and threshold states.
  - Acceptance criteria:
    - Green/yellow/orange/red transitions are observable and trigger expected degrade behavior.
- [ ] Implement graceful degradation strategy.
  - Acceptance criteria:
    - At orange/red states, non-critical behaviors degrade while core 1:1 messaging reliability is preserved.
- [ ] Add quota impact documentation for Stream-consuming surfaces.
  - Acceptance criteria:
    - PR includes required note under `ctf/docs/quota-impact/` with fallback and observability sections.

### �� Web Full-v1 Delivery

- [ ] Deliver web provider search and profile preview flows.
  - Acceptance criteria:
    - Survivors can discover and select providers with accessibility-aware filters.
- [ ] Deliver web 1:1 messaging and voice/video flows.
  - Acceptance criteria:
    - Survivors/providers can complete text, voice, and video interactions end-to-end.
- [ ] Deliver web quote lifecycle flows.
  - Acceptance criteria:
    - Users can create, update, and review quote requests across 3-state lifecycle.
- [ ] Deliver web history and notification settings.
  - Acceptance criteria:
    - Users can review interaction history and control notification channels/quiet hours.

### �� Android Parity Follow-up Tracking

- [ ] Create parity tracking table for all web-delivered Foundation capabilities.
  - Acceptance criteria:
    - Each capability includes owner, target sprint/date, risk, and parity validation status.
- [ ] Implement Android parity for provider search and selection.
  - Acceptance criteria:
    - Android outcomes match web command semantics and policy decisions.
- [ ] Implement Android parity for 1:1 text/voice/video.
  - Acceptance criteria:
    - Android interactions match web command outcomes and audit events.
- [ ] Implement Android parity for quote lifecycle, history, and notifications.
  - Acceptance criteria:
    - Android supports requested/provider_responded/closed lifecycle and equivalent history/notification behavior.
- [ ] Close parity deferments.
  - Acceptance criteria:
    - Any deferred item includes approved risk note and final completion date.

### �� Trauma-Informed and Accessibility Validation

- [ ] Validate trauma-informed UX constraints.
  - Acceptance criteria:
    - Language and interaction pacing avoid coercive urgency or harm-amplifying patterns.
- [ ] Validate accessibility constraints on web and Android.
  - Acceptance criteria:
    - Screen-reader, keyboard navigation, contrast, and caption/call accessibility criteria pass.
- [ ] Validate safety and reporting affordances.
  - Acceptance criteria:
    - Critical safety pathways are discoverable, clear, and policy-compliant.

### �� Security, Compliance, and Deletion

- [ ] Verify authz, consent, region, and deny-condition enforcement.
  - Acceptance criteria:
    - Enforcement exists server-side for all command families.
- [ ] Verify audit integrity (allow + deny).
  - Acceptance criteria:
    - Audit records are append-only, redacted/tokenized, and correlation IDs are present.
- [ ] Verify Foundation profile/deletion contract behavior.
  - Acceptance criteria:
    - Plugin-scoped deletion preserves canonical profile and Directory data.
    - Full-account flow removes Foundation user-scoped data per orchestrator policy.

### Validation, Seeds, and Release Gates [MVP: VALIDATION DEFERRED — see Rule 118.]

- [ ] Command schema design documentation.
  - Acceptance criteria:
    - Unknown fields, type errors, bounds violations, and invalid enum values handling is documented.
- [ ] Access policy enforcement design documentation.
  - Acceptance criteria:
    - Missing consent, wrong role, region restrictions, cross-tenant access, and deny conditions are documented.
- [ ] Audit contract design documentation.
  - Acceptance criteria:
    - Allow and deny outcomes expected evidence fields and request/trace correlations are documented.
- [ ] Quote lifecycle and history design documentation.
  - Acceptance criteria:
    - Requested/provider_responded/closed transitions and read permissions behavior is documented.
- [ ] Stream degradation behavior documentation.
  - Acceptance criteria:
    - Yellow/orange/red threshold behavior aligns with Maker-tier rules.
- [ ] Web + Android parity design scope. [MANUAL PARITY COVERAGE DEFERRED FOR MVP — see Rule 118.]
  - Acceptance criteria:
    - Parity-required flows are documented for post-MVP testing.

### Documentation and Inventory Lifecycle

- [ ] Keep `ctf-foundation-feature-inventory.md` updated with each accepted feature change.
  - Acceptance criteria:
    - Add/remove/behavior changes are reflected in same PR as implementation.
- [ ] Keep Foundation contracts updated with version and compatibility notes.
  - Acceptance criteria:
    - Command/policy/audit changes include migration impact notes when relevant.
- [ ] Implementation tracking. [EVIDENCE CAPTURE DEFERRED FOR MVP — see Rule 118.]
  - Acceptance criteria:
    - Implementation status is tracked; evidence collection deferred to post-MVP.

### Change Log

- 2026-02-24: Created initial Foundation rewrite checklist with full-v1 gates for search, 1:1 text/voice/video, quote lifecycle, history, notifications, rate limiting/scalability, trauma-informed accessibility, and web-first to Android parity follow-up tracking.
- 2026-05-31: Documented the transaction-scoped messaging lifecycle per platform rule 100 ("Messaging Scope and Lifecycle"): the 1:1 text/voice/video channel is bound to an active connection/quote and closes on terminal state (read-only window + records retained for moderation/abuse evidence); no 1:1 messaging outside an active connection/quote. Aligning the deletion contract to mirror this retention is a tracked follow-up.
- 2026-05-31: Backend reconciliation (🟡→✅). Fixed a runtime bug — added the `notification_preferences`/`accessibility_runtime_prefs`/`trauma_informed_defaults` JSONB columns to `foundation_user_extension` that `upsertNotificationPreferences` writes (the `PUT /api/foundation/notifications/preferences` path would otherwise fail). Fixed the broken seed: removed the phantom `foundation_service_credits_transactions` INSERT (table never existed; Foundation owns no credits ledger) and corrected the connection-thread fixture to set the required `thread_key` (`NOT NULL UNIQUE`, matching the repository's sorted `survivor:provider` key) with `ON CONFLICT (thread_key)` — it previously omitted `thread_key` and conflicted on a non-existent unique pair index, so it could never run. Reconciled the data model: dropped the non-existent `foundation_notification_preferences` (prefs are JSONB on `foundation_user_extension`) and `foundation_quota_threshold_states` (derived at evaluation time) entries so the data model matches the implemented schema.
