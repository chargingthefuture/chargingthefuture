# Stream Quota Impact — channel-type settings check

Change: `fix: name the Stream channel-type setting that blocks every chat message`.
Adds `ctf/packages/web/scripts/check-stream-channel-config.mjs` and its package script, which is why
the Stream quota gate requires this note.

## Summary

An operational script, not a product surface. It reads the Stream app's channel-type settings back and
reports any that stop members sending — specifically `mark_messages_pending`, which was switched on for
the `messaging` channel type and made Stream refuse every send with "pending messages not enabled for
this app". With `--fix` it turns that setting off. It runs by hand, never on a request path, and is not
wired into CI.

## Stream Surfaces Affected

- Stream Chat settings only: one `getAppSettings` read per credential pair per run, plus one
  `updateChannelType` write per blocked channel type when `--fix` is passed.
- No channel, message, user, token, or connection is created. Nothing runs during a member request.

## Estimated Monthly Impact

Effectively zero. The script is run by a person when chat is broken — a handful of runs a month at
most, two lightweight API calls each. It cannot add monthly active users, messages, participant
minutes, or stored data.

## Budget Threshold Risk

None. Chat is billed on monthly active users (2,000/month on the Maker tier); this adds none. Turning
`mark_messages_pending` off restores normal sending and does not change how usage is counted.

## Fallback and Degradation Plan

A credential pair that is unset is skipped rather than failed, and a channel type the app has never
created is skipped too. Without `--fix` the script only reads, so a wrong diagnosis cannot change
anything. If the `--fix` write is rejected, the script says so and points at the equivalent toggle in
the Stream dashboard.

## Observability

The script prints its own result per credential pair and channel type, and exits non-zero when a
setting blocks sending, so it can be read directly or used as a check. It never prints an API key or
secret — only setting names, their values, and Stream's own error text.

## Validation

Run with no credentials set: both pairs are reported as skipped and it exits 0. `@ctf/web` typecheck,
eslint, unit tests, and the full build pass. EOF and drift gates pass. Against the live app it reports
`mark_messages_pending` for the `messaging` channel type, which is the reported outage.
