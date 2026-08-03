# TrustTransport Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Plugin name: `TrustTransport`
- Plugin slug: `trust-transport`
- Owned surfaces: `/apps/trust-transport` (web), `packages/mobile/src/features/trust-transport` (Android), `/api/trust-transport/*` routes, `trust_transport_*` tables.
- Not owned: identity (Clerk), ServiceCredits ledger (service-credits plugin), notifications/email transport (notifications integration).
- Primary mission scope: peer-to-peer rides, package delivery, and food delivery.

## Intent and Outcome

TrustTransport is a trauma-informed, safety-first logistics marketplace plugin for survivors to:

1. request and fulfill rides,
2. request and fulfill package delivery,
3. request and fulfill food delivery,
4. earn income by helping fulfill requests,
5. build reputation and trust through transparent completion history.

The plugin ships on web (desktop + mobile-responsive). The former native Android (React Native) surface was removed 2026-07-20 (rule 105, PR #1742); this feature is now web-only, served by the installable web app (PWA).

---

## User Features

### 1.1 Unified Discovery and Booking Surface

1. Single landing decision flow for:
   - Ride,
   - Package,
   - Food.
2. Structured origin/destination/location input with map and list fallbacks.
3. Real-time quote previews (eta/price ranges) before submission.

### 1.2 Ride Marketplace

1. Rider flow:
   - request ride,
   - choose offer,
   - track driver,
   - complete.
2. Driver flow:
   - accept/decline requests,
   - pickup/dropoff confirmation,
   - status transitions with auditability.
3. Safety controls:
   - share trip status,
   - emergency help shortcut,
   - trusted-contact visibility toggle.

### 1.3 Package Marketplace

1. Sender flow:
   - create package job with dimensions/photos/value,
   - choose delivery speed and provider,
   - track parcel state transitions.
2. Courier flow:
   - accept route,
   - pickup confirmation (photo/code),
   - handoff confirmation (photo/code/signature).
3. Dispute-ready proof capture:
   - pickup evidence,
   - delivery evidence,
   - exception reason codes.

### 1.4 Food Marketplace

1. Buyer flow:
   - browse available providers/menus,
   - place order,
   - track preparation + delivery,
   - confirm receipt.
2. Provider flow (cook/store):
   - manage menu and availability,
   - receive/confirm orders,
   - prep status updates.
3. Courier flow:
   - pickup and dropoff with optional contactless proof.

### 1.5 Order/Trip Lifecycle and Communications

1. Canonical lifecycle states by mode (ride/package/food) with shared status vocabulary.
2. In-context communication channel scoped to each order/trip between exactly the two parties (rider and driver). The chat opens with the trip and closes when the trip reaches a terminal state (completed, canceled, disputed): no new messages may be sent, both parties keep read-only access for a limited window, and messages are retained server-side for moderation/abuse evidence per the deletion contract. No 1:1 messaging exists outside an active trip (platform rule 100, "Messaging Scope and Lifecycle").
3. Clear non-technical status and failure messaging.

### 1.6 Earnings and Completion History

1. ServiceCredits earned on a completed trip are paid straight to the member's ServiceCredits wallet (a real on-platform transfer requester → provider).
2. For any other settlement (fiat/crypto/barter), the platform has **no payment processing** — the payment is arranged peer-to-peer, off-platform, directly between the two people. There is no platform payout. The Earnings tab shows a **read-only record** of what completed trips were worth, per currency; the same figures are recognized by the GDP layer (`lib/gdp/recognition.ts`) as community economic activity. (Owner decision, 2026-07-08: the fiat/crypto "withdrawable balance + payout request" flow was removed — it implied a platform-issued payout that cannot exist.)
3. Reputation is transparent completion history only — the record of whether each trip was successfully completed or not, and a count of completed trips. There are no ratings, reviews, star scores, written feedback, or reliability badges of any kind. (Owner directive: rating of people is not allowed.)

---

## Admin Features

### 2.1 Trust and Safety Operations

1. Case queue for incidents and abuse reports.
2. Temporary/permanent account restriction controls.
3. Identity and policy-verification review workflow.

### 2.2 Marketplace Operations

1. Region and service-zone management.
2. Fee, commission, and incentives configuration.
3. Capacity controls (pause new requests by region/mode).

### 2.3 Disputes and Refunds

1. Dispute intake and adjudication workspace.
2. Evidence review (photos/codes/timestamps/event trail).
3. Refund and adjustment actions with audit trail.

### 2.4 Risk and Compliance Monitoring

1. Fraud/risk signal dashboard.
2. Policy-violation trends and enforcement history.
3. Required logs and exportable compliance reports.

---

## API Surface and Route Map

## Plugin Command Surface (Authoritative)

All command contracts conform to templates in `201-plugin-command-schema-template.mdc`, `202-plugin-access-policy-schema-template.mdc`, and `203-plugin-audit-schema-template.mdc`.

Command groups in scope:

1. `trust-transport.request.create`
2. `trust-transport.offer.list`
3. `trust-transport.offer.create`
4. `trust-transport.offer.accept`
5. `trust-transport.trip.status.update`
6. `trust-transport.trip.completion.confirm`
7. `trust-transport.delivery.proof.capture`
8. `trust-transport.order.cancel`
9. `trust-transport.chat.message.send`
10. `trust-transport.admin.dispute.resolve`
11. `trust-transport.admin.account.restrict`
12. `trust-transport.admin.market.config.update`

(Removed 2026-07-08: `trust-transport.payout.request` — there is no platform payout for non-ServiceCredits
settlement; see the Earnings section and the Change Log.)

## HTTP Projection Routes

User routes:

- `GET /api/trust-transport/modes` — Available transport modes (requires member read access).
- `POST /api/trust-transport/requests` — Create a request.
- `GET /api/trust-transport/requests/available` — Open requests a member can offer to help with: everyone's open requests except the caller's own, returning **only mode + settlement + age** (no pickup/drop-off, no title) per discovery model B. Location is shared with a provider only after the requester accepts their offer.
- `GET /api/trust-transport/requests/:requestId` — Request detail.
- `GET /api/trust-transport/requests/:requestId/offers` — Offers on a request.
- `POST /api/trust-transport/requests/:requestId/offers` — Make an offer on an open request (one pending offer per provider per request; re-offering updates it).
- `POST /api/trust-transport/offers/:offerId/accept` — Accept an offer, opening a trip.
- `GET /api/trust-transport/trips` — Trips the caller is fulfilling (provider side), with the now-revealed pickup/drop-off, so they can advance the lifecycle.
- `POST /api/trust-transport/trips/:tripId/status` — Advance trip status one forward step (assigned → en_route → picked_up → delivered), or set a terminal state. A non-admin cannot set `completed` here — completion requires mutual confirmation (below). Admins keep a direct override to `completed`.
- `POST /api/trust-transport/trips/:tripId/complete` — Record the caller's completion confirmation for a `delivered` trip. Only the requester or provider may call it. The trip transitions to `completed` (and settlement fires) only once **both** parties have confirmed — neither can complete a trip alone, because completion moves value (a ServiceCredits transfer, or a recorded off-platform fiat/crypto settlement).
- `POST /api/trust-transport/trips/:tripId/proof` — Capture pickup/delivery proof.
- `POST /api/trust-transport/trips/:tripId/chat` — Mint Stream chat credentials for the trip thread: chat channel (`channelId`/`streamChannelId`) and participant token. Text chat only — no video.
- `POST /api/trust-transport/trips/:tripId/emergency-stop` — Safety emergency-stop control.
- `POST /api/trust-transport/orders/:orderId/cancel` — Cancel an order.
- `GET /api/trust-transport/earnings` — The caller's **recorded** earnings from completed trips, per currency (read-only). Not a withdrawable balance: for anything other than ServiceCredits the payment is arranged peer-to-peer off-platform, so there is nothing to withdraw. The same figures feed the GDP recognition layer. (The `POST /payouts/requests` and `GET /payouts` routes were removed 2026-07-08.)
- `POST /api/trust-transport/service-credits` — Cross-user ServiceCredits transfer for trip economics (rejects self-transfer; emits a `trust-transport.service-credits.transfer` audit event).

Admin routes:

- `GET /api/trust-transport/admin/incidents` — Incident queue.
- `POST /api/trust-transport/admin/incidents/:incidentId/resolve` — Resolve an incident.
- `POST /api/trust-transport/admin/accounts/:userId/restrict` — Restrict an account.
- `POST /api/trust-transport/admin/accounts/:userId/restore` — Restore a restricted account.
- `PUT /api/trust-transport/admin/market-config` — Update market configuration.
- `GET /api/trust-transport/admin/audit-events` — Read admin audit trail.

---

## Data Model and Storage Contracts

### 4.1 Canonical Profile and Plugin Extension

Single-profile rule is enforced:

1. Canonical user profile is reused for identity/preferences/safety controls.
2. Plugin-specific extension data is linked by `user_id` only.
3. No separate full profile table for TrustTransport.

Extension entity:

- `trust_transport_user_extension` — mode preferences, trust/safety settings, payout preference metadata, linked by `user_id`.

### 4.2 Domain Entities

Tables owned by this plugin:

1. `trust_transport_requests` — Request rows across ride/package/food modes.
2. `trust_transport_offers` — Offers placed by providers on a request.
3. `trust_transport_trips` — Accepted-offer trips with lifecycle state. Includes `requester_completion_confirmed_at` and `provider_completion_confirmed_at` (both nullable timestamps): a trip only transitions to `completed` (and settles) once both are set — mutual completion confirmation.
4. `trust_transport_status_events` — Append-only event log for status transitions.
5. `trust_transport_proof_artifacts` — Pickup/delivery proof captures (photo, code, signature references).
6. `trust_transport_disputes` — Dispute records and adjudication state.
7. `trust_transport_earnings_ledger` — Earnings entries per completed task (`amount` is `NUMERIC`; `trip_id` links a settlement credit to its trip). A completed non-SC trip writes one `credit` row here; this is the read-only earnings record and the GDP recognition source. No `hold`/`debit` rows are written any more (the payout flow that created them was removed).
8. `trust_transport_payout_requests` — **Deprecated / write-frozen (2026-07-08).** No code writes to it now that the payout flow is removed. Retained (not dropped) for historical/financial integrity and kept in the deletion registry.
9. `trust_transport_risk_signals` — Fraud/risk signals captured for monitoring.
10. `trust_transport_market_config` — Region/service-zone/fee/commission/capacity configuration.
11. `trust_transport_admin_audit_trail` — Admin mutation audit log.

Multi-currency (issue #120): `trust_transport_payout_requests` and `trust_transport_earnings_ledger` gain
`price_currency` (FK → `currencies.code`), the admin-curated, referenced settlement currency that supersedes
the legacy free-text `currency` column (the GDP estimation layer in issue #121 reads `price_currency`).
Existing rows are backfilled from `currency` only where it already matches a known code; unknown legacy values
are left for manual reconciliation so no money data is overwritten. No surface renders a ServiceCredits amount
at a fiat equivalent.

### 4.3 Lifecycle and Storage Constraints

1. Immutable event log for status transitions.
2. Idempotency keys for create/update commands.
3. Redacted storage for sensitive proof and chat metadata.
4. Region-aware data storage and retention class tags.

---

## Security, Privacy, and Compliance Controls

1. Server-side authorization for every command execution.
2. Consent and lawful-basis validation per command policy schema.
3. Deny-by-default cross-tenant and cross-region access.
4. CSRF protection for all state-changing web routes.
5. Audit events (allow + deny) for command execution and admin decisions.
6. Explicit confirmation for irreversible actions (cancel, restrict, delete).
7. Sensitive-data redaction in logs and diagnostics.
8. Plugin-scoped deletion and full-account deletion support with distinct audit events.

---

## Web and Android Delivery Status

Delivery: **web + mobile-responsive complete** (functional). **Android (React Native) surface removed 2026-07-20 (rule 105, PR #1742)** — this feature is now web-only, served by the installable web app (PWA). Web surface lives under `/apps/trust-transport`. Historical parity detail: a former Android surface lived under `packages/mobile/src/features/trust-transport` (now removed); booking, tracking, completion, safety controls, and deletion behaved consistently across platforms. Web pixel pass complete: the shell (`trust-transport-shell.tsx` + `tt-*` sub-components) is aligned to `design/.../survivor-hub/TrustTransport.tsx` and decomposed within rule-116 limits; per the real-data-only rule it binds real `/api/trust-transport/modes` + `requests` + per-trip Stream chat and omits the design's mock driver/stat figures. Android pixel pass complete (2026-05-31): `TrustTransport.tsx` rewritten to align with `design/.../survivor-hub/MobileTrustTransport*.tsx` mockups for all four states (loading, public/unauthenticated, empty, main). Binds real `/api/trust-transport/requests` (list + create) via the existing `api.ts`. Omissions per real-data-only rule: "Nearby Drivers" list (no backend endpoint for available driver discovery), driver ratings/ETAs/vehicle info, and online driver count stat — none of these fields are returned by any `trust-transport` API endpoint. Mock file (`MockTrustTransport.tsx`) retired (content cleared). `AuthProvider` export preserved via `auth-context.tsx` re-export; `TrustTransport` export maintained in `index.ts`.

Provider/marketplace parity (2026-07-01 through 2026-07-02, issue #1250 — complete): the Android app
gained a "Help" tab (`TrustTransportHelpTab.tsx`) mirroring the web "Help out" tab's discovery model B —
it browses open requests via `GET /requests/available` (mode + settlement + age only, never a location),
submits an offer via `POST /requests/:requestId/offers`, and shows "Trips you're helping with" with the
same forward status controls and proof capture the web Help tab has, using the existing
`listProviderTrips`, `updateTripStatus`, and `captureProof` API client functions. A "Chat" button on both
the requester's Track tab (once a request has an accepted trip) and the provider's Help tab trips opens
`TrustTransportStreamTab` in a full-screen modal (`TrustTransportChatButton.tsx`) — this was previously
orphaned scaffold, never imported anywhere in the app; it is now wired for both parties. An "Earnings" tab
(`TrustTransportEarningsTab.tsx`) mirrors the web Earnings tab: per-currency balance cards
(`getEarningsBalances`), a payout request form scoped to the selected currency
(`requestPayout(amount, currency)`), and payout history (`listPayouts`). Every endpoint used across all of
the above already existed (no schema/route/contract change); see the Change Log for the full shipped list.
Issue #1250 is now closed out — Android has full parity with web across discovery/offer, view-offers/accept,
trip progression, proof capture, chat, and earnings/payouts.

While wiring Android chat, the same gap was found on web: the "Help out" tab's provider trip cards had no
chat access either — only the requester's "Direct Line" tab could open a trip's chat. `tt-help-tab.tsx`
gained an inline "Chat" toggle (`TripChat`) using the same `StreamChatPanel` and the same
`/api/trust-transport/trips/:tripId/chat` route (which already authorized either party) — no backend change
needed, only the missing UI.

Admin parity (2026-06-06): the Android admin screen `AdminTrustTransport.tsx` (exported from `index.ts`, registered in `App.tsx` as the `trust-transport-admin` feature) now matches the shipped web admin at `/admin/trust-transport`. It is admin-gated server-side (every admin route runs `requireTrustTransportAdminAccess`); a 401/403 surfaces an "available to admins only" notice. It binds the same existing admin endpoints with no new backend: incident queue with resolve, market controls (max concurrent trips, proof-on-delivery, emergency freeze), account restrict/restore, and the admin audit trail. Every state-changing action (resolve, market-config update, restrict, restore) asks for confirmation via a native `Alert` before sending, and mutations carry the `x-ctf-csrf: '1'` header. The web admin page is already mobile-responsive: it is a single-column flow (`max-w-5xl` content with a `grid-cols-1` → `sm:grid-cols-2` → `lg:grid-cols-4` stat grid and full-width stacked cards), so no responsive rework was required.

---

## Seed Coverage Status

`ctf/scripts/seedTrustTransport.mjs` seeds deterministic request/offer/trip/proof/dispute data for dev validation.

---

## Gaps and Known Technical Debt

1. Audit storage growth: `trust_transport_admin_audit_trail` has no archival or retention policy. No
   plugin in this codebase has one yet either — building a bespoke retention job for this table alone
   would require a retention-period decision (how long, under what compliance requirement) that has not
   been made at the product or platform level. Not blocking; flagged for a cross-plugin retention policy
   decision, not a per-plugin fix.
2. Command contract drift: mitigated by the `check-inventory-drift` CI gate (fails a PR that adds an
   undocumented schema table or API route) and the plugin contract templates (rules 200–203). Full
   field-by-field matching of contract YAML against inventory prose is still a manual review step, not an
   automated gate.
3. No admin trip-approval queue: the `design/` mockup shows an "approve/reject trip request queue" but no
   backend route exists for it. The incident queue is the real, shipped moderation surface; the mockup
   predates the incident-queue design and is stale, not a missing feature.
4. Nearby Drivers list, driver ratings, ETAs, and vehicle info are intentionally absent from both
   platforms — no backend endpoint returns any of these fields, per the real-data-only rule. Ratings of
   people specifically are never shown anywhere in this plugin: reputation is transparent completion
   history only (completed vs. not), never a score, by owner directive.

## Change Log

- 2026-08-02: **Deletion burn-down batch 4.** On account deletion, `trust_transport_status_events` and `trust_transport_proof_artifacts` rows you appear on are pseudonymized (actor/captured-by → `deleted_member`): events and proofs belong to the shared trip/request record that disputes rely on. `trust_transport_risk_signals` (abuse evidence) and `trust_transport_market_config` (admin-audited settings) are classified retained.
- 2026-08-02: **Deletion burn-down batch 3: disputes classified as retained.** On account deletion, `trust_transport_disputes` is retained — the accountability record for value that moved between two members over a trip, matching the earnings-ledger policy already in the registry. The deletion contract already documented this; the registry entry makes the coverage gate see it. Caught by the deletion-coverage gate added in #2056.
- 2026-08-02: **A departing member's id no longer survives on the other party's rows (owner
  directive).** Account deletion removed `trust_transport_trips` by `requester_user_id` only, so a member who deleted their
  account left their raw Clerk id sitting in the counterparty's view forever — the row belongs to the
  other person, so deleting it was never the answer. New `pseudonymize` deletion action: the row
  stays, `provider_user_id` is overwritten with the shared constant `deleted_member`. A single constant
  rather than a per-user token, because a token would still link that person's rows to each other.
  Deliberately not applied to abuse evidence, reviewer/admin audit columns, or
  `member_blocks.blocked_user_id` (overwriting it could unblock someone) — each recorded in the
  deletion contract. `check-deletion-registry.mjs` validates the new action and its cleared columns
  against `schema.sql`; verified it fails on a bad column name. No schema change.
- 2026-08-03: **US-spelling rename guard scoped to the public schema (fixes issue #2030).** The
  `canceled_reason` rename block in `ctf/schema.sql` checked `information_schema.columns` without
  naming a schema, so on a database that also holds the demo schema the check matched the demo copy
  of the column after the public one was already renamed, and the Neon apply workflow failed. The
  guard now filters on `table_schema = 'public'`; `schema.demo.sql` was regenerated, where the
  generator retargets the filter to the demo schema. No table, column, route, or contract change.
- 2026-07-31: **Stored status values respelled to US English (owner-directed).** `trust_transport_requests.status`, `trust_transport_trips.status`, and `trust_transport_status_events` (the cancel event's `event_name`, now `order_canceled`, plus `from_status`/`to_status`) now store `canceled`; the trip cancel-reason column was renamed to `canceled_reason`. Existing rows are migrated by the idempotent US-spelling data migration block at the end of `ctf/schema.sql`, which re-runs on every deploy. Code, contracts, and docs were renamed in the same PR.
- 2026-07-20: **Notifications producer.** Accepting an offer now emits a best-effort notification (`notifySafe`, `trust-transport.offer.accepted`, category `safety`) to the provider — deduped on the trip id, never to the accepting requester. Emitted from the accept-offer route. No schema/contract change.
- 2026-07-20: **Account deletion now clears the member's Stream chat copy (privacy).** TrustTransport trip-thread chat is sent directly into Stream Chat under the Stream user `trust-transport-<userId>`, so Stream kept an independent copy that the Postgres-only account-deletion registry never removed (Stream retains messages with no expiry by default). Registered `deleteTrustTransportStreamData(userId)` (in `lib/trust-transport/stream.ts` — hard-deletes the Stream user with `mark_messages_deleted`; never throws) into the shared account-deletion external-cleanup hook (`lib/account/external-cleanup-registry.ts`), which the orchestrator runs after the DB transaction commits on every whole-account deletion path (full-account route, internal delete, Clerk webhook), best-effort (a Stream outage is logged, never blocks the deletion). No schema/route/contract change.
- 2026-07-17: **History-aware back + admin↔member navigation (app-wide sweep).** The member
  shell's hand-rolled back chevron was replaced by the shared `BackChevronButton` — it returns to
  the previous in-app page and falls back to All Apps when there is no in-app history. The admin
  surface header gained the shared "Member view" pill (`PluginUserShellButton`) linking to
  `/apps/trust-transport`. UI-only; no schema, route, or contract change.
- 2026-07-14: **Added refresh controls (app-wide refresh rollout).** Web: shared `RefreshButton` in the desktop and mobile-responsive shell headers (`trust-transport-shell.tsx`), wired to `fetchRequests()` so the request list re-pulls without flashing the full-screen loading state. Android: native pull-to-refresh via `RefreshControl` on the screen's top-level `ScrollView` in `TrustTransport.tsx`, wired to a new background variant of `loadRequests` that skips the track tab's loading spinner. UI-only; no schema, route, or contract change.
- 2026-07-08: Removed the fiat/crypto payout flow; Earnings became a read-only record (owner decision).
  The platform has no payment processing, so a non-ServiceCredits payment is arranged peer-to-peer
  off-platform between the two people — there is nothing for the platform to pay out. Previously a
  completed non-SC trip credited a fiat/crypto "earnings ledger" that the member saw as a **withdrawable
  balance** with a "Request a payout" button (an admin was supposed to review it, though no admin payout
  surface ever existed) — implying a platform-issued payout that cannot happen. Removed: the
  `POST /api/trust-transport/payouts/requests` and `GET /api/trust-transport/payouts` routes, the
  `requestPayout`/`listMyPayouts`/`getProviderAvailableBalance` repository functions, the
  `trust-transport.payout.request` command (command/policy/audit contracts), and the payout +
  withdrawable-balance UI on web and Android. The Earnings tab now shows a read-only per-currency **record**
  of completed-trip earnings with copy making clear the payment is settled off-platform. **GDP is
  preserved:** completion still writes a `credit` row to `trust_transport_earnings_ledger`, which
  `lib/gdp/recognition.ts` reads unchanged, so completed-trip value still counts toward community economic
  activity per the multi-currency spec. `getEarningsBalancesByCurrency` → `getRecordedEarningsByCurrency`
  (sums `credit`/`release` only; no more hold-netting). The `trust_transport_payout_requests` table is
  retained (write-frozen) for historical/financial integrity, not dropped. No change to settlement itself
  or to the ServiceCredits path (SC still pays straight to the wallet on completion).

- 2026-07-08: Mutual completion confirmation (owner decision). Previously either party's single "Mark
  complete" tap (in practice the provider's) moved the trip straight to `completed`, which immediately
  settled it — debiting the requester's ServiceCredits wallet, or crediting the provider's earnings
  ledger for a fiat/crypto amount the platform never processed. That let one side unilaterally trigger a
  value movement. Now: a trip can only be advanced to `delivered` by the normal status route; from
  `delivered`, completion requires **both** the requester and the provider to confirm via the new
  `POST /api/trust-transport/trips/:tripId/complete` route (command `trust-transport.trip.completion.confirm`).
  The trip becomes `completed` and settles only on the second confirmation. `updateTripStatus` now rejects
  a non-admin `completed` transition with `completion_requires_confirmation` (admins keep a direct override,
  e.g. for dispute resolution). Schema: `trust_transport_trips` gains `requester_completion_confirmed_at`
  and `provider_completion_confirmed_at`. UI: the provider's Help-tab trip card and the requester's
  Tracking card both show a "Confirm trip completed" control on a delivered trip, then a "waiting for the
  other party" state after their own confirmation — web and Android. Contracts updated (command,
  access-policy, audit). This does not change the settlement mechanics themselves; it changes who must
  agree before settlement runs. (Open follow-up flagged to the owner: for non-SC settlement the platform
  has no payment processing — the exchange is peer-to-peer off-platform — so the fiat/crypto "earnings
  ledger + payout request" flow may be reworked so it no longer implies a platform-issued payout.)

- 2026-07-02: Cancel-request UI on both platforms. The `POST /api/trust-transport/orders/:orderId/cancel`
  route and `cancelOrder()` repository function already existed and were fully authorized (requester or
  admin only; forward-transition-checked so a completed/canceled request can't be re-canceled) but had
  no caller anywhere in the app — a member had no way to cancel a request they made. Added a "Cancel
  request" control to the Tracking tab (web `tt-tracking-tab.tsx`) and the Track tab (android
  `TrustTransport.tsx`, new `cancelOrder()` added to the mobile API client) for any of the member's own
  non-terminal requests (open, accepted, in progress), each behind an explicit confirmation prompt
  (`window.confirm` on web, a native `Alert` on android) per the "explicit confirmation for irreversible
  actions" security control. No schema/route/contract change — the endpoint already existed and was
  reviewed.

- 2026-07-02: Android earnings + payouts screen (parity with web slice 6, issue #1250). New
  `TrustTransportEarningsTab.tsx` — an "Earnings" tab in the bottom nav with per-currency balance cards
  (`getEarningsBalances`), a payout request form scoped to whichever currency is selected
  (`requestPayout(amount, currency)`), and payout history (`listPayouts`) — all reusing the existing
  mobile API client functions from the #1233 currency migration. No schema/route/contract change (every
  endpoint already existed and was reviewed). This was the last Android gap tracked under #1250; trip
  progression, proof capture, discovery/offer, view-offers/accept, and chat now all have Android parity.

- 2026-07-02: Android trip progression + proof capture (parity with web slices 4–5, issue #1250), plus
  chat wiring on both platforms. `TrustTransportHelpTab.tsx` gained a "Trips you're helping with" section
  (`listProviderTrips`, `updateTripStatus`, `captureProof` — all already-existing API client functions) with
  the same forward-only status controls and redacted-reference proof capture as web. New
  `TrustTransportChatButton.tsx` (button + full-screen RN `Modal`, mirroring the `ChymeTipModal.tsx`
  pattern since this app has no react-navigation) wraps the previously-orphaned `TrustTransportStreamTab`
  and is now shown on the Track tab's own-trip cards (once `tripId` is present — the mobile
  `TrustTransportRequest` type gained a `tripId` field mirroring web's, sourced from the same
  `listRequests` join that already returned it) and on Help-tab provider trip cards. Also found and fixed
  the same gap on web: `tt-help-tab.tsx`'s provider trip cards had no chat access (only the requester's
  Direct Line tab did) — added an inline `TripChat` toggle using the existing `StreamChatPanel` and the
  existing chat route (which already authorized either party). No schema/route/contract change — every
  endpoint used already existed and was reviewed. Corrected the `TRUST_TRANSPORT_PROFILE_AND_DELETION_CONTRACT.md`
  doc, which described a never-built `DELETE /api/account/trust-transport-profile` endpoint and four
  table names that never existed; service-scoped deletion has actually been live via the generic
  `DELETE /api/account/services/:slug` route since the `trust-transport` entry shipped in
  `deletion-registry.ts` — the doc now matches the real tables and their real delete/soft-delete/retain
  treatment. Documentation only for that file. Resolved the "Gaps and Known Technical Debt" list down to
  the items that are genuinely still open or intentionally not built (see that section) — closed the
  status-vocabulary item (the three-mode vocabulary has been stable and consistent throughout the shipped
  code; nothing concrete has needed a change) and the stale service-delete-endpoint item.

- 2026-07-01: Android view-offers + accept (parity with web slice 3, issue #1250). New
  `TrustTransportOffersSection.tsx` — shown on each of the caller's own **open** requests in the Track
  tab; loads pending offers via the mobile `listOffersForRequest` and accepts one via the fixed
  `acceptOffer(requestId, offerId)`. No schema/route/contract change (both endpoints already existed and
  are reviewed). Discovered and documented a separate, pre-existing gap while wiring this up: Android has
  no chat screen registered anywhere in the app (`TrustTransportStreamTab.tsx` is orphaned scaffold) — see
  "Gaps and Known Technical Debt". Trip progression, proof capture, and earnings/payouts screens for
  Android remain open follow-ups under #1250.

- 2026-07-01: Android provider discovery + make-an-offer (parity with web slice 2, issue #1250). New
  `TrustTransportHelpTab.tsx` — a "Help" tab in the bottom nav that lists open requests via the mobile
  `listAvailableRequests` (mode + settlement + age only, discovery model B — never pickup/drop-off) and
  submits an offer via `createOffer` (optional note + optional proposed amount), reusing the mobile API
  client shipped in the earlier foundation PR. No schema/route/contract change (both endpoints already
  existed and are reviewed). Trip progression, proof capture, and earnings/payouts screens for Android
  remain open follow-ups under #1250.

- 2026-07-01: Removed fabricated safety claims that survived on Android (completes the 2026-06-19 fix,
  which said "mobile public copy updated to match" but only touched the signed-out `PublicState`). The
  authenticated Book tab still said "Background-checked drivers"; the Track tab still showed a
  "🛡️ Background checked / ✅ ID verified" badge row per request card; and the post-booking confirmation
  said "being matched with nearby drivers" (there is no automated matching — a request goes `open` and
  members browse it to offer help). All three corrected to honest copy consistent with web. UI copy only
  — no schema, route, or contract change.

- 2026-06-30: Fiat/crypto earnings on completion + currency-aware payouts; closes issue #1233. (1) Money
  precision migration: `trust_transport_earnings_ledger.amount` and `trust_transport_payout_requests.amount`
  widened `INTEGER → NUMERIC`, and the earnings ledger gains a `trip_id UUID` column (via `ALTER ... IF
  EXISTS` on existing DBs; the CREATE blocks updated for fresh DBs). This also unbreaks the seed, which
  already inserted `trip_id` and a fractional amount. (2) On trip completion, non-SC priced settlement
  (fiat/crypto) now credits the provider's earnings ledger in that settlement currency (`trip_id`-keyed,
  idempotent), alongside the existing ServiceCredits move. (3) Balance + payout are now **currency-aware**:
  `getEarningsBalancesByCurrency` returns per-currency balances, `GET /earnings` returns `{ balances: [{ currency, balance }] }`,
  `requestPayout(userId, amount, currency, idempotencyKey)` validates against that currency's balance and
  stamps the payout + hold with it (no more hard-coded `USD`). The payout command contract gains a required
  `currency` input; `trip.status.update` `dataAccess` now lists `trust_transport_earnings_ledger`. (4) The
  Earnings tab shows a balance card per currency and a currency selector on the payout form.

- 2026-06-30: ServiceCredits settlement on trip completion (owner decision). When a trip transitions to
  `completed` and the requester chose **ServiceCredits** settlement (`price_currency = 'SC'` with a
  positive `price_amount`), `updateTripStatus` now moves the credits requester → provider via the
  service-credits `createTransfer` (rail: balance), keyed idempotently by trip id (`trust-transport-settlement-<tripId>`),
  and writes a `trust-transport.trip.settlement` audit event. It runs after the completion commits and is
  best-effort: a failure (e.g. the requester lacks balance) is logged for reconciliation rather than
  reverting the completed trip, and the trip-id key means a retry cannot double-pay. `trip.status.update`
  command `dataAccess` now lists the `service_credits_*` tables it touches on completion. No schema change.
  **Scope:** only ServiceCredits settlement moves value here — the provider is paid to their ServiceCredits
  wallet (not the TrustTransport earnings ledger). Fiat/crypto earnings crediting + currency-aware payouts
  (issue #1233) are a follow-up that needs an earnings-ledger migration (`amount INTEGER → NUMERIC`, add a
  `trip_id` column; the seed already assumes both).

- 2026-06-30: Earnings + payouts surface (web). New `GET /api/trust-transport/earnings` returns the
  caller's own available earnings balance (`getMyEarningsBalance`, wrapping the existing ledger sum). A
  new "Earnings" tab shows the available balance, a "Request a payout" form (posts to the existing
  `POST /payouts/requests`; blocked when the balance is zero and client-validated to the balance), and
  the payout history with per-row status (`GET /payouts`). The balance is shown as a plain number and no
  currency is asserted — the known payout-currency issue (#1233, `USD` hard-coded while the ledger can
  hold other currencies) is left for the owner as a separate ledger decision. No schema or contract
  change. Web only; Android parity tracked in #1250.

- 2026-06-30: Proof capture UI for the provider (web). Each active trip card in the "Help out" tab's
  "Trips you're helping with" section gains an "Add pickup/delivery proof" control: pick a type
  (Photo / Code / Note) and enter a short **redacted reference** (no raw images), which posts to the
  existing `POST /trips/:tripId/proof`. Copy makes clear it's stored as redacted dispute evidence. No
  schema, route, or contract change. Web only; Android parity tracked in #1250.

- 2026-06-30: Trip progression for the provider (web). New `GET /api/trust-transport/trips` lists the
  trips the caller is fulfilling (joined to the request for the now-revealed pickup/drop-off — they
  accepted, so model B allows it) via `listProviderTrips`. The "Help out" tab gains a "Trips you're
  helping with" section showing each active trip and a one-step-forward control (Start trip → Mark
  picked up → Mark delivered → Mark complete) that calls the existing `POST /trips/:tripId/status`.
  No schema or contract change. Web only; Android parity tracked in #1250.

- 2026-06-30: Requester can accept an offer in-app (web). The Tracking tab now loads the offers on each
  of your own open requests (`GET /requests/:requestId/offers`) and shows an Accept button per pending
  offer; accepting calls the existing `POST /offers/:offerId/accept`, which opens a trip. This is the
  point where — per discovery model B — the chosen provider gains the pickup/drop-off (the trip carries
  the full request). Previously offer acceptance was reachable only via the API/seed. Web only; Android
  parity tracked in #1250. No schema/route/contract change.

- 2026-06-30: Provider discovery + make-an-offer surface (web), discovery model B (owner decision). New
  `GET /api/trust-transport/requests/available` lists everyone's OPEN requests except the caller's own,
  returning **only mode + settlement + age** — never the pickup/drop-off text or the title (which embeds
  the locations). A survivor's whereabouts are not exposed to open browsing; the location reaches a
  provider only once the requester accepts their offer. The web shell gains a "Help out" tab
  (`tt-help-tab.tsx`) that lists available requests and submits an offer (optional note + optional amount)
  via the slice-1 `POST /requests/:requestId/offers`. No schema change. **Android parity deferred** —
  tracked for a follow-up pass.

- 2026-06-30: Removed the unbuilt "verified provider" role/tier (owner directive). There was never any
  in-app verification or a way to grant the `provider` role — it was only a role string read from the
  Clerk identity, gating two payout routes and nothing else. Deleted `ensureTrustTransportProviderRole`,
  the `requireTrustTransportProviderAccess` gate, and the `TRUST_TRANSPORT_PROVIDER_REQUIRED` error code.
  The payout routes (`GET /payouts`, `POST /payouts/requests`) now use member read access — payouts are
  already scoped to the caller's own earnings ledger by user id, so any member who has earned can request
  one. Dropped `provider` from the `requiredRoles` of the request.create, offer.create, trip.status.update,
  and payout.request access policies (the payout deny condition `actor_not_provider` → `actor_not_authenticated`),
  and removed "verified provider participation" / "provider eligibility flags" wording from the inventory.
  "Provider" remains only as a neutral domain term for whoever fulfils a request (the `provider_user_id`
  columns, the `provider_region`, the `provider_payouts` purpose) — not a gated, verified status.

- 2026-06-30: Added offer creation — the foundation of the provider/matching flow, which previously had
  no write path (offers existed only from seed data). New `POST /api/trust-transport/requests/:requestId/offers`
  with a `createOffer` repository function and `validateOfferInput`: a provider (or member) makes an offer
  (optional note + optional positive `proposedAmount`) on an **open** request they do not own. One pending
  offer per provider per request — re-offering updates the existing row rather than stacking duplicates.
  Restricted accounts are blocked; the route is CSRF-guarded and emits a `trust-transport.offer.create`
  audit event. Added the command to the command/access-policy/audit contracts. No schema change — the
  existing `trust_transport_offers` table is used. UI for browsing requests and making an offer follows in
  a later pass.

- 2026-06-30: Removed ratings entirely (owner directive: rating of people is not allowed). The feature
  was backend-only and never surfaced in the web or mobile app. Deleted: the `trust_transport_ratings`
  table (dropped in `schema.sql` and `schema.demo.sql`), the `POST /api/trust-transport/orders/:orderId/rating`
  route, `submitOrderRating` and `validateRatingInput` and the `TrustTransportRatingInput` type, the
  unused `TRUST_TRANSPORT_MAX_FEEDBACK_LENGTH` constant, and the `trust_transport_ratings` entry in the
  account-deletion registry. Reputation is now transparent completion history only — a trip is recorded
  as successfully completed or not (its existing terminal trip status); there are no ratings, reviews,
  star scores, written feedback, or reliability badges anywhere. No rating command exists in the
  contract files, so no contract change was needed.

- 2026-06-29: Code-review findings pass (issues #1113, #1204–#1208). (1) `GET /api/trust-transport/modes`
  now runs `requireTrustTransportReadAccess()` like every other read route — the mode list is no longer
  served to unauthenticated callers (#1206). (2) `POST /api/trust-transport/service-credits` now rejects a
  self-transfer (`toUserId === actor`, 400) and emits a `trust-transport.service-credits.transfer` audit
  event after a successful `createTransfer` (#1204, #1205); the new audited command is added to
  `TRUST_TRANSPORT_PLUGIN_AUDIT_CONTRACTS.yaml`. (3) Web `tt-sidebar` "My Trips" now reads
  `pickupCity`/`dropoffCity` (with the legacy `fromLocation`/`toLocation` and title fallbacks) instead of
  the never-returned `fromLocation`/`toLocation`, so cards no longer always show "— → —" (#1113). (4) Mobile
  `TrustTransportStreamTab` is typed with `StreamChat` instead of `any` (#1207). Verified already-correct and
  closed as not planned: `offer.accept` ownership is enforced in `acceptOffer` (#1118), `requestPayout`
  already rejects non-finite/non-positive amounts (#1120), and the trip-chat route reads no request body so a
  missing `Content-Type` header is inert (#1208). No schema changes.

- 2026-06-27: Code-review findings pass (issues #1113–#1122). (1) Member-facing mutation routes now emit
  audit events to `trust_transport_admin_audit_trail`, matching the audit contract: `request.create`
  (requests route), `offer.accept` (offers accept route), `trip.status.update` (trip status route), and
  `payout.request` (payouts requests route) — previously only admin routes wrote audit rows. (2) Trip
  chat fix: the requests list API now returns `tripId` (LEFT JOIN to `trust_transport_trips`), and the
  web shell opens chat with the trip id instead of the request id, so accepted trips no longer 404; when
  no trip exists yet the chat tab shows "Chat opens once a driver accepts this request." (3) Service-credits
  POST route now runs the CSRF check before the auth check, consistent with every other mutation route.
  Verified already-correct guards and closed as completed: `offer.accept` ownership (`actorMustOwnRequest`)
  is enforced in `acceptOffer` (`request.requesterUserId !== actorUserId` → 403), and `requestPayout`
  already rejects non-finite/non-positive amounts (→ 400) and checks available balance (→ 403); payout
  ownership comes from the authenticated user id, so no `providerId` body field is needed. No schema or
  contract changes; `tripId` is an additive read-only response field.

- 2026-06-26: Hyphenation/cleanup rename (hard cutover, no back-compat alias). The plugin slug, folder
  names, every route, and the command/audit namespace moved from `trusttransport` to the kebab-case
  `trust-transport` (so `/api/trusttransport/*` no longer exists — `/api/trust-transport/*` is the only
  surface; the app shell at `/apps/trust-transport`, the admin surface at `/admin/trust-transport`, the
  web components, and the mobile API client were all repointed). The database tables were renamed in the
  same pass to the matching snake_case prefix: every `trusttransport_*` table became `trust_transport_*`
  (`trust_transport_requests`, `_status_events`, `_offers`, `_trips`, `_risk_signals`, `_disputes`,
  `_ratings`, `_market_config`, `_user_extension`, `_proof_artifacts`, `_payout_requests`,
  `_earnings_ledger`, `_admin_audit_trail`), and the named price-consistency CHECK constraint moved to
  `trust_transport_requests_price_consistency_check`. `schema.sql` and `schema.demo.sql` run
  `ALTER TABLE IF EXISTS ... RENAME TO ...` before the `CREATE ... IF NOT EXISTS` blocks (and drop the
  legacy-named constraint), so an existing database keeps its rows and a fresh database builds the new
  names directly — no data loss. Cross-plugin references were updated too: the Trust trip-count query and
  its signal type (`engagement-trust-transport-trips`), the GDP recognition query + `recognizeGdp.mjs`,
  the feed targeting id, member-presence derivation, the account-deletion registry, the theme accent keys
  (web + mobile), the plugin registry (slug + schema seed row), the concierge intent/featured slug, the
  parity contract, and the four contract files (`TRUSTTRANSPORT_*` → `TRUST_TRANSPORT_*`). The pre-existing
  `'trust-transport'` slug alias in `repository.ts` and the duplicate token key in `shell-plugin-config.ts`
  were removed (the slug is now canonical, so no alias is needed). The slug and the table prefix now match
  (`trust-transport` ↔ `trust_transport_`). PascalCase identifiers (`TrustTransport`, `TrustTransportShell`,
  `requireTrustTransportAdminAccess`, the `trustTransportErrorResponse` helper, etc.) read as the proper
  noun "Trust Transport" and were left unchanged.

- 2026-06-19: Removed safety claims the platform cannot back, and stopped overstating tracking (owner-reported). The right-panel "Safety Features" list (Background Checked / Emergency SOS / Identity Verified / Real-time Tracking) was fabricated — none are implemented — so it was replaced with an honest "Good to know" panel of user-side reminders (community mutual aid, share your trip, meet in public) that assert no platform capability. Dropped "All drivers background-checked" from the booking subtitles and the public landing copy; drivers are described as fellow community members. Renamed "Live Tracking" → "Tracking" and removed the fake "live map" copy: there is no realtime GPS feed (Uber-style live tracking is not affordable/built); the tracking tab shows manual status updates only. Softened the "Safety-First" badge/tagline to "Community". Left-rail cleanup: the book tab uses a distinct MapPin glyph so the Car no longer shows twice, the dead Bell/Settings buttons were removed, and the static "S" avatar is now the live Clerk account menu. Mobile public copy updated to match. UI copy/icon only — no schema, route, or contract change.
- 2026-06-15: Account restriction migrated to the platform-wide signal (#528). `ensureUserNotRestricted` now reads the shared `account_restrictions` (`trading` scope) instead of `trusttransport_user_extension.account_restricted`; `restrictAccount`/`restoreAccount` write the shared signal (and keep the TrustTransport-specific `trusttransport_risk_signals` evidence rows). The admin restrict/restore endpoints and UI are unchanged. The per-plugin restriction columns are retired in code (not dropped) and backfilled into `account_restrictions`. A TrustTransport restriction now applies platform-wide (e.g. it also blocks ServiceCredits spending). See `ctf/docs/developer/specs/account-restrictions-spec.md`.
- 2026-06-13: Web admin — account restrict/restore. Added an Accounts tab (`components/trusttransport/trusttransport-admin-accounts.tsx`) with a user-ID + reason form and Restrict / Restore actions, wired to the existing `POST /api/trusttransport/admin/accounts/:userId/restrict` (with reason) and `…/restore` endpoints (with `x-ctf-csrf: '1'`). There is no account-list endpoint, so the admin acts by user ID (copied from the incident under review). Split into its own component for the rule-116 size budget. No new endpoint, schema, or contract.
- 2026-06-13: Web admin design pass. Replaced the bare diagnostic `/admin/trusttransport` page with `components/trusttransport/trusttransport-admin-shell.tsx`, styled to the admin design system (header with icon + ADMIN badge, snapshot stat blocks, Incidents / Market controls / Audit tabs). Bound to the real backend — `listIncidents`, `getMarketConfig`, `listAuditEvents`. Real actions on existing endpoints (with `x-ctf-csrf: '1'`): resolve an open incident (`POST /api/trusttransport/admin/incidents/:id/resolve`) and save market controls — max concurrent trips, require-proof-on-delivery, and the emergency freeze — (`PUT /api/trusttransport/admin/market-config`); audit is a read-only list. Account restrict/restore endpoints exist but are not yet surfaced in this slice. No new endpoint, schema, or contract.
- 2026-06-12: The Android TrustTransport API clients (`api.ts`, `admin-api.ts`, `fetchTrustTransportStreamCredentials.ts`) now use the shared authenticated fetch helper, which attaches the signed-in user's Clerk bearer token and reads the server address from runtime config (`APP_URL`), replacing plain fetch calls against hardcoded development URLs; the admin client's hand-passed token parameter (which the screen filled with the user id, not a real token) was removed, and the trip chat credential fetcher now maps the route's real response fields (`streamApiKey`/`streamUserId`/`streamToken`/`channelId`). No schema, route, or contract change.
- 2026-06-12: Removed out-of-scope video from the trip thread and fixed the trip chat. The orphaned Android `TrustTransportStreamTab` rendered a Stream **video** room (and read a `callId` the server never issued), but TrustTransport is a transport-coordination plugin with no video on the web and no video in its product scope — the component was unreferenced scaffold. Rather than wire up video, the tab is now **text chat only** (matching the web chat tab). `POST /api/trusttransport/trips/:tripId/chat` no longer returns a video `callId`; it now returns `streamChannelId` so the web chat tab connects to the real trip channel instead of falling back to the raw trip id. On Android, `fetchTrustTransportStreamCredentials` uses the platform base URL (a relative `/api/...` URL never resolves in React Native) and maps the canonical `stream*` fields. No schema change.
- 2026-06-12: Hardened settlement-price validation (follow-up to #420). The request route now parses `priceAmount` strictly — only a real number or a non-empty numeric string becomes an amount, so values like `true` or `[5]` no longer coerce into a price. The repository write path (`createRequest`) now calls `isValidRequestPrice` and rejects an invalid currency/amount combination before the database write, so a caller that bypasses the route guard cannot persist a row that violates the settlement contract. The Book-a-Ride form (web `tt-book-tab.tsx` + shell, Android `TrustTransport.tsx`) blocks submitting a priced request with a missing or non-positive amount (inline error + disabled button) instead of failing with a generic server error. No schema or new route.
- 2026-06-12: Adopted the shared currency selector on "Book a Ride" (issue #420). A ride request now names **how the requester will settle it** — default **Free** (asking for a free ride is valid mutual aid), or ServiceCredits / fiat / crypto / Barter. Data model: `trusttransport_requests` gains `price_currency` (FK → `currencies.code`) + `price_amount` with a price-consistency check allowing amount-less named types (Free, Barter — currency set, amount null), priced types (positive amount + currency), or none (both null). `POST /api/trusttransport/requests` parses `priceCurrency`/`priceAmount` and validates them against the catalog via `isValidRequestPrice` (amount required only for priced types). UI: the Book-a-Ride form (web `tt-book-tab.tsx`, Android `TrustTransport.tsx` BookTab) shows the value-type selector with the amount input hidden for Free/Barter; the tracking/request views show a settlement badge via `ttSettlementLabel` (never the bare `SC` code, never a fiat equivalent for ServiceCredits). Backward-compatible: existing requests read as "Free". TrustTransport completed-task earnings remain the existing Community Value Index source (#121); this adds the requester's stated settlement to the request.
- 2026-06-06: Android admin parity — added `packages/mobile/src/features/trusttransport/AdminTrustTransport.tsx` plus the admin API client `admin-api.ts`, exported `AdminTrustTransport` from `index.ts`, and registered the `trusttransport-admin` feature in `packages/mobile/App.tsx`. The screen mirrors the shipped web admin (`/admin/trusttransport`): incident queue with resolve, market controls update, account restrict/restore, and audit trail — binding only the existing admin endpoints (`GET /admin/incidents`, `POST /admin/incidents/:id/resolve`, `GET/PUT /admin/market-config`, `POST /admin/accounts/:userId/restrict`, `POST /admin/accounts/:userId/restore`, `GET /admin/audit-events`). No new backend, schema, route, or contract. Admin gate is server-side (`requireTrustTransportAdminAccess`); non-admins see an "admins only" notice. State-changing actions confirm via a native `Alert` and send `x-ctf-csrf: '1'`. Confirmed the web admin is already mobile-responsive (single-column stacking, responsive stat grid) — no web layout change. Gap: the design mockup's "approve/reject trip request queue" has no backing endpoint (there is no admin trip-approval route); the queue rendered is the incident queue the API actually exposes, per the real-data-only rule.
- 2026-06-03: Fixed a crash that made `/apps/trusttransport` fail to load ("This page couldn't load"). The shell read the API response bodies directly (`as Mode[]` / `as TripRequest[]`), but `/api/trusttransport/modes` returns `{ ok, modes: string[] }` and `/api/trusttransport/requests` returns `{ ok, items, page, ... }`. So `modes`/`requests` became the wrapper objects, and `deriveRideTypes(modes)` (plus the tracking/chat tabs) called `.map` on an object, throwing during render and taking the whole page down. Now the shell extracts `.modes` (mapping the strings to `{ id, name }`) and `.items`, and `deriveRideTypes` is hardened against non-arrays and missing fields. The loading state now uses the shared `AppLoading` and the duplicate `tt-loading.tsx` was deleted. No schema/route/contract changes.
- 2026-06-01: Multi-currency (issue #120): added `price_currency` (FK → `currencies.code`) to `trusttransport_payout_requests` and `trusttransport_earnings_ledger`, superseding the legacy free-text `currency` column, with a safe backfill that never overwrites money data. Documented the no-fiat-parity rule. The GDP estimation layer (issue #121) reads `price_currency`.

- 2026-05-31: Android pixel pass — rewrote `TrustTransport.tsx` to align with `design/.../survivor-hub/MobileTrustTransport*.tsx` (main, empty, loading, public states). Binds real `/api/trusttransport/requests` (list + create). Omits unbacked mockup elements (Nearby Drivers list, driver ratings/ETAs/vehicle info, online driver count) per real-data-only rule. Retired `MockTrustTransport.tsx` (cleared). `AuthProvider` + `TrustTransport` exports preserved. No schema/route/contract changes.
- 2026-05-30: Web pixel pass — aligned the shell to `design/.../survivor-hub/TrustTransport.tsx` and decomposed the 358-line / complexity-28 monolith into modular sub-components (`tt-shared.ts`, `tt-loading.tsx`, `tt-icon-rail`, `tt-sidebar`, `tt-book-tab`, `tt-tracking-tab`, `tt-chat-tab`, `tt-right-panel`, thin shell) within rule-116 limits. Per real-data-only, stripped remaining unbacked values (hardcoded "Safety Rating 4.9" and "Safety Incidents 0 today") and aligned GetStream-branded copy to the design's "End-to-end encrypted" / "All comms encrypted" wording (Stream chat integration unchanged). Dropped the unused `userId`/`isAdmin` props at the call site. No schema/route/contract changes.
- 2026-05-18: Inventory updated to enforce Rule 120 living-snapshot model. Removed "(Planned)" annotation from the HTTP Projection Routes heading and removed "Planned" prefixes on command groups, extension entities, and domain entities. Synced route list (added trips chat, emergency-stop, service-credits) and table list (added `market_config`, `admin_audit_trail`; removed unshipped `deliveries`, `food_orders`) with `ctf/schema.sql` and `ctf/packages/web/app/api/trusttransport/`. Confirmed `web+android complete`.
- 2026-05-17: Updated inventory to enforce Rule 120 living-snapshot model. Removed Phase language (Delivery Phasing section) and unresolved decisions list.
- 2026-04-06: Mobile rewrite with design-faithful UI (TrustTransport.tsx) for booking, tracking, chat flows and auth-gating. Admin features pending.
- 2026-02-24: Created initial CTF rewrite inventory for TrustTransport (net-new plugin) with user/admin/API/data/security/parity scope.
- 2026-05-31: Documented the transaction-scoped messaging lifecycle per platform rule 100 ("Messaging Scope and Lifecycle"): the per-trip 1:1 chat opens with the trip and closes on terminal state (read-only window + retained for moderation/abuse evidence); no messaging outside an active trip. Aligning the deletion contract to mirror this retention is a tracked follow-up.


## Build Checklist


### Scope and Boundary

- [ ] Confirm implementation scope is `ctf/` only.
  - Acceptance criteria:
    - No code changes required in `platform/`.
- [ ] Confirm TrustTransport plugin ID and command namespace.
  - Acceptance criteria:
    - Stable plugin ID and command naming convention approved.
- [ ] Confirm parity policy (web + Android) for critical flows.
  - Acceptance criteria:
    - Ride/package/food booking and safety controls marked parity-required.

### �� Contract Lock

- [ ] Define plugin command contracts for v1.
  - Acceptance criteria:
    - Every command includes required fields from `201-plugin-command-schema-template.mdc`.
- [ ] Define access policy contracts for v1 commands.
  - Acceptance criteria:
    - Every command includes roles, consent, region restrictions, and deny conditions from `202-plugin-access-policy-schema-template.mdc`.
- [ ] Define audit event contracts for v1 commands.
  - Acceptance criteria:
    - Every command logs allow/deny + result using `203-plugin-audit-schema-template.mdc`.
- [ ] Resolve open business/policy decisions.
  - Acceptance criteria:
    - Launch regions, payout policy, verification, cancellation/refunds, and dispute SLA are approved.

### �� Schema and Migrations

- [ ] Implement TrustTransport extension model on canonical profile.
  - Acceptance criteria:
    - No duplicate standalone profile table; extension keyed by `user_id`.
- [ ] Implement core domain tables and relationships.
  - Acceptance criteria:
    - Requests/offers/trips/deliveries/orders/events/proofs/disputes/ledger/payouts exist with constraints.
- [ ] Add migration SQL under `ctf/migrations/`.
  - Acceptance criteria:
    - Migration replay and rollback plan validated.
- [ ] Define retention class metadata per entity.
  - Acceptance criteria:
    - Retention class documented for proof, events, disputes, and financial records.

### �� API and Command Execution

- [ ] Implement request/create and offer/list/accept flows.
  - Acceptance criteria:
    - Idempotent create/update behavior with validation and authz checks.
- [ ] Implement lifecycle status updates and proof capture.
  - Acceptance criteria:
    - State transitions are valid, auditable, and recoverable on failure.
- [ ] Implement cancellation and payout request flows.
  - Acceptance criteria:
    - Policy rules and edge-case errors are deterministic.
- [ ] Implement admin dispute/risk/market-config APIs.
  - Acceptance criteria:
    - Admin mutation endpoints enforce role + CSRF + audit logging.

### �� Web Delivery

- [ ] Build unified mode-selection and booking UX (ride/package/food).
  - Acceptance criteria:
    - Users can complete end-to-end booking per mode.
- [ ] Build provider/courier/driver action surfaces.
  - Acceptance criteria:
    - Accept, pickup, dropoff, proof, completion are fully operable.
- [ ] Build tracking/status and communication surfaces.
  - Acceptance criteria:
    - Real-time or near-real-time updates with clear state labels.
- [ ] Build earnings/payout and completion-history surfaces.
  - Acceptance criteria:
    - Earnings, payout requests, and completion history visible. No ratings, reviews, scores, or reliability indicators.

### �� Android Delivery

- [ ] Implement critical path parity for booking and tracking.
  - Acceptance criteria:
    - Ride/package/food flows match web outcomes.
- [ ] Implement safety/consent/deletion parity.
  - Acceptance criteria:
    - Safety and privacy controls are behaviorally equivalent to web.
- [ ] Validate accessibility and trauma-informed constraints on Android.
  - Acceptance criteria:
    - Critical journeys pass accessibility checks and avoid overload patterns.

### �� Admin, Compliance, and Hardening

- [ ] Build admin trust-and-safety operations UI.
  - Acceptance criteria:
    - Incident triage, account restriction/restoration, and decisions are auditable.
- [ ] Build admin disputes and refunds UI.
  - Acceptance criteria:
    - Evidence-driven adjudication with reason codes and financial adjustments.
- [ ] Add observability hooks and error budgets.
  - Acceptance criteria:
    - Command errors, latency, and failure classes are measurable.
- [ ] Validate plugin deletion and full-account deletion behavior.
  - Acceptance criteria:
    - Plugin-scoped deletion preserves canonical profile and other plugin data; full-account flow executes cross-plugin deletion policy.

### Validation, Seeds, and Release Gates [MVP: VALIDATION DEFERRED — see Rule 118.]

- [ ] Command schema design documentation.
  - Acceptance criteria:
    - Unknown fields/invalid types/bounds failures handling is documented.
- [ ] Access policy enforcement design documentation.
  - Acceptance criteria:
    - Missing consent, wrong role, cross-tenant, and region restriction denial cases are documented.
- [ ] Audit integrity design documentation.
  - Acceptance criteria:
    - Allow + deny events append-only and correlation fields documentation.
- [ ] Lifecycle/disputes/payouts behavior design documentation. [MANUAL TESTING DEFERRED FOR MVP — see Rule 118.]
  - Acceptance criteria:
    - Core transactional paths and failure recovery requirements are documented.
- [ ] Web and Android parity design scope. [PARITY TESTING DEFERRED FOR MVP — see Rule 118.]
  - Acceptance criteria:
    - Critical journeys parity requirements are documented for post-MVP testing.
- [ ] Deterministic seed scenarios.
  - Acceptance criteria:
    - Seeded scenarios are reproducible via deterministic seed scripts/data.

### Documentation and Inventory Lifecycle

- [ ] Keep `ctf-trust-transport-feature-inventory.md` updated per accepted scope change.
  - Acceptance criteria:
    - Any add/remove/behavioral change updates inventory in same PR.
- [ ] Record deprecations/removals in inventory changelog.
  - Acceptance criteria:
    - Removed features are moved to dated changelog entries.
- [ ] Implementation tracking. [EVIDENCE COLLECTION DEFERRED FOR MVP — see Rule 118.]
  - Acceptance criteria:
    - Implementation status is tracked; evidence collection deferred to post-MVP.

### Open Decisions Tracker

- [ ] Launch region set and service-zone rules.
- [ ] Verification/KYC requirements by mode.
- [ ] Payout methods and settlement windows.
- [ ] Cancellation/refund policy matrix.
- [ ] Safety escalation owner and protocol.
- [ ] Retention classes for proof and messaging artifacts.
