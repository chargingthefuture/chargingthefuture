# Stream Quota Impact Note — a re-sent participant-left webhook counts its minutes once

## Summary

- Feature/Change: `call.session_participant_left` on `/api/beacon/stream-webhook` added the
  participant's seconds to the app's Stream Video meter (`stream_video_usage_daily`) with no record
  of the delivery. The body carries no delivery id, so when Stream re-sent a delivery after a slow
  response the same minutes were counted again. A new table, `stream_video_webhook_deliveries`, holds
  one row per processed delivery keyed on `call_cid|session_id|participant.user_session_id`, inserted
  in the same transaction as the credit; a re-sent delivery credits nothing. A payload missing any of
  those ids is still credited, as before.
- PR: opened from branch `fix/stream-webhook-participant-left-dedupe`.
- Owner: chargingthefuture
- Date: 2026-10-14

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: **Video**, the app's own minute meter only. No
  request to Stream is added or removed; nothing about what Stream bills changes.

## Estimated Monthly Impact

- Chat MAU impact estimate: no change.
- Activity Feed API calls estimate: no change.
- Video participant-minutes / HLS / recording estimate: no change to what Stream counts. The app's own
  meter reads lower by exactly the minutes it was counting twice, so it now matches Stream's figure
  more closely.
- AI Moderation credits estimate: no change.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): unchanged in real use. The quota guards
  that read this meter stop tripping early on minutes that were counted twice.
- Peak scenario estimate: a burst of re-sends no longer inflates the meter.

## Fallback and Degradation Plan

- What degrades first: if the dedupe insert fails, the transaction rolls back and the credit is not
  written; the route reports the failure under `beacon` / `stream_webhook` and still answers 200, so
  those minutes are missing from the meter (an undercount) rather than counted twice.
- User-visible messaging behavior: none.
- Kill switch / feature flag: none needed; reverting the PR restores the old counting.

## Observability

- Metrics and alerts added/updated: none. The meter on `/admin/chyme` (Live Audio Usage) is where a
  double count would show.

## Validation

- Tests added for degraded mode: unit tests for the dedupe key, including a payload missing an id.
- Manual check: the meter check in `ctf/docs/developer/test-scripts/beacon-test-script.md`.
- Rollback strategy: revert the PR. The new table can stay; nothing else reads it.
