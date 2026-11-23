import { describe, expect, it } from 'vitest';
import { SE_CARD_DOT_ICONS, seCardAccent, seCardDotIcon, seMarkChangeFor, seReadChangeFor, seTheme, seWwCardLink, type SeTodayCard } from '@ctf/shared';

const ww: SeTodayCard = {
  id: 'what-works:p1',
  kind: 'story',
  source: 'what-works',
  label: 'What worked for someone',
  title: 'Power bank',
  body: null,
  author: null,
  createdAtIso: '2026-11-23T00:00:00Z',
  href: '/apps/what-works',
  actions: [],
  whatWorks: { problemId: 'pr1', problemTitle: 'My phone dies by mid-afternoon. What keeps it charged?', link: 'https://example.org/a' },
};

describe('the What Works card on Today', () => {
  it('has its own icon and color, distinct from a story', () => {
    expect(seCardAccent(ww)).toBe('works');
    expect(seCardAccent({ kind: 'story', source: 'blog-story' })).toBe('story');
    expect(seCardDotIcon('works')).not.toEqual(SE_CARD_DOT_ICONS.story);
    for (const mode of ['light', 'dark'] as const) {
      const t = seTheme('burgundy', mode);
      expect(t.kind.works).not.toBe(t.kind.story);
    }
  });

  it('is not marked done by opening it; the dot still marks it done', () => {
    expect(seReadChangeFor({ cards: [ww] }, ww.id, 'viewer')).toBeNull();
    expect(seMarkChangeFor({ cards: [ww] }, 'read', ww.id)).toEqual({ cardId: ww.id, mark: 'done' });
  });

  it('shows only a web address as the solution link', () => {
    expect(seWwCardLink(' https://example.org/a ')).toBe('https://example.org/a');
    expect(seWwCardLink('javascript:alert(1)')).toBeNull();
    expect(seWwCardLink('')).toBeNull();
    expect(seWwCardLink(null)).toBeNull();
  });
});
