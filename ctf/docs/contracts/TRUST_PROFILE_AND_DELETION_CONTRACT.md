# Trust Profile and Deletion Contract (Draft)

## 1) Plugin Metadata

- Plugin Name: Trust
- Service Key (lowercase, stable): `trust`
- Owner Team: Trust and Safety Platform (proposed)
- Rollout Stage: Planning

## 2) Canonical Profile Usage

Rule 114 baseline: Trust extends the canonical profile by `user_id` and must not create a separate identity system.

- Read fields:
  - `user_id`
  - canonical account created timestamp or equivalent member-start timestamp
  - display name
  - avatar URL
  - role/workspace membership
- Write fields:
  - none to canonical profile
- Why canonical fields are needed:
  - attach trust signals to one canonical member identity
  - support moderator/admin review of a member's trust state
  - render consistent identity context across plugin surfaces

## Identity Handle Baseline

- Canonical handle source: the active auth provider's canonical `username` or equivalent handle field (see `ctf/docs/contracts/PLUGIN_IDENTITY_HANDLE_BASELINE.md`).
- Trust must not create plugin-local handles or alternate member identifiers.
- Any trust UI references to handles must use provider-derived canonical handle values only.

## 3) Plugin Extension Fields

- Storage location (table or json path): `trust_user_extension`
- Fields:
  - field name: `user_id`
    - type: uuid or text keyed to canonical identity implementation
    - nullable/default: non-null, unique, FK to canonical profile equivalent
    - purpose: plugin extension ownership key
  - field name: `trust_status`
    - type: enum (`unverified` | `verified` | `flagged`)
    - nullable/default: non-null, default `unverified`
    - purpose: public-safe trust state for trust badge rendering (admin-controlled)
  - field name: `trust_evidence`
    - type: jsonb (array of evidence items: `{ type, summary, details?, createdAt, createdBy? }`)
    - nullable/default: non-null, default `[]`
    - purpose: qualitative, non-numeric evidence derived from real cross-plugin participation, plus admin notes
  - field name: `trust_visibility`
    - type: enum (`public` | `private` | `restricted`)
    - nullable/default: non-null, default `public`
    - purpose: none as of 2026-08-10 — dormant. It held a per-member visibility choice; that choice
      was removed (a member does not decide what others see of their trust; the code does, the same
      way for everyone). Nothing writes it and no route reads it. Left in place so this change needs
      no migration; drop it in a later schema pass.
  - field name: `member_since_at`
    - type: timestamptz
    - nullable/default: nullable, derived/backfilled from canonical account timeline when available
    - purpose: month/year member-since rendering
  - field name: `service_deleted_at`
    - type: timestamptz
    - nullable/default: nullable
    - purpose: plugin-scoped deletion marker

- Storage location (table or json path): `trust_signal_snapshot`
- Fields:
  - field name: `id`
    - type: uuid
    - nullable/default: non-null, primary key
    - purpose: snapshot row identifier
  - field name: `user_id`
    - type: text keyed to canonical identity implementation
    - nullable/default: non-null
    - purpose: snapshot subject
  - field name: `snapshot`
    - type: jsonb
    - nullable/default: non-null, default `{}`
    - purpose: the derived metric bundle computed from real upstream rows (login*, socketRelay*, serviceCredits*, and per-plugin participation counts: lighthouseMatchesAccepted, trustTransportTripsCompleted, skillsHuntSubmissionsAccepted, levelUpCohortsCompleted, chymeRoomsJoined, directoryProfilesClaimed, whatWorksEndorsements, peerProgrammingCohortsJoined, contributionsConfirmed). Only coarse COUNTs are read (never amounts, balances, or sensitive per-row detail). No numeric trust score is stored.
  - field name: `snapshot_type`
    - type: text
    - nullable/default: non-null, default `cross_plugin_engagement_v3`
    - purpose: derivation model version so older snapshots stay self-describing
  - field name: `created_at`
    - type: timestamptz
    - nullable/default: non-null, default `NOW()`
    - purpose: freshness marker for server-side safety controls and support diagnostics

## 4) Domain Data Owned by Plugin

- Table/entity: `trust_user_extension`
  - Contains personal data? yes
  - Retention period: long-lived while plugin is enabled
  - Legal/compliance note: extension-only trust state; not a second profile table
