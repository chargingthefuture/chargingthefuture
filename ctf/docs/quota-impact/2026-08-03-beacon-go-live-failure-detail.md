# Stream Quota Impact Note — Beacon go-live failure detail

## Summary

- Feature/Change: Make a failed Beacon "Go live" explain itself, and stop two non-video steps from
  blocking a broadcast. The admin ingest route used to wrap every setup step in one catch that returned
  the fixed sentence "Broadcast input unavailable.", so an owner holding a phone could not tell whether
  the database read, the Stream Chat host registration, or the Stream Video call was at fault. Each step
  is now attempted separately and names itself in the message; the Stream Chat host registration and the
  audit row are best-effort (reported, not fatal), because neither is needed to publish video; and a
  failed Stream Video REST call now carries its HTTP status and endpoint alongside Stream's own message.
- PR: opened from branch `fix/beacon-go-live-failure-detail`.
- Owner: chargingthefuture
- Date: 2026-08-03

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: **Chat and Video**, error handling only. No Stream call
  is added, removed, retried, or moved. The Chat `upsertUser` for the host and the Video get-or-create
  call still run exactly once per "Go live" click, as before; only what happens when one of them fails
  changes. No change to Activity Feeds or AI Moderation.

## Estimated Monthly Impact

- Chat MAU impact estimate: no change. The same one host user is registered per go-live; when that
  registration fails it is no longer retried by the admin re-clicking through a dead end, so if anything
  the call count goes down slightly.
- Activity Feed API calls estimate: no change.
- Video participant-minutes / HLS / recording estimate: no change in the success path. In the failure
  path, a broadcast that previously could not start (because a Chat-side or audit-side failure aborted
  it) can now start, so video minutes are consumed as the feature intends rather than not at all. This
  is bounded by Beacon allowing one live event at a time.
- AI Moderation credits estimate: no change.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Green.** No new recurring call, no
  polling, no fan-out. Usage stays driven by how often the owner broadcasts and for how long.
- Peak scenario estimate: unchanged — one long, well-attended broadcast (HLS distribution plus one
  recording). This change does not raise the ceiling.

## Fallback and Degradation Plan

- What degrades first: Stream not configured still returns 503 "Live video is not configured." and every
  Beacon surface stays in its calm idle state. A Stream Chat failure now degrades the host's chat
  identity (display name, moderator role) instead of the broadcast itself. A failed audit write degrades
  the audit trail for that read, and is reported.
- User-visible messaging behavior: the admin banner now names the failing step and includes the
  underlying reason, capped at 300 characters. This surface is admin-gated. The API key is never
  included in the message — the endpoint path is recorded without its query string, which is where the
  key travels.
- Kill switch / feature flag: unchanged. Demo-mode sessions still route to the dedicated **staging**
  Stream app via `resolveStreamCredentials`, so recording sessions never draw on the production
  Maker-tier quota. Ending the event (`POST /api/beacon/[id]/end`) still stops the call, HLS
  distribution, and recording.

## Observability

- Metrics and alerts added/updated: no new metrics. Four separate `reportError` operations replace one
  generic report on the ingest path (`ingest_load_event`, `ingest_host_credentials`, `ingest_open_call`,
  `ingest_audit`), plus `host_chat_upsert` for the best-effort host registration. Error reporting now
  shows which step failed instead of one bucket. Stream's dashboard remains the source of truth for
  usage.

## Validation

- Tests added for degraded mode: none automated (Rule 118 defers automated tests during MVP). The
  degraded paths are: Stream unconfigured → 503 with the not-configured message; a throwing
  `upsertUser` → reported and the broadcast continues; a throwing audit insert → reported and the ingest
  response still returns. Lint, typecheck, the end-of-file format check, and the inventory drift gate
  pass for the changed files.
- Rollback strategy: revert the branch. Beacon returns to the single generic "Broadcast input
  unavailable." message and to treating a Chat or audit failure as a broadcast failure. No schema,
  contract, or route change is involved, so there is nothing to migrate.
