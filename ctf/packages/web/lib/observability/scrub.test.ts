import { describe, expect, it } from 'vitest';
import { seScrubAddress, seScrubBreadcrumb, seScrubEvent, seScrubQuery, seScrubReplayFrame, seScrubText } from '@ctf/shared';

const UUID = '3f2b6c1e-8a4d-4c2f-9b1e-7d6a5c4b3a21';

describe('seScrubAddress', () => {
  it('replaces a profile id with :id', () => {
    expect(seScrubAddress(`/apps/directory/profile/${UUID}`)).toBe('/apps/directory/profile/:id');
  });

  it('keeps the origin and replaces query values, keeping the keys', () => {
    expect(seScrubAddress(`https://app.lagatos.com/apps/x?id=${UUID}&page=2&flag`)).toBe(
      'https://app.lagatos.com/apps/x?id=:value&page=:value&flag',
    );
  });

  it('replaces Clerk ids, numeric ids, card ids and match codes', () => {
    expect(seScrubAddress('/api/users/user_2abcDEF345ghi/x')).toBe('/api/users/:id/x');
    expect(seScrubAddress('/api/click-log/48213')).toBe('/api/click-log/:id');
    expect(seScrubAddress('/api/today/cards/goal%3A42/answers')).toBe('/api/today/cards/:id/answers');
    expect(seScrubAddress('/today/goal:abc-1')).toBe('/today/:id');
    expect(seScrubAddress('/match/a1b2c3d4e5')).toBe('/match/:id');
  });

  it('leaves plain words, route patterns and short route names alone', () => {
    expect(seScrubAddress('/apps/foundation/lighthouse')).toBe('/apps/foundation/lighthouse');
    expect(seScrubAddress('GET /apps/directory/[handle]')).toBe('GET /apps/directory/[handle]');
    expect(seScrubAddress('')).toBe('');
  });

  it('replaces Directory handles and invite names with :handle', () => {
    expect(seScrubAddress('/apps/directory/jane-doe')).toBe('/apps/directory/:handle');
    expect(seScrubAddress('https://app.lagatos.com/apps/directory/profile/jane-doe?tab=skills')).toBe(
      'https://app.lagatos.com/apps/directory/profile/:handle?tab=:value',
    );
    expect(seScrubAddress('/api/directory/invites/jane-doe/image')).toBe('/api/directory/invites/:handle/image');
    expect(seScrubAddress('GET /apps/directory/jane-doe')).toBe('GET /apps/directory/:handle');
    expect(seScrubAddress(`/apps/directory/profile/${UUID}`)).toBe('/apps/directory/profile/:id');
  });

  it('leaves Directory pages and route templates alone', () => {
    expect(seScrubAddress('/apps/directory')).toBe('/apps/directory');
    expect(seScrubAddress('/apps/directory/')).toBe('/apps/directory/');
    expect(seScrubAddress('/apps/directory/invites')).toBe('/apps/directory/invites');
    expect(seScrubAddress('/apps/directory/weavers-of-the-commons')).toBe('/apps/directory/weavers-of-the-commons');
    expect(seScrubAddress('/apps/directory/profile/[handle]')).toBe('/apps/directory/profile/[handle]');
    expect(seScrubAddress('/apps/directory/:handle')).toBe('/apps/directory/:handle');
  });

  it('scrubs ids in the fragment and inside a segment', () => {
    expect(seScrubAddress(`/a#/b/${UUID}`)).toBe('/a#/b/:id');
    expect(seScrubAddress(`/files/photo-${UUID}.png`)).toBe('/files/photo-:id.png');
  });

  it('gives the same result when run twice', () => {
    const once = seScrubAddress(`/apps/directory/profile/${UUID}?q=x`);
    expect(seScrubAddress(once)).toBe(once);
  });
});

describe('seScrubQuery and seScrubText', () => {
  it('keeps keys with no value', () => {
    expect(seScrubQuery('?a=1&b=&c')).toBe('?a=:value&b=&c');
    expect(seScrubQuery('a=1')).toBe('a=:value');
  });

  it('strips email addresses, phone numbers and ids from text', () => {
    expect(seScrubText('Failed for someone@example.org at +1 (555) 123-4567')).toBe('Failed for :email at :phone');
    expect(seScrubText(`Card ${UUID} missing`)).toBe('Card :id missing');
    expect(seScrubText('Retry 3 of 5 on 2026-11-11')).toBe('Retry 3 of 5 on 2026-11-11');
  });
});

