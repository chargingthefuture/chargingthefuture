# Stream Quota Impact Note — Chyme chat is stored before the Stream copy is sent

## Summary

- Feature/Change: A Chyme room chat message is now written to `chyme_messages` first, and the Stream copy is sent after that write has committed. A failed Stream step (user upsert, channel setup or send) is reported and no longer stops the member's send.
- PR: #3016
- Owner: Charging The Future
- Date: 2026-10-05

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: Chat (the room channel fan-out). The same calls are made per message as before, in a different order. No new channels, users or message types.

## Estimated Monthly Impact

- Chat MAU impact estimate: none — the same members are upserted as before.
- Activity Feed API calls estimate: none.
- Video participant-minutes estimate: none.
- AI Moderation credits estimate: none — the same messages reach Stream. A message whose database write fails no longer reaches Stream, so the count can only go down.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): unchanged.
- Peak scenario estimate: unchanged.

## Fallback and Degradation Plan

- What degrades first: the Stream copy. During a Stream outage messages are still stored and shown in both apps, which read from `chyme_messages`; only the Stream channel misses them.
- User-visible messaging behavior: a send succeeds during a Stream outage instead of failing.
- Kill switch / feature flag: none added; the existing Stream configuration check still skips the fan-out when Stream is not set up.

## Observability

- Metrics and alerts added/updated: a failed fan-out is reported with op `stream_fanout_send`, area `chyme`, and the channel it was meant for.
- Dashboard link (if available): not applicable.

## Validation

- Tests added for degraded mode: none; the Chyme manual test script covers a send during a Stream failure.
- Rollback strategy: revert the PR.
