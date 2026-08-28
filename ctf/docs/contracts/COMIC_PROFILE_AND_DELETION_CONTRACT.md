# comic AI Assistant Profile and Deletion Contract (Draft)

> Scope: the `@comic` AI assistant subsystem (internal slug `comic`; user-facing label
> "AI Assistant"). Covers the comic conversation/supervision/training tables only. The
> unified Hub/Feed timeline, announcements, and peer-to-peer posts are governed by the Feed
> contract (`FEED_PROFILE_AND_DELETION_CONTRACT.md`).

## 1) Plugin Metadata

- Plugin Name: AI Assistant (`@comic`)
- Service Key (lowercase, stable): `comic`
- Owner Team: Social Platform (proposed)
- Rollout Stage: Web UI delivered (asker stream + owner review dashboard, design `9a4a1af`); Android parity deferred

## 2) Canonical Profile Usage

Rule 114 baseline: comic relies on canonical identity and does not duplicate account profile
fields.

- Read fields:
  - `user_id`
  - display name
- Write fields:
  - none to canonical profile
- Why canonical fields are needed:
  - turn ownership (the asker) and reviewer attribution
  - identity consistency across plugins

## Identity Handle Baseline

- Canonical handle source: the active auth provider's canonical `username` or equivalent handle field (see `ctf/docs/contracts/PLUGIN_IDENTITY_HANDLE_BASELINE.md`).
- Plugin must not create plugin-local username ownership models.
- The `@comic` handle is a fixed system mention, not a user handle; it never creates plugin-local username ownership.

## 3) Plugin Extension Fields

- Storage location (table or json path): none (comic does not add a canonical profile extension table)
- Fields:
  - field name: n/a
    - type: n/a
    - nullable/default: n/a
    - purpose: comic stores only conversation/supervision/training data keyed by `user_id`; it adds no profile extension fields

## 4) Domain Data Owned by Plugin

