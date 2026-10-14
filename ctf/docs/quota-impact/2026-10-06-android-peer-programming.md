# Stream Quota Impact Note — PeerProgramming in the Android app, with screen share

## Summary

- Feature/Change: the Android app gains PeerProgramming: the goal board, the cohort chat, and the
  live Session call with camera, microphone, Flip camera and Share screen. The goal board and the
  chat are database-backed and do not touch Stream.
- PR: opened from branch `feat/android-peer-programming`.
- Owner: chargingthefuture
- Date: 2026-10-06

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: **Video only.** The app joins the same per-cohort
  `default` call the web Session tab joins, with credentials from the same
  `POST /api/peer-programming/session/join`. No new call is created and no new call type is used.

## Estimated Monthly Impact

- Chat MAU impact estimate: no change. The cohort chat is stored in the app's own database, not in
  Stream Chat.
- Activity Feed API calls estimate: no change.
- Video participant-minutes / HLS / recording estimate: one participant per member in the call, the
  same as on the web; a member on Android instead of the web adds nothing. Sharing the phone's screen
  adds one more video track from that member while sharing, inside the same participant. A member who
  switches apps stays in the call (the foreground service), so minutes can run longer than on a web
  tab that gets closed; leaving the screen or pressing Leave session ends them. No HLS and no
  recording.
- AI Moderation credits estimate: no change.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Green**. Cohort calls are small and
  occasional; the app moves members between surfaces rather than adding new ones.
- Peak scenario estimate: an entire cohort in one call with one member sharing a screen.

## Fallback and Degradation Plan

- What degrades first: when Stream is not configured, the join route answers 503 and the Session tab
  shows its message ("Live video is not configured."); the goal board and the chat keep working.
- User-visible messaging behavior: as above; a declined screen-share prompt shows a calm line and the
  call carries on.
- Kill switch / feature flag: removing the Stream credentials makes the join route answer 503.

## Observability

- Metrics and alerts added/updated: none. Each join writes the existing
  `peer-programming.session.join` audit row.

## Validation

- Tests added for degraded mode: none automated. Mobile typecheck and lint pass.
- Manual check: AN-PP in `ctf/docs/developer/test-scripts/android-app-test-script.md`, on a real EAS
  build.
- Rollback strategy: revert the PR. No data migration is involved.
