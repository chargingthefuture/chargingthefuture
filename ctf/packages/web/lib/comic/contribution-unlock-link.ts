import { normalizeQuoraProfileUrl } from 'lib/unlock/quora-url';
import { createOrUpdateUnlockSubmission, getUnlockStatusForUser, insertUnlockAudit } from 'lib/unlock/repository';

// Contributing to the knowledge library is a route INTO verification, not something gated behind it
// (owner decision, 2026-07-29).
//
// The reasoning: to judge a contribution the owner has to open the contributor's Quora account and
// see that it is a real person writing real things. That is the same look Unlock verification asks
// for. Making someone complete Unlock first, then contribute, means reviewing the same account
// twice — and it turns the most useful thing a new member can do into something they have to wait
// for. So the submission carries a Quora profile URL, and that URL opens an Unlock submission.
//
// This is deliberately NOT an auto-approval. It creates a `pending` submission in the normal queue,
// exactly as if the member had used the Unlock screen. The owner still decides. What changes is that
// one review now answers both questions — is this account real, and is this writing usable — instead
// of the member being stuck behind the first before they can attempt the second.

export type UnlockLinkOutcome =
  | { status: 'already_on_file' }
  | { status: 'submitted' }
  | { status: 'invalid_url' }
  | { status: 'not_provided' }
  | { status: 'failed' };

// True when this member has no Quora URL on file, so the knowledge page should ask for one.
// A member who already submitted through Unlock is never asked again (owner decision): the
// contribution simply attaches to the account they already have, and two conflicting URLs can never
// end up on one account by way of this page.
export async function needsQuoraProfileUrl(userId: string): Promise<boolean> {
  try {
    const status = await getUnlockStatusForUser(userId);
    return !status.hasSubmission;
  } catch {
    // If the check fails, do not ask. A contribution is still worth having, and a member who does
    // have a URL on file must never be prompted for a second one because of a transient error.
    return false;
  }
}

// Open an Unlock submission from a contribution's Quora profile URL, when the member has none yet.
//
// Best-effort by design: the contribution has already been stored by the time this runs, and a
// failure here must not lose the member's writing. The worst case is that they verify the ordinary
// way afterwards.
export async function linkContributionToUnlock(input: {
  userId: string;
  quoraProfileUrl: string | null;
  contributionId: string;
}): Promise<UnlockLinkOutcome> {
  const raw = input.quoraProfileUrl?.trim() ?? '';
  if (raw.length === 0) {
    return { status: 'not_provided' };
  }

  try {
    // Re-check rather than trusting the page's own view of it: the member may have submitted through
    // the Unlock screen in another tab between the page rendering and this request.
    const status = await getUnlockStatusForUser(input.userId);
    if (status.hasSubmission) {
      return { status: 'already_on_file' };
    }

    const normalized = normalizeQuoraProfileUrl(raw);
    if (!normalized) {
      return { status: 'invalid_url' };
    }

    await createOrUpdateUnlockSubmission({
      userId: input.userId,
      quoraProfileUrl: raw,
      quoraProfileUrlNormalized: normalized,
    });

    // Audited as a normal Unlock submission so the queue and the trail read the same as any other,
    // with the contribution named in metadata so a reviewer can see where it came from.
    await insertUnlockAudit({
      actorUserId: input.userId,
      command: 'unlock.verification.submit',
      policyStatus: 'allow',
      reason: 'ok',
      targetUserId: input.userId,
      metadata: { source: 'comic_knowledge_contribution', contributionId: input.contributionId },
    });

    return { status: 'submitted' };
  } catch {
    return { status: 'failed' };
  }
}
