# Stream Quota Impact Note: the 3.1 live room drawn to its board

## Summary

- Feature/Change: the Chyme room inside the 3.1 frame is laid out to the approved "Live room" and "Room bar while browsing" boards, on web and Android. The call itself is unchanged: the same call type, the same join (camera and microphone off), the same token, the same presence heartbeat, the same leave. The new layout reads two things the Stream SDK already holds in the browser or app: the participant list (as before) and the call session's start time (`useCallStartedAt`), for "Since 1:53 PM CDT".
- PR: feat/live-room-design
- Owner: owner decision, 3.1 design canvas
- Date: 2026-11-03

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: Video only, read-only. No new call, track, request or permission.

## Estimated Monthly Impact

- Chat MAU impact estimate: none.
- Activity Feed API calls estimate: none.
- Video participant-minutes estimate: none. Joining still happens only on Listen in, and the call still ends on Leave quietly, from the room or from the room bar.
- AI Moderation credits estimate: none.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): unchanged.
- Peak scenario estimate: unchanged; the start time is part of the join answer the SDK already receives.

## Fallback and Degradation Plan

- What degrades first: nothing new. The quota policy's notice, the room cap and the paused Back Channel behave as before; the notice is drawn in the 3.1 look.
- User-visible messaging behavior: when the SDK has no start time, "Since" is left out of the header.
- Kill switch / feature flag: none; the 3.0 Chyme page keeps its layout, and reverting the PR restores the earlier 3.1 room.

## Observability

- Metrics and alerts added/updated: none. The join keeps reporting `area: chyme, op: audio_join` (web) and `op: audio_room_join` (Android).
- Dashboard link (if available): none.

## Validation

- Tests added for degraded mode: none needed; no Stream path changed.
- Rollback strategy: revert the PR.
