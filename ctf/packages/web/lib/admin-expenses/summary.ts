// The running costs of Skills Economy, as /admin/expenses shows them. Pure and import-safe from a
// client component: the screen and the copy-as-text control both read from here, so the figures a
// person sees and the figures they paste into a message cannot disagree.
//
// These are real US dollar amounts a person pays. Amounts travel as whole cents to keep sums exact.

export type ExpenseKind = 'recurring' | 'one_off';
export type ExpenseBilling = 'fixed' | 'usage';

export type Expense = {
  id: string;
  provider: string;
  purpose: string;
  kind: ExpenseKind;
  billing: ExpenseBilling;
  // null = not known yet. Zero is a checked, free line and counts as priced.
  amountCents: number | null;
  // High end of a range ("$18-25"); null for a single figure.
  amountMaxCents: number | null;
  paidOn: string | null;
  lastCheckedOn: string | null;
  stoppedOn: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type RecurringLine = {
  expense: Expense;
  lowCents: number;
  highCents: number;
  // This line's share of the monthly total, 0..1, measured at the middle of any range. null while
  // the line has no amount, or while the total is zero.
  share: number | null;
};

export type ExpenseSummary = {
  // Live recurring lines with an amount, largest first — the order the cut decision is made in.
  priced: RecurringLine[];
  // Live recurring lines nobody has put an amount on yet. Kept out of the total, and named, so the
  // total is never read as complete when it is not.
  unpriced: Expense[];
  // Recurring lines that were canceled. Shown, marked, outside the total.
  stopped: Expense[];
  // One-off payments, newest first. Never part of the monthly figure.
  oneOff: Expense[];
  monthlyLowCents: number;
  monthlyHighCents: number;
  // One-off payments dated within the 365 days before `today`.
  oneOffLastYearCents: number;
  approvedMembers: number;
  // Monthly total divided by approved members; null when there are none to divide by.
  perMemberLowCents: number | null;
  perMemberHighCents: number | null;
};

function midpoint(low: number, high: number): number {
  return (low + high) / 2;
}

export function summarizeExpenses(expenses: Expense[], approvedMembers: number, today: string): ExpenseSummary {
  const recurring = expenses.filter((expense) => expense.kind === 'recurring');
  const live = recurring.filter((expense) => expense.stoppedOn === null);
  const stopped = recurring.filter((expense) => expense.stoppedOn !== null);
  const unpriced = live.filter((expense) => expense.amountCents === null);

  const lines = live
    .filter((expense) => expense.amountCents !== null)
    .map((expense) => {
      const lowCents = expense.amountCents ?? 0;
      const highCents = Math.max(expense.amountMaxCents ?? lowCents, lowCents);
      return { expense, lowCents, highCents };
    });

  const monthlyLowCents = lines.reduce((total, line) => total + line.lowCents, 0);
  const monthlyHighCents = lines.reduce((total, line) => total + line.highCents, 0);
  const totalMid = midpoint(monthlyLowCents, monthlyHighCents);

  const priced: RecurringLine[] = lines
    .map((line) => ({
      ...line,
      share: totalMid > 0 ? midpoint(line.lowCents, line.highCents) / totalMid : null,
    }))
    .sort(
      (a, b) =>
        midpoint(b.lowCents, b.highCents) - midpoint(a.lowCents, a.highCents) ||
        a.expense.provider.localeCompare(b.expense.provider),
    );

  const oneOff = expenses
    .filter((expense) => expense.kind === 'one_off')
    .sort((a, b) => (b.paidOn ?? '').localeCompare(a.paidOn ?? ''));

  const yearAgo = new Date(`${today}T00:00:00Z`);
  yearAgo.setUTCDate(yearAgo.getUTCDate() - 365);
  const yearAgoIso = yearAgo.toISOString().slice(0, 10);
  const oneOffLastYearCents = oneOff
    .filter((expense) => expense.paidOn !== null && expense.paidOn > yearAgoIso && expense.paidOn <= today)
    .reduce((total, expense) => total + (expense.amountCents ?? 0), 0);

  const members = Math.max(0, Math.floor(approvedMembers));
  return {
    priced,
    unpriced: [...unpriced].sort((a, b) => a.provider.localeCompare(b.provider)),
    stopped: [...stopped].sort((a, b) => (b.stoppedOn ?? '').localeCompare(a.stoppedOn ?? '')),
    oneOff,
    monthlyLowCents,
    monthlyHighCents,
    oneOffLastYearCents,
    approvedMembers: members,
    perMemberLowCents: members > 0 ? monthlyLowCents / members : null,
    perMemberHighCents: members > 0 ? monthlyHighCents / members : null,
  };
}

// "$25.00", or "$0.48" for a per-member figure. Cents are always shown: at this scale a per-member
// cost is often under a dollar, and rounding it away would hide the number being asked about.
export function formatDollars(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// "$18.00–$25.00" for a range, "$25.00" otherwise.
export function formatDollarRange(lowCents: number, highCents: number): string {
  return Math.round(highCents) > Math.round(lowCents)
    ? `${formatDollars(lowCents)}–${formatDollars(highCents)}`
    : formatDollars(lowCents);
}

export function formatShare(share: number | null): string {
  if (share === null) return '—';
  const percent = share * 100;
  if (percent > 0 && percent < 1) return '<1%';
  return `${Math.round(percent)}%`;
}

export function billingLabel(billing: ExpenseBilling): string {
  return billing === 'usage' ? 'usage-based' : 'fixed';
}

function checkedLabel(expense: Expense): string {
  return expense.lastCheckedOn ? `checked ${expense.lastCheckedOn}` : 'never checked';
}

function withDetail(parts: string[], expense: Expense): string {
  const out = [...parts];
  if (expense.purpose) out.push(expense.purpose);
  if (expense.notes) out.push(expense.notes);
  return out.join(' · ');
}

function headerLines(summary: ExpenseSummary, today: string): string[] {
  const lines = [
    `Skills Economy running costs, as of ${today}`,
    `Monthly total: ${formatDollarRange(summary.monthlyLowCents, summary.monthlyHighCents)}`,
  ];
  if (summary.unpriced.length > 0) {
    lines.push(`(${summary.unpriced.length} more not priced yet and not in that total)`);
  }
  const { perMemberLowCents: low, perMemberHighCents: high } = summary;
  lines.push(
    low !== null && high !== null
      ? `Per approved member: ${formatDollarRange(low, high)} a month (${summary.approvedMembers} approved)`
      : 'Per approved member: no approved members yet',
  );
  return lines;
}

function recurringLines(summary: ExpenseSummary): string[] {
  const lines = ['', 'Recurring, per month, largest first'];
  if (summary.priced.length === 0) lines.push('None priced yet.');
  for (const line of summary.priced) {
    const { expense } = line;
    const parts = [expense.provider, formatDollarRange(line.lowCents, line.highCents), formatShare(line.share), billingLabel(expense.billing), checkedLabel(expense)];
    lines.push(withDetail(parts, expense));
  }
  return lines;
}

// A titled group that is left out entirely when it has nothing in it.
function optionalGroup(title: string, expenses: Expense[], describeOne: (expense: Expense) => string[]): string[] {
  if (expenses.length === 0) return [];
  return ['', title, ...expenses.map((expense) => withDetail(describeOne(expense), expense))];
}

function knownAmount(expense: Expense): string {
  if (expense.amountCents === null) return 'amount not known';
  return formatDollarRange(expense.amountCents, expense.amountMaxCents ?? expense.amountCents);
}

function oneOffLines(summary: ExpenseSummary): string[] {
  const lines = ['', `One-off payments (last 12 months: ${formatDollars(summary.oneOffLastYearCents)})`];
  if (summary.oneOff.length === 0) lines.push('None recorded.');
  for (const expense of summary.oneOff) {
    lines.push(withDetail([expense.paidOn ?? 'no date', expense.provider, knownAmount(expense)], expense));
  }
  return lines;
}

// The screen as plain text, for pasting into a message from a phone. One line per cost, largest
// first, with the totals at the top because that is what the message is usually about.
export function expensesAsPlainText(summary: ExpenseSummary, today: string): string {
  return [
    ...headerLines(summary, today),
    ...recurringLines(summary),
    ...optionalGroup('Not priced yet', summary.unpriced, (e) => [e.provider, billingLabel(e.billing), checkedLabel(e)]),
    ...optionalGroup('Stopped', summary.stopped, (e) => [e.provider, knownAmount(e), `stopped ${e.stoppedOn}`]),
    ...oneOffLines(summary),
  ].join('\n');
}
