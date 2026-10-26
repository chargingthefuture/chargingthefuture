import { describe, expect, it } from 'vitest';
import { SE_THEME_COLORS, SE_THEME_MODES, SE_THEMES, seTheme, type SeCardKind } from '@ctf/shared';

// WCAG contrast ratio between two #rrggbb colors.
function luminance(hex: string): number {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const KINDS: SeCardKind[] = ['ask', 'offer', 'story', 'match', 'mood', 'numbers', 'replay'];

describe('Skills Economy 3.1.0 themes', () => {
  for (const color of SE_THEME_COLORS) {
    for (const mode of SE_THEME_MODES) {
      const t = SE_THEMES[color][mode];
      const name = `${color} ${mode}`;

      it(`${name}: body text is readable on the page and on cards`, () => {
        expect(contrast(t.ink, t.bg)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t.ink, t.card)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t.soft, t.card)).toBeGreaterThanOrEqual(4.5);
      });

      it(`${name}: button, hero and LIVE badge text is readable`, () => {
        expect(contrast(t.onBtn, t.btn)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t.onHero, t.hero)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t.onLiveBadge, t.liveBadge)).toBeGreaterThanOrEqual(4.5);
      });

      it(`${name}: each card kind's label is readable on a card`, () => {
        for (const kind of KINDS) {
          expect(contrast(t.kind[kind], t.card), kind).toBeGreaterThanOrEqual(4.5);
        }
      });
    }
  }

  it('defaults to forest and gold, dark', () => {
    expect(seTheme()).toBe(SE_THEMES.forest.dark);
  });
});
