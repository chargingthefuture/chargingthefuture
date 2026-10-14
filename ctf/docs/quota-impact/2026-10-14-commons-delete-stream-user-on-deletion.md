# Stream Quota Impact Note — Commons deletes the member's Stream user on account deletion

## Summary

- Feature/Change: account deletion and Commons service deletion left the member's `feed-<userId>`
  Stream user behind, named with their @username and holding their Commons and contributor channel
  memberships. A new `deleteFeedStreamData` in `ctf/packages/web/lib/feed/stream.ts` hard-deletes
  that Stream user. It is registered under `feed-announcements` in the external-cleanup registry, so
  it runs after both kinds of deletion.
- PR: opened from branch `fix/commons-blocks-stream-cleanup-and-audit`.
- Owner: chargingthefuture
- Date: 2026-10-14

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: **Chat.** One user delete request per deletion. No
  new channel, message or user is created.

## Estimated Monthly Impact

- Chat MAU impact estimate: no rise. A deleted user stops counting toward monthly active users once
  removed; a member who comes back to the Commons later creates a fresh user, as any first visit does.
- Activity Feed API calls estimate: no change.
- Video participant-minutes / HLS / recording estimate: no change.
- AI Moderation credits estimate: no change.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): unchanged. One server-side request per
  account or Commons deletion, which happen a few times a month.
- Peak scenario estimate: a burst of deletions adds the same number of delete requests, far inside
  Stream's server-side rate limit.

## Fallback and Degradation Plan

- What degrades first: when Stream is not configured or the delete fails, the function returns false
  and never throws; the external-cleanup registry records it as a logged failure, and the account
  deletion itself still completes.
- User-visible messaging behavior: none. The member sees the same deletion result as before.
- Kill switch / feature flag: removing the `feed-announcements` registry entry stops the call.

## Observability

- Metrics and alerts added/updated: none. A failed delete is reported under `feed` /
  `stream_delete_user` with the Stream user id, and the cleanup registry logs the failure.

## Validation

- Tests added for degraded mode: none automated. Type check, lint and the build pass.
- Manual check: delete a test account that has visited the Commons, then confirm in the Stream
  dashboard that its `feed-<userId>` user no longer exists.
- Rollback strategy: revert the PR. No data migration is involved.
