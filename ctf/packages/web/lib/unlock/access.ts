import { UNLOCK_FLAGS } from '@ctf/shared';
import { evaluateBooleanFlag } from 'lib/feature-flags';
import { getEffectiveUnlockAccessTier } from './repository';

// Returns true if the user has full (approved) access to the platform.
// Evaluation order:
//  1. Unleash flag — if ON for this user (via userWithId targeting), granted immediately.
//  2. DB fallback — for users approved before flag-driven gating was deployed, or when
//     Unleash is not configured (local / CI); checks access_tier = 'approved_full' in DB.
//
// The DB fallback ensures no regression for existing approved users.
export async function isUserUnlocked(userId: string): Promise<boolean> {
	const flagEnabled = await evaluateBooleanFlag(UNLOCK_FLAGS.QUORA_ONBOARDING, false, {
		targetingKey: userId,
	});
	if (flagEnabled) return true;

	// Fall back to DB for users approved before Unleash targeting was set, or when Unleash
	// is unconfigured. The flag client returns the default (false) in both cases, so we
	// consult the DB to avoid locking out previously approved users.
	const tier = await getEffectiveUnlockAccessTier(userId);
	return tier === 'approved_full';
}
