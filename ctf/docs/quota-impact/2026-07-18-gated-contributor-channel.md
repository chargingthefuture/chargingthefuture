# Stream Quota Impact Note — Gated Contributor Channel

## Summary

- Feature/Change: One members-only chat channel (`ctf-gated:ctf-contributors`, surfaced as `#contributors`) beside the Commons, membership synced from the contributor-access eligibility flag. New channel type `ctf-gated` (threads, fixed reaction set, uploads off, 4000-char messages).
- PR: #1682
- Owner: farahbrunache
- Date: 2026-07-18

## Stream Surfaces Affected

- Chat only. No Activity Feeds, no Video, no AI Moderation.

## Estimated Monthly Impact

- Chat MAU impact estimate: ~0. Every member who can open the gated channel is already a Commons chat user (eligibility requires sustained platform activity), so no new MAU — the same members watch one additional channel. The launch gate holds the channel closed until at least the configured minimum (default 10) members qualify; population grows slowly by design (high admission bar).
- Activity Feed API calls estimate: 0 (not used).
- Video participant-minutes estimate: 0 (not used).
- AI Moderation credits estimate: 0 (not used).
- Extra API calls: one channel create (once), membership add/remove calls on the weekly recompute and on admin revoke/reinstate (batched, tens of calls per week at current scale), and the same watch/send pattern the Commons already uses for a second channel among the same small member set.

## Budget Threshold Risk

- Expected threshold after rollout: Green. Channel count +1, member set is a strict subset of existing chat users, message volume bounded by that small set.
- Peak scenario estimate: even if every eligible member is active daily, the ceiling is the Commons' own traffic shape for one extra channel among the platform's most active members — well inside the Maker-tier chat limits (rule 110).

## Fallback and Degradation Plan

- What degrades first: live delivery. Messages are DB-backed (Stream is the live layer only, same as the Commons), so if Stream is unavailable or over quota the channel still reads and writes through the API routes; only real-time push degrades.
- User-visible messaging behavior: messages appear on refresh instead of live; no data loss.
- Kill switch / feature flag: `contributor_access_config.channel_open` — the admin toggle closes the channel instantly (server-side gate on every route); membership sync failures are warnings, never hard failures. Demo mode uses the `*_STAGING` Stream credentials, so recordings never touch the production quota.
