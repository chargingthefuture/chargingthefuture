# TrustTransport Profile and Deletion Contract

## 1) Plugin Metadata

- Plugin Name: TrustTransport
- Service Key (lowercase, stable): `trust-transport`
- Owner Team: Mobility Platform
- Rollout Stage: Live — service-scoped deletion is shipped (see Section 9)

## 2) Canonical Profile Usage

Rule 114 baseline: TrustTransport uses a single canonical profile and plugin extension by `user_id`.

- Read fields:
  - `user_id`
  - display name
  - avatar URL
  - role/workspace membership
  - locale/timezone
- Write fields:
  - none to canonical profile
- Why canonical fields are needed:
  - trip ownership, participant authorization, and safety policy checks

## Identity Handle Baseline

- Canonical handle source: the active auth provider's canonical `username` or equivalent handle field (see `ctf/docs/contracts/PLUGIN_IDENTITY_HANDLE_BASELINE.md`).
- Plugin must not create plugin-local username ownership models.
- If the canonical provider handle is missing, use non-handle display fallback and treat `@mention` targeting as unavailable.
- Any persisted username snapshot fields must be derived from the canonical provider handle at write time.

## 3) Plugin Extension Fields

- Storage location (table or json path): `trust_transport_user_extension`
- Fields:
  - field name: `user_id`
    - type: text
    - nullable/default: non-null, primary key
    - purpose: plugin extension ownership key
  - field name: `availability_preferences`
    - type: jsonb
    - nullable/default: default `{}`
    - purpose: when/how the member is available to fulfill trips
  - field name: `work_preferences`
    - type: jsonb
    - nullable/default: default `{}`
    - purpose: mode/routing preferences for fulfilling trips
  - field name: `service_deleted_at`
    - type: timestamptz
    - nullable/default: nullable
    - purpose: plugin-scoped deletion marker (soft delete, see Section 5)

## 4) Domain Data Owned by Plugin

- Table/entity: `trust_transport_requests`
  - Contains personal data? yes (requester ownership, pickup/dropoff city, settlement)
  - Retention period: deleted on service-scoped deletion (see Section 5)
  - Legal/compliance note: none beyond the deletion behavior below
- Table/entity: `trust_transport_offers`
  - Contains personal data? yes (provider ownership, note, proposed amount)
  - Retention period: deleted on service-scoped deletion
- Table/entity: `trust_transport_trips`
  - Contains personal data? yes (requester/provider linkage, status)
  - Retention period: deleted on service-scoped deletion
- Table/entity: `trust_transport_user_extension`
  - Contains personal data? yes (routing/safety-contact preferences)
  - Retention period: soft-deleted (`service_deleted_at` stamped, row kept) on service-scoped deletion
- Table/entity: `trust_transport_earnings_ledger`
  - Contains personal data? yes (provider earnings entries)
  - Retention period: retained on service-scoped deletion — financial integrity
- Table/entity: `trust_transport_payout_requests`
  - Contains personal data? yes (payout amount, currency, status)
  - Retention period: retained on service-scoped deletion — financial integrity
- Table/entity: `trust_transport_admin_audit_trail`
  - Contains personal data? yes (actor linkage on admin actions)
  - Retention period: retained on service-scoped deletion — compliance record; no automated archival job exists yet (see inventory "Gaps and Known Technical Debt")

Two more tables are not in the service-scoped deletion registry, for two different reasons:
- `trust_transport_status_events` and `trust_transport_proof_artifacts` carry a real foreign key to
  `trust_transport_requests`/`trust_transport_trips` with `ON DELETE CASCADE`, so they are removed
  automatically when their parent row is deleted — no separate registry entry is needed.
- `trust_transport_disputes` and `trust_transport_risk_signals` reference `trip_id`/`request_id` as
  plain columns (no foreign key, no cascade). A deleted request/trip leaves these rows in place with a
  now-dangling id. This is consistent with Section 5's "retain for compliance/fraud/finance" intent —
  dispute and risk-signal rows are moderation/safety evidence that should outlive a user's own
  service-scoped deletion — but it means they are retained by omission rather than by an explicit
  retention rule. Documented here so it is not mistaken for an oversight.

### Transaction-scoped messaging retention

Per platform rule 100 ("Messaging Scope and Lifecycle"), the per-trip 1:1 chat is bound to a single trip/order between exactly the two parties (rider and driver) and has no existence outside it. When the trip reaches a terminal state (completed, cancelled, disputed) the chat closes: no new messages may be sent, both parties retain read-only access for a limited window, and chat records are retained server-side for moderation and abuse evidence. On service-scoped or full-account deletion, chat bodies are hard-deleted or pseudonymized per the scopes below, while minimal moderation/abuse-evidence and Rule 114 audit metadata may be retained where policy or law requires (consistent with the retain-for-compliance scope).

