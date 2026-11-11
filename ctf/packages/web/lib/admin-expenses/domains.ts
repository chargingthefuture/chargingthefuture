// The domain names Skills Economy pays for, each renewed once a year, as /admin/expenses lists them.
// Real US dollar amounts, held as exact cents. Each renews on the same month and day every year, so
// the list stays right across renewals; change a line here when a price or renewal day changes.
//
// These are listed beside the monthly total, not added to it: the recurring "Domain name" line is
// where the monthly share of all of them is entered.

export type Domain = {
  name: string;
  yearlyCents: number;
  // Month and day the registration renews, "MM-DD".
  renews: string;
};

export const DOMAINS: readonly Domain[] = [
  { name: 'the-comic.net', yearlyCents: 1186, renews: '11-08' },
  { name: 'lagatos.com', yearlyCents: 1117, renews: '11-16' },
  { name: 'chargingthefuture.com', yearlyCents: 1117, renews: '12-15' },
  { name: 'chargingthefuture.net', yearlyCents: 1186, renews: '12-15' },
  { name: 'chargingthefuture.org', yearlyCents: 1120, renews: '12-15' },
  { name: 'electricfeel.co', yearlyCents: 3000, renews: '12-17' },
  { name: 'lagatos.org', yearlyCents: 1120, renews: '01-20' },
  { name: 'yogasaunajuice.com', yearlyCents: 1117, renews: '02-14' },
  { name: 'lagatos.net', yearlyCents: 1186, renews: '03-07' },
  { name: 'the-comic.com', yearlyCents: 1117, renews: '05-06' },
  { name: 'farahbrunache.net', yearlyCents: 1186, renews: '06-14' },
  { name: 'farahbrunache.org', yearlyCents: 1120, renews: '06-14' },
  { name: 'farahbrunache.com', yearlyCents: 1117, renews: '01-03' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "11-16" → "Nov 16".
export function formatRenewal(renews: string): string {
  const [month, day] = renews.split('-').map(Number);
  return `${MONTHS[month - 1]} ${day}`;
}

// Soonest renewal first, counted from `today` (YYYY-MM-DD): a day later in the year than today comes
// before one that has already passed this year. Today's own renewals come first.
export function domainsByNextRenewal(domains: readonly Domain[], today: string): Domain[] {
  const todayKey = today.slice(5);
  const rank = (domain: Domain) => (domain.renews >= todayKey ? 0 : 1);
  return [...domains].sort(
    (a, b) => rank(a) - rank(b) || a.renews.localeCompare(b.renews) || a.name.localeCompare(b.name),
  );
}

export function domainsYearlyCents(domains: readonly Domain[]): number {
  return domains.reduce((total, domain) => total + domain.yearlyCents, 0);
}

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// The list as plain text, appended to the copy-as-text output of /admin/expenses.
export function domainsAsPlainText(domains: readonly Domain[], today: string): string {
  const yearly = domainsYearlyCents(domains);
  const lines = ['', `Domains, renewed yearly (${dollars(yearly)} a year, ${dollars(yearly / 12)} a month; not in the monthly total)`];
  for (const domain of domainsByNextRenewal(domains, today)) {
    const parts = [domain.name, `${dollars(domain.yearlyCents)} a year`, `renews ${formatRenewal(domain.renews)}`];
    lines.push(parts.join(' · '));
  }
  return lines.join('\n');
}
