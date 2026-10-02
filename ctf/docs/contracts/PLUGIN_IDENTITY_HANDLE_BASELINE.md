# Plugin Identity Handle Baseline

Status: Baseline decision for plugin contracts.

## Purpose

Define one canonical user handle source for all plugin surfaces that show a username or parse `@mention` text.

## Canonical Handle Source

- Source of truth: the active auth provider's canonical `username` or equivalent handle field.
- Scope: all plugins under `ctf/`.
- Display/mention token: `@{username}`.

## Contract Rules

1. Plugins must not create plugin-specific username fields as alternate identity handles.
2. When a plugin needs a username/handle, it must read from the provider-neutral identity context (or a canonical profile field mirrored from the active auth provider).
3. If a plugin persists identity snapshots for history/audit (for example chat message author fields), persisted handle values must originate from the active auth provider's canonical handle at write time.
4. Plugins may keep display-name fields (for non-handle UX), but those are not treated as canonical handles and must not be used for mention resolution.

## Null/Unset Username Fallback

- If `username` is missing, plugin behavior must be deterministic:
  - show non-handle display fallback (for example first name / display name fallback),
  - do not mint synthetic `@username` values,
  - treat `@mention` targeting for that user as unavailable until the canonical handle is set.

## Sign-up and Profile Governance

- Product should require canonical handle capture during sign-up/onboarding to maximize parity across plugins.
- If username changes are allowed in the active auth provider, downstream plugin reads must treat that provider as the current source of truth and avoid out-of-date plugin-local username ownership models.

## Security and Compliance Notes

- Keep deny payloads and logs free of unnecessary identity attributes.
- Do not log raw message payloads solely for mention parsing diagnostics.

## Implementation Notes

- Web/mobile parity should consume the same handle contract.
- Any future migration that introduces canonical-profile mirroring must document sync direction and conflict policy (`auth provider -> canonical profile` expected baseline).