- Table/entity: `trust_signal_snapshot`
  - Contains personal data? yes (derived behavioral metadata: real engagement counts)
  - Retention period: rolling snapshots while plugin is enabled
  - Legal/compliance note: must remain privacy-safe; stores coarse counts and no numeric trust score
- Table/entity: `trust_admin_audit_trail`
  - Contains personal data? minimal actor and target linkage
  - Retention period: compliance retention window
  - Legal/compliance note: append-only trust moderation and policy evidence

## 5) Service-Scoped Deletion Contract

When user deletes Trust usage only:

- Delete immediately:
  - `trust_user_extension`
  - user-scoped `trust_signal_snapshot`
- Anonymize/pseudonymize:
  - none planned in Phase 1; snapshots should be removable without preserving user-identifiable copies
- Retain for compliance/fraud/finance:
  - `trust_admin_audit_trail` with minimal actor/target linkage and no raw sensitive payloads
- Never touch (must remain):
  - canonical profile/account
  - non-Trust plugin data
  - source plugin domain records used to derive trust signals
- User-facing confirmation text:
  - “Delete Trust plugin data only? Your account and other plugin data stay active.”

## 6) Full-Account Deletion Contract

When user requests full account deletion:

- Additional records removed vs service-scoped deletion:
  - any remaining user-linked trust extension state and snapshots
- Cross-service dependencies:
  - full-account orchestrator clears Trust extension records after dependent plugin deletion jobs finalize
- Final expected state:
  - no recoverable user-scoped Trust display state except policy-required audit artifacts

## 7) Rejoin/Re-enable Behavior

If user returns after service-scoped deletion:

- Recreated defaults:
  - new `trust_user_extension` with `unverified` status
  - empty or re-derived `trust_signal_snapshot`
- Data that is not restored:
  - prior public-safe trust summary state unless re-derived from approved source systems
- Re-consent required? (yes/no):
  - yes (for public display of trust summary surfaces if product requires explicit opt-in)

## 8) Audit and Events

- Deletion event schema fields:
  - `id`, `user_id`, `scope`, `plugin_id`, `requested_at`, `processed_at`, `result`, `request_id`, `trace_id`
- Event table/path:
  - centralized deletion event table/orchestrator path plus `trust_admin_audit_trail` for trust moderation actions
- Who can trigger deletion:
  - authenticated user (self) for plugin-scoped deletion
  - full-account orchestrator/system actor
- Alerting/monitoring requirement:
  - alert on failed trust snapshot deletion or policy/audit write failures

## 9) API and UX Surface

- Service delete endpoint:
  - `DELETE /api/account/trust` (planned)
- Full account delete endpoint (or orchestrator):
  - `DELETE /api/account/full-account`
- Status model (`requested`, `processing`, `completed`, `failed`):
  - required for plugin and account deletion flows
- User-facing copy reviewed by:
  - Product, Trust and Safety, Compliance/Privacy
- Primary Phase 1 UX surfaces:
  - right-rail personal Trust card beneath the welcome/profile card
  - expandable viewed-user Trust preview beneath member name/header in plugin profile views

## 10) Migration and Rollback

- Migration file(s):
  - All schema changes are made directly in `ctf/schema.sql` (canonical source of truth).
- Rollback approach:
  - reverse-order rollback for Trust-only extension and snapshot tables
- Backfill required? (yes/no):
  - yes (member-since derivation and any approved initial verification carry-over from legacy systems)

## 11) Sign-off Checklist

- [ ] Product approved data behavior
- [ ] Engineering reviewed schema boundaries
- [ ] Compliance/privacy reviewed retention and deletion
- [ ] Observability added (without sensitive payloads)
- [ ] Web and Android parity confirmed

## Change Log

- 2026-06-08: Reconciled with shipped schema. Renamed `trust_signal_snapshots` → `trust_signal_snapshot` (the real table) and replaced the draft bucket columns with the actual columns (`id`, `user_id`, `snapshot` JSONB, `snapshot_type`, `created_at`). User-scoped snapshot rows are deleted on service/account deletion (now wired in the account deletion registry).
- 2026-03-25: Created initial Trust Phase 1 draft focused on privacy-safe trust signals, shared UI surfaces, and plugin-scoped extension storage.
