// The credits a member is owed for writing accepted into the knowledge library before they were
// verified (owner decision, 2026-10-15; issue #2678).
//
// Contributing is open to any signed-in member, and only a verified member receives the credits
// (shared-writing-grant.ts). So writing accepted while the member was still in Unlock stayed accepted
// with no credits, and the admin screen said they would follow. Nothing ever made that grant: the
// accept route is the only other caller, and it acts only on writing still waiting for review.
//
// Called through lib/shared/unlock-approval-interface.ts, never by Unlock directly — plugins stay
// isolated (rule 112). It takes the member and the approving admin and nothing about the Unlock
// decision itself; it runs only after an approval, so the member is verified by then, and
// grantSharedWritingCredits checks that again anyway.
//
// Safe to run twice. A contribution already granted is stamped and skipped, and each mint carries a
// per-contribution idempotency key.
import { reportError } from 'lib/observability/report';
import { grantSharedWritingCredits } from './shared-writing-grant';
import { listUngrantedAcceptedSharedWritingIds } from './shared-writing-repository';

/** How many of the member's accepted contributions had their credits granted by this run. */
export async function grantHeldSharedWritingCredits(userId: string, approvedByUserId: string): Promise<number> {
  const contributionIds = await listUngrantedAcceptedSharedWritingIds(userId);
  let granted = 0;
  for (const contributionId of contributionIds) {
    const outcome = await grantSharedWritingCredits({
      contributionId,
      contributorUserId: userId,
      reviewerId: approvedByUserId,
    });
    if (outcome.status === 'granted') {
      granted += 1;
    } else if (outcome.status === 'failed') {
      // Reported and passed over, so one failed mint does not stop the rest. The stamp was cleared,
      // so a later approval of this member tries it again.
      reportError(new Error(`contribution grant failed: ${outcome.reason}`), {
        area: 'comic',
        op: 'contribution_grant_on_approval',
        extra: { contributionId },
      });
    }
  }
  return granted;
}
