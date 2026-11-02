import { describe, expect, it } from 'vitest';
import { themesFromText } from './themes';
import { ROTATION_DAYS, rotationFor, rotationSlot } from './rotation';
import { blogPostPasteText } from './source';

describe('themesFromText', () => {
  it('places a post in every group whose part it links, on either domain', () => {
    const text = [
      '- Directory (https://app.lagatos.com/apps/directory) — guide (https://app.lagatos.com/guide#directory)',
      '- TrustTransport (https://app.chargingthefuture.com/apps/trust-transport)',
      '- Knowledge Library (https://app.lagatos.com/knowledge)',
      '- TI Radio — guide (https://app.lagatos.com/guide#ti-radio)',
    ].join('\n');
    expect(themesFromText(text)).toEqual(['ti-radio', 'reliable-rides', 'finding-tis', 'real-information']);
  });

  it('leaves a post with no app links in no group', () => {
    expect(themesFromText('Commons (https://app.lagatos.com) and nothing else.')).toEqual([]);
  });
});

describe('rotation', () => {
  it('shows every post exactly once across 30 consecutive days', () => {
    const posts = Array.from({ length: 151 }, (_, index) => index);
    const seen: number[] = [];
    for (let day = 0; day < ROTATION_DAYS; day += 1) {
      const date = new Date(Date.UTC(2027, 0, 10 + day)).toISOString().slice(0, 10);
      seen.push(...rotationFor(posts, date));
    }
    expect(seen.sort((a, b) => a - b)).toEqual(posts);
  });

  it('starts on slot 0 on day one and wraps after 30 days', () => {
    expect(rotationSlot('2026-11-02')).toBe(0);
    expect(rotationSlot('2026-12-02')).toBe(0);
    expect(rotationSlot('2026-11-01')).toBe(29);
  });
});

describe('blogPostPasteText', () => {
  it('hands over the title, the full post and the link on its own line', () => {
    expect(blogPostPasteText({ title: 'T', text: 'Body.\n', url: 'https://example.org/p' })).toBe('T\n\nBody.\n\nFull post: https://example.org/p');
  });
});
