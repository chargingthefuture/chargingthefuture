import { describe, expect, it } from 'vitest';
import { summarizeExpenses, type Expense } from './summary';
import { fundraisingAsPlainText, suggestFundraisingGoal } from './fundraising';

function recurring(provider: string, amountCents: number | null, amountMaxCents: number | null = null): Expense {
  return {
    id: provider,
    provider,
    purpose: '',
    kind: 'recurring',
    billing: 'fixed',
    amountCents,
    amountMaxCents,
    paidOn: null,
    lastCheckedOn: null,
    stoppedOn: null,
    notes: '',
    createdAt: '2026-09-26T00:00:00Z',
    updatedAt: '2026-09-26T00:00:00Z',
  };
}

// Made-up services and amounts ($154–$166 a month, one line not priced): the real list is the
// owner's data and never enters the repository.
const SUMMARY = summarizeExpenses(
  [recurring('Hosting', 4000), recurring('Database', 1200, 1600), recurring('Agent', 8000), recurring('Tools', 3000), recurring('GPU', null)],
  0,
  '2026-09-27',
);

describe('suggestFundraisingGoal', () => {
  it('suggests three months at the high end when no drive is open', () => {
    const suggestion = suggestFundraisingGoal(SUMMARY, null);
    expect(suggestion.suggestedGoalCents).toBe(49800);
    expect(suggestion.stillNeededCents).toBeNull();
    expect(suggestion.unpricedCount).toBe(1);
    expect(fundraisingAsPlainText(suggestion)).toContain('No drive is open. To cover the costs over a 3 months drive, set the goal to $498.00.');
  });

  it('scales to the open drive and subtracts what is confirmed', () => {
    // 2026-10-01 to 2026-12-31 is 91 days, just under three months.
    const suggestion = suggestFundraisingGoal(SUMMARY, {
      startsAt: '2026-10-01T00:00:00.000Z',
      endsAt: '2026-12-31T00:00:00.000Z',
      moneyGoalUsd: 500,
      moneyConfirmedUsd: 120,
    });
    expect(suggestion.suggestedGoalCents).toBe(49700);
    expect(suggestion.currentGoalCents).toBe(50000);
    expect(suggestion.stillNeededCents).toBe(37700);
  });

  it('never reports a negative amount still needed', () => {
    const suggestion = suggestFundraisingGoal(SUMMARY, {
      startsAt: '2026-10-01T00:00:00.000Z',
      endsAt: '2026-10-31T00:00:00.000Z',
      moneyGoalUsd: 0,
      moneyConfirmedUsd: 5000,
    });
    expect(suggestion.stillNeededCents).toBe(0);
  });
});
