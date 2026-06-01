# Stream Quota Impact Note — Chyme live audio room

## Summary

- Feature/Change: Replace the stubbed Chyme video panel with a real Stream **Video** audio room.
  Participants now actually join a Stream call (`default` call type, audio-only), publish/receive
  audio, see live speaking/mute state, and leave. Before this change Chyme minted Stream credentials
  but never established a media connection (the stub join failed), so it consumed **no** Video
  participant-minutes. This change introduces real, ongoing Video usage.
- PR: #266
- Owner: chargingthefuture
- Date: 2026-06-01

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: **Video** (new). Chyme's text chat already used
  Stream Chat; this adds Stream **Video** participant-minutes, which were previously zero because the
  stub never connected. No change to Chat, Activity Feeds, or AI Moderation.

## Estimated Monthly Impact

- Chat MAU impact estimate: no change (the Chyme chat channel and its members are unchanged).
- Activity Feed API calls estimate: no change.
- Video participant-minutes estimate: **net-new and the main cost of this change.** Audio rooms bill
  per participant-minute (every connected participant, speaking or listening, counts). Rough order of
  magnitude: `concurrent participants × minutes live × sessions`. Chyme is currently a single shared
  room, so usage scales with how long that room stays populated. Example: a 60-minute room with an
  average of 10 concurrent participants ≈ 600 participant-minutes per session. This is bounded by the
  one-room MVP but is unbounded per-session in duration, so it is the surface to watch as usage grows.
- AI Moderation credits estimate: no change.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Yellow** — this turns on a Video
  consumer that was previously dormant. Risk stays low while Chyme is one room with small concurrency,
  but rises with room duration and concurrent listeners.
- Peak scenario estimate: a long-running, well-attended room (e.g. several hours, dozens of concurrent
  listeners) is the peak driver; participant-minutes grow linearly with both duration and head count.

## Fallback and Degradation Plan

- What degrades first: if the Stream app does not have the Video product enabled, or a join otherwise
  fails, the audio room shows "Could not connect to the audio room." and stops there — it does not
  retry in a loop and does not consume minutes. The rest of Chyme (room state and text chat) keeps
  working.
- User-visible messaging behavior: a clear connecting/error message in place of the live stage; the
  text chat and room header remain usable.
- Kill switch / feature flag: demo-mode participants are routed to the dedicated **staging** Stream app
  (`STREAM_API_KEY_STAGING`/`STREAM_API_SECRET_STAGING`) via `resolveStreamCredentials`, so recording/
  demo sessions never draw on the production Maker-tier quota. There is no dedicated Chyme-audio flag
  yet; if Video minutes need to be cut off quickly, disabling the Video product (or rotating the room)
  degrades to the connection-error state above without breaking chat. Adding a dedicated kill flag is a
  follow-up.

## Observability

- Metrics and alerts added/updated: none added in this PR. Gap: there is no app-level metric for Chyme
  participant-minutes; Stream's own dashboard is the source of truth for now. A follow-up should add a
  minutes/concurrency signal so the Yellow risk above is monitored rather than estimated.

## Validation

- Tests added for degraded mode: none automated. The degraded path is exercised by the connecting/error
  branch in `chyme-audio-room.tsx`, which renders without ever joining when the client/call is absent.
  Typecheck and lint pass.
- Rollback strategy: revert the PR. Chyme returns to its prior state (text chat + room state, no media
  connection), which consumes no Video minutes. No data migration is involved.
