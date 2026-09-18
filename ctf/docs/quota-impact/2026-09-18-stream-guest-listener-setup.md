# Stream Quota Impact Note — Guest listener setup workflow

## Summary

- Feature/Change: `ctf/scripts/stream-guest-listener-setup.mjs` and the "Stream — Guest Listener
  Setup" workflow own the Chyme guest-listener Stream configuration in code (role exists; call-type
  grants in the listen-only target state), with a weekly drift check.
- PR: the guest-listener setup PR (2026-09-18)
- Owner: chargingthefuture
- Date: 2026-09-18

## Stream Surfaces Affected

- Configuration only: the Chat API roles endpoint (`GET /roles`, and `POST /roles` once, if the role
  is missing) and the Video API call-type endpoint (`GET /video/call_types/default`, and one `PUT`
  when grants are applied). No chat, feed, video session, or moderation traffic.
- Member surfaces are unchanged. Guests already consumed participant-minutes when listening (see
  `2026-06-19-chyme-guest-listen.md`); this change makes that listening work again when the guest
  role is configured, it does not add a surface.

## Estimated Monthly Impact

- Chat MAU impact estimate: none — no users are created or connected; `listRoles` is a
  server-side app call.
- Activity Feed API calls estimate: none.
- Video participant-minutes estimate: none from this workflow. Guest listening minutes return to
  the level already budgeted in the 2026-06-19 note now that guests can join again.
- AI Moderation credits estimate: none.
- API calls: the weekly check is 2 calls (one Chat, one Video); a manual apply is at most 5. Under
  ~10 calls a month against a Maker-tier allowance in the millions.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Green** — single-digit API calls a
  month.
- Peak scenario estimate: an operator running apply against both apps several times in a day is
  still under 50 calls.

## Fallback and Degradation Plan

- What degrades first: nothing in the product. If the workflow cannot reach Stream, the run goes
  red and the app is unchanged; guests keep whatever state Stream already holds.
- User-visible messaging behavior: unchanged. A guest refused by Stream sees the reason line on the
  public Chyme page (shipped 2026-09-17).
- Kill switch / feature flag: unsetting `CHYME_GUEST_STREAM_ROLE` returns guests to Stream's default
  role, which can already join; the workflow then exits 1 with a message saying there is nothing to
  set up.

## Observability

- The weekly check run is the alert: a red "Stream — Guest Listener Setup" run means production has
  drifted from the target state. The log names the role, the call type, and the capability list
  before and target.
- Guest joins refused by Stream are reported to Sentry under `chyme` / `guest_listen_join` with the
  call type and call id (shipped 2026-09-17).

## Validation

- Tests added for degraded mode: the script is exercised locally on every path that needs no
  secret — no role set exits 1 with a plain message, unset key pairs are skipped, a bad mode or
  target is refused. The authenticated paths are validated by the first plan run in CI, which
  prints the live state without writing.
- Rollback strategy: delete the workflow file; the script is inert without it. Stream keeps
  whatever state was last applied, which is the documented target state.

## Change Log

- 2026-09-18 (follow-up): the response-body parse in the script carries a `no-trace:` marker on
  its catch, for the Error Verbosity Gate. Comment only — no change to what the script calls or how
  often, so every estimate above stands.
