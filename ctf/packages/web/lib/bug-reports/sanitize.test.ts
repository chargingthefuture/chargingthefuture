import { describe, expect, it } from 'vitest';
import { pageAddressOnly, sanitizeBugReport } from './sanitize';

describe('sanitizeBugReport abusive-language check', () => {
  it('holds the bare word', () => {
    expect(sanitizeBugReport('this shit is broken', null).riskLevel).toBe('flagged');
  });

  it('holds a suffixed form', () => {
    expect(sanitizeBugReport('the fucking button does nothing', null).riskLevel).toBe('flagged');
  });

  it('holds a compound form', () => {
    expect(sanitizeBugReport('this is bullshit', null).riskLevel).toBe('flagged');
  });

  it('leaves a plain report clean', () => {
    expect(sanitizeBugReport('The save button does nothing on the profile page.', null).riskLevel).toBe('clean');
  });
});

describe('pageAddressOnly', () => {
  it('drops the query string and # part', () => {
    expect(pageAddressOnly('https://example.org/apps/directory?q=me%40mail.com&__clerk_db_jwt=abc#top')).toBe(
      'https://example.org/apps/directory',
    );
  });

  it('cuts a value that is not an absolute URL at the first ? or #', () => {
    expect(pageAddressOnly('/apps/directory?q=x')).toBe('/apps/directory');
  });
});
