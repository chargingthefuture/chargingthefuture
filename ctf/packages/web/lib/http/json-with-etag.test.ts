import { describe, expect, it } from 'vitest';
import { etagMatches, jsonWithEtag } from './json-with-etag';

describe('jsonWithEtag', () => {
  it('answers 200 with the body and a fingerprint on the first read', async () => {
    const response = jsonWithEtag(new Request('https://example.test/api/x'), { items: [1, 2] });
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toMatch(/^W\/".+"$/);
    expect(response.headers.get('cache-control')).toBe('private, no-cache');
    expect(await response.json()).toEqual({ items: [1, 2] });
  });

  it('answers a bodiless 304 when the fingerprint sent back still matches', async () => {
    const first = jsonWithEtag(new Request('https://example.test/api/x'), { items: [1, 2] });
    const etag = first.headers.get('etag') ?? '';
    const second = jsonWithEtag(
      new Request('https://example.test/api/x', { headers: { 'if-none-match': etag } }),
      { items: [1, 2] },
    );
    expect(second.status).toBe(304);
    expect(await second.text()).toBe('');
  });

  it('answers 200 with the new body once anything in it changes', async () => {
    const first = jsonWithEtag(new Request('https://example.test/api/x'), { items: [1, 2] });
    const etag = first.headers.get('etag') ?? '';
    const second = jsonWithEtag(
      new Request('https://example.test/api/x', { headers: { 'if-none-match': etag } }),
      { items: [1, 2, 3] },
    );
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ items: [1, 2, 3] });
  });
});

describe('etagMatches', () => {
  it('ignores the weak prefix on either side and accepts a list', () => {
    expect(etagMatches('"abc"', 'W/"abc"')).toBe(true);
    expect(etagMatches('W/"zzz", W/"abc"', 'W/"abc"')).toBe(true);
    expect(etagMatches('W/"zzz"', 'W/"abc"')).toBe(false);
    expect(etagMatches(null, 'W/"abc"')).toBe(false);
  });
});
