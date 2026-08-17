# Stream Quota Impact Note — Commons live layer: reuse-guard on the shared client

## Summary

Code-review fix (#1872) to the Commons (Survivor Hub home) live layer,
`ctf/packages/web/lib/commons/live-stream.ts`. `StreamChat.getInstance(apiKey)` returns a singleton per
API key, so a prior connection (after an account switch or a reconnect) could still be authenticated
as a different user; calling `connectUser` again on that already-connected singleton could fail or
operate as the wrong user. The connect path now guards on `client.userID`: it disconnects a stale
user first, and reuses the client (no new `connectUser`) when it is already this user. No new Stream
surface, channel, or feature — same one Commons channel watch as before.

## Stream Surfaces Affected

- Chat only: the existing `ctf-feed-community` (Commons) channel connection opened by `connectHubLive`.
- No video, no new channels, no new event subscriptions. `channel.watch()` and the typing/`message.new`
  handlers are unchanged.

## Estimated Monthly Impact

- Neutral to slightly negative (fewer calls). In the common case (same user, fresh mount) behavior is
  identical: one `connectUser` + one `watch`. When the singleton is already connected as this user, a
  redundant `connectUser` is now skipped (a small reduction). On an account switch, one extra
  `disconnectUser` is issued for the stale user before connecting the new one — a rare event bounded by
  how often a member switches accounts in a single tab, not by message volume. No change to per-message
  or per-poll call counts.

## Budget Threshold Risk

- None. The change cannot increase steady-state connection or message volume; it only prevents an
  incorrect/duplicate `connectUser` and cleans up a stale user on switch.

## Fallback and Degradation Plan

- Unchanged and best-effort: any failure in the connect path (including the new `disconnectUser`, which
  is wrapped in `.catch(() => undefined)`) leaves the caller on the existing poll, and the Commons keeps
  working. Stream being unconfigured still degrades silently to polling.

## Observability

- No new metrics. Failures remain swallowed by design (the poll is the backstop). Existing Stream
  dashboards for the Commons channel are unaffected.

## Validation

- `@ctf/web` typecheck, lint, and production build pass. Behavior verified by reasoning about the
  `client.userID` guard: same-user reuse skips `connectUser`; different-user disconnects then connects;
  no-connection connects as before.
