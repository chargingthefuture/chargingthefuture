import type { Expense } from 'lib/admin-expenses/summary';
import type { ExpenseInput } from 'lib/admin-expenses/parse';
import { responseFailureText, failureText } from 'lib/errors/client-failure';

// Neutral admin chrome (rule 131): the running costs belong to no plugin.
export const EXPENSES_ACCENT = '#6366F1';

// Today on the admin's own calendar, YYYY-MM-DD — the day they looked at a bill is their day, not UTC's.
export function localToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

// "25", "25.5", "$1,025.50" → cents. Blank → null, meaning "not known yet". Anything else → undefined,
// which the form reports as an input it could not read.
export function dollarsToCents(raw: string): number | null | undefined {
  const cleaned = raw.replace(/[$,\s]/g, '');
  if (cleaned === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return undefined;
  return Math.round(Number.parseFloat(cleaned) * 100);
}

export function centsToDollars(cents: number | null): string {
  if (cents === null) return '';
  return (cents / 100).toFixed(2).replace(/\.00$/, '');
}

export function toInput(expense: Expense): ExpenseInput {
  return {
    provider: expense.provider,
    purpose: expense.purpose,
    kind: expense.kind,
    billing: expense.billing,
    amountCents: expense.amountCents,
    amountMaxCents: expense.amountMaxCents,
    paidOn: expense.paidOn,
    lastCheckedOn: expense.lastCheckedOn,
    stoppedOn: expense.stoppedOn,
    notes: expense.notes,
  };
}

export type MutateResult = { ok: true } | { ok: false; message: string };

export async function mutateExpense(url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: ExpenseInput): Promise<MutateResult> {
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) return { ok: false, message: await responseFailureText(res, 'The change could not be saved.') };
    return { ok: true };
  } catch (error) {
    return { ok: false, message: failureText(error, { area: 'admin-expenses', op: `mutate_${method}`, fallback: 'The change could not be saved.' }) };
  }
}
