// The ServiceCredits recognition grant for an accepted knowledge contribution.
//
// ServiceCredits are an internal credits unit — not money, never redeemable for fiat. This is
// recognition for building something the whole community uses, not a payment for anyone's story.
//
// TWO RULES, and they are the reason this is its own module rather than a few lines in the route.
//
// 1. ONLY AN UNLOCKED MEMBER RECEIVES CREDITS. As of 2026-07-29 contributing ITSELF requires
//    completed Unlock (the /knowledge page and the submit route both enforce it), so in practice no
//    unverified member can reach an accepted contribution and this check should never fire. It is
//    kept as defence in depth: it is the last gate before credits are minted, and if the submit-side
//    requirement is ever relaxed again, the money-adjacent path must not quietly start paying out.
//    A contribution that somehow arrives from an unverified member stays accepted and ungranted
//    rather than failing — the writing is still worth having.
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
