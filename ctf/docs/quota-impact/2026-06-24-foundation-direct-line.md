# Stream Quota Impact Note — Foundation Direct Line chat surface

## Summary

- Feature/Change: Surfaces the **existing** per-thread Stream chat channel of a Foundation connection
  in the web UI. Today, "Request Quote" already opens a connection thread and creates a Stream chat
  channel for it — that channel was being created but never shown, because the component that rendered
  it (`components/foundation/Foundation.tsx`) was orphaned (nothing imported it). This change wires the
  real Direct Line: after a successful Request Quote the member lands straight in the Direct Line
  (`StreamChatPanel`) using the Stream credentials the thread POST already returned, and each Quotes
  row re-opens its Direct Line by fetching fresh credentials from a new read-only route
  `GET /api/foundation/connections/threads/:threadId/token`. The token route creates **no** new
  channel — it only looks up the thread's already-existing `stream_channel_id` and mints a token for a
  verified participant.
- PR: Foundation Direct Line chat surface (branch `feat/foundation-direct-line`; no PR opened)
- Owner: farah
- Date: 2026-06-24

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: Chat only. The `stream-quota-impact-note` gate fires
  because the changed file paths contain "stream" (the new route mints a Stream token and the UI uses
  `StreamChatPanel`). No new channel-creation pattern is introduced; channels are still created only at
  Request-Quote time, exactly as before this change.

## Estimated Monthly Impact

- Chat MAU impact estimate: bounded by the number of members who actually open an existing Foundation
  Direct Line. These are the same members who already created Foundation connections; a member counts
  toward Chat MAU only when they connect to a channel. The incremental effect is members opening
  connections they could not previously open in the UI at all — bounded by active Foundation
  connections, which is small.
- Activity Feed API calls estimate: 0 — no Activity Feeds usage.
- Video participant-minutes estimate: 0 — no video.
- AI Moderation credits estimate: 0 — no moderation calls added.
- Incremental Chat API calls: one `connectUser` + one `channel.watch` per opened Direct Line, plus the
  normal send/receive volume for messages members choose to send. Message volume was always possible
  on these channels (the message-send route already exists); this only gives members the surface to use
  it.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): Green — incremental consumption is
  bounded by active Foundation connections, a small population, and no new channels are created.
- Peak scenario estimate: every member with a Foundation connection opens their Direct Line and
  exchanges messages. This is bounded by the count of active connection threads and by manual member
  interaction; it stays well within normal Chat metering.

## Fallback and Degradation Plan

- What degrades first: if the token route or the Stream connection fails, the Direct Line shows its
  error state ("Could not open this Direct Line." / "temporarily unavailable") and the rest of the
  Foundation shell keeps working. If Stream credentials are not issued at Request-Quote time (Stream
  unconfigured), the post-quote flow falls back to the Quotes tab so the request is never lost.
- User-visible messaging behavior: additive — provider browse, quote request, and quote history are
  unchanged; the Direct Line is the new surface.
- Kill switch / feature flag: not applicable. The panel already degrades to its loading/error/
  unavailable states when Stream env is missing; removing the Direct Line controls reverts the surface
  with no data impact.

## Observability

- Metrics and alerts added/updated: None. The token route writes a Foundation audit event
  (`foundation.connection.thread.token.create`) like the other connection commands.
- Dashboard link (if available): N/A.

## Validation

- Tests added for degraded mode: None required (read-only route + client presentation). Typecheck,
  ESLint, and EOF formatting pass on the touched files; the panel still degrades to its error/
  unavailable states when Stream env is missing.
- Rollback strategy: Revert the route, the repository helper, and the UI wiring; no schema or data
  impact either way — the channels this surfaces already exist.
