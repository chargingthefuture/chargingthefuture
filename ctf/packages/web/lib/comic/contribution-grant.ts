// The ServiceCredits recognition grant for an accepted knowledge contribution.
//
// ServiceCredits are an internal credits unit — not money, never redeemable for fiat. This is
// recognition for building something the whole community uses, not a payment for anyone's story.
//
// TWO RULES, and they are the reason this is its own module rather than a few lines in the route.
//
// 1. ONLY AN UNLOCKED MEMBER RECEIVES CREDITS (owner decision, 2026-07-29). Contributing is open to
//    any signed-in member — someone still working through verification may have years of writing
//    worth having, and refusing it would cost the library more than it protects. The grant is the
//    part that requires full Unlock access. It is also the part a bad actor would want: paying for
//    contributions is an invitation to submit poisoned material, and requiring verification puts a
//    real cost in front of that. An accepted contribution from a not-yet-verified member stays
//    accepted and ungranted; nothing is lost, and the grant can be made later once they verify.
//
// 2. NEVER GRANT TWICE. `granted_at` is stamped in the database before the mint is attempted, and
//    the mint itself carries a per-contribution idempotency key, so a retried review, a double-click,
//    or a crash between the two cannot mint a second grant.
import { mintGrant } from 'lib/service-credits/repository';
import { isUserUnlocked } from 'lib/unlock/access';
import { markContributionGranted } from './contribution-repository';

// Recognition for one accepted contribution, whatever its size. Deliberately flat rather than
// per-post: paying by volume would reward padding a submission, and the reviewer would then be
// arguing about counts with people who are already having a hard week.
export const CONTRIBUTION_GRANT_AMOUNT = 100;

export type GrantOutcome =
  | { status: 'granted'; amount: number }
  | { status: 'already_granted' }
  | { status: 'skipped_not_unlocked' }
  | { status: 'failed'; reason: string };

export async function grantContributionRecognition(input: {
  contributionId: string;
  contributorUserId: string;
  reviewerId: string;
}): Promise<GrantOutcome> {
  if (!(await isUserUnlocked(input.contributorUserId))) {
    return { status: 'skipped_not_unlocked' };
  }

  // Stamp first. If the mint then fails, the contribution reads as granted and no credits landed —
  // which is recoverable by hand and is the safer failure. The reverse order risks minting twice.
  const stamped = await markContributionGranted(input.contributionId);
  if (!stamped) {
    return { status: 'already_granted' };
  }

  try {
    await mintGrant({
      actorId: input.reviewerId,
      targetUserId: input.contributorUserId,
      amount: CONTRIBUTION_GRANT_AMOUNT,
      grantReason: 'comic_knowledge_contribution_accepted',
      governanceTicketId: `comic:contribution:${input.contributionId}`,
      idempotencyKey: `comic-contribution-${input.contributionId}`,
    });
    return { status: 'granted', amount: CONTRIBUTION_GRANT_AMOUNT };
  } catch (error) {
    return { status: 'failed', reason: error instanceof Error ? error.message : 'mint_failed' };
  }
}
