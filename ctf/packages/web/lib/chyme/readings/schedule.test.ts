import { describe, expect, it } from 'vitest';
import { loopPositionAt, type ReadingsTrack } from './schedule';

function track(id: string, durationSeconds: number): ReadingsTrack {
  return { id, title: id, postUrl: null, audioUrl: `https://example.org/${id}.mp3`, durationSeconds };
}

describe('loopPositionAt', () => {
  it('returns null when there is nothing to play', () => {
    expect(loopPositionAt([], 1_000)).toBeNull();
  });

  it('places the clock inside the right track', () => {
    const tracks = [track('a', 60), track('b', 30)];
    expect(loopPositionAt(tracks, 10_000)).toEqual({ index: 0, offsetSeconds: 10 });
    expect(loopPositionAt(tracks, 75_000)).toEqual({ index: 1, offsetSeconds: 15 });
  });

  it('wraps around at the end of the loop', () => {
    const tracks = [track('a', 60), track('b', 30)];
    expect(loopPositionAt(tracks, 95_000)).toEqual({ index: 0, offsetSeconds: 5 });
  });
});
