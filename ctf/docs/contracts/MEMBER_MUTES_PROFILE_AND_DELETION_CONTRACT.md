# Member Mutes Profile and Deletion Contract

## 1) Metadata

- Feature Name: Personal mute (cross-cutting personal control, not a plugin)
- Service Key (lowercase, stable): `member-mutes`
- Rollout Stage: 3.1.0 (owner-approved plan, Personal controls and safety)

## 2) What this stores

- Table: `member_mutes`
  - `id` (uuid, primary key)
  - `user_id` (text): the member who muted.
  - `kind` (`person` or `words`)
  - `target` (text): the muted member's account id, or the muted words in lower case.
  - `label` (text, nullable): the handle shown when a person was muted, for the member's own list.
  - `created_at` (timestamptz)
  - Unique on `(user_id, kind, target)`.
- Read only by the member's own list and by Today, which leaves out cards by a muted person or
  containing muted words. Nobody is told; a mute is not a block and changes nothing else.

## 3) Deletion

- Service-scoped and full-account deletion: `DELETE FROM member_mutes WHERE user_id = X` (registry
  entry `member-mutes`).
- A row where another member muted X is that member's private list and stays, the same rule as
  blocks.

## 4) Retention

Until the member unmutes or deletes their account.
