# Stream Quota Impact Note — chat bubble color convention

## Summary

- Feature/Change: A CSS/styling change to the chat bubble colors. The logged-in author's own
  messages render gray; everyone else's use the plugin's assigned color (the hub's purple in Commons,
  each plugin's accent in its Direct Line chat). Touches the shared `StreamChatPanel` and the Commons
  CSS module only — no message volume, API calls, or feature toggles change.
- PR: chat bubble color convention
- Owner: farah
- Date: 2026-06-21

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: Chat — presentation only. The gate fires because the
  changed file paths contain "stream"; no Stream usage, capability, or call pattern changes.

## Estimated Monthly Impact

- Chat MAU impact estimate: 0 (styling only)
- Activity Feed API calls estimate: 0
- Video participant-minutes estimate: 0
- AI Moderation credits estimate: 0

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): Green — no change to consumption.
- Peak scenario estimate: No change; CSS variables and class rules have no runtime cost.

## Fallback and Degradation Plan

- What degrades first: Nothing — there is no runtime path. Without an accent the bubbles fall back to
  Stream's default color.
- User-visible messaging behavior: Unchanged (only bubble colors differ).
- Kill switch / feature flag: Not applicable (styling).

## Observability

- Metrics and alerts added/updated: None.
- Dashboard link (if available): N/A.

## Validation

- Tests added for degraded mode: None required (styling only); typecheck/lint/EOF pass.
- Rollback strategy: Revert the styling change; no runtime impact either way.
