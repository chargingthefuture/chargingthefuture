# Stream Quota Impact — one chat connection per Stream identity in the browser

Change: `fix: keep one Stream Chat connection per identity so a Direct Line send is never rejected`.
Touches `ctf/packages/web/components/shared/stream-chat-panel.tsx`, `ctf/packages/web/lib/commons/live-stream.ts`,
and the new `ctf/packages/web/lib/shared/stream-chat-connection.ts`, which is why the Stream quota gate
requires this note.

## Summary

Browser-side fix only. Every chat surface used to share one Stream Chat client per API key, even though
each surface signs in as its own Stream user (`socket-relay-<id>`, `feed-<id>`, `chyme-<id>`, ...).
Whichever surface connected last silently re-signed-in the shared client, so an open SocketRelay Direct
Line could send as the wrong user and Stream rejected the send ("Message Failed · Unauthorized", owner
report). Chat connections are now held one per (API key, Stream user) and shared by reference count
between surfaces using the same identity. No server-side Stream call is added, removed, or changed; no
new channels, messages, tokens, or users.

## Stream Surfaces Affected

- Stream Chat client connections (websockets) opened from the browser — the plugin chat panels
  (SocketRelay, LightHouse, TrustTransport, PeerProgramming, Foundation, Beacon) and the Commons live
  layer. Surfaces with the same identity (Commons + gated contributor chat) still share one connection,
  as before.
- No change to Video, Activity Feeds, or AI Moderation. No change to server-side chat calls.

## Estimated Monthly Impact

Roughly zero. The app shows at most one chat surface plus the Commons live layer at a time, and they
are on different routes, so steady-state concurrent connections per member stay at one — the same as
intended today. During a route change two connections can briefly overlap (the old one closing on its
own client while the new one opens) instead of fighting over one client; this is seconds per
navigation and does not affect MAU, message counts, or stored data. Chat MAU is unchanged: the same
users connect as the same identities.

## Budget Threshold Risk

None. Chat quota is billed on MAU (2,000/month on the Maker tier), which this change does not alter.
Concurrent-connection overlap is transient and bounded at one extra connection per member during a
navigation.

## Fallback and Degradation Plan

Unchanged from today: if a chat connection fails to open, the plugin panel shows its "Failed to connect
to chat." state, and the Commons live layer silently falls back to polling. A failed connection entry
is dropped so the next open retries with a fresh client.

## Observability

No new calls to instrument. Connection failures keep surfacing exactly where they did before (panel
error state; Commons polling fallback). Stream's dashboard concurrent-connection graph is the place to
confirm the (unchanged) steady-state count after deploy.

## Validation

`@ctf/web` typecheck + eslint + build clean; EOF and drift gates pass. Manual check after deploy: open
a SocketRelay Direct Line straight from the Commons and send a message — it must deliver, not fail
with "Message Failed · Unauthorized".
