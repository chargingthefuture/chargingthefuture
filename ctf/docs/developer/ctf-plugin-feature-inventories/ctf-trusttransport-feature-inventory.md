# TrustTransport Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Plugin name: `TrustTransport`
- Plugin slug: `trusttransport`
- Owned surfaces: `/apps/trusttransport` (web), `packages/mobile/src/features/trusttransport` (Android), `/api/trusttransport/*` routes, `trusttransport_*` tables.
- Not owned: identity (Clerk), service credits ledger (service-credits plugin), notifications/email transport (notifications integration).
- Primary mission scope: peer-to-peer rides, package delivery, and food delivery.

## Intent and Outcome

TrustTransport is a trauma-informed, safety-first logistics marketplace plugin for survivors to:

1. request and fulfill rides,
2. request and fulfill package delivery,
3. request and fulfill food delivery,
4. earn income through verified provider participation,
5. build reputation and trust through transparent completion history.

The plugin must provide equivalent core behavior across web and Android.

---

## Target User Features

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
   - complete and rate.
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
2. In-context communication channel for each order/trip.
3. Clear non-technical status and failure messaging.

### 1.6 Earnings, Payouts, and Reputation

1. Provider earnings ledger per completed task.
2. Payout request and payout status visibility.
3. Dual-sided ratings/reviews with abuse-report capability.
4. Reliability badges based on completion, cancellation, and dispute outcomes.

---

## Target Admin Features

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

1. `trusttransport.request.create`
2. `trusttransport.offer.list`
3. `trusttransport.offer.accept`
4. `trusttransport.trip.status.update`
5. `trusttransport.delivery.proof.capture`
6. `trusttransport.order.cancel`
7. `trusttransport.chat.message.send`
8. `trusttransport.rating.submit`
9. `trusttransport.payout.request`
10. `trusttransport.admin.dispute.resolve`
11. `trusttransport.admin.account.restrict`
12. `trusttransport.admin.market.config.update`

## HTTP Projection Routes

User routes:

- `GET /api/trusttransport/modes` — Available transport modes.
- `POST /api/trusttransport/requests` — Create a request.
- `GET /api/trusttransport/requests/:requestId` — Request detail.
- `GET /api/trusttransport/requests/:requestId/offers` — Offers on a request.
- `POST /api/trusttransport/offers/:offerId/accept` — Accept an offer, opening a trip.
- `POST /api/trusttransport/trips/:tripId/status` — Update trip status.
- `POST /api/trusttransport/trips/:tripId/proof` — Capture pickup/delivery proof.
- `POST /api/trusttransport/trips/:tripId/chat` — Send chat in trip thread.
- `POST /api/trusttransport/trips/:tripId/emergency-stop` — Safety emergency-stop control.
- `POST /api/trusttransport/orders/:orderId/cancel` — Cancel an order.
- `POST /api/trusttransport/orders/:orderId/rating` — Submit a rating.
- `GET /api/trusttransport/payouts` — Payout history.
- `POST /api/trusttransport/payouts/requests` — Request a payout.
- `POST /api/trusttransport/service-credits` — Service-credit interactions for trip economics.

Admin routes:

- `GET /api/trusttransport/admin/incidents` — Incident queue.
- `POST /api/trusttransport/admin/incidents/:incidentId/resolve` — Resolve an incident.
- `POST /api/trusttransport/admin/accounts/:userId/restrict` — Restrict an account.
- `POST /api/trusttransport/admin/accounts/:userId/restore` — Restore a restricted account.
- `PUT /api/trusttransport/admin/market-config` — Update market configuration.
- `GET /api/trusttransport/admin/audit-events` — Read admin audit trail.

---

## Data Model and Storage Contracts

### 4.1 Canonical Profile and Plugin Extension

Single-profile rule is enforced:

1. Canonical user profile is reused for identity/preferences/safety controls.
2. Plugin-specific extension data is linked by `user_id` only.
3. No separate full profile table for TrustTransport.

Extension entity:

- `trusttransport_user_extension` — mode preferences, trust/safety settings, payout preference metadata, provider eligibility flags, linked by `user_id`.

### 4.2 Domain Entities

Tables owned by this plugin:

1. `trusttransport_requests` — Request rows across ride/package/food modes.
2. `trusttransport_offers` — Offers placed by providers on a request.
3. `trusttransport_trips` — Accepted-offer trips with lifecycle state.
4. `trusttransport_status_events` — Append-only event log for status transitions.
5. `trusttransport_proof_artifacts` — Pickup/delivery proof captures (photo, code, signature references).
6. `trusttransport_disputes` — Dispute records and adjudication state.
7. `trusttransport_ratings` — Dual-sided ratings/reviews.
8. `trusttransport_earnings_ledger` — Earnings entries per completed task.
9. `trusttransport_payout_requests` — Provider payout requests and status.
10. `trusttransport_risk_signals` — Fraud/risk signals captured for monitoring.
11. `trusttransport_market_config` — Region/service-zone/fee/commission/capacity configuration.
12. `trusttransport_admin_audit_trail` — Admin mutation audit log.

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

`web+android complete`. Web surface lives under `/apps/trusttransport`; Android surface lives under `packages/mobile/src/features/trusttransport`. Booking, tracking, completion, safety controls, and deletion behave consistently across platforms.

---

## Seed Coverage Status

`ctf/scripts/seedTrustTransportPhase2.mjs` seeds deterministic request/offer/trip/proof/dispute/rating data for dev validation.

---

## Gaps and Known Technical Debt

1. Status vocabulary design across three modes (ride/package/food) may need refinement based on real operational needs.
2. Event volume and audit storage growth will require archival/retention policy once deployed at scale.
3. Command contract complexity should be monitored to prevent drift from UI flow logic.

## Change Log

- 2026-05-18: Inventory updated to enforce Rule 120 living-snapshot model. Removed "(Planned)" annotation from the HTTP Projection Routes heading and removed "Planned" prefixes on command groups, extension entities, and domain entities. Synced route list (added trips chat, emergency-stop, service-credits) and table list (added `market_config`, `admin_audit_trail`; removed unshipped `deliveries`, `food_orders`) with `ctf/schema.sql` and `ctf/packages/web/app/api/trusttransport/`. Confirmed `web+android complete`.
- 2026-05-17: Updated inventory to enforce Rule 120 living-snapshot model. Removed Phase language (Delivery Phasing section) and unresolved decisions list.
- 2026-04-06: Mobile rewrite with design-faithful UI (TrustTransport.tsx) for booking, tracking, chat flows and auth-gating. Admin features pending.
- 2026-02-24: Created initial CTF rewrite inventory for TrustTransport (net-new plugin) with user/admin/API/data/security/parity scope.
