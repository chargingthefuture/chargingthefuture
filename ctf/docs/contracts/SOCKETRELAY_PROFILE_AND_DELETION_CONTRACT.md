# SocketRelay Profile and Deletion Contract (Draft)

## 1) Plugin Metadata

- Plugin Name: SocketRelay
- Service Key (lowercase, stable): `socketrelay`
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

- Storage location (table or json path): `socketrelay_user_extension`
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

- Table/entity: `socketrelay_channel_memberships`
  - Contains personal data? yes (user linkage)
  - Retention period: short/medium-lived
  - Legal/compliance note: operational membership evidence
- Table/entity: `socketrelay_message_relays`
  - Contains personal data? yes (sender linkage + metadata)
  - Retention period: short-lived relay trace window
  - Legal/compliance note: avoid sensitive payload persistence
- Table/entity: `socketrelay_delivery_receipts`
  - Contains personal data? yes (recipient linkage)
  - Retention period: short/medium-lived
  - Legal/compliance note: delivery reliability evidence
- Table/entity: `socketrelay_deletion_events`
  - Contains personal data? minimal (`user_id`, scope, timestamps)
  - Retention period: compliance retention window
  - Legal/compliance note: Rule 114 deletion audit trail

### Transaction-scoped messaging retention

Per platform rule 100 ("Messaging Scope and Lifecycle"), the fulfillment chat (`socketrelay_messages`) is bound to a single fulfillment between exactly the two participants (request owner and fulfiller) and has no existence outside it. When the fulfillment reaches a terminal state (completed, cancelled, disputed) the chat closes: no new messages may be sent, both parties retain read-only access for a limited window, and messages are retained server-side for moderation and abuse evidence. On service-scoped or full-account deletion, message bodies are hard-deleted or pseudonymized per the scopes below, while minimal moderation/abuse-evidence and Rule 114 audit metadata may be retained where policy or law requires (consistent with the retain-for-compliance scope).

## 5) Service-Scoped Deletion Contract

When user deletes SocketRelay usage only:

- Delete immediately:
  - `socketrelay_user_extension`
  - active channel memberships and relay preferences
- Anonymize/pseudonymize:
  - historical delivery receipt ownership if retention is required
- Retain for compliance/fraud/finance:
  - policy-required relay reliability traces
  - `socketrelay_deletion_events`
- Never touch (must remain):
  - canonical profile
  - non-SocketRelay plugin data
- User-facing confirmation text:
  - “Delete SocketRelay plugin data only? Your account remains active.”

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
  - new `socketrelay_user_extension` and default relay preferences
- Data that is not restored:
  - deleted memberships, receipts, and per-user relay state
- Re-consent required? (yes/no):
  - yes (presence and relay preferences)

## 8) Audit and Events

- Deletion event schema fields:
  - `id`, `user_id`, `scope`, `plugin_id`, `requested_at`, `processed_at`, `result`, `request_id`, `trace_id`
- Event table/path:
  - `socketrelay_deletion_events`
- Who can trigger deletion:
  - authenticated user (self)
  - full-account orchestrator/system actor
- Alerting/monitoring requirement:
  - alert on deletion failures and retry saturation

## 9) API and UX Surface

- Service delete endpoint:
  - `DELETE /api/account/socketrelay-profile` (planned)
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
- 2026-05-31: Added transaction-scoped messaging retention (per rule 100): per-fulfillment 1:1 chat (`socketrelay_messages`) closes on terminal state (read-only window), retained server-side for moderation/abuse evidence; bodies hard-deleted/pseudonymized on deletion with minimal evidence/audit metadata retained per policy.
