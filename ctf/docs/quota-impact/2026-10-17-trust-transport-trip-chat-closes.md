# Stream Quota Impact Note: a TrustTransport trip chat ends with the trip

## Summary

- Feature/Change: a trip's 1:1 chat becomes read-only when the trip is completed, canceled or disputed, and stops opening 30 days after it was completed or canceled (issue #2857). The Stream channel is frozen on the ending change and again whenever an ended trip's chat is opened.
- PR: fix/trust-transport-trip-chat-closes
- Owner: owner decision, 2026-10-17
- Date: 2026-10-17

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: Chat only. One `updatePartial` call per trip that ends (complete, status change to an end state, order cancel), plus one per open of an ended trip's chat. No new users, channels, messages or video.

## Estimated Monthly Impact

- Chat MAU impact estimate: falls slightly. A closed chat mints no token and does not add its members back to the channel, so members of old trips stop counting toward MAU through that chat.
- Activity Feed API calls estimate: none.
- Video participant-minutes estimate: none.
- AI Moderation credits estimate: none; frozen channels take no new messages to moderate.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): Green, unchanged.
- Peak scenario estimate: one extra server call per ended trip; TrustTransport trip volume is low.

## Fallback and Degradation Plan

- What degrades first: if Stream is unreachable when a trip ends, the freeze is skipped and reported; the next open of that trip's chat freezes it.
- User-visible messaging behavior: an ended trip's chat shows "This trip has ended. You can read this chat until <date>, but not send in it." (or the dispute line) in place of the message box; a closed one answers "This trip's chat closed 30 days after the trip ended."
- Kill switch / feature flag: none; reverting the PR restores the earlier behavior. Unfreezing a channel is one Stream dashboard change.

## Observability

- Metrics and alerts added/updated: a failed freeze reports `area: trust-transport, op: freeze_trip_channel` with the trip id.
- Dashboard link (if available): none.

## Validation

- Tests added for degraded mode: `lib/trust-transport/trip-chat-window.test.ts` covers open, read-only with an end date, closed, and disputed.
- Rollback strategy: revert the PR; channels already frozen can be unfrozen from the Stream dashboard.
