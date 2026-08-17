# Stream Quota Impact Note — Commons live Stream layer

## Summary

- Feature/Change: The Commons (Survivor Hub home/community chat) opens a live Stream Chat connection
  for the first time. Before this change `POST /api/commons/join` returned hardcoded stub credentials
  (`'todo-stream-token'`), so the Commons never connected to Stream and consumed no live Chat usage —
  it ran entirely on a 10-second poll of our own `/api/commons/messages`. This change makes `join` mint
  real credentials for the shared `ctf-feed-community` channel, and the client opens one live
  `stream-chat` connection per Commons member (per browser tab open on the home screen) to receive
  real-time new-post events and typing indicators. This introduces real, ongoing Stream Chat
  connection usage where there was none.
- PR: (branch `feat/commons-live-stream-layer`; pushed, no PR opened)
- Owner: chargingthefuture
- Date: 2026-06-21

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: Chat (new connection load on an existing channel).
  The channel itself (`ctf-feed-community`) already exists and is already watched by the Feed/Questions
  Community surfaces, so this adds no new channel. What it adds is a live, connected member per open
  Commons screen (a WATCH plus a held WebSocket connection) and the typing events those members emit.
  No Activity Feeds, Video, or AI Moderation usage is added.

## Estimated Monthly Impact

- Chat MAU impact estimate: Commons is the home screen and the first surface every signed-in member
  sees, so in practice every active member now connects to Stream Chat. The community channel members
  were already counted as Chat monthly-active users on other Feed surfaces, so the marginal new
  monthly-active-user count is small; the real new cost is concurrency, not unique users.
- Activity Feed API calls estimate: no change (this feature does not use Activity Feeds).
- Video participant-minutes estimate: no change.
- AI Moderation credits estimate: no change.
- Connection / WATCH load (the main cost of this change): one live connection per open Commons tab.
  Rough order of magnitude: `concurrent members with the home screen open`. Each connection performs a
  channel WATCH on connect, holds a WebSocket, and emits a small, debounced typing event while a member
  is composing. Typing events are server-debounced by `channel.keystroke()`, so a member typing a
  sentence sends roughly one `typing.start` and one `typing.stop`, not one per keystroke. Real-time
  new-post delivery replaces poll volume: the 10-second poll slows to a 30-second backstop once a
  member is live, so per-member background request volume to `/api/commons/messages` drops by about two
  thirds while connected.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): Yellow — this turns on a Chat consumer
  (the Commons home screen) that was previously dormant on Stream. Risk is concurrency-driven: it rises
  with how many members have the home screen open at the same time, which is the highest-traffic
  surface in the product.
- Peak scenario estimate: a launch/announcement moment where a large share of members land on the home
  screen at once is the peak driver; concurrent live connections (and the WATCH burst as they connect)
  grow with simultaneous home-screen viewers.

## Fallback and Degradation Plan

- What degrades first: the live connection. If Stream is not configured, or the connect/watch fails,
  the client silently stays on the 10-second poll. New posts then arrive on the poll instead of
  instantly, and the typing indicator is absent — nothing else changes and Commons stays fully usable.
- User-visible messaging behavior: identical chat, minus the instant updates and the "X is typing…"
  line. The existing footer connection status still reads live vs. syncing.
- Kill switch / feature flag: the natural kill path is configuration. When `STREAM_API_KEY` /
  `STREAM_API_SECRET` are absent, `resolveStreamCredentials()` returns null, `getFeedStreamCredentials`
  returns null, and `POST /api/commons/join` returns `{ ok: true, configured: false }` — the client never
  opens a connection and stays on polling. So removing/rotating the Stream credentials (or, for
  demo/recording sessions, the demo-mode routing to the staging Stream app per rule 110) cuts the
  Commons connection load back to zero without breaking the chat. There is no separate per-feature flag
  yet; adding one is a follow-up if Commons connections need to be cut independently of the rest of
  Stream Chat.

## Observability

- Metrics and alerts added/updated: none added in this change. Gap: there is no app-level metric for
  concurrent Commons Stream connections; Stream's own dashboard (concurrent connections / WATCH counts)
  is the source of truth for now. A follow-up should add a concurrency signal so the Yellow risk above
  is monitored rather than estimated.
- Dashboard link (if available): Stream dashboard for the production app (Chat → connections).

## Validation

- Tests added for degraded mode: none automated. The degraded path is exercised by the
  `configured: false` branch in `POST /api/commons/join` and the null-connection branch in
  `use-home-chat.ts` (`connectHubLive` returns null → the hook stays on the 10-second poll and clears
  the typing state). Verified manually that the web build succeeds and Commons works with the Stream
  environment variables absent (the default in this environment). Typecheck and lint pass.
- Rollback strategy: revert the branch. The Commons returns to its prior state (stub join credentials,
  poll-only, no live connection), which consumes no Stream Chat connection load. No data migration is
  involved.
