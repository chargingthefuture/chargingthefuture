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
4. Quote request lifecycle (requested → provider_responded → closed) with immutable timeline view.
5. Connection and quote history lists scoped by actor ownership.
6. In-app notifications for messages, quote state changes, and missed calls.
7. Notification preferences and quiet-hour controls.

## Target Admin Features

1. Capacity policy control under Stream Maker-tier limits with threshold handling (green/yellow/orange/red).
2. Kill-switch and degrade controls for non-critical behavior under quota pressure.
3. Operational review of denied command decisions and reason-code trends.
4. Policy diagnostics for consent, region, and role-driven denials.
5. Rate-limit tuning by command family.
6. Quota threshold transition alerts and recovery controls.

## API Surface and Route Map

User routes:

- `GET /api/foundation/providers/search`
- `POST /api/foundation/connections/threads`
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

Foundation-owned domain entities:

1. `foundation_user_extension` — User Foundation plugin extension data.
2. `foundation_connection_threads` — 1:1 survivor-provider threads.
3. `foundation_thread_participants` — Thread participant roster.
4. `foundation_message_metadata` — Message history with delivery/read state.
5. `foundation_call_sessions` — Voice/video call session records.
6. `foundation_quote_requests` — Quote request lifecycle records.
7. `foundation_quote_status_events` — Quote state transition log.
8. `foundation_notification_preferences` — User notification opt-in/opt-out settings.
9. `foundation_notification_events` — Notification delivery history.
10. `foundation_rate_limit_counters` — Per-command rate limiting state.
11. `foundation_quota_threshold_states` — Current quota threshold level (green/yellow/orange/red).
12. `foundation_capacity_policies` — Admin-configured capacity limits and thresholds.
13. `foundation_admin_audit_trail` — Admin action audit log.

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

Parity status: **web+android complete**.

## Seed Coverage Status

Deterministic Foundation seed script: `ctf/scripts/seedFoundationPhase0.mjs`.

Seeded content:
- Sample survivors and providers with deterministic states.
- Sample connection threads and messages.
- Sample quote requests in various lifecycle states.

## Gaps and Known Technical Debt

1. Final quote payload schema by service category requires explicit product + compliance documentation (currently implementation-driven).
2. Voice/video fallback interaction copy finalization pending survivor-advisory review.
3. Notification channel rollout order and region targeting remain operational decisions.
4. Capacity policy defaults based on monthly demand assumptions need ongoing validation.

## Change Log

- 2026-05-17: Updated inventory to enforce Rule 120 living-snapshot model. Removed Phase language (Delivery Phasing sections), Planned section headers, and planning ambiguities. Confirmed web+android complete delivery status. Clarified technical debt (quote schema, fallback copy, notification strategy, capacity assumptions) as known limitations, not unimplemented features.
- 2026-02-24: Created initial Foundation CTF rewrite inventory with full-v1 scope for search, 1:1 text/voice/video, quote lifecycle, history, notifications, rate limiting, and scalability.
