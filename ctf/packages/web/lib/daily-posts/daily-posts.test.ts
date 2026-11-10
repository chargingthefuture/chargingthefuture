import { describe, expect, it } from 'vitest';
import { themesFromText } from './themes';
import { ROTATION_DAYS, ROTATION_EPOCH, rotationFor, rotationSlot } from './rotation';
import { blurbPasteText, dailyPick, livePasteText, type DailyContent } from './daily-content';
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

describe('dailyPick', () => {
  const content: DailyContent = {
    lines: [
      { id: 'a', label: 'Line A' },
      { id: 'b', label: 'Line B' },
    ],
    blurbs: [
      { id: 'a1', line: 'a', link: 'https://x', text: 'A one' },
      { id: 'a2', line: 'a', link: 'https://x', text: 'A two' },
      { id: 'b1', line: 'b', link: 'https://x', text: 'B one' },
    ],
    live: [
      { id: 'la1', line: 'a', link: 'https://x', title: 'LA1', points: ['1', '2', '3'] },
      { id: 'la2', line: 'a', link: 'https://x', title: 'LA2', points: ['1', '2', '3'] },
      { id: 'lb1', line: 'b', link: 'https://x', title: 'LB1', points: ['1', '2', '3'] },
    ],
  };

  it('gives one blurb per line and moves the live topic through the lines a day at a time', () => {
    const first = dailyPick(content, ROTATION_EPOCH);
    expect(first.blurbs.map((blurb) => blurb.id)).toEqual(['a1', 'b1']);
    expect(first.live?.id).toBe('la1');
    expect(dailyPick(content, '2026-11-03').live?.id).toBe('lb1');
    expect(dailyPick(content, '2026-11-04').live?.id).toBe('la2');
    expect(dailyPick(content, '2026-11-03').blurbs.map((blurb) => blurb.id)).toEqual(['a2', 'b1']);
  });

  it('keeps an earlier day the same when an entry is added to the end of a line', () => {
    const longer = { ...content, live: [...content.live, { id: 'lb2', line: 'b', link: 'https://x', title: 'LB2', points: ['1', '2', '3'] }] };
    expect(dailyPick(longer, '2026-11-03').live?.id).toBe('lb1');
  });

  it('puts the link on its own line under a blurb and under a live topic', () => {
    expect(blurbPasteText({ text: 'Hi.', link: 'https://x' })).toBe('Hi.\n\nhttps://x');
    expect(livePasteText({ title: 'T', points: ['p'], link: 'https://x' })).toBe('T\n\n- p\n\nhttps://x');
  });
});
