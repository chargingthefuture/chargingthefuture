# Stream Quota Impact Note — socket-relay code-review fixes (batch 2)

## Summary

- Feature/Change: A second batch of small socket-relay code-review fixes. The only Stream-touching
  edit is in `lib/socket-relay/stream.ts`: it **removes** two no-op `disconnectUser()` calls on the
  server-side (secret-keyed) StreamChat clients, which hold no user connection. A related change in
  `repository.ts` passes readable display names (member `@username` / a formatted short id) to
  `ensureSocketRelayFulfillmentChannel` instead of raw UUIDs. Neither adds any Stream call, channel,
  connection, or token — they change an argument value and remove a no-op.
- PR: resolve socket-relay code-review findings (batch 2)
- Owner: farah
- Date: 2026-07-05

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: Chat — the same `upsertUser` + channel create/watch +
  addMembers calls run exactly as before; only the `name` passed to `upsertUser` changes (UUID →
  readable handle) and a no-op `disconnectUser()` is dropped. No new Stream usage. The gate fires
  because the changed file path contains "stream".

## Estimated Monthly Impact

- Chat MAU impact estimate: 0 (same users, same channels)
- Activity Feed API calls estimate: 0
- Video participant-minutes estimate: 0
- AI Moderation credits estimate: 0

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): Green — no change to consumption. If
  anything, dropping the no-op `disconnectUser()` removes a redundant server call.
- Peak scenario estimate: No change; the call pattern per claim/chat-open is identical.

## Fallback and Degradation Plan

- What degrades first: Nothing new. Channel creation and membership behave exactly as before.
- User-visible messaging behavior: Improved only cosmetically — chat participants now show a readable
  name instead of a raw UUID. No behavioral change to messaging.
- Kill switch / feature flag: Not applicable.

## Observability

- Metrics and alerts added/updated: None.
- Dashboard link (if available): N/A.

## Validation

- Tests added for degraded mode: None required. Web typecheck, lint, EOF, inventory-drift, and
  test-script-drift all pass.
- Rollback strategy: Revert the change; no runtime or quota impact either way.
