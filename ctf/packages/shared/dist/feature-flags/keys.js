// Vendor-neutral feature-flag key registry shared across web, mobile, and agents.
// The backing flag service is Unleash (self-hosted on Railway); these constants are
// the single source of truth for flag keys so every consumer references the same string.
//
// Naming convention (keep in sync with .claude/rules/123-environment-configuration-rules.mdc):
//   feature-{pluginSlug}-{featureName}  — user-facing feature gating (e.g. feature-unlock-quora-onboarding)
//   release-{agent}-{fixName}           — release/rollout gating for a specific change
//   system flags                        — cross-cutting platform switches (e.g. demo-mode)
// Cross-cutting platform flags that are not tied to a single plugin.
export const SYSTEM_FLAGS = {
    // When ON, data-fetching surfaces must read from demo-safe (synthetic) data — see issue #102/#103.
    DEMO_MODE: 'demo-mode',
    // Reserved global kill-switch for ALL public/unauthenticated access (landing, sign-in,
    // unlock onboarding, socket-relay public board). NOT currently wired: per-plugin public
    // visibility is an auth-gate concern (directory has no public view in v3; socket-relay
    // redacts fields for unauth callers; chyme/hub are fully authenticated). Kept as a
    // registered key for a future incident/pre-launch lockdown switch — see issue #102.
    PUBLIC_SURFACE: 'public-surface',
};
// Build a user-facing feature flag key: feature-{pluginSlug}-{featureName}.
export function featureFlagKey(pluginSlug, featureName) {
    return `feature-${pluginSlug}-${featureName}`;
}
// Build a release/rollout flag key: release-{agent}-{fixName}.
export function releaseFlagKey(agent, fixName) {
    return `release-${agent}-${fixName}`;
}
// Vendor-neutral evaluation context. The web/mobile/agent flag clients map this onto
// their provider's native context (e.g. Unleash Context: userId + properties).
// Per-user unlock feature flags. Admin approval grants the matching flag to the user
// via Unleash targeting (see lib/feature-flags/unleash-admin.ts). The flag evaluation
// falls back to the DB approval status for users approved before flag-driven gating.
export const UNLOCK_FLAGS = {
    // Controls access to the Quora-profile-verification onboarding flow.
    // OFF (default) = user is in pending/review; ON = user has full access.
    QUORA_ONBOARDING: 'feature-unlock-quora-onboarding',
    // The early-Commons A/B experiment flag (`feature-unlock-early-commons-access`) was removed on
    // 2026-08-19. Giving a not-yet-verified member the Commons is no longer a rollout percentage —
    // it is the standing rule for anyone who asks for help or comes back a second day. Delete the
    // flag in Unleash too; nothing reads it any more.
};
