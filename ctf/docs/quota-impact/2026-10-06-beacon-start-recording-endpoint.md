# Stream Quota Impact Note — Beacon starts HLS and recording through their own endpoints

## Summary

- Feature/Change: `startBeaconBroadcastEgress` started the public HLS feed and the recording by
  sending a second `go_live` with `start_hls` + `start_recording` to a call that was already live. No
  recording was ever made, so every ended event showed "no recording found" and no replay was posted.
  It now calls `POST /api/v2/video/call/livestream/{id}/start_broadcasting` and
  `POST .../start_recording` (the paths Stream's own client uses for `startHLS()` and
  `startRecording()`), attempting both even when one fails. A refusal naming something as already
  running counts as success; any other refusal is thrown with each message.
- PR: opened from branch `fix/beacon-chat-and-recording`.
- Owner: chargingthefuture
- Date: 2026-10-06

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: **Video only.** The triggers are unchanged (the
  in-browser screen-share and the `call.session_participant_joined` webhook); only the request that
  starts HLS and recording changes. No new call, poll or participant. Chat is untouched.

## Estimated Monthly Impact

- Chat MAU impact estimate: no change.
- Activity Feed API calls estimate: at most one replay notice per broadcast, which the feature was
  designed to post and was not posting.
- Video participant-minutes / HLS / recording estimate: **recording minutes rise from zero to one
  recording per broadcast**, the amount the feature was designed for. HLS consumption is unchanged
  if the old request was starting HLS, and rises to the designed amount if it was not. Each trigger
  now makes two requests instead of one; requests are not a metered surface.
- AI Moderation credits estimate: no change.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Green-to-Yellow**, the band the
  feature was already sized for. Beacon runs one one-way broadcast at a time.
- Peak scenario estimate: a long, well-attended broadcast with one 720p recording. Unchanged in kind;
  the recording is now actually made.
- Newly consuming case to be aware of: recordings now exist and are stored by Stream until copied by
  the "Beacon — Keep a copy of each recording" workflow.

## Fallback and Degradation Plan

- What degrades first: if Stream is not configured, `startBeaconBroadcastEgress` returns false as
  before. If Stream refuses one start, the other is still attempted, so a broadcast on air without a
  recording still gets one where Stream allows it.
- User-visible messaging behavior: a real refusal now reaches the host stage as "The public broadcast
  and recording did not start:" with Stream's reason, instead of being hidden.
- Kill switch / feature flag: unchanged. Ending the event (`POST /api/beacon/[id]/end`, `stop_live`)
  stops HLS and recording. Demo mode still uses the staging Stream app.

## Observability

- Metrics and alerts added/updated: none added. Refusals are reported through `reportError` with
  `op: 'start_broadcast'` (browser path) and `op: 'start_egress_on_participant_joined'` (webhook
  path), and the message now names the endpoint that refused. An already-running start is no longer
  reported, so those reports now mean a real refusal.

## Validation

- Tests added for degraded mode: none automated. Type check, lint and the pre-push build pass.
- Manual check: BCN-A2e in `ctf/docs/developer/test-scripts/beacon-test-script.md` — broadcast with
  a screen-share, end it, and confirm the event reads `recording ready` with a replay posted once.
- Rollback strategy: revert the PR. Beacon returns to the second `go_live` request and no recordings.
  No data migration is involved.