## 5) Service-Scoped Deletion Contract

Implemented via the generic per-plugin deletion route (Section 9) driven by the
`trust-transport` entry in `ctf/packages/web/lib/account/deletion-registry.ts`:

- Delete immediately (hard delete):
  - `trust_transport_trips` (by `requester_user_id`) — trips you requested
  - `trust_transport_offers` (by `provider_user_id`) — offers you made
  - `trust_transport_requests` (by `requester_user_id`) — your ride/package requests
  - (cascades: deleting a request/trip also removes its `trust_transport_status_events` and
    `trust_transport_proof_artifacts` rows via `ON DELETE CASCADE`)
- Soft-delete (row kept, marker stamped):
  - `trust_transport_user_extension` — `service_deleted_at` is stamped; the row and its preference
    fields remain
- Retain for compliance/fraud/finance (never deleted by this flow):
  - `trust_transport_earnings_ledger` — financial integrity
  - `trust_transport_payout_requests` — financial integrity
  - `trust_transport_admin_audit_trail` — compliance record
  - `trust_transport_disputes`, `trust_transport_risk_signals` — not owned by this deletion scope at
    all (see Section 4); they hold no active FK to the deleted rows so they are simply left in place
- Never touch (must remain):
  - canonical profile
- User-facing confirmation text: the generic Account & Data screen's per-service delete confirmation
  (see `GET /api/account/services`, which lists TrustTransport under "deletable" with the
  `dataSummary` above).

## 6) Full-Account Deletion Contract

Full-account deletion runs the same table operations as Section 5 for every service in the deletion
registry, including `trust-transport`, via the shared full-account orchestrator. There is no
TrustTransport-specific behavior beyond what Section 5 already describes.

## 7) Rejoin/Re-enable Behavior

If user returns after service-scoped deletion:

- Recreated defaults:
  - a new request/offer/trip creates fresh rows; `trust_transport_user_extension` is written again
    with default preferences on next use
- Data that is not restored:
  - the deleted requests, offers, and trips are gone permanently (hard delete, no soft-delete/undo)
- Re-consent required? (yes/no):
  - no explicit re-consent step exists today beyond normal sign-in

## 8) Audit and Events

- Deletion is performed by the generic account-deletion path shared by every plugin in the registry;
  there is no TrustTransport-specific deletion-event table. Deletion actions surface through the
  platform's own account-deletion logging, not a plugin-owned audit table.
- Who can trigger deletion:
  - authenticated user (self), via the Account & Data screen
  - full-account orchestrator/system actor, via full-account deletion

## 9) API and UX Surface

- Service delete endpoint (live):
  - `DELETE /api/account/services/trust-transport` — the single generic per-plugin deletion route
    (`ctf/packages/web/app/api/account/services/[slug]/route.ts`), validated against the
    `trust-transport` entry in `deletion-registry.ts` and against `ctf/schema.sql` in CI.
- Read-only projection:
  - `GET /api/account/services` lists TrustTransport under `deletable` services for the Account & Data UI.
- Full account delete endpoint (or orchestrator):
  - the shared full-account deletion orchestrator (not a TrustTransport-specific route)
- User-facing copy reviewed by:
  - shared across all plugins on the generic Account & Data screen; not plugin-specific copy

## 10) Migration and Rollback

- Migration file(s):
  - All schema changes are made directly in `ctf/schema.sql` (canonical source of truth).
- Rollback approach:
  - reverse-order rollback for TrustTransport-only extension/deletion tables
- Backfill required? (yes/no):
  - no

## 11) Sign-off Checklist

- [x] Product approved data behavior
- [x] Engineering reviewed schema boundaries
- [ ] Compliance/privacy reviewed retention and deletion
- [ ] Observability added (without sensitive payloads)
- [x] Web and Android parity confirmed (deletion is a single shared web route; there is no
  Android-specific deletion surface to parity-check against)

## Change Log

- 2026-02-25: Created initial draft.
- 2026-05-31: Added transaction-scoped messaging retention (per rule 100): per-trip 1:1 chat closes on terminal state (read-only window), retained server-side for moderation/abuse evidence; bodies hard-deleted/pseudonymized on deletion with minimal evidence/audit metadata retained per policy.
- 2026-07-02: Corrected this contract to match the live implementation — it previously described a
  planned `DELETE /api/account/trust-transport-profile` endpoint and four tables
  (`trust_transport_trip_requests`, `trust_transport_trip_events`, `trust_transport_safety_flags`,
  `trust_transport_deletion_events`) that never existed under those names. Service-scoped deletion has
  actually been live since the generic `DELETE /api/account/services/:slug` route and the
  `trust-transport` entry in `deletion-registry.ts` shipped; this document now lists the real tables
  and their real delete/soft-delete/retain treatment. No code changed — documentation only.
