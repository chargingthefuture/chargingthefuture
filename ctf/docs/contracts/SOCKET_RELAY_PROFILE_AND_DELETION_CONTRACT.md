# SocketRelay Profile and Deletion Contract (Draft)

## 1) Plugin Metadata

- Plugin Name: SocketRelay
- Service Key (lowercase, stable): `socket-relay`
- Owner Team: Realtime Platform (proposed)
- Rollout Stage: Planning

## 2) Canonical Profile Usage

Rule 114 baseline: SocketRelay uses canonical identity and plugin extension rows keyed by `user_id`.

- Read fields:
  - `user_id`
  - display name
  - role/workspace membership
- Write fields:
  - none to canonical profile
- Why canonical fields are needed:
  - authenticated relay authorization and channel membership ownership

## Identity Handle Baseline

- Canonical handle source: the active auth provider's canonical `username` or equivalent handle field (see `ctf/docs/contracts/PLUGIN_IDENTITY_HANDLE_BASELINE.md`).
- Plugin must not create plugin-local username ownership models.
- If the canonical provider handle is missing, use non-handle display fallback and treat `@mention` targeting as unavailable.
- Any persisted username snapshot fields must be derived from the canonical provider handle at write time.

## 3) Plugin Extension Fields

- Storage location (table or json path): `socket_relay_user_extension`
- Fields:
  - field name: `user_id`
    - type: uuid
    - nullable/default: non-null, unique, FK to canonical profile
    - purpose: plugin extension ownership key
  - field name: `relay_preferences`
    - type: jsonb
    - nullable/default: default `{}`
    - purpose: connection QoS and notification preferences
  - field name: `presence_opt_in`
    - type: boolean
    - nullable/default: default `true`
    - purpose: presence sharing controls
  - field name: `service_deleted_at`
    - type: timestamptz
    - nullable/default: nullable
    - purpose: plugin-scoped deletion marker

## 4) Domain Data Owned by Plugin

- Table/entity: `socket_relay_channel_memberships`
  - Contains personal data? yes (user linkage)
  - Retention period: short/medium-lived
  - Legal/compliance note: operational membership evidence
- Table/entity: `socket_relay_message_relays`
  - Contains personal data? yes (sender linkage + metadata)
  - Retention period: short-lived relay trace window
  - Legal/compliance note: avoid sensitive payload persistence
- Table/entity: `socket_relay_delivery_receipts`
  - Contains personal data? yes (recipient linkage)
  - Retention period: short/medium-lived
  - Legal/compliance note: delivery reliability evidence
- Table/entity: `socket_relay_deletion_events`
  - Contains personal data? minimal (`user_id`, scope, timestamps)
  - Retention period: compliance retention window
  - Legal/compliance note: Rule 114 deletion audit trail

### Transaction-scoped messaging retention

Per platform rule 100 ("Messaging Scope and Lifecycle"), the fulfillment chat (`socket_relay_messages`) is bound to a single fulfillment between exactly the two participants (request owner and fulfiller) and has no existence outside it. When the fulfillment reaches a terminal state (completed, canceled, disputed) the chat closes: no new messages may be sent, both parties retain read-only access for a limited window, and messages are retained server-side for moderation and abuse evidence. On service-scoped or full-account deletion, message bodies are hard-deleted or pseudonymized per the scopes below, while minimal moderation/abuse-evidence and Rule 114 audit metadata may be retained where policy or law requires (consistent with the retain-for-compliance scope).

## 5) Service-Scoped Deletion Contract

When user deletes SocketRelay usage only:

- Delete immediately:
  - `socket_relay_user_extension`
  - active channel memberships and relay preferences
- Anonymize/pseudonymize:
  - historical delivery receipt ownership if retention is required
- Retain for compliance/fraud/finance:
  - policy-required relay reliability traces
  - `socket_relay_deletion_events`
- Never touch (must remain):
  - canonical profile
  - non-SocketRelay plugin data
- User-facing confirmation text:
  - “Delete SocketRelay plugin data only? Your account remains active.”

### Admin request removal (moderation)

When an admin removes a request (`DELETE /api/socket-relay/admin/requests/:id`), the removal runs in one
transaction and is deterministic — the plugin's tables carry no `ON DELETE CASCADE`, so the app clears
the dependent rows itself instead of leaving orphans:

