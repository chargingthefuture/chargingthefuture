import { describe, expect, it } from 'vitest';
import { expensesAsPlainText, formatShare, summarizeExpenses, type Expense } from './summary';
import { parseExpenseInput } from './parse';

function expense(overrides: Partial<Expense>): Expense {
  return {
    id: overrides.provider ?? 'x',
    provider: 'x',
    purpose: '',
    kind: 'recurring',
    billing: 'fixed',
    amountCents: null,
    amountMaxCents: null,
    paidOn: null,
    lastCheckedOn: null,
    stoppedOn: null,
    notes: '',
    createdAt: '2026-09-26T00:00:00Z',
    updatedAt: '2026-09-26T00:00:00Z',
    ...overrides,
  };
}

const LIST: Expense[] = [
  expense({ provider: 'Render', amountCents: 2500 }),
  expense({ provider: 'Railway', billing: 'usage', amountCents: 1800, amountMaxCents: 2500 }),
  expense({ provider: 'Claude Code', amountCents: 10000 }),
  expense({ provider: 'Infisical', amountCents: 0 }),
  expense({ provider: 'RunPod', billing: 'usage' }),
  expense({ provider: 'Old host', amountCents: 900, stoppedOn: '2026-08-01' }),
  expense({ provider: 'Domain', kind: 'one_off', amountCents: 1200, paidOn: '2026-03-01' }),
  expense({ provider: 'Laptop', kind: 'one_off', amountCents: 50000, paidOn: '2024-01-01' }),
];

describe('summarizeExpenses', () => {
  const summary = summarizeExpenses(LIST, 4, '2026-09-26');

  it('totals live, priced recurring lines only, as a range', () => {
    expect(summary.monthlyLowCents).toBe(14300);
    expect(summary.monthlyHighCents).toBe(15000);
  });

  it('keeps unpriced, stopped and one-off lines out of the monthly total', () => {
    expect(summary.unpriced.map((e) => e.provider)).toEqual(['RunPod']);
    expect(summary.stopped.map((e) => e.provider)).toEqual(['Old host']);
    expect(summary.oneOff.map((e) => e.provider)).toEqual(['Domain', 'Laptop']);
  });

  it('orders recurring lines largest first and shares sum to one', () => {
    expect(summary.priced.map((line) => line.expense.provider)).toEqual(['Claude Code', 'Render', 'Railway', 'Infisical']);
    const total = summary.priced.reduce((sum, line) => sum + (line.share ?? 0), 0);
    expect(total).toBeCloseTo(1, 10);
    expect(formatShare(summary.priced[3].share)).toBe('0%');
  });

  it('divides the monthly total by approved members', () => {
    expect(summary.perMemberLowCents).toBe(3575);
    expect(summary.perMemberHighCents).toBe(3750);
    expect(summarizeExpenses(LIST, 0, '2026-09-26').perMemberLowCents).toBeNull();
  });

  it('counts only one-off payments from the last 12 months', () => {
    expect(summary.oneOffLastYearCents).toBe(1200);
  });

  it('copies as plain text with the totals first', () => {
    const text = expensesAsPlainText(summary, '2026-09-26');
    expect(text.split('\n').slice(0, 4)).toEqual([
      'Skills Economy running costs, as of 2026-09-26',
      'Monthly total: $143.00–$150.00',
      '(1 more not priced yet and not in that total)',
      'Per approved member: $35.75–$37.50 a month (4 approved)',
    ]);
    expect(text).toContain('Claude Code · $100.00 · 68% · fixed · never checked');
    expect(text).toContain('Old host · $9.00 · stopped 2026-08-01');
  });
});

describe('parseExpenseInput', () => {
  const base = { provider: 'Render', kind: 'recurring', billing: 'fixed', amountCents: 2500 };

  it('accepts a blank amount as not known, apart from zero', () => {
    const blank = parseExpenseInput({ ...base, amountCents: null });
    const zero = parseExpenseInput({ ...base, amountCents: 0 });
    expect(blank.ok && blank.value.amountCents).toBeNull();
    expect(zero.ok && zero.value.amountCents).toBe(0);
  });

  it('refuses a range upside down and a bad date', () => {
    expect(parseExpenseInput({ ...base, amountMaxCents: 100 }).ok).toBe(false);
    expect(parseExpenseInput({ ...base, lastCheckedOn: '26/09/2026' }).ok).toBe(false);
  });

  it('drops fields that do not apply to the kind', () => {
    const oneOff = parseExpenseInput({ ...base, kind: 'one_off', amountMaxCents: 3000, stoppedOn: '2026-09-01', paidOn: '2026-09-02' });
    expect(oneOff.ok && oneOff.value).toMatchObject({ amountMaxCents: null, stoppedOn: null, paidOn: '2026-09-02' });
  });
});
