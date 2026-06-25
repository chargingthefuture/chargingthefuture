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
- `POST /api/foundation/connections/threads/:threadId/calls` — the original generic (scheduled-style) voice/video call-session create.
- `POST /api/foundation/connections/threads/:threadId/instant-call` — place an instant 1:1 audio call ring on the thread (Foundation "Connect now", issue #808 tasks 3 and 4). Rings the other thread participant; rate limited; returns the created call in `ringing` state. Optional body `{ authorizedBlocks }` is the buyer-set per-session block cap (default 6; the call can never extend past it in v1). Ringing moves no credits but is rejected up front (402 `FOUNDATION_CALL_INSUFFICIENT_FUNDS`) if the caller cannot afford the first block, or (409 `FOUNDATION_CALL_BILLING_MISCONFIGURED`) if the provider has no valid paid-call rate. In-app only (push is task 5).
- `GET /api/foundation/connections/instant-calls/:callId` — poll a call's state for either participant; when answered, also returns the participant-only Stream audio-join credentials (same token path as the Direct Line). Realises the ~60s ring timeout AND the lazy paid-window expiry on read.
- `POST /api/foundation/connections/instant-calls/:callId/answer` — callee answers a ringing call AND the first per-block charge is taken (issue #808 task 4): the provider's rate + interval are snapshotted onto the call and the first block is charged caller→provider via the canonical peer-to-peer ServiceCredits transfer. On insufficient funds the call ends cleanly with no credits moved and the route returns 402 `FOUNDATION_CALL_INSUFFICIENT_FUNDS` (the call is never opened).
- `POST /api/foundation/connections/instant-calls/:callId/extend` — **caller-only** (issue #808 task 4). Charges one more paid block at the rate LOCKED at answer, while the call is active and under the authorized cap. Returns 409 `FOUNDATION_CALL_BLOCK_CAP_REACHED` at the cap, 402 `FOUNDATION_CALL_INSUFFICIENT_FUNDS` (call ends cleanly) when the caller cannot pay, 403 `FOUNDATION_CALL_NOT_CALLER` for the callee. Idempotent per block via the deterministic key.
- `POST /api/foundation/connections/instant-calls/:callId/decline` — callee declines a ringing call (terminal).
- `POST /api/foundation/connections/instant-calls/:callId/end` — either participant ends/cancels the call (terminal; idempotent). Ending stops billing; prepaid blocks are not refunded or prorated in v1.
- `GET /api/foundation/connections/incoming-call` — the signed-in member's one live incoming ring, if any; the in-app incoming-call surface polls this.
- `POST /api/foundation/push/subscribe` — save the signed-in member's Web Push subscription for one device, so the instant-call ring can wake that device with the app closed (issue #808 task 5). CSRF-guarded, auth-gated, audited. The endpoint and keys are stored but never logged.
- `POST /api/foundation/push/unsubscribe` — remove the signed-in member's Web Push subscription for one device (they turned alerts off, or the browser revoked it). CSRF-guarded, auth-gated, audited.
- `GET /api/foundation/push/vapid-public-key` — return the public VAPID key the browser needs to subscribe (not secret). Returns `enabled:false` with an empty key when Web Push is not configured, so the client shows a clear "alerts unavailable" state.
- `POST /api/foundation/quotes`
- `POST /api/foundation/quotes/:quoteRequestId/state`
- `GET /api/foundation/quotes/history`
- `GET /api/foundation/connections/history`
- `GET /api/foundation/notifications` — list the signed-in member's Foundation notification events (`listNotificationEvents`); optional `?unreadOnly=true` returns only the unread ones. Read-access gated (`requireFoundationReadAccess`). Returns `{ ok, items }`.
- `PUT /api/foundation/notifications/preferences`
- `POST /api/foundation/notifications/:notificationEventId/ack`
- `POST /api/foundation/service-credits` ← `{ toUserId, amount, message?, idempotencyKey? }` → `{ ok, transaction }` — send ServiceCredits from the signed-in member to `toUserId` from a Foundation surface. Read-access gated (`requireFoundationReadAccess`) + CSRF (`x-ctf-csrf: '1'`); `amount` must be a positive number (else 400). Uses the shared ServiceCredits `createTransfer` primitive with `originPlugin: 'foundation'`, `reasonCode: 'foundation.transfer'` (idempotent on `(sender, idempotencyKey)`; a default key is derived when none is supplied). Foundation owns no credits ledger of its own — the movement is recorded only in the canonical ServiceCredits tables.

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
5. `foundation_call_sessions` — Voice/video call session records. The instant 1:1 call ring/answer lifecycle (issue #808 task 3, audio-only v1) adds ring columns to this same table: `caller_user_id` / `callee_user_id` (`TEXT`, who rang / who was rung), `ring_status` (`TEXT NOT NULL DEFAULT 'none'`: `none` | `ringing` | `answered` | `declined` | `timed_out` | `ended`), `ring_expires_at` (`TIMESTAMPTZ`, ~60s unanswered-ring timeout), `answered_at` / `ended_at` (`TIMESTAMPTZ`), `ended_by_user_id` (`TEXT`), and `first_block_charged` (`BOOLEAN NOT NULL DEFAULT FALSE`). Per-block billing (issue #808 task 4) adds: `rate_credits_locked` (`INTEGER`, the provider's rate snapshotted at answer), `interval_minutes_locked` (`INTEGER`, the block length snapshotted at answer), `authorized_blocks` (`INTEGER`, the buyer-set per-session cap set at ring), `blocks_charged` (`INTEGER NOT NULL DEFAULT 0`, how many blocks have been paid), `paid_through_at` (`TIMESTAMPTZ`, = `answered_at + blocks_charged * interval`, drives the display countdown and the lazy paid-window expiry), `last_transfer_id` (`TEXT`, the most recent ServiceCredits transfer id — trace only, NOT a value), and `ended_reason` (`TEXT`: `caller_insufficient_funds` | `paid_window_elapsed` | `block_cap_reached`, null for a plain end/decline/timeout). **No credit balance is stored on this table** — every block charge is a row in the canonical `service_credits_*` tables (see Security/Compliance and the deletion contract). A partial unique index `foundation_call_sessions_active_ring_per_callee` (over `callee_user_id WHERE ring_status = 'ringing'`) allows only one live ring per callee at a time; index `foundation_call_sessions_ring_status_idx` supports the inbox poll and timeout sweep. All added with `ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS` so legacy DBs upgrade cleanly.
6. `foundation_quote_requests` — Quote request lifecycle records.
7. `foundation_quote_status_events` — Quote state transition log.
8. `foundation_notification_events` — Notification delivery history. The instant-call ring (issue #808 task 5) writes a row of kind `instant_call.ring` (title "Incoming call", body "<caller> is calling you on Foundation.", `metadata.callId` + `metadata.type`) for the callee, so the in-app inbox/poll fallback shows the ring even when Web Push is unconfigured. Existing kinds: `message.new`, `quote.requested`, `quote.state.updated`.
9. `foundation_rate_limit_counters` — Per-command rate limiting state.
10. `foundation_capacity_policies` — Admin-configured capacity limits and thresholds.
11. `foundation_admin_audit_trail` — Admin action audit log.
12. `foundation_provider_accepted_currencies` — join (`user_id`, `currency_code` FK → `currencies.code`) for the currencies a provider accepts.
13. `foundation_provider_skills` — join (`user_id`, `skill_id` → `skills_taxonomy_skills.id`) of the skills a provider has opted in to be contacted about. This is the "willing to offer SAID skill" signal that distinguishes Foundation from the Directory: provider search only surfaces members with at least one row here, and `skill_id` is constrained (in the repository) to skills the member lists on their own claimed Directory profile.
14. `push_subscriptions` — Web Push device subscriptions (issue #808 task 5). Deliberately **user-global and NOT Foundation-specific in shape** so any plugin can reuse it; the Foundation instant-call ring is its first consumer. Columns: `id` (`UUID` PK), `user_id` (`TEXT NOT NULL`), `kind` (`TEXT NOT NULL DEFAULT 'web'` — room for `'expo'` when Android native push lands, no schema change), `endpoint` (`TEXT NOT NULL` — the push service URL, treated as the subscription identity), `p256dh` / `auth` (`TEXT`, the subscription's own public encryption keys from the browser — NOT the server VAPID private key, which lives only in env), `user_agent` (`TEXT`, a short non-identifying device label), `created_at` (`TIMESTAMPTZ NOT NULL DEFAULT NOW()`), `last_used_at` (`TIMESTAMPTZ`, stamped when a push is sent). Unique index `push_subscriptions_user_endpoint_key` on `(user_id, endpoint)` makes a re-subscribe an upsert; index `push_subscriptions_user_id_idx` on `(user_id)` for the send-time lookup. All columns added with `ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS`. Deletion: wired in `lib/account/deletion-registry.ts` under the `foundation` entry (hard delete on `user_id`).

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
- **Web — instant 1:1 call (issue #808 task 3, audio-only v1):** delivered. The "Connect now" consent dialog (`foundation-connect-now.tsx`) now places a live ring instead of showing a disabled button. A single `FoundationInstantCallController` (`foundation-instant-call.tsx`) is mounted once at the shell root and provides `startCall(provider)` to the button (caller side) and polls `GET /api/foundation/connections/incoming-call` so a member being rung sees an in-app answer/decline surface (callee side). It follows the ring → answered | declined | timed_out → ended state machine by polling `GET /api/foundation/connections/instant-calls/:callId`, and on answer joins an audio-only Stream Video room (`foundation-call-audio.tsx`, `default` call type, camera disabled — reuses the Chyme audio pattern) with join, mute toggle, end-call, and a visible call state. All real states are covered (ringing, connecting, in-call, ended/declined/timed-out, error) and the overlay is mobile-responsive (fills small screens, centers a card otherwise). No video tracks/camera UI in v1.
- **Web — instant 1:1 call per-block billing (issue #808 task 4):** delivered. The "Connect now" consent dialog now has a spend-limit selector (the buyer-set block cap, default 6) and shows the worst-case total ("up to N ServiceCredits"); the consent copy and footer state honestly that the first block is charged when the provider answers and that ringing is free. The in-call overlay now shows the caller a live block countdown (from `paid_through_at` + the locked interval), how many blocks of the authorized cap are paid, and an **Extend (+N credits)** control that highlights as the block nears its end; at the cap the control is replaced with a clear "you've used all the blocks you authorized" message; the terminal screen distinguishes "session ended — out of credits" and "session ended — paid time used up" from a plain hang-up. Insufficient-funds and cap errors are surfaced in place. The callee (provider) never sees the billing strip (they do not pay). Covers loading/ringing/in-call/extend/cap/ended/error states and is mobile-responsive (full-width strip inside the centered call card).
- **Web — instant-call ring delivery via Web Push (issue #808 task 5):** delivered. When a member rings a provider, `ringInstantCall` (after the row commits, best-effort) sends a Web Push to every device the callee enabled, so the device wakes with the app closed, and also writes a `foundation_notification_events` row of kind `instant_call.ring` for the in-app inbox/poll fallback. A provider enables alerts per device in the instant-call settings panel via "Enable call alerts on this device" (`foundation-call-alerts.tsx`): it requests notification permission, registers the service worker (`public/sw.js`), fetches the public VAPID key, subscribes, and POSTs the subscription. All real states are covered (unsupported browser, push not configured, permission denied, enabled-on-this-device, disabled, error) and the control is mobile-responsive. Clicking the push notification focuses/opens the app at `/apps/foundation`, where the existing incoming-call overlay renders answer/decline. Server keys (`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`) are read from env; when unset the send is a graceful no-op so the call flow, builds, and tests are unaffected and the in-app poll remains. A provider who has not enabled alerts still gets the in-app poll.
- **Android:** delivered (pixel pass, 2026-05-31) for the search/quote/Direct Line surface. The instant 1:1 call **ring/answer lifecycle (issue #808 task 3)** and its **per-block billing display (task 4)** are now also delivered on Android (React Native) — see the "Android — instant 1:1 call" bullet below. The **Web Push ring delivery (task 5)** remains **web + mobile-responsive web only**; the React Native app delivers the ring by in-app polling (the same fallback the web uses when push is unavailable), and Expo native push is still a deferred follow-up (#808 Android push ticket). The mobile feature binds the real Foundation API — see below.
- **Android — instant 1:1 call ring/answer lifecycle + per-block billing display (issue #808 tasks 3 and 4, audio-only v1):** delivered. Pure mobile client — no backend, schema, contract, or money-logic change; the app shows the server-returned state and calls the existing REST endpoints. New client methods in `ctf/packages/mobile/src/features/foundation/api.ts` (`ringInstantCall`, `getInstantCallState`, `answerInstantCall`, `declineInstantCall`, `endInstantCall`, `extendInstantCall`, `getIncomingCall`, plus `FoundationInstantCall`/state/join interfaces mirroring the web `FoundationInstantCall` and a `describeCallError` mapper for the server `FOUNDATION_*` codes). `FoundationInstantCallController.tsx` is mounted once at the app root (in `App.tsx`, inside `AuthProvider`): it exposes `startCall(provider, authorizedBlocks)`, polls `GET /api/foundation/connections/incoming-call` (~4s) so a callee sees an incoming ring anywhere in the app, and polls `GET /api/foundation/connections/instant-calls/:callId` (~2s) while a call is live, driving ringing → answered → ended/declined/timed_out. `FoundationInstantCallAudio.tsx` joins an audio-only Stream Video room via the React Native SDK (`default` call type, camera disabled right after join — audio-only enforced exactly as web v1), with mute toggle, end-call, and visible call state. The caller sees the billing strip (live current-block countdown from `paidThroughAt` + the locked interval, blocks paid / cap, and an **Extend (+N credits)** button that disables at the cap; terminal states distinguish "out of credits" / "paid time used up" from a plain hang-up); the callee (provider) never sees the billing strip. "Connect now" entry lives on the provider detail (`FoundationProviderDetail.tsx`) only when the provider has it enabled with a valid rate and the viewer is not that provider (using `instantCallEnabled` / `instantCallRateCredits` / `instantCallIntervalMinutes` / `viewerUserId` from the search payload), with a confirm sheet carrying the block-cap selector + worst-case total (`FoundationConnectNow.tsx`). The Stream Video transport needs native code, so this runs in an EAS dev/production build, not Expo Go — the same constraint as the other Stream calls in the app.

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

The instant 1:1 call ring/answer lifecycle (issue #808 task 3) and per-block billing (task 4) added columns to `foundation_call_sessions` but seed **no** call rows — a call is an ephemeral, member-initiated runtime event, not seed content, so there is no deterministic ring/charge to seed. The block charges write to the canonical `service_credits_*` tables at runtime, which have their own seed/treasury setup. `seedFoundation.mjs` is unchanged.

## Gaps and Known Technical Debt

1. Final quote payload schema by service category requires explicit product + compliance documentation (currently implementation-driven).
2. Voice/video fallback interaction copy finalization pending survivor-advisory review.
3. Notification channel rollout order and region targeting remain operational decisions.
4. Capacity policy defaults based on monthly demand assumptions need ongoing validation.
5. **Instant-call disputes/refunds are a deferred follow-up (issue #808 task 4 owner decision).** v1 charges prepaid blocks with no in-flow refund or proration; ending a call simply stops billing. When a refund/adjustment is genuinely needed it is handled manually through the **existing** ServiceCredits dispute machinery — the `service_credits_disputes` table plus the admin dispute/adjustment APIs (`createDispute`, `applyDisputeAdjustment` in `lib/service-credits/repository.ts`) — which already exist; no Foundation-specific dispute path was built.
6. **Mid-session block-cap re-authorization is a deferred follow-up.** The buyer sets the per-session block cap (`authorized_blocks`) once at ring time and the call can never extend past it in v1. Letting the buyer raise the cap during an in-progress call (a second authorization step) is a possible later enhancement.
7. **Trust signal — not applicable for the paid instant call.** Per rule 132, a completed paid 1:1 support call is a sensitive personal-wellbeing/safety + payment context, so it is deliberately NOT surfaced as a public Trust signal (no numeric credit/participation score, ever). Foundation does not currently expose any coarse completed-engagement Trust count that this would need to mirror, so there is nothing to add. If Foundation later adds a coarse public participation signal, revisit whether a categorical (non-numeric) "has completed a paid support call" presence indicator is appropriate then — but never a count of calls or credits.
8. **Android/Expo native push for the instant-call ring is deferred to the #808 Android push ticket.** The React Native instant-call surface (tasks 3 and 4) is now delivered and learns about an incoming ring by in-app polling (the same fallback the web uses when push is unavailable). Expo native push — waking the device when the app is closed — is the remaining piece and is still deferred. The `push_subscriptions` table is intentionally device-kind-agnostic (`kind` defaults to `'web'`, with room for `'expo'`) so an Expo push token can be added later without a schema change.
9. **Web Push requires the owner to provision VAPID keys.** Until `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` are set (the owner generates them once with `npx web-push generate-vapid-keys` and stores them in Infisical `production`), the ring is delivered in-app only — every push is a graceful no-op. No keys are generated or committed in the repo (open-source secrets policy). See `.claude/rules/123-environment-configuration-rules.mdc`.

## Change Log

- 2026-06-25: **Android (React Native) parity for the instant 1:1 call ring/answer lifecycle and per-block billing display (issue #808 tasks 3 and 4, audio-only v1).** Pure mobile client work — no backend, schema, contract, or money-logic change. The app shows the server-returned call state and calls the existing REST endpoints; every charge and transition runs server-side (the same routes the web uses). New client methods in `packages/mobile/src/features/foundation/api.ts`: `ringInstantCall(threadId, authorizedBlocks?)` → `POST .../threads/:threadId/instant-call`, `getInstantCallState(callId)` → `GET .../instant-calls/:callId` (returns the Stream join credentials when answered), `answerInstantCall` / `declineInstantCall` / `endInstantCall` / `extendInstantCall(callId)` → the matching `POST .../instant-calls/:callId/{answer,decline,end,extend}`, and `getIncomingCall()` → `GET .../connections/incoming-call`; all POSTs send `x-ctf-csrf: '1'`. Added `FoundationInstantCall` plus the state/join/incoming/action response interfaces (mirroring the web `FoundationInstantCall` + join shape) and a `describeCallError` mapper that turns the server `FOUNDATION_*` codes (insufficient funds, callee busy, block cap reached, billing misconfigured, rate limited) into plain messages; the `Provider` type gained the read-only `instantCallEnabled` / `instantCallRateCredits` / `instantCallIntervalMinutes` mirror and the search result gained `viewerUserId`. New components: `FoundationInstantCallController.tsx` (singleton mounted once at the app root in `App.tsx`, inside `AuthProvider` — exposes `startCall(provider, authorizedBlocks)`, polls the incoming-call inbox ~4s for the callee and the live call state ~2s while a call is active, drives ringing → answered → ended/declined/timed_out, and renders the modal overlay for incoming ring / caller ringing / in-call / terminal); `FoundationInstantCallAudio.tsx` (audio-only Stream Video room via the React Native SDK, `default` call type, camera disabled immediately after join — audio-only enforced exactly as web v1 — with mute toggle, end-call, and a visible connecting/in-call/error state); `FoundationConnectNow.tsx` (the "Connect now" button + confirm sheet with the block-cap spend-limit selector and worst-case total, shown on the provider detail only when the provider opted in with a valid rate and the viewer is not that provider). The caller sees the billing strip (live current-block countdown from `paidThroughAt` + the locked interval, blocks paid / cap, an **Extend (+N credits)** button that disables at the cap, and "out of credits" / "paid time used up" terminal labels distinct from a plain hang-up); the callee (provider) never sees the billing strip. The ring is delivered by **in-app polling only** — the same fallback the web uses when push is unavailable; **Expo native push remains a deferred follow-up** (the #808 Android push ticket). The Stream transport needs native code, so this runs in an EAS dev/production build, not Expo Go. Mobile client + inventory only; no schema/route/contract/credit change.
- 2026-06-25: **Documented two existing user routes** (inventory-debt burn-down — documentation catch-up, no code change). Added `GET /api/foundation/notifications` (list the member's notification events; optional `?unreadOnly=true`; read-access gated) and `POST /api/foundation/service-credits` (send ServiceCredits caller→`toUserId` via the shared `createTransfer` primitive with `originPlugin: 'foundation'`; read-access gated + CSRF; Foundation owns no credits ledger) to the API Surface route map. Both verified against the route handlers. Removed these two routes from `ctf/scripts/inventory-drift-allowlist.json`.
- 2026-06-25: **Instant-call ring delivery via Web Push (issue #808 task 5 — web + mobile-responsive web).** Wakes a provider's device when a member rings them, even with the app closed; the in-app `incoming-call` poll remains the fallback. Added the `web-push` dependency. New user-global table `push_subscriptions` (`kind` defaults to `'web'`, room for `'expo'`; stores the device endpoint and the subscription's own public encryption keys — never the server VAPID private key), unique on `(user_id, endpoint)`, indexed on `user_id`, added with the `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS` pattern, and registered for deletion under the `foundation` entry in `lib/account/deletion-registry.ts` (hard delete on `user_id`). New server module `lib/notifications/push.ts` (`saveWebPushSubscription`, `deleteWebPushSubscription`, `sendWebPushToUser`, `resolveWebPushKeys`, `getWebPushPublicKey`): keys are read from env (`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`), and when unset the send is a logged no-op that never throws, so builds, tests, and the call flow are unaffected; on a 404/410 from the push service a dead subscription is pruned; no key material or endpoint URL is ever logged. New service worker `public/sw.js` (plain JS, push + notificationclick → focus/open `/apps/foundation`). New API routes: `POST /api/foundation/push/subscribe`, `POST /api/foundation/push/unsubscribe` (both CSRF-guarded, auth-gated, audited), and `GET /api/foundation/push/vapid-public-key` (returns the non-secret public key, `enabled:false` when unconfigured). Wired the task-3 ring seam: `ringInstantCall` now calls `dispatchRingDelivery` AFTER the transaction commits (best-effort, wrapped so a push or notification-event failure can never fail the ring), which writes a `foundation_notification_events` row of new kind `instant_call.ring` and sends the push. New web component `components/foundation/foundation-call-alerts.tsx` ("Enable call alerts on this device") mounted in the instant-call settings panel, covering unsupported/unavailable/denied/enabled/disabled/error states and mobile-responsive. Added three command contracts, three access-policy contracts, an audit changelog note, the deletion-contract entry, and the three VAPID env vars to rule 123. **Android/Expo native push deferred to the #808 Android parity ticket** (the table's `kind` column leaves room for `'expo'`). The owner must generate the VAPID keys (`npx web-push generate-vapid-keys`) and set them; none are generated or committed (open-source secrets policy). Dependency + schema + server module + service worker + API + ring wiring + web UI + contracts + inventory.
- 2026-06-25: **Instant 1:1 call per-block billing (issue #808 task 4 — owner-review, moves real ServiceCredits).** Wires real ServiceCredits onto the metered "Connect now" call from task 3. Direct per-block transfer (no escrow): every block is charged caller→provider via the canonical `createTransfer` peer-to-peer primitive (`lib/service-credits/repository.ts`), which runs in its own DB transaction, is idempotent on `(sender, idempotency_key)`, holds a `FOR UPDATE` balance lock, and throws `'insufficient_balance'`. New billing columns on `foundation_call_sessions` (all `ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS`): `rate_credits_locked`, `interval_minutes_locked` (provider rate + interval snapshotted at answer so a mid-call rate change cannot affect the call), `authorized_blocks` (buyer-set per-session cap chosen at ring, default 6, never exceeded in v1), `blocks_charged`, `paid_through_at` (drives the countdown + lazy paid-window expiry), `last_transfer_id` (trace), and `ended_reason`. `lib/foundation/instant-call.ts`: `ringInstantCall` now takes `authorizedBlocks` and rejects up front if the caller can't afford the first block or the provider has no valid rate (ringing still moves no credits); `answerInstantCall` snapshots the rate and charges block 1 on answer (key `foundation-instant-call-<callId>-block-1`), ending the call cleanly with no credits moved on insufficient funds (the call is never opened); new `extendInstantCall` (caller-only) charges block n+1 at the LOCKED rate under the cap (key `...-block-<n>`); a lazy paid-window sweep ends an answered call once `paid_through_at` passes without an extend (no background job, mirroring the ring-timeout sweep). New route `POST .../instant-calls/:callId/extend` (caller-only, CSRF, audited); the ring route accepts/validates `authorizedBlocks`; the answer route surfaces a 402 `FOUNDATION_CALL_INSUFFICIENT_FUNDS`. Web: the consent dialog (`foundation-connect-now.tsx`) gains a spend-limit (block-cap) selector + worst-case total and honest copy; the call overlay (`foundation-instant-call.tsx`) gains a live per-block countdown, paid/cap counter, an Extend (+N credits) prompt that highlights near a block's end, a cap-disabled message, and "out of credits" / "paid time used up" terminal states (callee never sees the billing strip). Credit-safety invariants enforced: only answer+extend charge (ring never does); no double-charge (deterministic per-block key + `blocks_charged` guard); never beyond `authorized_blocks`; caller always sender / provider always recipient; always the locked rate after answer; insufficient funds ⇒ clean error + call ends + no partial transfer (no negative balances, guarded by `createTransfer`). Contracts: `ring`/`answer` bumped to v1.1.0 with the service-credits `dataAccess` and credit deny conditions, new `foundation.connection.instant-call.extend` command + access policy + audit-event shapes. **Disputes/refunds and mid-session cap re-authorization are deferred follow-ups** (see Gaps — refunds use the existing `service_credits_disputes` + admin adjustment APIs). **Trust signal: not applicable** (sensitive payment/wellbeing 1:1; no numeric score — see Gaps). Android (React Native) parity deferred to the issue #808 Android follow-up. Schema + API + repository + web UI + contracts + inventory.
- 2026-06-25: **Instant 1:1 call ring/answer lifecycle (issue #808 task 3 — audio-only v1).** Wires the live call behind the "Connect now" button: it now places a real audio ring instead of a disabled stub. Reuses the existing Direct Line 1:1 thread (`foundation_connection_threads`) and the participant-only Stream token path (no parallel token). New state machine on `foundation_call_sessions` (ring columns added via `ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS`): `ring_status` ringing → answered | declined | timed_out → ended, with `caller_user_id`/`callee_user_id`, `ring_expires_at` (~60s timeout, realised lazily on read/write — no background job), `answered_at`/`ended_at`/`ended_by_user_id`, a partial unique index allowing one live ring per callee, and a `first_block_charged` flag-only seam for task 4. New repository module `lib/foundation/instant-call.ts` (`ringInstantCall`, `getInstantCallState`, `getIncomingRing`, `answerInstantCall`, `declineInstantCall`, `endInstantCall`, join-credential helpers). New API routes: `POST .../threads/:threadId/instant-call` (ring, rate limited to 5/60s via `foundation_rate_limit_counters`), `GET .../instant-calls/:callId` (state + audio-join credentials when answered), `POST .../instant-calls/:callId/answer|decline|end`, and `GET .../connections/incoming-call` (callee inbox). New web components: `foundation-instant-call.tsx` (the controller mounted once at the shell root — caller ring overlay, callee answer/decline, in-call), `foundation-call-audio.tsx` (audio-only Stream Video room, `default` call type, camera disabled, mute/end controls; reuses the Chyme pattern). Added six command contracts and six access-policy contracts; documented the call-session columns in the deletion contract; audit rows recorded via the shared `foundation_admin_audit_trail`. **Task-4 (billing) seam:** the first per-block charge belongs inside `answerInstantCall`'s transaction (marked with an inline comment) and flips `first_block_charged`; no credits move in v1. **Task-5 (push) seam:** the ring is in-app only (the callee's `incoming-call` poll); a push would be dispatched from `ringInstantCall` after commit and is marked with an inline comment. Android (React Native) parity deferred to the #808 Android follow-up. Schema + API + repository + web UI + contracts + inventory.
- 2026-06-24: **Foundation "Connect now" button + consent preview (issue #808, task 2 — entry point only).** Surfaces a provider's instant-call availability to viewers and adds the consent/cost-preview step, building on the merged settings layer (task 1). Read-only addition: `GET /api/foundation/providers/search` now LEFT JOINs `foundation_user_extension` and includes `instantCallEnabled`, `instantCallRateCredits`, and `instantCallIntervalMinutes` per provider, plus a top-level `viewerUserId` so the client can hide the button on the viewer's own card — no new table, no write path, no credit movement, same Unlock read gate as the existing search. New `ProviderView`/`FoundationProviderSearchItem` fields mirror those three. New web component `components/foundation/foundation-connect-now.tsx`: a "Connect now" button (rendered on Browse cards and the provider detail only when the provider has it enabled with a valid whole-credit rate and the viewer is not that provider) that shows the rate as "X ServiceCredits / N min", and a consent dialog previewing the per-block rate, a plain-language disclaimer (this starts a live paid 1:1 call; you're charged per block; you can end it anytime) and a consent checkbox. Because the call lifecycle (task 3) and per-block billing (task 4) do not exist yet, the dialog's final "Start call" action is rendered **disabled** with an honest inline note that live calling arrives in the next update — it never calls an endpoint, never stubs a call, and never throws. Works at phone width. Updated the `foundation.search.providers` command contract output schema + dataAccess (`foundation_user_extension`). Android (React Native) parity deferred — see the Parity Ticket on the PR. The call lifecycle and billing remain later tasks of #808.
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
