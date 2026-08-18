// Shared constants for the public Quora account-deletion survey.
//
// The survey collects self-reports from people whose Quora accounts were removed, so the blog
// posts can cite a record instead of an impression. Everything here is deliberately narrow: a
// fixed option list per question, hard length caps, and consent flags that default to off.
//
// Two limits belong in front of anyone reading a result set, and are repeated in the survey copy
// and the inventory so they cannot be quietly dropped:
//   1. Self-report. Nothing here is verified against Quora. A response is what one person says.
//   2. Selection bias runs one way. Only someone who found another platform can answer at all,
//      so the sample skews toward people who persisted. Report a count of responses, never a
//      share of a population.

export const QUORA_SURVEY_ERROR_CODE = {
  csrfDenied: 'quora_deletion_survey.csrf_denied',
  invalidPayload: 'quora_deletion_survey.invalid_payload',
  rateLimited: 'quora_deletion_survey.rate_limited',
  persistenceUnavailable: 'quora_deletion_survey.persistence_unavailable',
  forbidden: 'quora_deletion_survey.forbidden',
} as const;

export type QuoraSurveyErrorCode =
  (typeof QUORA_SURVEY_ERROR_CODE)[keyof typeof QUORA_SURVEY_ERROR_CODE];

// Q1. Yes or no, with no third option (owner decision, 2026-08-18). The question is required
// rather than defaulted: an unanswered response would be stored as one of the two answers and
// counted as if the person had said it, so the form asks for it before it will send.
export const QUORA_SURVEY_TARGETED_INDIVIDUAL = ['yes', 'no'] as const;
export type QuoraSurveyTargetedIndividual = (typeof QUORA_SURVEY_TARGETED_INDIVIDUAL)[number];

// Q4. What Quora did to the account. An account left standing but emptied of its answers is the
// same silencing as a deletion, so it is a first-class option rather than an "other".
export const QUORA_SURVEY_ACTION = [
  'account_deleted',
  'account_suspended',
  'answers_removed',
  'space_removed',
  'posting_blocked',
] as const;
export type QuoraSurveyAction = (typeof QUORA_SURVEY_ACTION)[number];

export const QUORA_SURVEY_ACTION_LABEL: Record<QuoraSurveyAction, string> = {
  account_deleted: 'The whole account was deleted',
  account_suspended: 'The account was banned or suspended',
  answers_removed: 'Answers or posts were removed, account kept',
  space_removed: 'A Space I ran was removed',
  posting_blocked: 'I was blocked from posting',
};

// Q6. The reason Quora gave. 'none_given' is expected to be the most common answer and is the
// default; it is an answer in its own right, not a missing value.
export const QUORA_SURVEY_REASON = [
  'none_given',
  'spam',
  'harassment',
  'misinformation',
  'impersonation',
  'adult_content',
  'ban_evasion',
  'other',
  'do_not_recall',
] as const;
export type QuoraSurveyReason = (typeof QUORA_SURVEY_REASON)[number];

export const QUORA_SURVEY_REASON_LABEL: Record<QuoraSurveyReason, string> = {
  none_given: 'No reason was given',
  spam: 'Spam',
  harassment: 'Harassment or bullying',
  misinformation: 'Misinformation',
  impersonation: 'Impersonation or a fake name',
  adult_content: 'Adult content',
  ban_evasion: 'Making a new account after a ban',
  other: 'Something else',
  do_not_recall: 'I do not remember',
};

// Q8. What the account mostly wrote about. This is the column that separates "accounts get
// removed" from "accounts writing about this get removed", so the list names the subject matter
// plainly rather than lumping it under one catch-all.
export const QUORA_SURVEY_TOPIC = [
  'targeting_and_gang_stalking',
  'surveillance_and_harassment_tactics',
  'coping_and_support',
  'legal_and_reporting',
  'organizing_and_meetups',
  'unrelated_subjects',
] as const;
export type QuoraSurveyTopic = (typeof QUORA_SURVEY_TOPIC)[number];

export const QUORA_SURVEY_TOPIC_LABEL: Record<QuoraSurveyTopic, string> = {
  targeting_and_gang_stalking: 'Targeting and gang stalking',
  surveillance_and_harassment_tactics: 'Surveillance and harassment tactics',
  coping_and_support: 'Coping, support, encouragement',
  legal_and_reporting: 'Legal steps and reporting',
  organizing_and_meetups: 'Organizing, meetups, community building',
  unrelated_subjects: 'Subjects unrelated to targeting',
};

// Length and count caps. They bound one accidental paste and one abusive flood; they are not a
// judgment about how much anyone has to say.
export const QUORA_SURVEY_HANDLE_MAX_LENGTH = 200;
export const QUORA_SURVEY_TEXT_MAX_LENGTH = 5000;
export const QUORA_SURVEY_MAX_ACCOUNTS = 25;

// The earliest year worth offering: Quora opened to the public in 2010, and a report of a
// removal before that is a typing mistake rather than an event.
export const QUORA_SURVEY_EARLIEST_YEAR = 2010;

// Per-IP write brake. Far tighter than the shared public READ limit, because one person filing
// one considered response is the expected shape of legitimate traffic here.
export const QUORA_SURVEY_SUBMIT_RATE_LIMIT = 5;
export const QUORA_SURVEY_SUBMIT_RATE_WINDOW_MS = 60 * 60 * 1000;

// Where the form lives. A short top-level path, not one under /apps: this link is read outside
// the app — on Quora, on Reddit, in a blog post — and has to be easy to type and to trust.
export const QUORA_SURVEY_PUBLIC_PATH = '/survey/quora-account-deletions';
