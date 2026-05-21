# Feed Plugin — Android Parity Note

## Status: Required

Android parity is required for the Feed plugin before release. This note documents the scope, surfaces, and acceptance criteria for Android implementation.

## Scope

All three feed channels must be implemented on Android with full feature parity:

### 1. Announcements Channel

- Timeline rendering with priority/expiry handling
- Read/dismiss user-state transitions
- Admin-published announcement cards with correct visibility targeting
- Membership-aware visibility (only members see targeted announcements)

### 2. Questions Channel (LLM-Assisted Q&A)

- Question submission form
- LLM-generated answer display (inline in timeline)
- Answer rating (helpful/not helpful)
- Consent flow for `llm_processing` scope before first question
- Graceful fallback when LLM service is unavailable

### 3. Community Support Channel

- Community post creation
- Reply threading
- Content moderation enforcement (same policies as web)
- Community posts visible in unified timeline with channel filter

## Technical Requirements

- **GetStream**: Android must use the same `stream-chat` channel (`ctf-feed-membership-events`) for real-time fan-out
- **Postgres**: All canonical reads/writes go through the same API routes used by web
- **Auth**: provider-neutral authentication with the same server-side role and consent checks
- **Audit**: All commands must log with unified `feed.*` namespace (e.g., `feed.announcement.read.mark`, `feed.question.submit`)
- **Offline**: Graceful degradation when offline; cached timeline items remain visible

## Acceptance Criteria

1. All 18 `feed.*` commands from `FEED_PLUGIN_COMMAND_CONTRACTS.yaml` are callable from Android
2. Access policies from `FEED_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml` are enforced (server-side)
3. Audit events from `FEED_PLUGIN_AUDIT_CONTRACTS.yaml` fire correctly for Android-originated actions
4. Timeline supports channel filtering (all, announcements, questions, community)
5. LLM consent and answer rating flows work end-to-end
6. Parity validated against `ctf/config/plugin-parity-contracts.json` entry for `feed-announcements`

## Mobile Feature Directories

Per `plugin-parity-contracts.json`, mobile implementation directories are:

- `feed`
- `announcements`
- `questions`
- `community`

The current mobile parity shell exposes all four directories inside the `feed-announcements` surface so Android work can track the same three-channel model as web while the full native API integration is hardened.

## Risk

- LLM latency on mobile networks may require streaming/progressive answer display
- Community moderation UX may differ from web (e.g., swipe-to-report vs. menu)

## References

- [FEED_PLUGIN_COMMAND_CONTRACTS.yaml](../../contracts/FEED_PLUGIN_COMMAND_CONTRACTS.yaml)
- [FEED_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml](../../contracts/FEED_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml)
- [FEED_PLUGIN_AUDIT_CONTRACTS.yaml](../../contracts/FEED_PLUGIN_AUDIT_CONTRACTS.yaml)
- [ctf-feed-feature-inventory.md](ctf-feed-feature-inventory.md)
- [ctf-feed-feature-inventory.md](ctf-feed-feature-inventory.md) — Phase 6

## Change Log

- 2026-04-05: Created Android parity note with three-channel scope, LLM requirements, and acceptance criteria.
- 2026-04-05: Updated parity note after adding `questions` and `community` mobile feature directories and unified feed parity shells.
