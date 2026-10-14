import { UNLOCK_FLAGS } from '@ctf/shared';
import { evaluateBooleanFlag } from 'lib/feature-flags';
import { hasUnlockCommonsFallback } from './help-requests';
import { getEffectiveUnlockAccessTier } from './repository';
import type { UnlockAccessTier } from './types';

// Resolves the user's effective Unlock access tier — the single source of truth for
// how much of the app a signed-in person can reach.
// Evaluation order:
//  1. Stored submission row — read first, with lazy expiry applied by getEffectiveUnlockAccessTier.
//     When a row exists it decides: an approval stores `approved_full`, and a rejection, a reward
//     revoke or a re-submission stores a lower tier that nothing else may override.
//  2. Unleash flag — consulted only when the member has no row at all, so a member added to the
//     flag by hand in the Unleash dashboard still gets full access. Approval used to add members to
//     the flag and nothing took them out again, so a flag-first order let a rejected or revoked
//     member keep full access; the row now always wins.
//  3. No row and no flag — the Commons fallback below, or null.
export async function getUnlockAccessTier(userId: string): Promise<UnlockAccessTier | null> {
	const storedTier = await getEffectiveUnlockAccessTier(userId);
	if (storedTier === 'approved_full') return storedTier;

	if (storedTier === null) {
		try {
			const flagEnabled = await evaluateBooleanFlag(UNLOCK_FLAGS.QUORA_ONBOARDING, false, {
				targetingKey: userId,
			});
			if (flagEnabled) return 'approved_full';
		} catch (error) {
			// A flag-backend failure must never lock out approved users; fall through to the DB tier.
			console.error('[unlock] flag evaluation failed; falling back to DB access tier', error);
		}
	}

	if (storedTier === 'locked_support_only') return storedTier;

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