- Table/entity: `comic_admin_audit_trail`
  - Contains personal data? minimal (the acting admin's id, and the id of what was acted on)
  - Retention period: compliance retention window
  - Legal/compliance note: the durable record of every admin decision on the AI Assistant, added 2026-08-28. Append-only and **never** removed by a member's service-scoped or full-account deletion — the record of a decision about someone's contribution has to outlive the contribution, or a decline erases its own evidence. Holds no member-authored content.
- Table/entity: `comic_conversations`
  - Contains personal data? yes (`user_id` ownership, and `asker_username` — the asker's @username
    snapshotted at ask time for display in the review dashboard)
  - Retention period: medium-lived under supervision policy
  - Legal/compliance note: conversation context for the human-in-the-loop review trail; the whole row
    (including `asker_username`) is removed when the user's comic data is deleted (see deletion scope)
- Table/entity: `comic_turns`
  - Contains personal data? yes (asker message content + bot/human drafts)
  - Retention period: medium-lived; corrected turns feed training
  - Legal/compliance note: survivor-safe content; no location/identity should be persisted in turn bodies
- Table/entity: `comic_review_queue`
  - Contains personal data? minimal (reviewer id, draft linkage, decision reason)
  - Retention period: compliance retention window (supervision audit)
  - Legal/compliance note: records the no-bad-info supervision decision per turn
- Table/entity: `comic_training_examples`
  - Contains personal data? yes (derived from asker question text)
  - Retention period: long-lived under training policy
  - Legal/compliance note: curated training data available via the training-example export; redact identifying details before export or any model training
- Table/entity: `comic_answer_ratings`
  - Contains personal data? yes (`user_id` ownership of the rating)
  - Retention period: medium-lived (quality signal)
  - Legal/compliance note: helpful/not_helpful/flagged rating per answered turn; CASCADE-deleted with the rated turn

- Table/entity: `comic_contributions` (+ `comic_contribution_entries`)
  - Contains personal data? yes — the member's own public Quora writing, plus their consent record
    and any note they wrote about third parties named in their posts.
  - Retention period: long-lived while the member wants it in the library; removed on withdrawal of
    the account, and deactivated on withdrawal of the contribution.
  - Legal/compliance note: the lawful basis is the member's explicit, per-clause consent, captured at
    submit time with the version of the wording they read (`consent_version`) — a later edit to the
    form cannot be claimed as agreement from an earlier contributor. **The uploaded `.zip` is never
    stored**: it is parsed in memory and discarded with the request, so there is no archive at rest.
    Inbox messages, unpublished drafts, and profile data are dropped by an allowlist before any human
    reads the submission, so the contributor is not relied upon to strip them.
  - Right to erasure: deliverable in practice, not just on paper, because the assistant **retrieves**
    from `comic_knowledge_entries` at answer time rather than being trained on the text. Withdrawal
    deactivates those rows; account deletion removes them outright via
    `comic_knowledge_entries.contribution_id` ON DELETE CASCADE. Words absorbed into model weights
    could not be withdrawn, which is why the design does not absorb them.

## 5) Service-Scoped Deletion Contract

When user deletes AI Assistant usage only:

- Delete immediately:
  - `comic_conversations` owned by the user (CASCADE removes `comic_turns`, which CASCADEs to
    `comic_review_queue`, `comic_training_examples`, and `comic_answer_ratings` derived from those
    turns)
  - `comic_contributions` owned by the user, which CASCADEs to `comic_contribution_entries` and to
    every `comic_knowledge_entries` row that contribution produced — so deleting the data also stops
    the assistant quoting it. Account deletion must never be a weaker promise than the member's own
    Withdraw button.
- Anonymize/pseudonymize:
  - reviewer attribution on retained supervision records where hard delete is not policy-allowed
- Retain for compliance/fraud/finance:
  - policy-required safety-supervision audit rows (decoupled reviewer attribution)
- Never touch (must remain):
  - canonical profile
  - other users' conversations/turns
- User-facing confirmation text:
  - “Delete AI Assistant data only? Your account remains active.”

## 6) Full-Account Deletion Contract

When user requests full account deletion:

- Additional records removed vs service-scoped deletion:
  - any remaining user-linked comic conversations/turns/training examples where policy allows hard delete
- Cross-service dependencies:
  - full-account orchestrator coordinates deletion sequencing and audit completion
- Final expected state:
  - no recoverable user-scoped comic data except policy-required compliance artifacts

## 7) Rejoin/Re-enable Behavior

If user returns after service-scoped deletion:

- Recreated defaults:
  - a fresh `comic_conversations` row is created on the next `@comic` mention
- Data that is not restored:
  - prior conversations, turns, and training examples
- Re-consent required? (yes/no):
  - yes (LLM-processing consent re-verified before any generation)

## 8) Audit and Events

- Deletion event schema fields:
  - `id`, `user_id`, `scope`, `plugin_id`, `requested_at`, `processed_at`, `result`, `request_id`, `trace_id`
- Event table/path:
  - shared account/deletion audit trail (comic does not own a dedicated deletion-events table at this stage)
- Who can trigger deletion:
  - authenticated user (self)
  - full-account orchestrator/system actor
- Alerting/monitoring requirement:
  - alert on deletion failures and supervision-retention exceptions

## 9) API and UX Surface

- Service delete endpoint:
  - `DELETE /api/account/comic-profile` (planned)
- Full account delete endpoint (or orchestrator):
  - `DELETE /api/account/full-account`
- Status model (`requested`, `processing`, `completed`, `failed`):
  - required for plugin and account deletion flows
- User-facing copy reviewed by:
  - Product, Compliance/Privacy, Trust & Safety

## 10) Migration and Rollback

- Migration file(s):
  - All schema changes are made directly in `ctf/schema.sql` (canonical source of truth).
- Rollback approach:
  - reverse-order rollback for the comic conversation/supervision/training tables
- Backfill required? (yes/no):
  - no

## 11) Sign-off Checklist

- [ ] Product approved data behavior
- [ ] Engineering reviewed schema boundaries
- [ ] Compliance/privacy reviewed retention and deletion
- [ ] Observability added (without sensitive payloads)
- [ ] Web and Android parity confirmed

## Change Log

- 2026-05-31: Added `comic_answer_ratings` (helpful/not_helpful/flagged quality signal, CASCADE
  off `comic_turns`) to owned data + deletion scope alongside the web UI delivery (design
  `9a4a1af`). Updated rollout stage to web UI delivered.
- 2026-05-31: Created initial draft alongside the comic backend foundation.
