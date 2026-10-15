# Member Blocks Profile and Deletion Contract

## 1) Metadata

- Feature Name: Member Blocking (cross-cutting safety control, not a plugin)
- Service Key (lowercase, stable): `member-blocks`
- Issue: #809 (owner-signed model, 2026-06-24)
- Rollout Stage: API + manage-list UI (task 2) and the optional safety escalation (task 3) are built.
  Enforcement across surfaces (task 4) and the admin global ban (task 5) are separate, later tasks.

## 2) What this stores

- Table: `member_blocks`
  - `id` (uuid, primary key)
  - `blocker_user_id` (text) — the member who created the block.
  - `blocked_user_id` (text) — the member who is blocked.
  - `created_at` (timestamptz) — when the block was created.
  - Unique on `(blocker_user_id, blocked_user_id)`; CHECK forbids a self-block.
- No `reason` column. Ordinary blocks are private; the admin never reads them. A member may block
  anyone for any reason and none is recorded.
- Table: `member_safety_reports` (issue #809, task 3) — the optional safety escalation, kept
  DELIBERATELY SEPARATE from `member_blocks` so ordinary blocks stay out of the admin's view. A row
  is written here only when the blocking member flags the block as a safety concern (suspected
  predator / human trafficker); it is then admin-visible.
  - `id` (uuid, primary key)
  - `reporter_user_id` (text) — the member who raised the concern (the blocker).
  - `reported_user_id` (text) — the member the concern is about (the blocked person).
  - `detail` (text, nullable) — optional free-text context the reporter added.
  - `status` (text, default `open`) — `open` | `reviewed` | `dismissed`; CHECK keeps it in-range.
  - `created_at` (timestamptz), `reviewed_at` (timestamptz, nullable), `reviewed_by_user_id` (text,
    nullable) — stamped when an admin moves a report out of `open`.
  - Indexed on `(status, created_at DESC)` for the admin queue read and on `reported_user_id` for the
    per-member repeat count. CHECK forbids a self-report.
  - The block and the safety report are written in ONE transaction, so a report can never exist
    without its block and a report-insert failure rolls the block back.

## 3) Resolving the blocked member's display label

The manage-list resolves `blocked_user_id` to a human label by a LEFT JOIN LATERAL to
`directory_profiles` on `claimed_by_user_id`, taking one profile (the oldest claimed one, `LIMIT 1`)
so a member who claimed more than one profile still appears once, using
`TRIM(first_name || ' ' || last_name)`. When there is no claimed profile, the label falls back to the
neutral word "Member" so every row still names someone the viewer can recognize and unblock.

## 4) Deletion behavior

On full-account deletion, the member's own blocks and the safety reports they filed are removed.
This is wired into the account deletion registry (`ctf/packages/web/lib/account/deletion-registry.ts`)
as two entries:

- `member-blocks`: `member_blocks` — `delete` where `blocker_user_id = <user>` (the blocks the member
  created).
- `member-safety-reports`: `member_safety_reports` — `delete` where `reporter_user_id = <user>` (the
  safety reports the member filed about others), and `safety_admin_audit_trail` retained. This entry
  has `serviceScopeSupported: false`, so the reports go only with the account, never when the member
  clears their blocked list (issue #2672). Reports ABOUT the member (`reported_user_id = <user>`) are the admin's safety
  evidence raised by someone else and are **NOT** deleted: retained like an audit/accountability
  record, because erasing them would destroy the owner's record of a predator/trafficker concern and
  would let a flagged member delete-and-rejoin to clear reports against them. A retained report that
  points at a now-deleted account is harmless evidence (the account is gone).

Scope notes:

- The member may also clear all their own blocks on their own via the standard service-scope delete
  (`DELETE /api/account/services/member-blocks`), since `serviceScopeSupported` is `true`. That
  removes `member_blocks` rows only; an open safety report the member filed stays for the owner to
  review. `DELETE /api/account/services/member-safety-reports` is refused, because that entry has no
  service scope.
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
