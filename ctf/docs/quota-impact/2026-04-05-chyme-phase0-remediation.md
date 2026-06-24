## Summary

Chyme consumes Stream for room join credentials and mirrored chat fan-out through shared adapters in `ctf/packages/shared`.

## Stream Surfaces Affected

- Chyme room join token issuance
- Chyme room channel membership
- Chyme mirrored chat message fan-out

## Estimated Monthly Impact

- Chat MAU impact: bounded by active Chyme participants only
- Chat API impact: one channel watch/create path per join plus message fan-out on send
- Video/audio minutes: not yet tracked as separate Stream call-session minutes because Chyme currently issues join credentials without a dedicated native call client

## Budget Threshold Risk

- Green under normal internal/private MVP usage
- Elevated risk if join polling or message fan-out becomes noisy without usage dashboards

## Fallback and Degradation Plan

- If Stream configuration is unavailable, `POST /api/chyme/join` returns `503`
- Companion chat remains readable from persisted DB history
- Non-essential live-room behaviors degrade before core read/send/delete flows

## Observability

- Route-level Chyme audit events cover room fetch, message list/send, join, and deletion flows
- Full-account delete records reclaim dependency queueing via existing ServiceCredits tables

## Validation

- `pnpm --filter @ctf/shared typecheck`
- `pnpm --filter @ctf/web typecheck`
- `pnpm --filter @ctf/mobile typecheck`
- `pnpm --filter @ctf/mobile build:android:ci`
