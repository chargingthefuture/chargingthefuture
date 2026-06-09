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
