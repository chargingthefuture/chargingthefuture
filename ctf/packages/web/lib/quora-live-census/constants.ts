import {
  QUORA_RESEARCH_SUBJECT,
  QUORA_RESEARCH_SUBJECT_LABEL,
  type QuoraResearchSubject,
} from 'lib/shared/quora-research-subjects';

// Shared constants for the Quora live-account census.
//
// The census is the other half of the deletion survey. The survey records what was removed, which
// cannot establish what remains; this records what is still standing on a fixed date, coded by
// subject and stance, so the two together can answer a question neither answers alone.

export const QUORA_CENSUS_ERROR_CODE = {
  invalidPayload: 'quora_live_census.invalid_payload',
  csrfDenied: 'quora_live_census.csrf_denied',
  notFound: 'quora_live_census.not_found',
  runClosed: 'quora_live_census.run_closed',
  duplicateHandle: 'quora_live_census.duplicate_handle',
  persistenceUnavailable: 'quora_live_census.persistence_unavailable',
} as const;

export type QuoraCensusErrorCode =
  (typeof QUORA_CENSUS_ERROR_CODE)[keyof typeof QUORA_CENSUS_ERROR_CODE];

// A run is open while coding is in progress and closed when it is finished. Only a closed run
// should be quoted: a half-coded run reports whatever was entered first, which is usually whatever
// was easiest to find.
export const QUORA_CENSUS_RUN_STATUS = ['open', 'closed'] as const;
export type QuoraCensusRunStatus = (typeof QUORA_CENSUS_RUN_STATUS)[number];

// Where a run's accounts came from. This is not bookkeeping — it decides what the run can support,
// and getting it wrong produces a confident number that is simply false.
//
// A fresh search cannot see a removed account. Search Quora today and you get survivors; the
// accounts that were taken down are not missing from the results, they are invisible to them. So a
// fresh-search run can describe what the survivors say, and can say NOTHING about how many were
// removed — its "gone" count is only the handful that died between finding them and coding them.
//
// A list assembled beforehand, on a criterion unrelated to what the accounts say, is the frame
// that supports both. The app already holds one: directory_profiles with source 'admin' or
// 'community-generated' were added because the person is a targeted individual, whatever they
// write. Walking that list today gives a removal rate against a fixed denominator and the stance
// mix among the survivors, from the same pass.
export const QUORA_CENSUS_FRAME_KIND = ['existing_list', 'fresh_search'] as const;
export type QuoraCensusFrameKind = (typeof QUORA_CENSUS_FRAME_KIND)[number];

export const QUORA_CENSUS_FRAME_KIND_LABEL: Record<QuoraCensusFrameKind, string> = {
  existing_list: 'A list assembled before this run',
  fresh_search: 'Searching Quora during this run',
};

export const QUORA_CENSUS_FRAME_KIND_SUPPORTS: Record<QuoraCensusFrameKind, string> = {
  existing_list:
    'Supports both: how many of a fixed set are gone, and what the survivors say. Strongest when the list was built on something other than what the accounts write — the app directory is, since profiles are added for being a targeted individual.',
  fresh_search:
    'Supports what the survivors say, and nothing about removals: a search today cannot return an account that no longer exists, so a removal rate cannot be read off this run.',
};

// Whether a run's frame can speak to how many accounts were removed.
export function frameSupportsRemovalRate(frameKind: QuoraCensusFrameKind): boolean {
  return frameKind === 'existing_list';
}

export const QUORA_CENSUS_ACCOUNT_STATE = ['live', 'gone', 'renamed_or_moved'] as const;
export type QuoraCensusAccountState = (typeof QUORA_CENSUS_ACCOUNT_STATE)[number];

export const QUORA_CENSUS_ACCOUNT_STATE_LABEL: Record<QuoraCensusAccountState, string> = {
  live: 'Still live',
  gone: 'Gone when checked',
  renamed_or_moved: 'Renamed or moved',
};

// The subject list lives in lib/shared/quora-research-subjects.ts, shared with the deletion survey.
// It was duplicated here while the survey was unmerged; the copies are now one list, because two
// copies drift apart without anything failing to warn you. Re-exported under the census's own
// names so call sites here read locally.
export const QUORA_CENSUS_TOPIC = QUORA_RESEARCH_SUBJECT;
export type QuoraCensusTopic = QuoraResearchSubject;
export const QUORA_CENSUS_TOPIC_LABEL = QUORA_RESEARCH_SUBJECT_LABEL;

// What the account DOES, not how the person behind it seems to be doing.
//
// This list once carried three more values — distress with no way forward, tells others to give
// up, says targeting is not real. They were removed on the owner's decision (2026-08-19), and the
// reason is worth keeping in front of whoever edits this next: each was a psychological judgment
// about an identifiable person, inferred from their public posts, stored against their handle, and
// exportable — about a population that believes it is being catalogued and was never asked. The
// deletion survey promises the opposite standard about the same people and asks their permission
// three separate ways. The census does not get a looser standard just because its subjects cannot
// object to it.
//
// What that costs, stated plainly because it is not small: the census can no longer test whether
// what remains is discouraging. An account that is pure despair now codes as 'personal_account' or
// 'unclear' like any other. It measures survival and subject matter — which accounts are still
// standing and what they are about — and the question about tone needs an instrument that does not
// keep a verdict on a named person.
//
// 'unclear' is the honest default and the stored default. A coder who cannot tell records that
// rather than guessing.
export const QUORA_CENSUS_STANCE = [
  'practical_help',
  'organizing',
  'personal_account',
  'unclear',
  'unrelated',
] as const;
export type QuoraCensusStance = (typeof QUORA_CENSUS_STANCE)[number];

export const QUORA_CENSUS_STANCE_LABEL: Record<QuoraCensusStance, string> = {
  practical_help: 'Practical help — what to do, what worked',
  organizing: 'Organizing — groups, meetups, building something',
  personal_account: 'Personal account — their own experience',
  unclear: 'Cannot tell from the account',
  unrelated: 'Not about targeting at all',
};

export const QUORA_CENSUS_TEXT_MAX_LENGTH = 5000;
export const QUORA_CENSUS_HANDLE_MAX_LENGTH = 200;
export const QUORA_CENSUS_URL_MAX_LENGTH = 2000;

// The earliest year worth offering: Quora opened to the public in 2010.
export const QUORA_CENSUS_EARLIEST_YEAR = 2010;
