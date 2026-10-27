# Stream Quota Impact Note: Chyme room chat removed

## Summary

- Feature/Change: Chyme room chat is removed (3.1.0). Joining a room no longer creates or joins a Stream chat channel; the join answers with the room's call id only. Room audio, the Back Channel and tips are unchanged.
- PR: fix/chyme-remove-room-chat
- Owner: owner decision, 3.1 plan
- Date: 2026-10-27

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: Chat only, and only downward. No Chyme chat channel is created or joined. Video is unchanged.

## Estimated Monthly Impact

- Chat MAU impact estimate: falls. A member who only uses Chyme no longer counts toward Chat MAU through the room channel.
- Activity Feed API calls estimate: none.
- Video participant-minutes estimate: none.
- AI Moderation credits estimate: none; no Chyme messages to moderate.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): Green, unchanged or lower.
- Peak scenario estimate: one fewer Stream chat call per room join.

## Fallback and Degradation Plan

- What degrades first: nothing new; there is no chat to degrade.
- User-visible messaging behavior: the room has no chat panel, signed in or out.
- Kill switch / feature flag: none; reverting the PR restores the chat.

## Observability

- Metrics and alerts added/updated: none. The deletion cleanup of a member's Stream user (`deleteChymeStreamData`) stays and keeps reporting `area: chyme, op: stream_delete_user`, because Stream still holds messages copied before 2026-10-16.
- Dashboard link (if available): none.

## Validation

- Tests added for degraded mode: none needed; the path is removed.
- Rollback strategy: revert the PR. The dropped `chyme_messages` table would need its `CREATE TABLE` back in `schema.sql`; the old rows are not recoverable.
