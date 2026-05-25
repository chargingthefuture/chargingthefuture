// Vendor-neutral feature-flag key registry shared across web, mobile, and agents.
// The backing flag service is Unleash (self-hosted on Railway); these constants are
// the single source of truth for flag keys so every consumer references the same string.
//
// Naming convention (keep in sync with .github/instructions/123-environment-configuration-rules.mdc):
//   feature-{pluginSlug}-{featureName}  — user-facing feature gating (e.g. feature-unlock-quora-onboarding)
//   release-{agent}-{fixName}           — release/rollout gating for a specific change
//   system flags                        — cross-cutting platform switches (e.g. demo-mode)
// Cross-cutting platform flags that are not tied to a single plugin.
export const SYSTEM_FLAGS = {
    // When ON, data-fetching surfaces must read from demo-safe (synthetic) data — see issue #102/#103.
    DEMO_MODE: 'demo-mode',
    // When ON, public (non-authenticated) screens are reachable — see issue #102.
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
