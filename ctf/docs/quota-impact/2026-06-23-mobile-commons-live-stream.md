# Stream Quota Impact Note — Android parity: Commons live Stream layer

## Summary

- Feature/Change: The mobile (React Native / Android) Commons — the Survivor Hub home/community chat
  (`ctf/packages/mobile/src/features/hub/HubHome.tsx`) — now opens a live Stream Chat connection,
  matching what web already does for the same channel. Before this change the mobile Hub polled
  `GET /api/commons/messages` every 15 seconds and never touched Stream. Now, on entry, it calls
  `POST /api/commons/join` through `authedFetch` for real credentials and, when Stream is configured,
  opens one `stream-chat` connection per mobile Hub viewer to the shared `ctf-feed-community` channel.
  It watches that channel for new posts (which trigger an immediate history reload) and surfaces a
  typing indicator. This adds real, ongoing Stream Chat connection usage on mobile where there was
  none — it is NOT zero-impact. The connection mirrors the existing web Commons connection on the same
  channel; it does not create a new channel.
- PR: (branch `feat/mobile-commons-live-stream`; pushed, no PR opened)
- Owner: chargingthefuture
- Date: 2026-06-23

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: Chat only (added connection load on an existing
  channel). The channel `ctf-feed-community` already exists and is already watched by the web Commons
  and the Feed/Questions Community surfaces, so no new channel is created. What this adds is one live,
  connected member per open mobile Hub screen (a channel WATCH plus a held WebSocket connection) and
  the typing events those members emit. No Activity Feeds, Video, or AI Moderation usage is added.

## Estimated Monthly Impact

- Chat MAU impact estimate: the Hub is the default mobile surface, so in practice every active mobile
  member now connects to Stream Chat. The community-channel members are already counted as Chat
  monthly-active users on the web Commons and other Feed surfaces, so the marginal new monthly-active
  user count is small; the real new cost is concurrency, not unique users.
- Activity Feed API calls estimate: no change (this feature does not use Activity Feeds).
- Video participant-minutes estimate: no change.
- AI Moderation credits estimate: no change.
- Connection / WATCH load (the main cost of this change): one live connection per open mobile Hub
  screen. Rough order of magnitude: `concurrent mobile members with the Hub open`, bounded by the
  number of simultaneous mobile Hub viewers. Each connection performs a channel WATCH on connect,
  holds a WebSocket, and emits a small, server-debounced typing event while a member is composing
  (`channel.keystroke()` debounces, so a member typing a sentence sends roughly one `typing.start`
  and one `typing.stop`, not one per keystroke). Real-time new-post delivery replaces poll volume:
  the 15-second poll slows to a 30-second backstop once a member is live, so per-member background
  request volume to `/api/commons/messages` drops by about half while connected.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): Yellow — this turns on a Chat consumer
  (the mobile Hub) that was previously dormant on Stream, adding to the same concurrency pool the web
  Commons already drives on `ctf-feed-community`. Risk is concurrency-driven: it rises with how many
  mobile members have the Hub open at the same time.
- Peak scenario estimate: a launch/announcement moment where a large share of mobile members land on
  the Hub at once is the peak driver; concurrent live connections (and the WATCH burst as they
  connect) grow with simultaneous mobile Hub viewers, on top of the web Commons concurrency.

## Fallback and Degradation Plan

- What degrades first: the live connection. If Stream is not configured, or the connect/watch fails,
  the mobile client silently stays on the 15-second poll — exactly as it ran before this change. New
  posts then arrive on the poll instead of instantly, and the typing indicator is absent; nothing else
  changes and the Hub stays fully usable. A Stream failure can never break or blank the Hub.
- User-visible messaging behavior: identical chat, minus the instant updates and the "X is typing…"
  line.
- Kill switch / feature flag: the natural kill path is configuration. When `STREAM_API_KEY` /
  `STREAM_API_SECRET` are absent, `resolveStreamCredentials()` returns null, `getFeedStreamCredentials`
  returns null, and `POST /api/commons/join` returns `{ ok: true, configured: false }` — the mobile client
  (`fetchHubJoin` returns null) never opens a connection and stays on polling. So removing/rotating the
  Stream credentials (or the demo-mode routing to the staging Stream app per rule 110) cuts the mobile
  Hub connection load back to zero without breaking the chat. There is no separate per-feature flag
  yet; adding one is a follow-up if mobile Hub connections need to be cut independently.

## Observability

- Metrics and alerts added/updated: none added in this change. Gap: there is no app-level metric for
  concurrent Hub Stream connections (web or mobile); Stream's own dashboard (concurrent connections /
  WATCH counts) is the source of truth for now. A follow-up should add a concurrency signal so the
  Yellow risk above is monitored rather than estimated.
- Dashboard link (if available): Stream dashboard for the production app (Chat → connections).

## Validation

- Tests added for degraded mode: none automated. The degraded path is exercised by the
  `configured: false` branch in `POST /api/commons/join` and the null-credentials/null-connection branches
  in the mobile `live-stream.ts` (`fetchHubJoin` returns null or `connectHubLive` returns null → the
  screen stays on the 15-second poll and clears the typing state). The mobile typecheck and lint pass.
  The connection is best-effort and wrapped so any failure resolves to null without throwing.
- Rollback strategy: revert the branch. The mobile Hub returns to its prior state (poll-only, no live
  connection), which consumes no Stream Chat connection load. No data migration is involved.