describe('seScrubBreadcrumb', () => {
  it('drops typed text and console text', () => {
    expect(seScrubBreadcrumb({ category: 'ui.input', message: 'textarea.note', data: { value: 'x' } })).toEqual({ category: 'ui.input' });
    expect(seScrubBreadcrumb({ category: 'console', message: 'hello a@b.co', data: { arguments: ['a'] } })).toEqual({ category: 'console' });
  });

  it('scrubs fetch addresses and drops bodies', () => {
    const crumb = seScrubBreadcrumb({
      category: 'fetch',
      data: { url: `/api/directory/profiles/${UUID}`, method: 'POST', request_body_size: 10, body: '{"a":1}', response: { body: 'x', size: 2 } },
    });
    expect(crumb.data).toEqual({ url: '/api/directory/profiles/:id', method: 'POST', request_body_size: 10 });
  });

  it('scrubs navigation from and to', () => {
    const crumb = seScrubBreadcrumb({ category: 'navigation', data: { from: `/p/${UUID}`, to: '/p/123?x=y' } });
    expect(crumb.data).toEqual({ from: '/p/:id', to: '/p/:id?x=:value' });
  });

  it('cuts attribute values from click selectors', () => {
    const crumb = seScrubBreadcrumb({ category: 'ui.click', message: 'div.card > img[alt="Jane Doe"][title=Hi]' });
    expect(crumb.message).toBe('div.card > img[alt][title]');
  });
});

describe('seScrubReplayFrame', () => {
  it('scrubs a recorded navigation span and a breadcrumb frame', () => {
    const span = seScrubReplayFrame({
      type: 5,
      data: { tag: 'performanceSpan', payload: { op: 'navigation.push', description: `/p/${UUID}`, data: { previous: '/p/99' } } },
    });
    expect(span.data.payload).toEqual({ op: 'navigation.push', description: '/p/:id', data: { previous: '/p/:id' } });
    const crumb = seScrubReplayFrame({ type: 5, data: { tag: 'breadcrumb', payload: { category: 'ui.input', message: 'input' } } });
    expect(crumb.data.payload).toEqual({ category: 'ui.input' });
  });

  it('leaves other frames alone', () => {
    const frame = { type: 5, data: { tag: 'options', payload: { maskAllText: true } } };
    expect(seScrubReplayFrame(frame)).toEqual({ type: 5, data: { tag: 'options', payload: { maskAllText: true } } });
  });
});

describe('seScrubEvent', () => {
  it('scrubs the request, drops cookies, sign-in headers and the member', () => {
    const event = seScrubEvent({
      message: 'Lookup failed for a@b.co',
      transaction: `/apps/directory/profile/${UUID}`,
      user: { id: 'user_2abcDEF345ghi', email: 'a@b.co' },
      request: {
        url: `https://app.lagatos.com/p/${UUID}?q=secret`,
        query_string: 'q=secret',
        cookies: { session: 'x' },
        data: '{"note":"x"}',
        headers: { Cookie: 'x', Authorization: 'Bearer y', Referer: `https://app.lagatos.com/p/${UUID}`, Accept: 'text/html' },
      },
      exception: { values: [{ type: 'Error', value: 'call 555-123-4567 now' }] },
      breadcrumbs: [{ category: 'ui.input', message: 'textarea' }],
      urls: [`https://app.lagatos.com/p/${UUID}`],
    });
    expect(event).toEqual({
      message: 'Lookup failed for :email',
      transaction: '/apps/directory/profile/:id',
      request: {
        url: 'https://app.lagatos.com/p/:id?q=:value',
        query_string: 'q=:value',
        headers: { Referer: 'https://app.lagatos.com/p/:id', Accept: 'text/html' },
      },
      exception: { values: [{ type: 'Error', value: 'call :phone now' }] },
      breadcrumbs: [{ category: 'ui.input' }],
      urls: ['https://app.lagatos.com/p/:id'],
    });
  });

  it('scrubs object and pair query strings and span descriptions', () => {
    const event = seScrubEvent({
      request: { query_string: [['a', '1']] },
      spans: [{ description: `GET /api/x/${UUID}`, data: { url: '/api/x/12' } }],
    });
    expect(event).toEqual({ request: { query_string: [['a', ':value']] }, spans: [{ description: 'GET /api/x/:id', data: { url: '/api/x/:id' } }] });
    expect(seScrubEvent({ request: { query_string: { a: '1' } } })).toEqual({ request: { query_string: { a: ':value' } } });
  });
});
