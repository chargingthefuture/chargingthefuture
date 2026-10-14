# Stream Quota Impact Note — Beacon broadcasts from the browser's camera and microphone

## Summary

- Feature/Change: the Beacon admin page gains "Use camera and microphone" (with a preview and a camera
  flip), so the host can go live from a phone's browser with no broadcaster app. The admin page now
  joins the call only when that button or "Share screen" is pressed, instead of as soon as Go Live
  succeeds. The start-broadcast request is retried up to four times, three seconds apart.
- PR: opened from branch `feat/beacon-phone-camera-broadcast`.
- Owner: chargingthefuture
- Date: 2026-10-06

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: **Video.** The same one host publisher in the same
  `livestream` call, now sending a camera and microphone where it sent a screen share. Viewers still
  watch over HLS and never join the call.

## Estimated Monthly Impact

- Chat MAU impact estimate: no change.
- Activity Feed API calls estimate: no change.
- Video participant-minutes / HLS / recording estimate: one host participant per broadcast, as
  before. HLS and recording minutes are what Beacon was sized for, now with real picture and sound.
  An admin who opens the page without broadcasting no longer adds a participant at all, which
  removes the silent minutes the old join-on-load spent.
- AI Moderation credits estimate: no change.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Green-to-Yellow**, the band Beacon
  was already sized for. One one-way broadcast at a time.
- Peak scenario estimate: unchanged in kind.

## Fallback and Degradation Plan

- What degrades first: if the browser refuses the camera or microphone, the error shows under the
  buttons and nothing is joined. If every start attempt is refused, the error replaces the "live" line.
- User-visible messaging behavior: as above, in the admin's broadcast panel.
- Kill switch / feature flag: ending the event (`stop_live`) stops HLS and recording; leaving the page
  leaves the call.

## Observability

- Metrics and alerts added/updated: none. Device and start failures go through `reportError`
  (`op: 'host_camera'`, `'host_screen_share'`, `'start_broadcast_client'`), and the event's Log in the
  admin history shows each start.

## Validation

- Tests added for degraded mode: none automated. Type check, lint, Beacon tests and the build pass.
- Manual check: BCN-A2 in `ctf/docs/developer/test-scripts/beacon-test-script.md`.
- Rollback strategy: revert the PR. No data migration is involved.
