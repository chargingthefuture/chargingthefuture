import { describe, expect, it } from 'vitest';
import { loopPositionAt, parseBlogReadings } from './schedule';

describe('loopPositionAt', () => {
  it('returns null when there is nothing to play', () => {
    expect(loopPositionAt([], 1_000)).toBeNull();
  });

  it('places the clock inside the right track', () => {
    expect(loopPositionAt([60, 30], 10_000)).toEqual({ index: 0, offsetSeconds: 10 });
    expect(loopPositionAt([60, 30], 75_000)).toEqual({ index: 1, offsetSeconds: 15 });
  });

  it('wraps around at the end of the loop', () => {
    expect(loopPositionAt([60, 30], 95_000)).toEqual({ index: 0, offsetSeconds: 5 });
  });
});

describe('parseBlogReadings', () => {
  const good = {
    slug: 'who-teaches-them',
    title: 'Who teaches them',
    postUrl: 'https://chargingthefuture.github.io/chargingthefuture/article/wiki-site/who-teaches-them',
    audioUrl: 'https://chargingthefuture.github.io/chargingthefuture/audio/who-teaches-them.mp3',
  };

  it('keeps well-formed entries and drops the rest', () => {
    const list = parseBlogReadings({ readings: [good, { ...good, audioUrl: 'http://example.org/a.mp3' }, null, { title: 'x' }] });
    expect(list).toEqual([good]);
  });

  it('returns an empty list for anything that is not the blog list', () => {
    expect(parseBlogReadings(null)).toEqual([]);
    expect(parseBlogReadings({ readings: 'no' })).toEqual([]);
  });
});
