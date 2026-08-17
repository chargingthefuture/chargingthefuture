# Stream Quota Impact Note — Beacon starts egress when any publisher joins

## Summary

- Feature/Change: Start the public HLS feed and the recording when a publisher actually joins the
  Beacon call, instead of only when the in-browser screen-share starts. The existing
  `POST /api/beacon/[id]/start-broadcast` route is the only thing that starts HLS and recording, and
  its only caller was the browser screen-share control, which fires on a screen-share track. A phone
  pushing RTMP publishes an ordinary video track, so a broadcast run entirely from a phone started
  neither: viewers could sit in front of an empty player, and nothing was recorded, so no replay was
  posted to the Commons. The Stream webhook route now also acts on
  `call.session_participant_joined` and starts egress for the matching live event.
- PR: opened from branch `fix/beacon-start-egress-on-rtmp-publisher`.
- Owner: chargingthefuture
- Date: 2026-08-10

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: **Video only.** This changes *what triggers* the
  start of HLS and recording on a call that has already gone live. It adds no call, no new API poll,
  and no new participant. No change to Chat, Activity Feeds, or AI Moderation.

## Estimated Monthly Impact

- Chat MAU impact estimate: no change (the event chat channel and its members are untouched).
- Activity Feed API calls estimate: no change. The replay notice posted to the Commons is unchanged —
  it was already written on `call.recording_ready`. In the phone-only case that notice previously never
  fired at all, so this is at most one Feed write per phone broadcast that should already have
  happened.
- Video participant-minutes / HLS / recording estimate: **unchanged for the browser path, and up by
  the intended amount for the phone path.** For a browser-hosted broadcast the egress start now has
  two possible triggers instead of one, but egress can only start once per call, so consumption is
  identical. For a phone-only broadcast, HLS distribution and one recording now happen where before
  they did not — that is the feature working as designed, not new overhead. No new polling and no
  per-interval traffic is introduced: the trigger is a webhook Stream already sends.
- Webhook volume: `call.session_participant_joined` is delivered for publishers only. Viewers watch
  over public HLS and never join the call, so this is one or two deliveries per broadcast, not one per
  viewer. Webhook deliveries are not a metered Stream surface.
- AI Moderation credits estimate: no change.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Green-to-Yellow**, the same band the
  feature already sat in. Beacon runs a single one-way livestream at a time, so HLS distribution and
  recording scale with broadcast duration and viewer count. This change does not raise the ceiling; it
  makes the phone input path reach the ceiling the browser path already could.
- Peak scenario estimate: a long, well-attended broadcast (HLS to many viewers plus one recording).
  Unchanged by this PR — the peak driver is viewer count and duration, not the trigger.
- Newly consuming case to be aware of: a phone broadcast that previously produced no HLS and no
  recording now produces both. If a phone broadcast is started and left running unattended, it draws
  Video quota where it previously drew none. Ending the event remains the stop control.

## Fallback and Degradation Plan

- What degrades first: if Stream is not configured, `startBeaconBroadcastEgress` returns false and the
  handler acknowledges the webhook with `handled: false`; nothing throws and no broadcast state
  changes. If Stream refuses the start because egress is already running, the error is reported and
  acknowledged — the broadcast is already on air, so there is nothing to recover.
- User-visible messaging behavior: unchanged. The public viewer stays in its starting/idle state until
  the HLS playlist URL appears, and the admin surfaces are untouched by this PR.
- Kill switch / feature flag: unchanged. Demo-mode sessions are routed to the dedicated **staging**
  Stream app via `resolveStreamCredentials`, so demo and recording sessions never draw on the
  production Maker-tier quota. To cut HLS and recording quickly, ending the event
  (`POST /api/beacon/[id]/end`) stops the call, HLS distribution, and recording — that remains the one
  stop control, and it now matters more for phone broadcasts because they consume quota where they
  previously consumed none.
- Guard against a webhook putting an event back on air: the handler starts egress only for an event
  whose status is `live`. A draft that has not gone live, and an ended event still receiving a
  straggling join, are both ignored.

## Observability

- Metrics and alerts added/updated: none added. A failed or duplicate start is reported through
  `reportError` with `op: 'start_egress_on_participant_joined'` and carries the event id and call id,
  so the phone path is now visible in error reporting instead of failing silently. The pre-existing
  `op: 'stream_webhook'` catch now also records the event type it was handling. Stream's own dashboard
  remains the source of truth for HLS and recording usage.

## Validation

- Tests added for degraded mode: none automated. The degraded paths are the false-return branch in
  `startBeaconBroadcastEgress` (Stream unconfigured), the non-`live` event guard, and the caught
  duplicate-start error. Typecheck, lint, and build pass for the changed files.
- Manual check: run a broadcast from a phone only, with no browser screen-share anywhere, and confirm
  video reaches `/apps/beacon` signed out and a replay is posted to the Commons after the event ends.
  This is recorded as a step in `ctf/docs/developer/test-scripts/beacon-test-script.md`.
- Rollback strategy: revert the branch. Beacon returns to its prior state — egress starts only from
  the in-browser screen-share, and phone-only broadcasts again produce no public feed and no replay.
  No data migration is involved.
