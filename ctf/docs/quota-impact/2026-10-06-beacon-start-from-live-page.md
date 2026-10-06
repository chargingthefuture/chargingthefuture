# Stream Quota Impact Note — Beacon starts a phone broadcast's feed and recording from the live page

## Summary

- Feature/Change: `GET /api/beacon/current` calls `startBeaconBroadcastEgress` when an event is live
  and Stream has no HLS playlist yet, and the admin page reads that route every 15 seconds while its
  open event is live. Before this, a phone broadcast's feed and recording started only on Stream's
  `call.session_participant_joined` webhook, which did not arrive for the 2026-10-06 broadcasts, so
  nothing was shown to viewers and nothing was recorded.
- PR: opened from branch `fix/beacon-start-recording-without-webhook`.
- Owner: chargingthefuture
- Date: 2026-10-06

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: **Video.** The same two start requests the webhook
  and the screen share already make. No new call, participant or recording.

## Estimated Monthly Impact

- Chat MAU impact estimate: no change.
- Activity Feed API calls estimate: no change.
- Video participant-minutes / HLS / recording estimate: **HLS and recording minutes rise from zero to
  the designed one feed and one recording per broadcast** for phone broadcasts, the amount Beacon was
  sized for. Start requests: two per attempt, at most one attempt per 15 seconds per event per server
  instance, only while live with no playlist, and none after a start works. Requests are not metered.
- AI Moderation credits estimate: no change.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Green-to-Yellow**, the band Beacon
  was already sized for. One one-way broadcast at a time.
- Peak scenario estimate: unchanged in kind; the feed and recording now actually run.

## Fallback and Degradation Plan

- What degrades first: a refused start is retried on the next poll and logged once per distinct
  reason. The public route still answers if the start throws.
- User-visible messaging behavior: the event's Log in the admin history shows the attempt and
  Stream's reason.
- Kill switch / feature flag: ending the event (`stop_live`) stops HLS and recording, and the route
  only starts anything for a `live` event.

## Observability

- Metrics and alerts added/updated: none. Failures go through `reportError`
  (`op: 'viewer_start_broadcast'`) and the event's Log.

## Validation

- Tests added for degraded mode: none automated. Type check, lint, Beacon tests and the build pass.
- Manual check: BCN-A2c in `ctf/docs/developer/test-scripts/beacon-test-script.md`.
- Rollback strategy: revert the PR. No data migration is involved.
