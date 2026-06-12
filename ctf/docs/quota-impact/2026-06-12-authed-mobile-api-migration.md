# Stream Quota Impact Note — Authenticated Mobile API Migration

## Summary

- Feature/Change: Every mobile feature client now calls the backend through the shared
  authenticated fetch helper (Clerk bearer token, server address from runtime config) instead of
  plain fetch against hardcoded development URLs. This includes the Stream chat credential
  fetchers for the feed/community/announcements/hub channels, SocketRelay fulfillment chat,
  Lighthouse match chat, TrustTransport trip chat, and the Questions channel.
- PR: #442 (this note follows up; the PR merged before the note landed)
- Owner: @farahbrunache
- Date: 2026-06-12

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: Chat only. No new Stream surface is added and no
  channel type changes. The change repairs existing mobile chat clients that previously could not
  connect at all (no auth token, wrong field names, or a dead route), so those screens move from
  always-erroring to working.

## Estimated Monthly Impact

- Chat MAU impact estimate: Near zero. Stream counts a user once per month regardless of platform,
  and the people using these chats on Android are overwhelmingly the same accounts already counted
  from the web app. Only a member who uses chat exclusively on Android and never on the web would
  add MAU; current Android distribution is a preview build, so that population is effectively zero
  today.
- Activity Feed API calls estimate: No change (no activity-feed surface touched).
- Video participant-minutes estimate: No change (no video surface; TrustTransport video was removed
  separately in #444).
- AI Moderation credits estimate: No change.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): Green.
- Peak scenario estimate: If every current web chat user also connected from Android in the same
  month, MAU is unchanged (same accounts). The bounding case is Android-only adopters, which is
  limited by Android install volume and stays well inside the current plan headroom.

## Fallback and Degradation Plan

- What degrades first: Credential calls fail closed — a screen shows its error state and a retry;
  no chat connection is attempted without credentials.
- User-visible messaging behavior: Plain error text with retry on the affected screen. No fake or
  cached chat data is shown (real-data-only rule).
- Kill switch / feature flag: None added; the existing server-side gates on each credential route
  (feed/plugin read-access checks) remain the control point — denying access there disables the
  mobile chat surface.

## Observability

- Metrics and alerts added/updated: None added. Existing app-wide error reporting (see
  2026-06-01-app-wide-error-reporting.md) captures credential-fetch failures from the mobile app.
- Dashboard link (if available): Stream dashboard usage page (no repo-linkable URL).

## Validation

- Tests added for degraded mode: None added in #442; the converted clients throw on non-2xx and the
  screens render error states, exercised by typecheck/lint gates and owner testing on the deployed
  build.
- Rollback strategy: Revert #442 (single merge commit) restores the previous clients; no schema or
  Stream configuration depends on it.
