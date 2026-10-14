import { describe, expect, it } from 'vitest';
import { buildContributionsCallDraft } from './contributions-call';
import { summarizeExpenses, type Expense } from './summary';

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
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('buildContributionsCallDraft', () => {
  it('fills in sign-ups, approved members, cost per person and the monthly total', () => {
    const summary = summarizeExpenses(
      [expense({ provider: 'Render', amountCents: 20000 }), expense({ provider: 'RunPod', amountCents: 4000, amountMaxCents: 6000 }), expense({ provider: 'Later' })],
      43,
      '2026-10-05',
    );
    const draft = buildContributionsCallDraft({ signedUp: 86, summary, appUrl: 'https://app.example.com/' });
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;
    expect(draft.title).toBe('Contribute if you can 😄');
    expect(draft.body).toContain('86 people have signed up and 43 people have used the app.');
    // (20000 + 5000) / 43 = 581.4 cents
    expect(draft.body).toContain('about $5.81 USD per person every month');
    expect(draft.body).toContain("So for 43 people it's ~$250/month.");
    expect(draft.body).toContain('not counting my own time');
    expect(draft.body.endsWith('https://app.example.com/apps/contributions')).toBe(true);
    expect(draft.unpricedProviders).toEqual(['Later']);
  });

  it('refuses when there is nobody to divide the cost by', () => {
    const summary = summarizeExpenses([expense({ amountCents: 1000 })], 0, '2026-10-05');
    expect(buildContributionsCallDraft({ signedUp: 5, summary, appUrl: null }).ok).toBe(false);
  });

  it('refuses when no cost is recorded', () => {
    const summary = summarizeExpenses([], 10, '2026-10-05');
    expect(buildContributionsCallDraft({ signedUp: 5, summary, appUrl: null }).ok).toBe(false);
  });
});
