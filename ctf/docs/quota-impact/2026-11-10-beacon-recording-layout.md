# Stream Quota Impact Note — Beacon replays keep the full picture

## Summary

- Feature/Change: Beacon sets each call's recording layout to `single-participant` with
  `detect_orientation` on and `video.scale_mode: fit` (`BEACON_RECORDING_LAYOUT` in
  `packages/web/lib/beacon/stream.ts`), through one `PATCH /api/v2/video/call/livestream/{id}` when
  the broadcast panel opens. A phone held upright was recorded in a landscape frame with the picture
  cropped to fill a tile; now an upright phone records upright and nothing is cropped.
- PR: opened from branch `fix/beacon-recording-full-frame`.
- Owner: chargingthefuture
- Date: 2026-11-10

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: **Video recording.** One more call-settings request
  per broadcast. The recording itself is the same length and the same 720p size; only its framing
  changes.

## Estimated Monthly Impact

- Chat MAU impact estimate: no change.
- Activity Feed API calls estimate: no change.
- Video participant-minutes / HLS / recording estimate: no change in minutes. One extra API request
  each time the broadcast panel opens.
- AI Moderation credits estimate: no change.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): unchanged.
- Peak scenario estimate: unchanged.

## Fallback and Degradation Plan

- What degrades first: if Stream refuses the layout, the refusal is reported (op `recording_layout`)
  and Go live carries on; the replay keeps Stream's default framing.
- User-visible messaging behavior: none.
- Kill switch / feature flag: revert the PR.

## Observability

- Metrics and alerts added/updated: the error report above.
- Dashboard link (if available): N/A.

## Validation

- Tests added for degraded mode: the layout request is wrapped so its failure cannot reach the
  ingest route. Checked by typecheck, lint and the web build; the framing itself is checked by the
  Beacon test script after a real broadcast.
- Rollback strategy: revert the PR; calls created afterwards record with Stream's default layout.
