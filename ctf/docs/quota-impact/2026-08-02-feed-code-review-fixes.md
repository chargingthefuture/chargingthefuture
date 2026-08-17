# Stream Quota Impact Note — feed code-review fixes

## Summary

- Feature/Change: A batch of small code-review fixes for the `feed` plugin. The only Stream-adjacent
  part is in `ctf/packages/web/lib/feed/stream.ts`: the two server-side `StreamChat` helpers
  (`getFeedStreamCredentials`, `emitFeedMembershipEventToStream`) no longer call
  `streamClient.disconnectUser()` in a `finally` block. That call is the client-side teardown for a
  connected user; a server client built from an API key + secret opens no user WebSocket, so the call
  did nothing useful and only risked masking a real error thrown in the body. The rest of the change is
  non-Stream: a rate-limit SQL hardening, a scoped `feed_items` update, and returning the stored
  `read_at` from `markAnnouncementRead`.
- PR: harden feed rate-limit SQL, drop server-side Stream teardown, scope notice update (#2058)
- Owner: farah
- Date: 2026-08-02

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: Chat only, and consumption can only fall. The removed
  `disconnectUser()` calls are the only change to Stream call patterns. No channel, connection, watch,
  token, upsert, or event-send behavior changes; the same `upsertUser` / `createToken` /
  `channel.create` / `addMembers` / `sendEvent` sequence runs as before.

## Estimated Monthly Impact

- Chat MAU impact estimate: 0 (no new users, channels, or connections)
- Activity Feed API calls estimate: 0 — if anything slightly fewer, since a per-call `disconnectUser`
  REST round-trip is no longer attempted.
- Video participant-minutes estimate: 0 (no video surface touched)
- AI Moderation credits estimate: 0

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): Green — usage can only stay the same or
  drop, never rise.
- Peak scenario estimate: No change; the credential-mint and membership-event paths issue the same
  Stream calls at the same frequency, minus the removed teardown call.

## Fallback and Degradation Plan

- What degrades first: Nothing — no live behavior changes. If Stream is unavailable, the helpers fail
  exactly as before (`getFeedStreamCredentials` returns `null` when credentials cannot be resolved;
  `emitFeedMembershipEventToStream` returns `false`).
- User-visible messaging behavior: Unchanged. The feed chat channels connect as before.
- Kill switch / feature flag: Not applicable.

## Observability

- Metrics and alerts added/updated: None. Existing `console.error` logging around `channel.create()` /
  `channel.watch()` is unchanged.
- Dashboard link (if available): N/A.

## Validation

- Tests added for degraded mode: None required. Web typecheck, lint, build, EOF, inventory-drift, and
  test-script-drift all pass locally.
- Rollback strategy: Revert the change; no runtime or quota impact either way.
