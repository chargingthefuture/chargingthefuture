# Stream Quota Impact Note — Foundation instant calls in the Android app

## Summary

- Feature/Change: the Android app gains Foundation's instant 1:1 calls: call alerts on this device
  (native push), the incoming-call ring with Answer and Decline, the live audio call with Mute,
  Extend and End, and "Connect now" from the member's connections. Every other Foundation screen
  stays on the web.
- PR: opened from branch `feat/android-foundation-calls`.
- Owner: chargingthefuture
- Date: 2026-10-06

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: **Video only, audio-only 1:1.** The app joins the
  same per-call `default` Video call the web joins, with credentials from the same
  `GET /api/foundation/connections/instant-calls/[callId]`, camera off and microphone on. No new call
  is created and no new call type is used. The ring push goes through Expo, not Stream.

## Estimated Monthly Impact

- Chat MAU impact estimate: no change. Direct Line messages stay on the web; the app reads no Stream
  Chat channel.
- Activity Feed API calls estimate: no change.
- Video participant-minutes / HLS / recording estimate: two participants per answered call, the same
  as on the web; a member on Android instead of the web adds nothing. Audio only, so no video tracks.
  A member who locks the phone stays in the call (the foreground service), so minutes can run longer
  than on a web tab that gets closed; End, or the block time running out, ends them. Calls are capped
  by the caller's block limit (at most 24 blocks). No HLS and no recording.
- AI Moderation credits estimate: no change.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Green**. 1:1 audio calls with credits
  attached are few, and the app moves members between surfaces rather than adding new ones.
- Peak scenario estimate: several 1:1 audio calls at once, each up to its block limit.

## Fallback and Degradation Plan

- What degrades first: when Stream is not configured, the call state route returns no audio
  credentials, and the answered call screen shows End with no audio room, as on the web.
- User-visible messaging behavior: the route's own messages (out of credits, the person is busy, too
  many attempts). When native push is not available (no EAS project id, or notifications blocked) the
  call alerts switch says so, and an incoming call still shows while the app is open.
- Kill switch / feature flag: removing the Stream credentials stops the audio join; turning call
  alerts off on the device stops the ring push.

## Observability

- Metrics and alerts added/updated: none. Ringing, answering, extending, ending and push subscribe
  already write Foundation audit rows. Join and microphone failures go to `reportError` (Sentry).

## Validation

- Tests added for degraded mode: none automated. Mobile typecheck and lint pass.
- Manual check: AN-FD in `ctf/docs/developer/test-scripts/android-app-test-script.md`, on a real EAS
  build.
- Rollback strategy: revert the PR. No data migration is involved.
