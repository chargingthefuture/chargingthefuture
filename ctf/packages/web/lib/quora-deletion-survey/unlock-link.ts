import {
  createOrUpdateUnlockSubmission,
  getUnlockStatusForUser,
  insertUnlockAudit,
  normalizeQuoraProfileUrl,
} from 'lib/shared/unlock-interface';
import { queryDb } from 'lib/db/postgres';
import { failureReason } from 'lib/errors/failure';
import { reportError } from 'lib/observability/report';
import { QUORA_SURVEY_UNLOCK_SOURCE } from './constants';

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
// The accounts a member reported as closed are NOT written here. They go onto the account history
// on submission, for every respondent, in lib/quora-deletion-survey/account-history.ts — tying
// that write to this step left an already-verified member's reported closures unrecorded. This
// file does one thing: turn the live account they named into a pending verification submission.

export type SurveyUnlockLinkOutcome =
  | { status: 'submitted' }
  | { status: 'already_on_file' }
  | { status: 'invalid_url' }
  | { status: 'not_reported' }
  | { status: 'failed'; reason: string };

// True when this member has no Quora URL on file, so the confirmation screen should make the
// offer. A member who already submitted is never asked again.
export async function surveyRespondentNeedsUnlock(userId: string): Promise<boolean> {
  try {
    const status = await getUnlockStatusForUser(userId);
    return !status.hasSubmission;
  } catch (error) {
    // On a failed check, do not offer. A missed offer costs one extra trip to the Unlock screen;
    // a wrongly shown offer asks a verified member for a second URL. Reported, because a broken
    // Unlock read removes the offer from every confirmation screen and nothing on screen says so.
    reportError(error, { area: 'quora-deletion-survey', op: 'needs-unlock' });
    return false;
  }
}

export async function linkSurveyRespondentToUnlock(input: {
  userId: string;
  quoraProfileUrl: string;
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

    // Audited as an ordinary Unlock submission so the queue and the trail read the same as any
    // other, with the survey named in metadata so a reviewer can see where it came from and that
    // the member never saw the Unlock form.
    await insertUnlockAudit({
      actorUserId: input.userId,
      command: 'unlock.verification.submit',
      policyStatus: 'allow',
      reason: 'ok',
      targetUserId: input.userId,
      metadata: { source: QUORA_SURVEY_UNLOCK_SOURCE },
    });

    return { status: 'submitted' };
  } catch (error) {
    // The member sees the reason in a 503; this is the record an operator sees.
    reportError(error, { area: 'quora-deletion-survey', op: 'unlock-link' });
    return { status: 'failed', reason: failureReason(error) };
  }
}

// The second way to finish Unlock (3.1.0 plan, Access): a removed Quora account the member reported
// in this survey. Only the accounts Quora deleted or suspended count; an account with its answers
// removed still exists and is finished the ordinary way.
const REMOVED_ACTIONS = ['account_deleted', 'account_suspended'];

export type ReportedRemovedAccount = { handle: string; responseId: string };

// The removed accounts this member reported, newest answer first, one row per handle.
export async function listReportedRemovedAccounts(userId: string): Promise<ReportedRemovedAccount[]> {
  const result = await queryDb<{ handle: string; response_id: string }>(
    `SELECT DISTINCT ON (LOWER(a.handle)) a.handle, a.response_id::text AS response_id
       FROM quora_deletion_survey_accounts a
       JOIN quora_deletion_survey_responses r ON r.id = a.response_id
      WHERE r.user_id = $1 AND a.action = ANY($2::text[]) AND LENGTH(TRIM(a.handle)) > 0
      ORDER BY LOWER(a.handle), r.created_at DESC
      LIMIT 20`,
    [userId, REMOVED_ACTIONS],
  );
  return result.rows.map((row) => ({ handle: row.handle.trim(), responseId: row.response_id }));
}

// The profile address a reported handle stood for. A handle typed as an address is used as is;
// otherwise spaces become the hyphens Quora puts in profile addresses.
export function profileUrlForHandle(handle: string): string {
  const trimmed = handle.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const slug = trimmed.replace(/^@/, '').replace(/\s+/g, '-');
  return `https://www.quora.com/profile/${encodeURIComponent(slug)}`;
}

export async function linkRemovedAccountToUnlock(input: {
  userId: string;
  handle: string;
}): Promise<SurveyUnlockLinkOutcome> {
  try {
    const status = await getUnlockStatusForUser(input.userId);
    if (status.hasSubmission) {
      return { status: 'already_on_file' };
    }

    // Only an account this member reported themselves. The handle in the request picks one of them;
    // it is never taken on its own word.
    const wanted = input.handle.trim().toLowerCase();
    const reported = (await listReportedRemovedAccounts(input.userId)).find((account) => account.handle.toLowerCase() === wanted);
    if (!reported) {
      return { status: 'not_reported' };
    }

    const url = profileUrlForHandle(reported.handle);
    const normalized = normalizeQuoraProfileUrl(url);
    if (!normalized) {
      return { status: 'invalid_url' };
    }

    await createOrUpdateUnlockSubmission({
      userId: input.userId,
      quoraProfileUrl: url,
      quoraProfileUrlNormalized: normalized,
      finishRoute: 'removed_account',
      finishEvidenceId: reported.responseId,
    });

    await insertUnlockAudit({
      actorUserId: input.userId,
      command: 'unlock.verification.submit',
      policyStatus: 'allow',
      reason: 'ok',
      targetUserId: input.userId,
      metadata: { source: QUORA_SURVEY_UNLOCK_SOURCE, finishRoute: 'removed_account', responseId: reported.responseId },
    });

    return { status: 'submitted' };
  } catch (error) {
    reportError(error, { area: 'quora-deletion-survey', op: 'unlock-link-removed-account' });
    return { status: 'failed', reason: failureReason(error) };
  }
}
