# Feed Profile and Deletion Contract (Draft)

## 1) Plugin Metadata

- Plugin Name: Feed
- Service Key (lowercase, stable): `feed`
- Owner Team: Social Platform (proposed)
- Rollout Stage: Planning

## 2) Canonical Profile Usage

Rule 114 baseline: Feed relies on canonical identity and does not duplicate account profile fields.

- Read fields:
  - `user_id`
  - display name
  - avatar URL
  - locale/timezone
- Write fields:
  - none to canonical profile
- Why canonical fields are needed:
  - content ownership and moderation decisions
  - identity consistency across plugins

## Identity Handle Baseline

- Canonical handle source: the active auth provider's canonical `username` or equivalent handle field (see `ctf/docs/contracts/PLUGIN_IDENTITY_HANDLE_BASELINE.md`).
- Plugin must not create plugin-local username ownership models.
- If the canonical provider handle is missing, use non-handle display fallback and treat `@mention` targeting as unavailable.
- Any persisted username snapshot fields must be derived from the canonical provider handle at write time.

## 3) Plugin Extension Fields

- Storage location (table or json path): none — Feed has no dedicated per-user extension table.
- Single-profile rule: per-user Feed state is keyed by `user_id` across the read-state, dismissal,
  rating, and announcement-state tables; there is no duplicate profile and no per-user preference
  table (render mode is a global singleton in `feed_render_config`, which also carries the
  `is_public` flag for the publicly-viewable Hub channel).
- Per-user state tables (all keyed by `user_id`):
  - `feed_user_read_state` — `(user_id, item_id, read_at)`; which feed items the user has read.
  - `feed_user_dismissals` — `(user_id, item_id, dismissed_at)`; dismissed items.
  - `feed_answer_ratings` — `(user_id, answer_id, rating)`; the user's answer ratings.
  - `feed_community_post_reactions` — `(post_id, user_id, emoji)`; the user's emoji reactions on community posts.
  - `announcement_user_state` — `(user_id, announcement_id, read_at, acknowledged_at, dismissed_at)`.

## 4) Domain Data Owned by Plugin

- Table/entity: `feed_community_posts`
  - Contains personal data? yes (author linkage + content)
  - Retention period: long-lived under moderation policy
  - Legal/compliance note: abuse evidence may require retention
- Table/entity: `feed_community_replies`
  - Contains personal data? yes (author linkage + content)
  - Retention period: long-lived under moderation policy
  - Legal/compliance note: user-generated content controls apply
- Table/entity: `feed_questions`
  - Contains personal data? yes (asker linkage, optional location context)
  - Retention period: medium-lived; location context minimized
  - Legal/compliance note: consent-gated LLM Q&A
- Table/entity: `feed_answers`
  - Contains personal data? yes for community answers (author linkage)
  - Retention period: medium-lived
  - Legal/compliance note: LLM answers are logged in `llm_inference_log`
- Table/entity: `feed_answer_ratings`
  - Contains personal data? yes (user linkage)
  - Retention period: medium-lived
  - Legal/compliance note: engagement metadata

## 5) Service-Scoped Deletion Contract

When user deletes Feed usage only:

- Delete immediately:
  - per-user state rows in `feed_user_read_state`, `feed_user_dismissals`, `feed_answer_ratings`,
    `feed_community_post_reactions`, `announcement_user_state`, `announcement_reactions`, and
    `feed_hub_last_seen` (2026-08-02: the last three now have registry entries — this contract
    already promised `feed_community_post_reactions` would clear, but no registry entry existed, so
    the deletion engine never executed that promise until the deletion-coverage gate caught it)
- Anonymize/pseudonymize:
  - historical authored content (`feed_community_posts`, `feed_community_replies`, `feed_questions`)
    where hard delete is not policy-allowed
- Retain for compliance/fraud/finance:
  - policy-required moderation records
  - `llm_inference_log` audit rows
- Never touch (must remain):
  - canonical profile
  - content owned by other users
- User-facing confirmation text:
  - “Delete Feed plugin data only? Your account remains active.”

## 6) Full-Account Deletion Contract

When user requests full account deletion:

- Additional records removed vs service-scoped deletion:
  - remaining user-linked community posts/replies, questions, and answer ratings where policy allows hard delete
- Cross-service dependencies:
  - full-account orchestrator coordinates deletion sequencing and audit completion
- Final expected state:
  - no recoverable user-scoped Feed data except policy-required compliance artifacts

## 7) Rejoin/Re-enable Behavior

If user returns after service-scoped deletion:

- Recreated defaults:
  - none — per-user Feed state starts empty (no extension row to recreate)
- Data that is not restored:
  - removed read/dismissal/rating state and hard-deleted authored content
- Re-consent required? (yes/no):
  - yes for LLM Q&A (per-question consent); no per-user personalization is stored

## 8) Audit and Events

- Deletion event schema fields:
  - `id`, `user_id`, `scope`, `plugin_id`, `requested_at`, `processed_at`, `result`, `request_id`, `trace_id`
- Event table/path:
  - `feed_deletion_events`
- Who can trigger deletion:
  - authenticated user (self)
  - full-account orchestrator/system actor
- Alerting/monitoring requirement:
  - alert on deletion failures and moderation-retention exceptions

## 9) API and UX Surface

- Member self-delete of their own Commons post (distinct from account/plugin deletion):
  - `DELETE /api/hub/messages/:postId` — author-only, CSRF-guarded. Hard-deletes the caller's own
    community (peer) post; cascades its replies and reactions and removes the projected `feed_items`
    row (with its targets, read state, and dismissals). The product has no edit — a member corrects a
    post by deleting and reposting, so no edit/version endpoint exists. A delete of a post the caller
    does not own is rejected (403).
- Service delete endpoint:
  - `DELETE /api/account/feed-profile` (planned)
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
  - reverse-order rollback for Feed-only extension/deletion tables
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
