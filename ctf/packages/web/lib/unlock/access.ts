import { UNLOCK_FLAGS } from '@ctf/shared';
import { evaluateBooleanFlag } from 'lib/feature-flags';
import { getEffectiveUnlockAccessTier } from './repository';
import type { UnlockAccessTier } from './types';

// Resolves the user's effective Unlock access tier — the single source of truth for
// how much of the app a signed-in person can reach.
// Evaluation order:
//  1. Unleash flag — if ON for this user (via userWithId targeting), they have full access.
//  2. DB fallback — for users approved before flag-driven gating was deployed, or when
//     Unleash is not configured (local / CI); returns the stored tier (with lazy expiry
//     applied by getEffectiveUnlockAccessTier), or null when the user has no submission.
//
// The DB fallback ensures no regression for existing approved users.
export async function getUnlockAccessTier(userId: string): Promise<UnlockAccessTier | null> {
	try {
		const flagEnabled = await evaluateBooleanFlag(UNLOCK_FLAGS.QUORA_ONBOARDING, false, {
			targetingKey: userId,
		});
		if (flagEnabled) return 'approved_full';
	} catch (error) {
		// A flag-backend failure must never lock out approved users; fall through to the DB tier.
		console.error('[unlock] flag evaluation failed; falling back to DB access tier', error);
	}

	// Fall back to DB for users approved before Unleash targeting was set, or when Unleash
	// is unconfigured. The flag client returns the default (false) in both cases, so we
	// consult the DB to avoid locking out previously approved users.
	return getEffectiveUnlockAccessTier(userId);
}

// Returns true if the user has full (approved) access to the platform. Thin wrapper over
// getUnlockAccessTier so existing callers keep working.
export async function isUserUnlocked(userId: string): Promise<boolean> {
	return (await getUnlockAccessTier(userId)) === 'approved_full';
}

// A/B experiment bucket. True when this user is in the "early Commons access" treatment group —
// a not-yet-verified member who is allowed into the Commons (Hub general channel) to ask for help
// before completing Quora verification. Bucketing is the Unleash flag's gradual rollout (sticky on
// userId); the default is false, so when the flag is off or Unleash is unconfigured, behavior is
// the current control (Unlock-only until verified). A flag-backend failure must never widen access,
// so any error resolves to false (control).
export async function isUnlockEarlyCommonsEnabled(userId: string): Promise<boolean> {
	try {
		return await evaluateBooleanFlag(UNLOCK_FLAGS.EARLY_COMMONS_ACCESS, false, {
			targetingKey: userId,
		});
	} catch (error) {
		console.error('[unlock] early-commons flag evaluation failed; defaulting to control', error);
		return false;
	}
}
