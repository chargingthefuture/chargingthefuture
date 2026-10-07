# Stream Quota Impact Note — Beacon in the Android app, with camera and screen share

## Summary

- Feature/Change: the Android app gains an Apps list and Beacon: the HLS viewer, member chat, and for
  an admin, going live with the camera and microphone or by sharing the phone's screen. The Stream
  config plugin gets `enableScreenshare: true`.
- PR: opened from branch `feat/android-apps-list-beacon`.
- Owner: chargingthefuture
- Date: 2026-10-06

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: **Video and Chat.** Viewers watch over HLS, the
  same public playlist the web viewer plays, and never join the call. Members chat in the event's
  existing channel. The host joins the same `livestream` call the web admin page joins, as the one
  publisher.

## Estimated Monthly Impact

- Chat MAU impact estimate: members who chat from the app were already counted when they chatted on
  the web; a member who only uses the app adds one MAU while chatting.
- Activity Feed API calls estimate: no change.
- Video participant-minutes / HLS / recording estimate: one host participant per broadcast, as on
  the web. HLS viewing minutes grow with Android viewers, the same as web viewers. Recording is one
  per broadcast, unchanged.
- AI Moderation credits estimate: no change.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Green-to-Yellow**, the band Beacon
  was sized for. One one-way broadcast at a time.
- Peak scenario estimate: a long broadcast with many Android viewers; HLS scales like the web viewer.

## Fallback and Degradation Plan

- What degrades first: a refused start shows on the host card and is retried; the viewer keeps its
  last state on a failed poll; chat shows "Live chat is unavailable right now."
- User-visible messaging behavior: as above.
- Kill switch / feature flag: ending the event (`stop_live`) stops HLS and recording; leaving the
  Beacon screen leaves the call.

## Observability

- Metrics and alerts added/updated: none. Each start appears in the event's Log on the web admin page.

## Validation

- Tests added for degraded mode: none automated. Mobile typecheck and lint pass.
- Manual check: AN-BN in `ctf/docs/developer/test-scripts/android-app-test-script.md`, on a real EAS
  build.
- Rollback strategy: revert the PR. No data migration is involved.
