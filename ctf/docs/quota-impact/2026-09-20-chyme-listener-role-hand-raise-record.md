# Stream Quota Impact Note — Listener role records hand-raise mode

## Summary

- Feature/Change: documentation and comments only. The role named by `CHYME_GUEST_STREAM_ROLE` is
  given to a member an admin moves to listening in hand-raise mode, not only to a signed-out guest,
  so the runbook, the setup script's header, the workflow's header, the Chyme inventory, and the
  Chyme test script no longer say members are unaffected by it. No executable line changes.
- PR: the listener-role record PR (2026-09-20)
- Owner: chargingthefuture
- Date: 2026-09-20

## Stream Surfaces Affected

- None. The behavior being written down shipped with the moderation controls (see
  `2026-09-19-chyme-moderation-stream-controls.md`), which is where its Stream calls are accounted
  for: `updateCallMembers` once per member per role change. This change adds no call and removes
  none.
- The setup script's target state is unchanged — role exists; on the `default` call type it has
  `join-call` and `read-call` and none of `send-audio` / `send-video` / `screenshare` — because a
  listening member needs exactly what a guest needs. Only the script's comment block changed.

## Estimated Monthly Impact

- Chat MAU impact estimate: none.
- Activity Feed API calls estimate: none.
- Video participant-minutes estimate: none. A member moved to listening stays in the call and keeps
  consuming the minutes already budgeted for a member in the room; the role changes what they may
  publish, not whether they are a participant.
- AI Moderation credits estimate: none.
- API calls: none added. The weekly check run's two calls are unchanged.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Green** — no change to any counted
  quantity.
- Peak scenario estimate: unchanged from the moderation note.

## Fallback and Degradation Plan

- What degrades first: nothing. No code path is touched.
- User-visible messaging behavior: unchanged.
- Kill switch / feature flag: unchanged. With `CHYME_GUEST_STREAM_ROLE` unset, hand-raise mode is
  enforced by the web and Android apps alone and guests return to Stream's default role.

## Observability

- Unchanged. The weekly "Stream — Guest Listener Setup" check run remains the alert for a drifted
  role, and this change records that such a drift now reaches hand-raise mode as well as guest
  listening: a missing `join-call` grant drops a listening member instead of letting them listen.

## Validation

- Tests added for degraded mode: none applicable — no executable change. The edited script parses
  under `node --check` and the edited workflow parses as YAML; the repo's documentation gates (EOF,
  inventory drift, test-script drift, US spelling, notice formatting) pass.
- Rollback strategy: revert the commit. Nothing in the product depends on it.
