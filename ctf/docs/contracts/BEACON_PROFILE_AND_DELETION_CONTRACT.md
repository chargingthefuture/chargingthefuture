# Beacon Profile and Deletion Contract

## 1) Plugin Metadata

- Plugin Name: Beacon
- Service Key (lowercase, stable): `beacon`
- Owner Team: chargingthefuture
- Rollout Stage: v1 build

## 2) Canonical Profile Usage

Rule 114 baseline: Beacon uses one canonical profile by `user_id`. There is no Beacon-local profile.

- Read fields:
  - `user_id` (the admin host on an event; the signed-in member when minting a chat token)
  - display name (for the Stream Chat/Video user record)
- Write fields:
  - none to canonical profile

## Identity Handle Baseline

- Canonical handle source: the active auth provider's canonical `username` or equivalent handle field
  (see `ctf/docs/contracts/PLUGIN_IDENTITY_HANDLE_BASELINE.md`).
- Beacon must not create a plugin-local username model. If the canonical handle is missing, a
  non-handle display fallback is used.

## 3) Plugin Extension Fields

Beacon has no per-member extension table. It does not store any per-member rows in our database. The
live chat is held by Stream — and, correction from an earlier version of this contract, it is **not
ephemeral**: Stream Chat retains messages with no expiry by default, so a member's Beacon chat persists
under the Stream user `beacon-<userId>` until deleted. On account deletion the orchestrator's
external-cleanup hook (`lib/account/external-cleanup-registry.ts` → `deleteBeaconStreamData`) hard-deletes
that Stream user (with `mark_messages_deleted`), removing the copy.

## 4) Domain Data Owned by Plugin

- Table/entity: `beacon_events`
  - Contains personal data? minimal — `host_user_id` (an admin) and the saved public recording URL.
    No viewer or chatter identities are stored in this table (chat lives in Stream, not the DB — and
    is cleared from Stream on account deletion via the external-cleanup hook).
  - Retention period: long-lived (event history and replay links). A `live` or `ended` row is never
    deletable through the app — the admin surface has no delete control for one, and the
    `DELETE /api/beacon/[id]` route refuses it with a 409 and records the refusal in the audit trail.
    A `draft` row is the one exception: an admin can delete it (see below), because a draft was never
    broadcast, has no recording, and never appeared in the member view.
  - Legal/compliance note: the broadcast and its recording are public by design; the replay is posted
    publicly to the Commons. No private member content is stored here.
- Table/entity: `beacon_events_admin_audit_trail`
  - Contains personal data? minimal — `actor_id` (the admin) and an optional moderated `target_id`.
  - Retention period: compliance retention window.
  - Legal/compliance note: admin-action audit trail (create, go-live, end, moderate,
    recording-ingest, and draft delete — including a *refused* delete of a live or ended event).

## 5) Service-Scoped Deletion Contract

Beacon stores no per-member profile or per-member content, so there is no member-facing "delete my
Beacon data" surface. A member who never wants to appear simply never chats — anonymous public
watching leaves no stored identity, and members are never on camera (the admin is the sole publisher).

- Delete immediately: nothing member-scoped exists in the DB to delete. The member's Stream chat copy
  (`beacon-<userId>`) IS deleted, but on the account path via the deletion orchestrator's external
  cleanup — there is no standalone Beacon service-delete surface (`serviceScopeSupported: false` in the
  deletion registry).
- Anonymize/pseudonymize: not applicable — no per-member rows are stored in the DB.
- Retain for compliance: `beacon_events_admin_audit_trail` (admin actions only).
- Never touch: canonical profile; other plugins' data; Chyme.

## 6) Full-Account Deletion Contract

When a member requests full account deletion:

- No member-scoped Beacon rows exist, so nothing is removed from Beacon tables for an ordinary member.
- The member's Stream chat copy (`beacon-<userId>`) is hard-deleted via the orchestrator's
  external-cleanup hook (`deleteBeaconStreamData`), best-effort after the DB transaction commits — so a
  Beacon registry entry now exists (both tables `retain`) purely so the orchestrator knows Beacon and
  runs this cleanup on every whole-account path (full-account route, internal delete, Clerk webhook).
- An admin's `host_user_id` references on past events are retained as event history (the events are
  public broadcasts already posted to the Commons); the orchestrator does not hard-delete public
  broadcast history.
- Final expected state: no recoverable member-scoped Beacon data — no DB rows (there were none), and the
  Stream chat copy removed.

## 7) Rejoin/Re-enable Behavior

Not applicable — Beacon keeps no per-member state to recreate.

## 8) Audit and Events

- Admin actions are written to `beacon_events_admin_audit_trail` (`actor_id`, `command`,
  `policy_status`, `reason`, `target_type`, `target_id`, `metadata`, `created_at`).
- Who can trigger event lifecycle changes: an admin (create/go-live/end/moderate); the Stream webhook
  (system actor) on recording-ready.

## 9) API and UX Surface

- No member deletion endpoint is required (no member-scoped data).
- Full account delete endpoint (orchestrator): `DELETE /api/account/full-account` — no Beacon-specific
  member rows to remove.

## 10) Migration and Rollback

- Migration file(s): all schema changes are in `ctf/schema.sql` (canonical source of truth):
  `beacon_events`, `beacon_events_admin_audit_trail`.
- Rollback approach: dropping Beacon tables removes only event history and the admin audit trail; no
  member-scoped data is affected. Unsetting the Stream credentials degrades the plugin gracefully
  (the viewer shows the idle/replay state and chat is unavailable) without data loss.
- Backfill required? no.

## 11) Sign-off Checklist

- [ ] Product approved data behavior
- [ ] Engineering reviewed schema boundaries
- [ ] Compliance/privacy reviewed retention and deletion
- [ ] Observability added (without sensitive payloads)
- [ ] Web and Android parity confirmed (Android viewer parity deferred via a parity ticket)

## Change Log

- 2026-06-21: Created for the Beacon v1 build. No per-member data is stored (live chat ephemeral in
  Stream; viewers anonymous over HLS). Owned tables: `beacon_events`,
  `beacon_events_admin_audit_trail`.
