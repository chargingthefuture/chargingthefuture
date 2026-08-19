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

// The subject list. Deliberately identical to the deletion survey's
// (lib/quora-deletion-survey/constants.ts): the two datasets only answer the question together,
// and they cannot be compared if they are coded differently. Change one list and you must change
// the other, or the comparison silently stops meaning anything.
export const QUORA_CENSUS_TOPIC = [
  'targeting_and_gang_stalking',
  'surveillance_and_harassment_tactics',
  'coping_and_support',
  'legal_and_reporting',
  'organizing_and_meetups',
  'unrelated_subjects',
] as const;
export type QuoraCensusTopic = (typeof QUORA_CENSUS_TOPIC)[number];

export const QUORA_CENSUS_TOPIC_LABEL: Record<QuoraCensusTopic, string> = {
  targeting_and_gang_stalking: 'Targeting and gang stalking',
  surveillance_and_harassment_tactics: 'Surveillance and harassment tactics',
  coping_and_support: 'Coping, support, encouragement',
  legal_and_reporting: 'Legal steps and reporting',
  organizing_and_meetups: 'Organizing, meetups, community building',
  unrelated_subjects: 'Subjects unrelated to targeting',
};

// The column the census exists for: what the surviving account actually says.
//
// The list includes categories that would REFUTE the claim under test — practical_help and
// organizing — alongside the ones that would support it. That is the point. A coding scheme
// containing only the expected answers produces the expected answer and proves nothing, so these
// two options must never be dropped to "simplify" the list.
//
// 'unclear' is the honest default. A coder who cannot tell from the account should record that
// rather than guess, and a run with a large unclear share is telling you the sampling or the
// reading was too thin, not that the accounts were ambiguous.
export const QUORA_CENSUS_STANCE = [
  'practical_help',
  'organizing',
  'personal_account',
  'distress_no_coping',
  'discouraging',
  'dismissive',
  'unclear',
  'unrelated',
] as const;
export type QuoraCensusStance = (typeof QUORA_CENSUS_STANCE)[number];

export const QUORA_CENSUS_STANCE_LABEL: Record<QuoraCensusStance, string> = {
  practical_help: 'Practical help — what to do, what worked',
  organizing: 'Organizing — groups, meetups, building something',
  personal_account: 'Personal account — their own experience, no advice',
  distress_no_coping: 'Distress with no way forward offered',
  discouraging: 'Tells others to stop trying or give up',
  dismissive: 'Says targeting is not real, or is only illness',
  unclear: 'Cannot tell from the account',
  unrelated: 'Not about targeting at all',
};

export const QUORA_CENSUS_TEXT_MAX_LENGTH = 5000;
export const QUORA_CENSUS_HANDLE_MAX_LENGTH = 200;
export const QUORA_CENSUS_URL_MAX_LENGTH = 2000;

// The earliest year worth offering: Quora opened to the public in 2010.
export const QUORA_CENSUS_EARLIEST_YEAR = 2010;
