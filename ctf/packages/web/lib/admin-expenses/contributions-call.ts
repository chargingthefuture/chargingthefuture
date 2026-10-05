// The twice-yearly "Contribute if you can" Commons post, as a draft for the owner to check and
// publish from /admin/feed-announcements. Pure: the route reads the figures and passes them in.
//
// Owner decision, 2026-10-05: signing up costs nothing (the sign-in and database providers are free
// at this size), but every approved member is someone the hosting bill is paid for. So the post
// counts both, and the cost per person is the monthly total divided by approved members — the same
// figure /admin/expenses shows. The owner's own time is never part of it.

import type { ExpenseSummary } from './summary';
import { formatDollars } from './summary';

export const CONTRIBUTIONS_CALL_TITLE = 'Contribute if you can 😄';
export const CONTRIBUTIONS_CALL_LINKED_PLUGINS = ['contributions'];

export type ContributionsCallFigures = {
  signedUp: number;
  summary: ExpenseSummary;
  appUrl: string | null;
};

export type ContributionsCallDraft =
  | { ok: true; title: string; body: string; unpricedProviders: string[] }
  | { ok: false; reason: string };

function middle(low: number, high: number): number {
  return Math.round((low + high) / 2);
}

// Whole dollars for the monthly total ("$250"), cents kept for the per-person figure ("$5.79").
function roundDollars(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString('en-US')}`;
}

export function buildContributionsCallDraft({ signedUp, summary, appUrl }: ContributionsCallFigures): ContributionsCallDraft {
  const approved = summary.approvedMembers;
  if (approved <= 0 || summary.perMemberLowCents === null || summary.perMemberHighCents === null) {
    return { ok: false, reason: 'No approved members to divide the monthly cost by.' };
  }
  const monthlyCents = middle(summary.monthlyLowCents, summary.monthlyHighCents);
  if (monthlyCents <= 0) {
    return { ok: false, reason: 'No monthly cost is recorded on /admin/expenses.' };
  }
  const perPersonCents = middle(summary.perMemberLowCents, summary.perMemberHighCents);
  const link = `${(appUrl ?? 'https://app.chargingthefuture.com').replace(/\/+$/, '')}/apps/contributions`;

  const body = [
    'Fund, Comment or Favorite',
    `${signedUp} people have signed up and ${approved} people have used the app. I have built Skills Economy (SE) from just an idea to a working app for every TI to use for free. Signing up costs nothing. Each person using the app costs me money. It costs me about ${formatDollars(perPersonCents)} USD per person every month to keep the app running, not counting my own time. So for ${approved} people it's ~${roundDollars(monthlyCents)}/month. If you can, please contribute by sharing the app with other people who might be TIs or helping me cover the hosting costs.`,
    '',
    'Open Contributions:',
    link,
  ].join('\n');

  return {
    ok: true,
    title: CONTRIBUTIONS_CALL_TITLE,
    body,
    unpricedProviders: summary.unpriced.map((expense) => expense.provider),
  };
}
