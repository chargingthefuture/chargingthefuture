import {
  createOrUpdateUnlockSubmission,
  getUnlockStatusForUser,
  insertUnlockAudit,
  normalizeQuoraProfileUrl,
} from 'lib/shared/unlock-interface';
import { recordRemovedQuoraAccountStandalone } from 'lib/shared/directory-interface';
import { failureReason } from 'lib/errors/failure';
import {
  QUORA_SURVEY_MAX_LINKED_HANDLES,
  QUORA_SURVEY_UNLOCK_SOURCE,
  removedQuoraAccountMarker,
} from './constants';

// Carrying a survey answer into Unlock verification, when the person asks for it on the
// confirmation screen.
//
// Why this exists at all: someone answering this survey has usually just told us they had one or
// more Quora accounts removed and still hold one that was not. That live account is exactly what
// Unlock verification asks to see. Making them find the Unlock screen and type the same URL again
// is asking twice for the same thing, at the moment they are most likely to leave.
//
// Three things this deliberately does NOT do:
//
//   1. It is not an approval. It creates a `pending` submission in the ordinary queue, exactly as
//      the Unlock screen would. The owner still decides.
//   2. It does not run as part of the survey submission. It is a separate request the person
//      starts by pressing a button after their answer is already stored, so a failure here can
//      never lose their answer.
//   3. It never touches an account that already has a submission. A member who verified through
//      the Unlock screen is not asked again and is not overwritten, so two conflicting URLs can
//      never land on one account by this path.
//
// The removed handles are recorded on the member's account as a matter of course, not behind an
// extra choice. Two earlier drafts of this file argued for hiding the connection between a
// respondent and the handles they reported; both were wrong for this survey (owner, 2026-08-19).
// It exists to put handle history on record — the handles are public, the person typed them
// deliberately, and someone who does not want theirs recorded does not fill in the form.
//
// Publication is the separate question, and it is answered by the three consent flags on the
// response, not here. Nothing in this file publishes anything.

export type SurveyUnlockLinkOutcome =
  | { status: 'submitted'; linkedHandles: number }
  | { status: 'already_on_file' }
  | { status: 'invalid_url' }
  | { status: 'failed'; reason: string };

// True when this member has no Quora URL on file, so the confirmation screen should make the
// offer. A member who already submitted is never asked again.
export async function surveyRespondentNeedsUnlock(userId: string): Promise<boolean> {
  try {
    const status = await getUnlockStatusForUser(userId);
    return !status.hasSubmission;
  } catch {
    // On a failed check, do not offer. A missed offer costs one extra trip to the Unlock screen;
    // a wrongly shown offer asks a verified member for a second URL.
    return false;
  }
}

// Write the removed handles onto the member's Directory account history.
//
// Best-effort per handle: this runs after the Unlock submission has already been created, and a
// handle that will not record is not a reason to lose a verification the person asked for. Each
// handle is stored as a marker string rather than a URL — the account is gone, so there is no URL
// to store and none may be invented, or the history would carry a link that looks live.
async function recordRemovedHandles(userId: string, handles: string[]): Promise<number> {
  let recorded = 0;
  for (const handle of handles.slice(0, QUORA_SURVEY_MAX_LINKED_HANDLES)) {
    const trimmed = handle.trim();
    if (trimmed.length === 0) {
      continue;
    }
    try {
      await recordRemovedQuoraAccountStandalone({
        userId,
        removedAccountMarker: removedQuoraAccountMarker(trimmed),
        changedByUserId: userId,
        source: QUORA_SURVEY_UNLOCK_SOURCE,
      });
      recorded += 1;
    } catch (error) {
      // Not rethrown on purpose: the count returned to the caller is what was actually written, so
      // the audit row reports the real number rather than the number attempted. The cause is
      // logged rather than dropped, because a handle that silently fails to record would look
      // exactly like a handle the person chose not to link.
      console.error(
        '[quora-deletion-survey.unlock-link] could not record removed handle',
        failureReason(error),
      );
    }
  }
  return recorded;
}

export async function linkSurveyRespondentToUnlock(input: {
  userId: string;
  quoraProfileUrl: string;
  // The handles the person reported as removed, recorded alongside the account they are verifying
  // with so their account history sits in one place.
  removedHandles: string[];
}): Promise<SurveyUnlockLinkOutcome> {
  try {
    // Re-checked here rather than trusted from the page: the member may have submitted through
    // the Unlock screen in another tab while this one was open.
    const status = await getUnlockStatusForUser(input.userId);
    if (status.hasSubmission) {
      return { status: 'already_on_file' };
    }

    const normalized = normalizeQuoraProfileUrl(input.quoraProfileUrl);
    if (!normalized) {
      return { status: 'invalid_url' };
    }

    await createOrUpdateUnlockSubmission({
      userId: input.userId,
      quoraProfileUrl: input.quoraProfileUrl,
      quoraProfileUrlNormalized: normalized,
    });

    const linkedHandles = await recordRemovedHandles(input.userId, input.removedHandles);

    // Audited as an ordinary Unlock submission so the queue and the trail read the same as any
    // other, with the survey named in metadata so a reviewer can see where it came from and that
    // the member never saw the Unlock form.
    await insertUnlockAudit({
      actorUserId: input.userId,
      command: 'unlock.verification.submit',
      policyStatus: 'allow',
      reason: 'ok',
      targetUserId: input.userId,
      metadata: { source: QUORA_SURVEY_UNLOCK_SOURCE, linkedRemovedHandles: linkedHandles },
    });

    return { status: 'submitted', linkedHandles };
  } catch (error) {
    return { status: 'failed', reason: failureReason(error) };
  }
}
