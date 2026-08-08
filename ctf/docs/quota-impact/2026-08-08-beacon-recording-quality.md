# Stream Quota Impact Note — Beacon recording quality

## Summary

- Feature/Change: Fix a Beacon "Go live" that could never start. Beacon asked Stream to create the
  broadcast call with `recording: { mode: 'available' }` and nothing else. Stream rejects that with a
  400 — `GetOrCreateCall failed with error: "recording quality is required when audio_only is false
  and recording is enabled"` — because a video recording has to say what picture size it records at.
  The rejection killed the whole get-or-create, so the call was never created and the admin screen
  showed "Broadcast input unavailable". The create request in
  `ctf/packages/web/lib/beacon/stream.ts` now states the two values Stream validates as a pair:
  `audio_only: false` and `quality: '720p'`.
- PR: opened from branch `fix/beacon-recording-quality`.
- Owner: chargingthefuture
- Date: 2026-08-08

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: **Video only**, and only the settings sent when the
  call is created. No Stream call is added, removed, retried, or moved: the same single get-or-create
  runs once per "Go live" click, as before. Recording still runs in `available` mode and is still
  started later by `start-broadcast` once someone is actually publishing. No change to Chat, Activity
  Feeds, or AI Moderation.

## Estimated Monthly Impact

- Chat MAU impact estimate: no change.
- Activity Feed API calls estimate: no change.
- Video participant-minutes / HLS / recording estimate: this is the honest part — before this fix no
  Beacon broadcast could start, so the feature consumed **zero** video minutes and produced zero
  recordings. With it working, Beacon consumes what it was always designed to consume: one live
  event at a time, HLS distribution to viewers, and one recording per event. That is the budgeted
  behaviour from the original Beacon note (`2026-06-21-beacon-livestream-video.md`), not new
  spending on top of it. The recording is written at 720p; a 1080p recording would have been roughly
  double the stored bytes per minute, so this choice is the cheaper of the two sensible ones and is
  bounded by how often the owner broadcasts and for how long.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Green.** No new recurring call, no
  polling, no fan-out. One extra field on a request that already ran.
- Peak scenario estimate: unchanged from the original Beacon estimate — one long, well-attended
  broadcast (HLS distribution plus one 720p recording). This change does not raise the ceiling; it
  restores the path to the ceiling that was already budgeted for.

## Fallback and Degradation Plan

- What degrades first: Stream not configured still returns 503 "Live video is not configured." and
  every Beacon surface stays in its calm idle state. If Stream ever rejects the create request again
  for a different reason, the admin banner still names the failing step and carries Stream's own
  message plus the HTTP status (added 2026-08-03), so the next failure explains itself the same way
  this one did.
- User-visible messaging behavior: unchanged. On success the admin sees the RTMP address and stream
  key and the "Share screen" control instead of the error banner.
- Kill switch / feature flag: unchanged. Demo-mode sessions still route to the dedicated **staging**
  Stream app via `resolveStreamCredentials`, so recording sessions never draw on the production
  Maker-tier quota. Ending the event (`POST /api/beacon/[id]/end`) still stops the call, HLS
  distribution, and recording — the cost-critical stop path is untouched.

## Observability

- Metrics and alerts added/updated: none. The existing per-step error reports on the ingest path
  (`ingest_load_event`, `ingest_host_credentials`, `ingest_open_call`, `ingest_audit`) are unchanged,
  and `ingest_open_call` is the one that was firing on every click before this fix. Stream's
  dashboard remains the source of truth for usage.

## Validation

- Tests added for degraded mode: none automated (Rule 118 defers automated tests during MVP). The
  accepted `quality` values were confirmed against the Stream Video client types shipped in the
  workspace (`RecordSettingsRequestQualityEnum` in `@stream-io/video-client`), which lists `360p`,
  `480p`, `720p`, `1080p`, `1440p` and the five portrait sizes. Degraded paths checked by reading:
  Stream unconfigured → 503 with the not-configured message; a Stream rejection → the named step and
  Stream's message in the admin banner. Lint, typecheck, the production build, the end-of-file format
  check, and the inventory drift gate pass for the changed files.
- Rollback strategy: revert the branch. Beacon returns to sending recording settings with no picture
  size, which means "Go live" fails again — so a rollback is only sensible together with a different
  fix. No schema, contract, or route change is involved, so there is nothing to migrate.
