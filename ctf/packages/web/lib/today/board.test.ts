import { describe, expect, it } from 'vitest';
import { seBroadcastHostLine, seClosingLines, seParseSaveChange, sePresenceLine, seSaveChangeFor, seSaveCardInToday, type SeTodayCard } from '@ctf/shared';

const story: SeTodayCard = { id: 'blog-story:a', kind: 'story', source: 'blog-story', label: 'Story', title: 'A', body: null, author: null, createdAtIso: '2026-11-03T00:00:00Z', href: 'https://example.org/a', actions: [] };

describe('presence pill', () => {
  it('reads one Aven, several Avens, and nothing when unknown', () => {
    expect(sePresenceLine(1)).toBe('1 Aven here');
    expect(sePresenceLine(3)).toBe('3 Avens here');
    expect(sePresenceLine(null)).toBeNull();
    expect(sePresenceLine(0)).toBeNull();
  });
});

describe('closing lines', () => {
  it('says caught up when somebody asked or offered, and that is today on a quiet day', () => {
    expect(seClosingLines([{ kind: 'ask' }], 5)).toEqual({ title: "You're caught up.", note: '5 more stories open at your midnight.' });
    expect(seClosingLines([{ kind: 'story' }, { kind: 'ask', mine: { leavesIso: '', dueIso: null, canClose: true, canRenew: true } }], 1).title).toBe('That is today.');
    expect(seClosingLines([{ kind: 'story' }], 1).note).toBe('1 more story opens at your midnight.');
    expect(seClosingLines([], null)).toEqual({ title: 'Nothing here yet.', note: 'New cards arrive as people post.' });
  });
});

describe('broadcast line', () => {
  it('joins the host and the start, and leaves out what is missing', () => {
    expect(seBroadcastHostLine({ host: 'farah', startedAtIso: null })).toBe('farah');
    expect(seBroadcastHostLine({ host: null, startedAtIso: null })).toBeNull();
    expect(seBroadcastHostLine({ host: 'farah', startedAtIso: '2026-10-26T23:02:00Z' })).toMatch(/^farah · started at \d{1,2}:\d{2}/);
  });
});

describe('saves', () => {
  it('saves a story with its title and address, and takes a saved one off', () => {
    expect(seSaveChangeFor(story)).toEqual({ cardId: 'blog-story:a', saved: true, kind: 'story', title: 'A', href: 'https://example.org/a' });
    expect(seSaveChangeFor({ ...story, saved: true })).toEqual({ cardId: 'blog-story:a', saved: false });
    expect(seSaveCardInToday({ cards: [story] }, { cardId: 'blog-story:a', saved: false }).cards[0].saved).toBe(false);
  });

  it('refuses an unsafe address, an unsavable kind and a bad id', () => {
    const base = { cardId: 'blog-story:a', saved: true, kind: 'story', title: 'A' };
    expect(seParseSaveChange({ ...base, href: 'javascript:alert(1)' })).toBeNull();
    expect(seParseSaveChange({ ...base, href: '//evil.example' })).toBeNull();
    expect(seParseSaveChange({ ...base, href: '/apps/beacon', kind: 'ask' })).toBeNull();
    expect(seParseSaveChange({ ...base, href: '/apps/beacon', cardId: 'bad id' })).toBeNull();
    expect(seParseSaveChange({ ...base, href: '/apps/beacon' })).toMatchObject({ saved: true, href: '/apps/beacon' });
    expect(seParseSaveChange({ cardId: 'blog-story:a', saved: false })).toEqual({ cardId: 'blog-story:a', saved: false });
  });
});
