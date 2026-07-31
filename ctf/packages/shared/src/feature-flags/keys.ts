// Vendor-neutral feature-flag key registry shared across web, mobile, and agents.
// The backing flag service is Unleash (self-hosted on Railway); these constants are
// the single source of truth for flag keys so every consumer references the same string.
//
// Naming convention (keep in sync with .claude/rules/123-environment-configuration-rules.mdc):
//   feature-{pluginSlug}-{featureName}  — user-facing feature gating (e.g. feature-unlock-quora-onboarding)
//   release-{agent}-{fixName}           — release/rollout gating for a specific change
//   system flags                        — cross-cutting platform switches (e.g. demo-mode)

export type FlagKey = string;

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
} as const;

export type SystemFlagKey = (typeof SYSTEM_FLAGS)[keyof typeof SYSTEM_FLAGS];

// Build a user-facing feature flag key: feature-{pluginSlug}-{featureName}.
export function featureFlagKey(pluginSlug: string, featureName: string): FlagKey {
	return `feature-${pluginSlug}-${featureName}`;
}

// Build a release/rollout flag key: release-{agent}-{fixName}.
export function releaseFlagKey(agent: string, fixName: string): FlagKey {
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
	// A/B experiment: give a not-yet-verified member early support-only access to the Commons
	// (the Hub general channel) so they can ask for help — e.g. trouble finding their Quora URL —
	// instead of being confined to the Unlock screen. Configure in Unleash as a gradual rollout
	// (e.g. 50%) with stickiness on userId so each member is sticky in one bucket. OFF (default,
	// and when Unleash is unconfigured) = current behavior (Unlock-only until verified). The goal
	// is to test whether early Commons access lifts the Quora-URL submission/completion rate.
	EARLY_COMMONS_ACCESS: 'feature-unlock-early-commons-access',
} as const;

export type UnlockFlagKey = (typeof UNLOCK_FLAGS)[keyof typeof UNLOCK_FLAGS];

export interface FeatureFlagContext {
	// Stable identifier used for per-user targeting and sticky percentage rollout.
	targetingKey?: string;
	// Additional targeting attributes (role, segment, region, etc.).
	attributes?: Record<string, string | number | boolean>;
}
