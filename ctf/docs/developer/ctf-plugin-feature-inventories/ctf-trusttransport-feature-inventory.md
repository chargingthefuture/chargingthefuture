# TrustTransport Plugin Feature Inventory (CTF Rewrite)

## Scope

- Rewrite target only: `ctf/`
- Legacy reference excluded from implementation: `platform/`
- Plugin name: `TrustTransport`
- Primary mission scope:
  - peer-to-peer rides,
  - peer-to-peer package delivery,
  - peer-to-peer food delivery.

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

All command contracts must conform to templates from:

- `201-plugin-command-schema-template.mdc`
- `202-plugin-access-policy-schema-template.mdc`
- `203-plugin-audit-schema-template.mdc`

Planned command groups:

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

## HTTP Projection Routes (Planned)

User routes:

- `GET /api/trusttransport/modes`
- `POST /api/trusttransport/requests`
- `GET /api/trusttransport/requests/:requestId`
- `GET /api/trusttransport/requests/:requestId/offers`
- `POST /api/trusttransport/offers/:offerId/accept`
- `POST /api/trusttransport/trips/:tripId/status`
- `POST /api/trusttransport/trips/:tripId/proof`
- `POST /api/trusttransport/orders/:orderId/cancel`
- `POST /api/trusttransport/orders/:orderId/rating`
- `POST /api/trusttransport/payouts/requests`
- `GET /api/trusttransport/payouts`

Admin routes:

- `GET /api/trusttransport/admin/incidents`
- `POST /api/trusttransport/admin/incidents/:incidentId/resolve`
- `POST /api/trusttransport/admin/accounts/:userId/restrict`
- `POST /api/trusttransport/admin/accounts/:userId/restore`
- `PUT /api/trusttransport/admin/market-config`
- `GET /api/trusttransport/admin/audit-events`

---

## Data Model and Storage Contracts

### 4.1 Canonical Profile and Plugin Extension

Must follow single-profile rule:

1. Reuse canonical user profile for identity/preferences/safety controls.
2. Add plugin extension data linked by `user_id` only.
3. No separate full profile table for TrustTransport.

Planned extension entity:

- `trusttransport_user_extension`
  - `user_id`
  - mode preferences,
  - trust/safety settings,
  - payout preference metadata,
  - provider eligibility flags.

### 4.2 Domain Entities

Planned domain tables (initial set):

1. `trusttransport_requests`
2. `trusttransport_offers`
3. `trusttransport_trips`
4. `trusttransport_deliveries`
5. `trusttransport_food_orders`
6. `trusttransport_status_events`
7. `trusttransport_proof_artifacts`
8. `trusttransport_disputes`
9. `trusttransport_ratings`
10. `trusttransport_earnings_ledger`
11. `trusttransport_payout_requests`
12. `trusttransport_risk_signals`

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

1. Core booking/tracking/completion parity required on both platforms.
2. Safety, consent, and deletion controls cannot be platform-deferred.
3. UI layout may differ by platform, but command outcomes and status semantics must match.
4. Any deferred parity requires owner + due date + risk note.

---

## Seed Coverage Status

Seed script requirement: Provide a deterministic plugin seed script with dummy development data for manual plugin validation in dev environments.

---

## Gaps and Known Technical Debt

1. Status vocabulary design across three modes (ride/package/food) may need refinement based on real operational needs.
2. Event volume and audit storage growth will require archival/retention policy once deployed at scale.
3. Command contract complexity should be monitored to prevent drift from UI flow logic.

## Change Log

- 2026-05-17: Updated inventory to enforce Rule 120 living-snapshot model. Removed Phase language (Delivery Phasing section) and unresolved decisions list. Kept core user/admin/API/data/security features as implemented/planned inventory sections. Clarified technical debt (status vocab refinement, event archival strategy, command contract drift) as known limitations, not unimplemented features. Mobile implementation with booking/tracking/chat UI confirmed.
- 2026-04-06: Mobile rewrite with design-faithful UI (TrustTransport.tsx) for booking, tracking, chat flows and auth-gating. Admin features pending.
- 2026-02-24: Created initial CTF rewrite inventory for TrustTransport (net-new plugin) with user/admin/API/data/security/parity scope.
