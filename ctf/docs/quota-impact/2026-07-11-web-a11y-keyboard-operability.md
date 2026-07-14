# Stream Quota Impact Note — web accessibility keyboard-operability pass

## Summary

- Feature/Change: Accessibility pass on clickable web elements (#1432). The only Stream-touching file
  in this change is `StreamChatPanel` (`packages/web/components/shared/stream-chat-panel.tsx`), where a
  single `aria-selected={false}` attribute was added to each chat-search result button so the
  `role="option"` items inside the `role="listbox"` carry the ARIA prop that role requires. No Stream
  API call, connection, channel, watch, message, or credential path is touched.
- PR: #1440
- Owner: farahbrunache
- Date: 2026-07-11

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: None functionally. The edit is a static accessibility
  attribute on an existing chat-search result button. No Activity Feed, Video, or AI Moderation surface
  is touched; no new channel, watch, message, connection, or credential-minting call is added.

## Estimated Monthly Impact

- Chat MAU impact estimate: None. No new members, channels, or connections are reached; markup-only.
- Activity Feed API calls estimate: 0 (surface not used here).
- Video participant-minutes estimate: 0 (surface not used here).
- AI Moderation credits estimate: 0 (surface not used here).

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): Green. An ARIA attribute cannot change
  MAU, channels watched, messages sent, or connection count.
- Peak scenario estimate: Identical to before — no Stream traffic is added in any scenario.

## Fallback and Degradation Plan

- What degrades first: Nothing changes. The chat search behaves exactly as before; the added attribute
  only reports selection state to assistive technology.
- User-visible messaging behavior: Unchanged — same loading / error / unavailable states.
- Kill switch / feature flag: None added or changed.

## Observability

- Metrics and alerts added/updated: None. No Stream usage is added, so no dashboard change is needed.
- Dashboard link (if available): GetStream app dashboard (existing).

## Validation

- Tests added for degraded mode: None needed (markup-only). Verified by `pnpm --dir ctf run lint:a11y`
  (the scan's total dropped from 41 to 13), `pnpm --filter @ctf/web run typecheck`, and `run build`.
- Rollback strategy: Revert PR #1440. No schema, contract, or data change; nothing to migrate.
