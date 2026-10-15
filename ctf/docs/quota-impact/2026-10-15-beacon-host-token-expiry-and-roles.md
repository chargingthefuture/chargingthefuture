# Stream Quota Impact Note — Beacon host token expires and the host loses the app-wide admin role

## Summary

- Feature/Change: The Beacon host token, which is also the RTMP stream key, now expires 4 hours after it is minted and is minted fresh on each load of the broadcast panel. The host is upserted on Stream Chat as an ordinary user instead of the app-wide `admin` role, is added as a moderator of the event's chat channel, and is given the `host` role on the event's call through Stream's update-members endpoint.
- PR: #3242
- Owner: Charging The Future
- Date: 2026-10-15

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: Chat (each load of the broadcast panel adds a get-or-create of the event channel and one add-moderators call, beside the existing user upsert) and Video (one update-members call after the existing get-or-create of the call). No new channels, users or message types: the event channel is the one members already chat in.

## Estimated Monthly Impact

- Chat MAU impact estimate: none — the host was already a Chat user.
- Activity Feed API calls estimate: none.
- Video participant-minutes estimate: none — the same host publishes the same broadcast.
- AI Moderation credits estimate: none.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): unchanged. Three extra server calls per broadcast panel load, which an admin opens a few times per event.
- Peak scenario estimate: unchanged.

## Fallback and Degradation Plan

- What degrades first: the host's chat moderator rights. The channel and moderator calls sit inside the existing best-effort block, so a Chat failure is reported (`host_chat_upsert`) and the broadcast still starts. A failed update-members call fails the ingest step with the existing "opening the broadcast call failed" message, since without the host role the host cannot publish.
- User-visible messaging behavior: a stream key older than 4 hours is refused by Stream when a broadcaster app connects with it; the admin screen says under the key that it lasts 4 hours.
- Kill switch / feature flag: none added; the existing Stream configuration check still applies.

## Observability

- Metrics and alerts added/updated: none new; Chat-side failures report as op `host_chat_upsert`, and ingest failures as op `ingest_open_call`.
- Dashboard link (if available): not applicable.

## Validation

- Tests added for degraded mode: none; the Beacon manual test case BCN-A2c1 covers the key's expiry, publishing with the host role, and chat moderation without the admin role.
- Rollback strategy: revert the PR.
