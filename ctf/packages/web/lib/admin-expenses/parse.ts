import type { ExpenseBilling, ExpenseKind } from './summary';

// What an add or an edit on /admin/expenses may set. Every field is present after parsing: an edit
// sends the entire row back, which keeps the before/after in the audit trail a plain comparison.
export type ExpenseInput = {
  provider: string;
  purpose: string;
  kind: ExpenseKind;
  billing: ExpenseBilling;
  amountCents: number | null;
  amountMaxCents: number | null;
  paidOn: string | null;
  lastCheckedOn: string | null;
  stoppedOn: string | null;
  notes: string;
};

export type ParseResult = { ok: true; value: ExpenseInput } | { ok: false; message: string };

const MAX_TEXT = 500;
// $1,000,000 a month: far past anything this list holds, and well inside an INTEGER of cents.
const MAX_CENTS = 100_000_000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function text(value: unknown, field: string, required: boolean): string | { error: string } {
  if (value === undefined || value === null) {
    return required ? { error: `${field} is required.` } : '';
  }
  if (typeof value !== 'string') return { error: `${field} must be text.` };
  const trimmed = value.trim();
  if (required && trimmed.length === 0) return { error: `${field} is required.` };
  if (trimmed.length > MAX_TEXT) return { error: `${field} is longer than ${MAX_TEXT} characters.` };
  return trimmed;
}

// Amounts arrive as whole cents. null (or a missing field) means "not known yet", which is kept
// apart from 0, a checked, free line.
function cents(value: unknown, field: string): number | null | { error: string } {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > MAX_CENTS) {
    return { error: `${field} must be a whole number of cents between 0 and ${MAX_CENTS}.` };
  }
  return value;
}

function date(value: unknown, field: string): string | null | { error: string } {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    return { error: `${field} must be a date written YYYY-MM-DD.` };
  }
  return value;
}

function isError(value: unknown): value is { error: string } {
  return typeof value === 'object' && value !== null && 'error' in value;
}

export function parseExpenseInput(body: unknown): ParseResult {
  if (!body || typeof body !== 'object') {
    return { ok: false, message: 'The cost could not be read: the request body was not an object.' };
  }
  const raw = body as Record<string, unknown>;

  const provider = text(raw.provider, 'Provider', true);
  const purpose = text(raw.purpose, 'What it pays for', false);
  const notes = text(raw.notes, 'Notes', false);
  const amountCents = cents(raw.amountCents, 'Amount');
  const amountMaxCents = cents(raw.amountMaxCents, 'Upper amount');
  const paidOn = date(raw.paidOn, 'Paid on');
  const lastCheckedOn = date(raw.lastCheckedOn, 'Last checked');
  const stoppedOn = date(raw.stoppedOn, 'Stopped on');

  for (const value of [provider, purpose, notes, amountCents, amountMaxCents, paidOn, lastCheckedOn, stoppedOn]) {
    if (isError(value)) return { ok: false, message: value.error };
  }

  if (raw.kind !== 'recurring' && raw.kind !== 'one_off') {
    return { ok: false, message: 'Kind must be recurring or one-off.' };
  }
  if (raw.billing !== 'fixed' && raw.billing !== 'usage') {
    return { ok: false, message: 'Billing must be fixed or usage-based.' };
  }

  const low = amountCents as number | null;
  const high = amountMaxCents as number | null;
  if (high !== null && low === null) {
    return { ok: false, message: 'An upper amount needs a lower amount too.' };
  }
  if (high !== null && low !== null && high < low) {
    return { ok: false, message: 'The upper amount is below the lower amount.' };
  }

  const kind = raw.kind;
  return {
    ok: true,
    value: {
      provider: provider as string,
      purpose: purpose as string,
      kind,
      billing: raw.billing,
      amountCents: low,
      // A one-off payment is one figure, and only a recurring cost can be stopped; anything sent for
      // the other kind is dropped rather than stored where nothing reads it.
      amountMaxCents: kind === 'recurring' ? high : null,
      paidOn: kind === 'one_off' ? (paidOn as string | null) : null,
      lastCheckedOn: lastCheckedOn as string | null,
      stoppedOn: kind === 'recurring' ? (stoppedOn as string | null) : null,
      notes: notes as string,
    },
  };
}
