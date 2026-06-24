# Member Blocks Profile and Deletion Contract

## 1) Metadata

- Feature Name: Member Blocking (cross-cutting safety control, not a plugin)
- Service Key (lowercase, stable): `member-blocks`
- Issue: #809 (owner-signed model, 2026-06-24)
- Rollout Stage: API + manage-list UI (task 2). Enforcement across surfaces (task 4) and the optional
  safety escalation (task 3) are separate, later tasks.

## 2) What this stores

- Table: `member_blocks`
  - `id` (uuid, primary key)
  - `blocker_user_id` (text) — the member who created the block.
  - `blocked_user_id` (text) — the member who is blocked.
  - `created_at` (timestamptz) — when the block was created.
  - Unique on `(blocker_user_id, blocked_user_id)`; CHECK forbids a self-block.
- No `reason` column. Ordinary blocks are private; the admin never reads them. A member may block
  anyone for any reason and none is recorded. The optional "report as suspected predator/trafficker"
  escalation is a separate mechanism (a member safety report kept apart from this table), built in a
  later task, so ordinary blocks stay out of the admin's view.

## 3) Resolving the blocked member's display label

The manage-list resolves `blocked_user_id` to a human label by a LEFT JOIN to `directory_profiles`
on `claimed_by_user_id` (active profiles only, `deleted_at IS NULL`), using
`TRIM(first_name || ' ' || last_name)`. When there is no claimed profile, the label falls back to the
neutral word "Member" so every row still names someone the viewer can recognize and unblock.

## 4) Deletion behavior

On full-account deletion, the member's own blocks are removed. This is wired into the account
deletion registry (`ctf/packages/web/lib/account/deletion-registry.ts`) as the `member-blocks` entry:

- `member_blocks` — `delete` where `blocker_user_id = <user>` (the blocks the member created).

Scope notes:

- The member may also clear all their own blocks on their own via the standard service-scope delete
  (`DELETE /api/account/services/member-blocks`), since `serviceScopeSupported` is `true`.
- Rows where someone ELSE blocked this member (`blocked_user_id = <user>`) are that other member's
  private boundary and are NOT cleared by this member's deletion — they are removed when the other
  member deletes their account (their own `blocker_user_id` rows). A leftover reverse-direction row
  that points at a deleted user is harmless (the user is gone). Cleaning up such orphaned reverse rows
  is a noted follow-up, deliberately not done here so service-scope deletion can never touch another
  member's blocks.

## 5) Access and CSRF

- Auth: any signed-in member (`any_authenticated`), the same posture as account deletion. Blocking is
  a baseline safety control, never unlock-gated.
- CSRF: every state-changing request (POST create, DELETE remove) requires the `x-ctf-csrf: 1` header
  and a same-origin check, via the shared account `ensureMutationCsrf` helper.
