# Stream Quota Impact Note — "Chat" → "Direct Line" relabel

## Summary

- Feature/Change: A label/copy-only change renaming the user-visible "Chat" tab to "Direct Line" in
  LightHouse, SocketRelay, TrustTransport, and PeerProgramming (web + mobile). No tab keys, routes,
  Stream calls, channels, tokens, or feature toggles change. The gate fires only because two changed
  file paths contain the substring "Stream" (`LighthouseStreamTab.tsx`, `SocketRelayStreamTab.tsx`).
- PR: relabel plugin "Chat" tabs to "Direct Line"
- Owner: farah
- Date: 2026-06-24

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: Chat — presentation only. No Stream usage,
  capability, channel, or call pattern changes; only the visible label text differs.

## Estimated Monthly Impact

- Chat MAU impact estimate: 0 (copy only)
- Activity Feed API calls estimate: 0
- Video participant-minutes estimate: 0
- AI Moderation credits estimate: 0

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): Green — no change to consumption.
- Peak scenario estimate: No change; a renamed label has no runtime or network cost.

## Fallback and Degradation Plan

- What degrades first: Nothing — there is no runtime path. The Direct Line surfaces behave exactly as
  before; only their name differs.
- User-visible messaging behavior: Unchanged.
- Kill switch / feature flag: Not applicable (copy).

## Observability

- Metrics and alerts added/updated: None.
- Dashboard link (if available): N/A.

## Validation

- Tests added for degraded mode: None required (copy only); web + mobile typecheck and lint pass.
- Rollback strategy: Revert the label change; no runtime impact either way.
