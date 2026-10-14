import { describe, expect, it } from 'vitest';
import { expensesAsPlainText, formatShare, sourceLabel, summarizeExpenses, type Expense } from './summary';
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
  // Made-up services and amounts: the real list is the owner's data and never enters the repository.
  expense({ provider: 'Hosting', amountCents: 4000 }),
  expense({ provider: 'Database', billing: 'usage', amountCents: 1200, amountMaxCents: 1600 }),
  expense({ provider: 'Agent', amountCents: 8000 }),
  expense({ provider: 'Secrets', amountCents: 0 }),
  expense({ provider: 'GPU', billing: 'usage' }),
  expense({ provider: 'Old host', amountCents: 900, stoppedOn: '2026-08-01' }),
  expense({ provider: 'Domain', kind: 'one_off', amountCents: 1500, paidOn: '2026-03-01' }),
  expense({ provider: 'Laptop', kind: 'one_off', amountCents: 50000, paidOn: '2024-01-01' }),
];

describe('summarizeExpenses', () => {
  const summary = summarizeExpenses(LIST, 4, '2026-09-26');

  it('totals live, priced recurring lines only, as a range', () => {
    expect(summary.monthlyLowCents).toBe(13200);
    expect(summary.monthlyHighCents).toBe(13600);
  });

  it('keeps unpriced, stopped and one-off lines out of the monthly total', () => {
    expect(summary.unpriced.map((e) => e.provider)).toEqual(['GPU']);
    expect(summary.stopped.map((e) => e.provider)).toEqual(['Old host']);
    expect(summary.oneOff.map((e) => e.provider)).toEqual(['Domain', 'Laptop']);
  });

  it('orders recurring lines largest first and shares sum to one', () => {
    expect(summary.priced.map((line) => line.expense.provider)).toEqual(['Agent', 'Hosting', 'Database', 'Secrets']);
    const total = summary.priced.reduce((sum, line) => sum + (line.share ?? 0), 0);
    expect(total).toBeCloseTo(1, 10);
    expect(formatShare(summary.priced[3].share)).toBe('0%');
  });

  it('divides the monthly total by approved members', () => {
    expect(summary.perMemberLowCents).toBe(3300);
    expect(summary.perMemberHighCents).toBe(3400);
    expect(summarizeExpenses(LIST, 0, '2026-09-26').perMemberLowCents).toBeNull();
  });

  it('counts only one-off payments from the last 12 months', () => {
    expect(summary.oneOffLastYearCents).toBe(1500);
  });

  it('copies as plain text with the totals first', () => {
    const text = expensesAsPlainText(summary, '2026-09-26');
    expect(text.split('\n').slice(0, 4)).toEqual([
      'Skills Economy running costs, as of 2026-09-26',
      'Monthly total: $132.00–$136.00',
      '(1 more not priced yet and not in that total)',
      'Per approved member: $33.00–$34.00 a month (4 approved)',
    ]);
    expect(text).toContain('Agent · $80.00 · 60% · fixed · never checked');
    expect(text).toContain('Old host · $9.00 · stopped 2026-08-01');
  });
});

describe('parseExpenseInput', () => {
  const base = { provider: 'Hosting', kind: 'recurring', billing: 'fixed', amountCents: 4000 };

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
    const oneOff = parseExpenseInput({ ...base, kind: 'one_off', amountMaxCents: 5000, stoppedOn: '2026-09-01', paidOn: '2026-09-02' });
    expect(oneOff.ok && oneOff.value).toMatchObject({ amountMaxCents: null, stoppedOn: null, paidOn: '2026-09-02' });
  });
});

describe('the RunPod line, measured or typed', () => {
  const runpod = expense({ provider: 'RunPod', billing: 'usage', amountCents: 2000, amountMaxCents: 4000 });
  const render = expense({ provider: 'Render', amountCents: 2500 });

  it('replaces the typed range with the measured figure instead of adding to it', () => {
    const summary = summarizeExpenses([runpod, render], 0, '2026-10-01', 1234);
    const line = summary.priced.find((entry) => entry.expense.provider === 'RunPod');
    expect(line).toMatchObject({ lowCents: 1234, highCents: 1234, source: 'measured' });
    expect(summary.monthlyLowCents).toBe(1234 + 2500);
    expect(summary.monthlyHighCents).toBe(1234 + 2500);
    expect(line && sourceLabel(line)).toBe('measured from the RunPod bill, last 30 days');
  });

  it('keeps the typed figure, labeled an estimate, when the bill has not been read', () => {
    const summary = summarizeExpenses([runpod, render], 0, '2026-10-01', null);
    const line = summary.priced.find((entry) => entry.expense.provider === 'RunPod');
    expect(line).toMatchObject({ lowCents: 2000, highCents: 4000, source: 'entered' });
    expect(line && sourceLabel(line)).toBe('estimate, typed by hand');
    expect(sourceLabel(summary.priced.find((entry) => entry.expense.provider === 'Render')!)).toBeNull();
  });

  it('prices an unpriced RunPod line once the bill is read', () => {
    const unpriced = expense({ provider: 'RunPod', billing: 'usage' });
    expect(summarizeExpenses([unpriced], 0, '2026-10-01', null).unpriced).toHaveLength(1);
    const measured = summarizeExpenses([unpriced], 0, '2026-10-01', 500);
    expect(measured.unpriced).toHaveLength(0);
    expect(measured.monthlyLowCents).toBe(500);
  });
});
