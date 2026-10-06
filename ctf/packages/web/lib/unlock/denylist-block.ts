import { restrictAccount } from 'lib/auth/account-restrictions';
import { reportError } from 'lib/observability/report';
import { UNLOCK_SPAM_DENYLIST_ACTOR, UNLOCK_SPAM_RESTRICTION_REASON } from './spam-denylist';

// A submitted URL on the spam denylist is auto-marked spam by createOrUpdateUnlockSubmission. Apply the
// same app-wide block the admin spam path applies, so a spammer who deleted their data and made a new
// account is shut out again without an admin re-reviewing them. Attributed to the system (no admin
// acted). Best-effort: a retry re-applies it, and the restriction is idempotent.
//
// Shared by every place that opens an Unlock submission — the Unlock screen's own route and the
// knowledge library contribution, which opens one from the Quora profile URL the member gives there.
// A submission opened by either route must meet the same block, or the second one is a way around it.
export async function applyDenylistBlockIfSpam(reviewStatus: string, targetUserId: string): Promise<void> {
  if (reviewStatus !== 'spam') {
    return;
  }
  try {
    await restrictAccount({
      targetUserId,
      actorId: UNLOCK_SPAM_DENYLIST_ACTOR,
      scope: 'all',
      reason: UNLOCK_SPAM_RESTRICTION_REASON,
    });
  } catch (restrictionError) {
    reportError(restrictionError, { area: 'unlock', op: 'submission_denylist_restrict' });
  }
}
