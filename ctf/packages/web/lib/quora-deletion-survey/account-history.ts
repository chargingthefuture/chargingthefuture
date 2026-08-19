import {
  listRemovedQuoraAccountMarkers,
  recordRemovedQuoraAccountStandalone,
} from 'lib/shared/directory-interface';
import { failureReason } from 'lib/errors/failure';
import {
  QUORA_SURVEY_MAX_LINKED_HANDLES,
  QUORA_SURVEY_UNLOCK_SOURCE,
  removedQuoraAccountMarker,
} from './constants';

// Writing the accounts a member reported as closed onto their own account history.
//
// This runs on every survey submission, for every respondent — not only for a member who goes on
// to verify, and not behind a choice (owner, 2026-08-19). A member may have had several accounts
// closed and still hold others; the survey is the list of the ones Quora closed, and that list
// belongs on their account history. Two earlier builds tied this write to the verification step,
// which meant an already-verified member's reported closures were never recorded at all, and a
// member with no Quora account left could not record anything — the strongest case in the
// research, with the emptiest history.
//
// The history is append-only. There is no update and no delete anywhere in the codebase, and
// account deletion retains it. A member cannot revise what they reported here, which is the point:
// it is a record of accounts being erased, and a record that can be quietly edited is not one.
//
// Each closure is written as a marker string rather than a URL. The account is gone, so there is
// no URL, and inventing a plausible quora.com/profile/... link would put something in the history
// that looks live and clickable and is not.
//
// Best-effort per handle: the response is already stored by the time this runs, and a handle that
// will not record must not turn a saved answer into an error on the member's screen.
export async function recordReportedClosures(input: {
  userId: string;
  handles: string[];
}): Promise<number> {
  let recorded = 0;

  // Skip anything already on this member's history, so answering the survey twice does not write
  // the same closure twice into a table that cannot be corrected afterwards.
  let alreadyRecorded: Set<string>;
  try {
    alreadyRecorded = await listRemovedQuoraAccountMarkers(input.userId);
  } catch (error) {
    console.error(
      '[quora-deletion-survey.account-history] could not read existing closures; skipping the write rather than risking duplicates',
      failureReason(error),
    );
    return 0;
  }

  for (const handle of input.handles.slice(0, QUORA_SURVEY_MAX_LINKED_HANDLES)) {
    const trimmed = handle.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const marker = removedQuoraAccountMarker(trimmed);
    if (alreadyRecorded.has(marker.toLowerCase())) {
      continue;
    }
    try {
      await recordRemovedQuoraAccountStandalone({
        userId: input.userId,
        removedAccountMarker: marker,
        changedByUserId: input.userId,
        source: QUORA_SURVEY_UNLOCK_SOURCE,
      });
      alreadyRecorded.add(marker.toLowerCase());
      recorded += 1;
    } catch (error) {
      // The count returned is what was actually written, so the audit row reports the real number
      // rather than the number attempted. The cause is logged rather than dropped.
      console.error(
        '[quora-deletion-survey.account-history] could not record a reported closure',
        failureReason(error),
      );
    }
  }

  return recorded;
}
