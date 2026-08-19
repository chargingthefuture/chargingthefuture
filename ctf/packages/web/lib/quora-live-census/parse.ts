// Validation for the census admin writes.
//
// Admin-entered rather than public, but validated the same way: a miscoded row is worse here than
// a rejected one, because the whole value of the census is that a later reader can trust what each
// row says.

import {
  QUORA_CENSUS_ACCOUNT_STATE,
  QUORA_CENSUS_EARLIEST_YEAR,
  QUORA_CENSUS_HANDLE_MAX_LENGTH,
  QUORA_CENSUS_STANCE,
  QUORA_CENSUS_TEXT_MAX_LENGTH,
  QUORA_CENSUS_TOPIC,
  QUORA_CENSUS_URL_MAX_LENGTH,
  type QuoraCensusAccountState,
  type QuoraCensusStance,
  type QuoraCensusTopic,
} from 'lib/quora-live-census/constants';
import type { CreateCensusEntryInput, CreateCensusRunInput } from 'lib/quora-live-census/repository';

export type ParseResult<T> = { ok: true; value: T } | { ok: false; message: string };

function trimmed(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length === 0 ? null : text.slice(0, max);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function optionalCount(value: unknown, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded < 0 || rounded > max ? null : rounded;
}

function optionalYear(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const year = Math.round(value);
  if (year < QUORA_CENSUS_EARLIEST_YEAR || year > QUORA_CENSUS_EARLIEST_YEAR + 100) return null;
  return year;
}

// YYYY-MM-DD only. Accepting a free-form date here would put unparseable strings in the one column
// the census is cited by.
function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

// A run without a stated scope and method is not reproducible, so both are required rather than
// defaulted — the alternative is a census nobody can check, which is the thing this exists to fix.
export function parseCensusRun(
  raw: unknown,
  createdByUserId: string | null,
): ParseResult<CreateCensusRunInput> {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, message: 'The submitted run was empty or unreadable.' };
  }
  const body = raw as Record<string, unknown>;

  if (!isCalendarDate(body.observedOn)) {
    return { ok: false, message: 'Give the observation date as YYYY-MM-DD.' };
  }
  const topicScope = trimmed(body.topicScope, QUORA_CENSUS_TEXT_MAX_LENGTH);
  if (!topicScope) {
    return { ok: false, message: 'Say what was searched — the scope is what makes the run readable later.' };
  }
  const samplingMethod = trimmed(body.samplingMethod, QUORA_CENSUS_TEXT_MAX_LENGTH);
  if (!samplingMethod) {
    return { ok: false, message: 'Say how the accounts were picked, or the numbers cannot be checked.' };
  }

  return {
    ok: true,
    value: {
      observedOn: body.observedOn,
      topicScope,
      samplingMethod,
      notes: trimmed(body.notes, QUORA_CENSUS_TEXT_MAX_LENGTH),
      createdByUserId,
    },
  };
}

function parseTopics(value: unknown): QuoraCensusTopic[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(QUORA_CENSUS_TOPIC);
  return [
    ...new Set(
      value.filter((entry): entry is QuoraCensusTopic => typeof entry === 'string' && allowed.has(entry)),
    ),
  ];
}

export function parseCensusEntry(raw: unknown, runId: string): ParseResult<CreateCensusEntryInput> {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, message: 'The submitted entry was empty or unreadable.' };
  }
  const body = raw as Record<string, unknown>;

  const handle = trimmed(body.handle, QUORA_CENSUS_HANDLE_MAX_LENGTH);
  if (!handle) {
    return { ok: false, message: 'An entry needs the account handle.' };
  }

  return {
    ok: true,
    value: {
      runId,
      handle,
      profileUrl: trimmed(body.profileUrl, QUORA_CENSUS_URL_MAX_LENGTH),
      accountState: oneOf<QuoraCensusAccountState>(
        body.accountState,
        QUORA_CENSUS_ACCOUNT_STATE,
        'live',
      ),
      topics: parseTopics(body.topics),
      // Defaults to 'unclear', never to a substantive stance: an entry saved before the coder
      // picked one must not silently join a category and shift the tally.
      stance: oneOf<QuoraCensusStance>(body.stance, QUORA_CENSUS_STANCE, 'unclear'),
      approxAnswerCount: optionalCount(body.approxAnswerCount, 1_000_000),
      lastActiveYear: optionalYear(body.lastActiveYear),
      evidenceUrl: trimmed(body.evidenceUrl, QUORA_CENSUS_URL_MAX_LENGTH),
      notes: trimmed(body.notes, QUORA_CENSUS_TEXT_MAX_LENGTH),
    },
  };
}
