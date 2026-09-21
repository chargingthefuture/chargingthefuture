# Stream Quota Impact Note — the Video minute meter covers every call

## Summary

- Feature/Change: The app's Stream Video minute meter (`stream_video_usage_daily`, shipped the
  same day for the Chyme rooms) now covers every Stream Video call. Owner decision: the app's meter
  is the only one read; the Stream dashboard is not. Beacon publishers, PeerProgramming cohort
  calls, and Foundation calls are credited from Stream's `call.session_participant_left` webhook
  event, whose `duration_seconds` is one participant's time in the session. The event already
  arrived at the Beacon webhook route (the one URL Stream sends every call event to) and was
  acknowledged without acting; it is now read by `lib/stream-quota/webhook-usage.ts`.
- PR: `feat/stream-video-meter-all-calls`
- Owner: chargingthefuture
- Date: 2026-09-19

## Stream Surfaces Affected

- **Video**: none in usage terms — no call is created, joined, or changed. One more webhook event
  type is acted on at the existing endpoint. Webhook deliveries are not a metered Stream surface.
- Chat, Activity Feeds, AI Moderation: no change.

## Estimated Monthly Impact

- Chat MAU impact estimate: none.
- Activity Feed API calls estimate: none.
- Video participant-minutes estimate: none; this measures them. One database write per participant
  who leaves a non-Chyme call. Chyme rooms and Back Channel calls are skipped by call id prefix so a
  Chyme minute is never counted twice (their heartbeats feed the meter).
- AI Moderation credits estimate: none.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Green.** The meter's percent may
  read higher than before because it now includes surfaces it did not count; the bands and the
  Chyme caps read the same table, so a busy Beacon month now correctly moves the Chyme policy
  toward Yellow. That is the meter working, not a new cost.
- Peak scenario estimate: bounded by the number of participants leaving calls — one small write
  each.

## Fallback and Degradation Plan

- What degrades first: a payload without a usable `duration_seconds` or `call_cid` is acknowledged
  with `handled: false` and nothing is written; a database failure is caught by the route's existing
  catch (reported, acknowledged with 200 so Stream does not retry into a fault). A missing webhook
  registration means these surfaces read zero, exactly as before this change.
- User-visible messaging behavior: none for members. The admin screen's surface lines say which
  are heartbeat-credited and which are webhook-credited.
- Kill switch / feature flag: none needed; removing the three-line branch in the webhook route
  returns to acknowledging the event.

## Observability

- Metrics and alerts added/updated: the meter itself gains three surfaces (`beacon`,
  `peer-programming`, `foundation`, plus `other` for an unrecognized call id), visible on
  `/admin/chyme`. A write failure lands in the webhook route's existing `reportError`
  (`op: 'stream_webhook'`, with the event type).
- Dashboard link (if available): `/admin/chyme`.

## Validation

- Tests added for degraded mode: `lib/stream-quota/webhook-usage.test.ts` — the prefix mapping,
  the Chyme/Back Channel skip, the "other" bucket, integer-second rounding, and the ignored payloads
  (wrong event type, zero duration, missing duration). Typecheck and lint pass.
- Rollback strategy: revert the PR; no schema change.
