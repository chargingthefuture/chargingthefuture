// Emoji rain (3.1 plan, Look: "Emoji rain when Days won goes up, off by default"). When the member
// has the switch on and the Days won total is higher than the last total their account saw, a short
// light shower of emoji falls over Today. Shared so the web and Android draw the same drops.

// Plain signs of a day won: a party popper, a sprout, a star, raised hands and a sparkle.
export const SE_EMOJI_RAIN = ['🎉', '🌱', '⭐', '🙌', '✨'] as const;

// How many drops fall, and the longest any one takes from top to bottom, delay included.
export const SE_EMOJI_RAIN_DROPS = 18;
export const SE_EMOJI_RAIN_MS = 3200;

export type SeEmojiRainDrop = {
  key: string;
  emoji: string;
  // Distance from the left edge, as a percentage of the screen's width.
  leftPct: number;
  delayMs: number;
  fallMs: number;
  sizePx: number;
};

// The drops, spread evenly across the width with a fixed jitter so every run looks the same on both
// platforms and nothing depends on a random number.
export function seEmojiRainDrops(count: number = SE_EMOJI_RAIN_DROPS): SeEmojiRainDrop[] {
  return Array.from({ length: count }, (_, i) => {
    const jitter = (i * 37) % 11;
    return {
      key: `drop-${i}`,
      emoji: SE_EMOJI_RAIN[i % SE_EMOJI_RAIN.length],
      leftPct: Math.min(94, Math.round(((i + 0.5) / count) * 100) - 3 + (jitter % 5)),
      delayMs: ((i * 7) % count) * 60,
      fallMs: 1600 + jitter * 50,
      sizePx: 22 + (jitter % 3) * 4,
    };
  });
}

// What Today does with the Days won total it has just read:
// - `rain`: draw the rain now (the switch is on and the total went up since the account last saw it);
// - `record`: the total to save as seen, or null when nothing needs saving.
// `seen` is undefined while the account has not answered yet (decide nothing), and null when it has
// never recorded a total (record this one; there is nothing to compare it with, so no rain).
// The total is recorded with the switch off too, so turning it on later does not rain for growth the
// member already saw. A sample total (shown while the real one cannot be read) is never recorded.
export function seEmojiRainStep(input: {
  on: boolean;
  total: number | null | undefined;
  sample?: boolean;
  seen: number | null | undefined;
}): { rain: boolean; record: number | null } {
  const { on, total, sample, seen } = input;
  if (seen === undefined || typeof total !== 'number' || !Number.isFinite(total) || sample) return { rain: false, record: null };
  const days = Math.max(0, Math.floor(total));
  return { rain: on && seen !== null && days > seen, record: days === seen ? null : days };
}

// A saved total must be a count of days, zero or more.
export function isSeDaysWonSeen(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2_147_483_647;
}
