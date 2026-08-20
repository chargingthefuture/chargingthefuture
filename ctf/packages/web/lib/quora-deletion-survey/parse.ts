// Turning one untrusted JSON body into a survey response, or saying exactly what was wrong
// with it.
//
// Kept out of the route so each check stays small and separately readable: this is the only
// place in the app that accepts a write from someone with no account, so what it does and does
// not accept should be obvious at a glance rather than buried in a handler.

import {
  QUORA_SURVEY_ACTION,
  QUORA_SURVEY_EARLIEST_YEAR,
  QUORA_SURVEY_HANDLE_MAX_LENGTH,
  QUORA_SURVEY_MAX_ACCOUNTS,
  QUORA_SURVEY_REASON,
  QUORA_SURVEY_TARGETED_INDIVIDUAL,
  QUORA_SURVEY_TEXT_MAX_LENGTH,
  QUORA_SURVEY_TOPIC,
  type QuoraSurveyAction,
  type QuoraSurveyReason,
  type QuoraSurveyTargetedIndividual,
  type QuoraSurveyTopic,
} from 'lib/quora-deletion-survey/constants';
import type {
  CreateSurveyResponseInput,
  SurveyAccountInput,
} from 'lib/quora-deletion-survey/repository';

export type ParseResult =
  // Everything the body carries. The member id is not in the body and is never taken from it —
  // the route reads it from the checked session and adds it on the way to the database.
  | { ok: true; value: Omit<CreateSurveyResponseInput, 'userId'> }
  | { ok: false; message: string };

function asOptionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, QUORA_SURVEY_TEXT_MAX_LENGTH);
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

// For an optional yes/no, where "did not say" is a real third state and must survive into the
// column rather than collapsing into a no.
function asOptionalBoolean(value: unknown): boolean | null {
  if (value === true) return true;
  if (value === false) return false;
  return null;
}

// A number the person typed, or null. Anything that is not a finite whole number in range is
// treated as "not answered" rather than rejected: an optional size estimate is not worth
// bouncing a whole response over.
function asOptionalCount(value: unknown, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < 0 || rounded > max) return null;
  return rounded;
}

function asOptionalMonth(value: unknown): number | null {
  const month = asOptionalCount(value, 12);
  return month === null || month < 1 ? null : month;
}

function asOptionalYear(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const year = Math.round(value);
  // The upper bound is generous rather than "this year": the server clock and the person's
  // clock can disagree across a new year, and rejecting a December report on January 1 would
  // lose a real answer over a time zone.
  if (year < QUORA_SURVEY_EARLIEST_YEAR || year > QUORA_SURVEY_EARLIEST_YEAR + 100) return null;
  return year;
}

function asOneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

// The same check without a fallback, for a question that has no safe default and must be
// answered rather than assumed.
function asOneOfStrict<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

function asTopics(value: unknown): QuoraSurveyTopic[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(QUORA_SURVEY_TOPIC);
  const chosen = value.filter(
    (entry): entry is QuoraSurveyTopic => typeof entry === 'string' && allowed.has(entry),
  );
  return [...new Set(chosen)];
}

// One account row. The handle is the only required field — everything else is something a
// person may genuinely not remember about an account taken years ago, and demanding it would
// trade real answers for tidy ones.
function parseAccount(raw: unknown): SurveyAccountInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const entry = raw as Record<string, unknown>;

  const handle = typeof entry.handle === 'string' ? entry.handle.trim() : '';
  if (handle.length === 0) return null;

  return {
    handle: handle.slice(0, QUORA_SURVEY_HANDLE_MAX_LENGTH),
    action: asOneOf<QuoraSurveyAction>(entry.action, QUORA_SURVEY_ACTION, 'account_deleted'),
    removedMonth: asOptionalMonth(entry.removedMonth),
    removedYear: asOptionalYear(entry.removedYear),
    statedReason: asOneOf<QuoraSurveyReason>(entry.statedReason, QUORA_SURVEY_REASON, 'none_given'),
    appealed: asBoolean(entry.appealed),
    reinstated: asBoolean(entry.reinstated),
    topics: asTopics(entry.topics),
    approxPostCount: asOptionalCount(entry.approxPostCount, 1_000_000),
    approxActiveMonths: asOptionalCount(entry.approxActiveMonths, 600),
  };
}

type AccountsResult =
  | { ok: true; accounts: SurveyAccountInput[] }
  | { ok: false; message: string };

// Over the limit the whole response is refused, never trimmed to fit. Trimming was the old
// behavior and it was wrong in the one direction that matters here: a person reporting more
// accounts than the cap lost the rest with nothing on screen and nothing in the audit row saying
// anything had been dropped. A refusal at least tells them, and the limit sits far enough out
// (see QUORA_SURVEY_MAX_ACCOUNTS) that only automation should ever meet it.
function parseAccounts(raw: unknown): AccountsResult {
  if (!Array.isArray(raw)) return { ok: true, accounts: [] };
  if (raw.length > QUORA_SURVEY_MAX_ACCOUNTS) {
    return {
      ok: false,
      message: `That is more than ${QUORA_SURVEY_MAX_ACCOUNTS} accounts in one response. Nothing was recorded — send them in more than one response, or get in touch if you really did lose that many.`,
    };
  }
  return {
    ok: true,
    accounts: raw
      .map(parseAccount)
      .filter((account): account is SurveyAccountInput => account !== null),
  };
}

// A response is worth storing when it says something. Answering "yes, accounts of mine were
// removed" without naming one carries no evidence, so that combination is the single rejection
// here; a "no" answer is stored as-is, because knowing who opened the form and had nothing to
// report is part of reading the results honestly.
export function parseSurveySubmission(raw: unknown): ParseResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, message: 'The submitted form was empty or unreadable.' };
  }

  const body = raw as Record<string, unknown>;
  const anyAccountRemoved = asBoolean(body.anyAccountRemoved);
  const parsedAccounts = parseAccounts(body.accounts);
  if (!parsedAccounts.ok) {
    return { ok: false, message: parsedAccounts.message };
  }
  const accounts = parsedAccounts.accounts;

  // Q1 has no third option and therefore no safe default: storing an unanswered response as
  // either 'yes' or 'no' would count the person as having said something they did not say.
  const targetedIndividual = asOneOfStrict<QuoraSurveyTargetedIndividual>(
    body.targetedIndividual,
    QUORA_SURVEY_TARGETED_INDIVIDUAL,
  );
  if (targetedIndividual === null) {
    return { ok: false, message: 'Answer the first question with yes or no.' };
  }

  if (anyAccountRemoved && accounts.length === 0) {
    return {
      ok: false,
      message: 'Add at least one account, with its handle, or answer no to the first question.',
    };
  }

  return {
    ok: true,
    value: {
      targetedIndividual,
      anyAccountRemoved,
      hasCurrentProfile: asOptionalBoolean(body.hasCurrentProfile),
      evidenceNote: asOptionalText(body.evidenceNote),
      otherNotes: asOptionalText(body.otherNotes),
      consentPublishHandles: asBoolean(body.consentPublishHandles),
      consentQuote: asBoolean(body.consentQuote),
      consentAttributeQuote: asBoolean(body.consentAttributeQuote),
      // An account listed under a "no" answer is dropped rather than stored: the two contradict
      // each other, and the explicit answer is the one the person meant.
      accounts: anyAccountRemoved ? accounts : [],
    },
  };
}
