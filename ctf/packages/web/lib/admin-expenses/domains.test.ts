import { describe, expect, it } from 'vitest';
import { DOMAINS, domainsAsPlainText, domainsByNextRenewal, domainsYearlyCents, formatRenewal, type Domain } from './domains';

const sample: Domain[] = [
  { name: 'b.com', yearlyCents: 1000, renews: '01-10' },
  { name: 'a.com', yearlyCents: 2000, renews: '11-20' },
  { name: 'c.com', yearlyCents: 500, renews: '11-11' },
];

describe('domains', () => {
  it('formats the renewal month and day', () => {
    expect(formatRenewal('12-15')).toBe('Dec 15');
    expect(formatRenewal('01-03')).toBe('Jan 3');
  });

  it('lists the soonest renewal first, with days already passed this year last', () => {
    expect(domainsByNextRenewal(sample, '2026-11-11').map((d) => d.name)).toEqual(['c.com', 'a.com', 'b.com']);
    expect(domainsByNextRenewal(sample, '2026-11-12').map((d) => d.name)).toEqual(['a.com', 'b.com', 'c.com']);
  });

  it('adds the yearly prices and writes the copy text', () => {
    expect(domainsYearlyCents(sample)).toBe(3500);
    const text = domainsAsPlainText(sample, '2026-11-11');
    expect(text).toContain('$35.00 a year, $2.92 a month');
    expect(text).toContain('c.com · $5.00 a year · renews Nov 11');
  });

  it('holds every domain once, with a valid renewal day', () => {
    expect(new Set(DOMAINS.map((d) => d.name)).size).toBe(DOMAINS.length);
    for (const domain of DOMAINS) expect(domain.renews).toMatch(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
  });
});
