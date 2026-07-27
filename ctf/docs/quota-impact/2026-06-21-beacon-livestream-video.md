# Stream Quota Impact Note — Beacon livestream video

## Summary

- Feature/Change: Beacon, an admin-only one-way livestream plugin. An admin goes live ad hoc to
  broadcast a live demo (screen content); the flagship use is the "State of the Skills Economy"
  address. Watching is public over HLS (no sign-in); chatting/reacting needs a signed-in member
  (Stream Chat). Recording is on; the replay is posted to the Commons.
- PR: branch `feat/beacon-plugin` (no PR opened yet)
- Owner: chargingthefuture
- Date: 2026-06-21

## Stream Surfaces Affected

- Video. One Stream `livestream` call per event (call id `beacon-<eventId>`). The admin is the only
  publisher (RTMP ingest from a phone broadcaster app, or in-browser desktop screen-share). Public
  viewers watch over HLS, which does not multiply WebRTC participant cost. Recording is enabled, which
  adds recording storage and a recording-ready webhook.
- Chat. One Stream `livestream` chat channel per event (same id). Only signed-in members get a token,
  so chat MAU is bounded by members who choose to chat during an event, not by total viewers.
- Activity Feed / AI Moderation: none.

## Estimated Monthly Impact

- Video minutes are the most cost-sensitive Stream usage here, and cost scales with viewers ×
  duration. Public viewing is served over HLS (a single broadcast distributed to many viewers) rather
  than per-viewer WebRTC, so it does not fan out into per-participant WebRTC minutes. Events are ad
  hoc and infrequent (no fixed cadence), so total minutes stay low: a handful of broadcasts a month,
  each tens of minutes, over a single publisher.
- Recording storage: one recording per event, retained as the replay link. Small at current cadence.
- Chat MAU: only members who actually post chat count; watchers who never chat add nothing. Bounded
  and low.

## Budget Threshold Risk

- Expected threshold after rollout: Green. Single publisher, HLS distribution for viewers, infrequent
  ad hoc events. The dominant lever is event duration, which the admin controls and ends explicitly.
- Peak scenario: a long, heavily-watched broadcast. Even then, HLS keeps the cost off per-viewer
  WebRTC, and there is at most one live event at a time (enforced by a partial unique index on the
  events table). Re-evaluate if event frequency or duration grows substantially.

## Fallback and Degradation Plan

- What degrades first: if Stream is not configured (no API key/secret), `resolveStreamCredentials()`
  returns null and every Beacon Stream call degrades safely — `current` shows the idle/replay state,
  the ingest/go-live routes return 503, and the chat-token route returns 503. Nothing crashes.
- The End-event path is the billing kill switch: ending an event calls `endBeaconCall`, which stops
  the Stream call so distribution and billing stop. The End route stops the call before marking the
  event ended, and reports (does not swallow) a stop failure so it can be followed up.
- Demo mode already routes Stream to the staging app (`resolveStreamCredentials`), so recording
  sessions never consume production quota.

## Observability

- Server errors are reported to Sentry via `reportError` (`area: 'beacon'`, ops: `current`, `ingest`,
  `go_live`, `end`, `end_stop_call`, `moderate`, `chat_token`, `stream_webhook`, and client
  `host_join_client`).
- Admin actions (create, go-live, end, moderate, ingest) are written to
  `beacon_events_admin_audit_trail`.

## Validation

- Tests added for degraded mode: covered by each route's explicit 503 branch when Stream is not
  configured, and by the viewer's idle state when `current` returns no live event. No automated test
  harness for live Stream calls (consistent with the existing Chyme / PeerProgramming video
  surfaces).
- Rollback strategy: revert the branch, or unset the production Stream credentials to disable the
  broadcast path while leaving the rest of the app intact.

## Open confirmations (owner action before first real broadcast)

- The Video REST field names and endpoints this build reads are confirmed against Stream's current
  docs (2026-06-21) and the in-code `TODO(beacon)` markers are resolved: RTMP ingest at
  `call.ingress.rtmp.address` with a host user token used as the stream key; HLS at
  `call.egress.hls.playlist_url`; the `go_live` (start_hls + start_recording) and `stop_live`
  endpoints; and the `call.recording_ready` webhook payload (`call_cid`, `call_recording.url`). Each
  field is read defensively; no URL is fabricated when a field is absent.
- Still needs the owner in the Stream dashboard: confirm the `livestream` call-type config (host-only
  publish; viewer role cannot publish) and that recording is enabled (or rely on the
  `settings_override.recording` this build sets), and register the recording webhook endpoint
  (`/api/beacon/stream-webhook`) so `call.recording_ready` is delivered and signed.
- Still needs a live smoke test: one real broadcast end to end (go live from a phone broadcaster app
  over RTMP, watch the public HLS on a non-Safari browser, end the event, confirm the replay posts to
  the Commons) to prove the wiring against the live service.
