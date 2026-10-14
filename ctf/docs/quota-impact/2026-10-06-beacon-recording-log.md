# Stream Quota Impact Note — Beacon admin history shows why an event has no recording

## Summary

- Feature/Change: the admin event history gains a Log for each live or ended event. When an event
  still has no recording, the admin list's existing lookup (`GET .../recordings`, up to five events
  per load) now returns why: no recording for the call, recordings with no file yet, or the lookup's
  own error. The Stream webhook writes `call.recording_started`, `_stopped` and `_failed`, the
  publisher-joined start and recording-ready to the event's audit trail, and the start-broadcast route
  writes its failures there too.
- PR: opened from branch `fix/beacon-recording-log`.
- Owner: chargingthefuture
- Date: 2026-10-06

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: **Video, read-only.** No new request to Stream: the
  recordings lookup was already made on each admin list load, and the webhook events were already
  being delivered and acknowledged. Nothing new is started, joined, polled or recorded.

## Estimated Monthly Impact

- Chat MAU impact estimate: no change.
- Activity Feed API calls estimate: no change.
- Video participant-minutes / HLS / recording estimate: no change.
- AI Moderation credits estimate: no change.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): unchanged.
- Peak scenario estimate: unchanged; the change only reads and records what already happens.

## Fallback and Degradation Plan

- What degrades first: a failed log write is reported and never fails the webhook or the route. A
  failed log read leaves the admin list without logs rather than failing it.
- User-visible messaging behavior: the admin row shows Stream's answer instead of a bare
  "no recording found".
- Kill switch / feature flag: none needed; no Stream usage is added.

## Observability

- Metrics and alerts added/updated: none. The log is the observability: each broadcast step and its
  failure reason is now readable on `/admin/beacon` without the hosting logs.

## Validation

- Tests added for degraded mode: none automated. Type check, lint, Beacon tests and the build pass.
- Manual check: BCN-A1c in `ctf/docs/developer/test-scripts/beacon-test-script.md`.
- Rollback strategy: revert the PR. No data migration is involved.
