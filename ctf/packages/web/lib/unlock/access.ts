import { hasUnlockCommonsFallback } from './help-requests';
import { getEffectiveUnlockAccessTier } from './repository';
import type { UnlockAccessTier } from './types';

// Resolves the user's effective Unlock access tier — the single source of truth for
// how much of the app a signed-in person can reach.
// Evaluation order:
//  1. Stored submission row — read first, with lazy expiry applied by getEffectiveUnlockAccessTier.
//     When a row exists it decides: an approval stores `approved_full`, and a rejection, a reward
//     revoke or a re-submission stores a lower tier that nothing else may override.
//  2. No row, or a row below full access — the Commons fallback below, or the stored tier.
// (A hand-kept flag service list once granted full access to a member with no row. It was removed
// with the flag service; approval has always stored `approved_full`, so the row is the record.)
export async function getUnlockAccessTier(userId: string): Promise<UnlockAccessTier | null> {
	const storedTier = await getEffectiveUnlockAccessTier(userId);
	if (storedTier === 'approved_full') return storedTier;

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
