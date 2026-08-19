import { UNLOCK_FLAGS } from '@ctf/shared';
import { evaluateBooleanFlag } from 'lib/feature-flags';
import { hasUnlockCommonsFallback } from './help-requests';
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
	const storedTier = await getEffectiveUnlockAccessTier(userId);
	if (storedTier === 'approved_full' || storedTier === 'locked_support_only') return storedTier;

	// Everything below is a member who cannot reach the Commons on their stored tier: either no
	// submission at all (null) or one waiting in the review queue (`pending_readonly`). Both used to
	// mean the Unlock screen was the only thing they could open — including no access to the Commons,
	// which is the one place to ask for help with the step they are stuck on.
	//
	// The waiting case matters as much as the missing one. Someone who gave a URL and is waiting has
	// done everything asked of them; leaving them with nobody to ask until the review window lapses is
	// the same dead end, and it silently sent them back to the Unlock screen when they pressed the
	// help button. Asking for help, or coming back on a later day, opens the Commons for either.
	//
	// They still reach no approved-only surface, and the Commons keeps the verification banner in
	// front of them.
	if (await hasUnlockCommonsFallback(userId)) return 'locked_support_only';
	return storedTier;
}

// Returns true if the user has full (approved) access to the platform. Thin wrapper over
// getUnlockAccessTier so existing callers keep working.
export async function isUserUnlocked(userId: string): Promise<boolean> {
	return (await getUnlockAccessTier(userId)) === 'approved_full';
}
