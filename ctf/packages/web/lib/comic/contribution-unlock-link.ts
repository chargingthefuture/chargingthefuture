import {
  applyDenylistBlockIfSpam,
  createOrUpdateUnlockSubmission,
  getUnlockStatusForUser,
  insertUnlockAudit,
  normalizeQuoraProfileUrl,
} from 'lib/shared/unlock-interface';
import { reportError } from 'lib/observability/report';

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
  } catch (error) {
    // If the check fails, do not ask. A contribution is still worth having, and a member who does
    // have a URL on file must never be prompted for a second one because of a transient error. The
    // failure is reported so a page that stopped asking for everyone can be traced to its cause.
    reportError(error, { area: 'comic', op: 'contribution_unlock_status_check' });
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

    const submission = await createOrUpdateUnlockSubmission({
      userId: input.userId,
      quoraProfileUrl: raw,
      quoraProfileUrlNormalized: normalized,
    });

    // A URL on the spam denylist comes back marked spam. It gets the same app-wide block the Unlock
    // screen's own route applies, or contributing would be a way around the denylist.
    const spam = submission.reviewStatus === 'spam';
    await applyDenylistBlockIfSpam(submission.reviewStatus, input.userId);

    // Audited as a normal Unlock submission so the queue and the trail read the same as any other,
    // with the contribution named in metadata so a reviewer can see where it came from.
    await insertUnlockAudit({
      actorUserId: input.userId,
      command: 'unlock.verification.submit',
      policyStatus: spam ? 'deny' : 'allow',
      reason: spam ? 'spam_denylisted' : 'ok',
      targetUserId: input.userId,
      metadata: {
        source: 'comic_knowledge_contribution',
        contributionId: input.contributionId,
        submissionId: submission.id,
      },
    });

    return { status: 'submitted' };
  } catch (error) {
    // The contribution is already stored, so this stays a `failed` outcome rather than an error
    // response — but the cause is reported, or a broken link to Unlock could not be diagnosed.
    reportError(error, {
      area: 'comic',
      op: 'contribution_unlock_link',
      extra: { contributionId: input.contributionId },
    });
    return { status: 'failed' };
  }
}