- Deleted: the `socket_relay_requests` row, its `socket_relay_fulfillments`, their
  `socket_relay_fulfillment_participants`, and the request's `socket_relay_request_events`.
- Retained: `socket_relay_messages` for those fulfillments — kept server-side as moderation/abuse
  evidence per the transaction-scoped messaging retention above (rule 100). Once the fulfillment row is
  gone they are unreachable through the participant-gated read path.
- Audited: the removal writes a `socket-relay.admin.request.delete` row to `socket_relay_admin_audit_trail`.

### Rows you appear on but do not own (pseudonymized, not deleted)

A fulfillment where you were the **helper** belongs to the member who posted the request: deleting it
would destroy their record of what happened on their own request. So the row stays and your identity
is overwritten instead — `socket_relay_fulfillments.fulfiller_user_id` is set to `deleted_member` and
the handle captured at claim time (`fulfiller_username`) is set to `NULL`.

Why a single shared constant and not a per-user token: a token would still link that person's rows to
one another, which is the thing deletion is meant to end. Two departed helpers on one request both
read as "Deleted member", and that is correct — the surviving party has no need to tell them apart.

Rows where you were the **requester** are deleted outright, as before; you own those.

Deliberately NOT pseudonymized, for reasons that outrank tidiness:
- a safety report's subject (`member_safety_reports.reported_user_id`) — abuse evidence, retained;
- reviewer/admin columns (`reviewed_by_user_id`, `updated_by_user_id`) — an audit trail of who
  decided what, retained for compliance;
- `member_blocks.blocked_user_id` — the column a block is enforced by; overwriting it could unblock
  someone.

## 6) Full-Account Deletion Contract

When user requests full account deletion:

- Additional records removed vs service-scoped deletion:
  - remaining user-linked relay memberships and receipts where removable
- Cross-service dependencies:
  - full-account orchestrator coordinates cross-plugin completion and audit emission
- Final expected state:
  - no recoverable user-scoped SocketRelay data except policy-required audit evidence

## 7) Rejoin/Re-enable Behavior

If user returns after service-scoped deletion:

- Recreated defaults:
  - new `socket_relay_user_extension` and default relay preferences
- Data that is not restored:
  - deleted memberships, receipts, and per-user relay state
- Re-consent required? (yes/no):
  - yes (presence and relay preferences)

## 8) Audit and Events

- Deletion event schema fields:
  - `id`, `user_id`, `scope`, `plugin_id`, `requested_at`, `processed_at`, `result`, `request_id`, `trace_id`
- Event table/path:
  - `socket_relay_deletion_events`
- Who can trigger deletion:
  - authenticated user (self)
  - full-account orchestrator/system actor
- Alerting/monitoring requirement:
  - alert on deletion failures and retry saturation

## 9) API and UX Surface

- Service delete endpoint:
  - `DELETE /api/account/socket-relay-profile` (planned)
- Full account delete endpoint (or orchestrator):
  - `DELETE /api/account/full-account`
- Status model (`requested`, `processing`, `completed`, `failed`):
  - required for plugin and account deletion flows
- User-facing copy reviewed by:
  - Product, Compliance/Privacy

## 10) Migration and Rollback

- Migration file(s):
  - All schema changes are made directly in `ctf/schema.sql` (canonical source of truth).
- Rollback approach:
  - reverse-order rollback for SocketRelay-only extension/deletion tables
- Backfill required? (yes/no):
  - no

## 11) Sign-off Checklist

- [ ] Product approved data behavior
- [ ] Engineering reviewed schema boundaries
- [ ] Compliance/privacy reviewed retention and deletion
- [ ] Observability added (without sensitive payloads)
- [ ] Web and Android parity confirmed

## Change Log

- 2026-02-25: Created initial draft.
- 2026-05-31: Added transaction-scoped messaging retention (per rule 100): per-fulfillment 1:1 chat (`socket_relay_messages`) closes on terminal state (read-only window), retained server-side for moderation/abuse evidence; bodies hard-deleted/pseudonymized on deletion with minimal evidence/audit metadata retained per policy.
- 2026-07-05: Documented admin request removal (moderation delete): now a single transaction that clears the request plus its fulfillments, participants, and request-events (no orphaned rows, since these tables have no FK cascade), retains `socket_relay_messages` as moderation evidence, and writes a `socket-relay.admin.request.delete` audit row.
