# Stream Quota Impact Note — Chat Dark Theme Fix and Read-Only Composer

## Summary

- Feature/Change: Fix the shared chat panel so Stream's dark theme actually applies (theme class moved onto the `<Chat theme>` prop; plugin accent re-declared on the `.str-chat` element), and add a `readOnlyNotice` prop that replaces the message composer with a plain notice on ended Direct Lines.
- PR: #2060
- Owner: farahbrunache
- Date: 2026-08-02

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: Chat rendering only. No new channels, watches, queries, or messages. The read-only state removes the composer, so a panel in that state can no longer attempt sends at all.

## Estimated Monthly Impact

- Chat MAU impact estimate: 0 — same members, same channels, same connection lifecycle.
- Activity Feed API calls estimate: 0.
- Video participant-minutes estimate: 0.
- AI Moderation credits estimate: 0.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): unchanged (Green).
- Peak scenario estimate: unchanged. If anything, marginally fewer API calls: the doomed sends that previously failed "Unauthorized" on ended conversations are no longer attempted.

## Fallback and Degradation Plan

- What degrades first: nothing new — theming is CSS-only; the read-only notice is a static element.
- User-visible messaging behavior: on an ended Direct Line the transcript stays readable and the notice explains why sending is off; live conversations are unchanged.
- Kill switch / feature flag: none needed; reverting the PR restores the prior rendering.

## Observability

- Metrics and alerts added/updated: none — no quota-bearing behavior changed.
- Dashboard link (if available): n/a.

## Validation

- Tests added for degraded mode: n/a (no degraded mode introduced); typecheck, lint, and full web build pass.
- Rollback strategy: revert the PR; the change is presentation-only.
