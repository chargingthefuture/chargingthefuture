# Demo account list replaces the flag service: Stream quota impact

## Summary

Which Stream app a request uses (production or the demo `*_STAGING` keys) is still decided per
account, as before. The answer now comes from the `demo_mode_accounts` table instead of the
Unleash flag. Only the import in `lib/integrations/stream-credentials.ts` changed.

## Stream Surfaces Affected

Every surface that picks Stream credentials through `stream-credentials.ts`: Chyme rooms, Beacon
broadcasts, Foundation calls, PeerProgramming calls and chat. No call, room, user or message is
added or removed.

## Estimated Monthly Impact

None on production. While the flag service was down, accounts meant for demo used the production
Stream app; once their "Demo data" switch is on they use the demo app again, which moves their
small amount of use off the production quota.

## Budget Threshold Risk

None. No new Stream calls.

## Fallback and Degradation Plan

If the table cannot be read, the last list read is kept; with none, the account uses production,
as before this change.

## Observability

A failed read of the list is written to the error log with what failed and why.

## Validation

`stream-credentials.test.ts` covers a forced demo pin and an account on the list.
