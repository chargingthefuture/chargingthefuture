// The readings loop's playlist and where in it "now" falls — a copy of the web's
// lib/chyme/readings/schedule.ts (the mobile package cannot import web code). Every listener works
// out the same position from the clock, so the loop behaves like a radio station.

export const BLOG_URL = 'https://chargingthefuture.github.io/chargingthefuture';
export const BLOG_READINGS_URL = 'https://chargingthefuture.github.io/chargingthefuture/readings.json';

export type ReadingsTrack = {
  slug: string;
  title: string;
  postUrl: string;
  audioUrl: string;
  durationSeconds: number;
};

function isTrack(item: unknown): item is ReadingsTrack {
  if (typeof item !== 'object' || item === null) return false;
  const entry = item as Record<string, unknown>;
  return (
    typeof entry.slug === 'string' &&
    typeof entry.title === 'string' &&
    typeof entry.postUrl === 'string' &&
    typeof entry.audioUrl === 'string' &&
    entry.postUrl.startsWith('https://') &&
    entry.audioUrl.startsWith('https://') &&
    typeof entry.durationSeconds === 'number' &&
    entry.durationSeconds > 0
  );
}

// Keeps only well-formed https entries, so a malformed list plays what it can instead of nothing.
export function parseBlogReadings(data: unknown): ReadingsTrack[] {
  const list = typeof data === 'object' && data !== null ? (data as { readings?: unknown }).readings : undefined;
  if (!Array.isArray(list)) return [];
  return list.filter(isTrack);
}

export type LoopPosition = { index: number; offsetSeconds: number };

// Where in the loop "now" falls, anchored at the Unix epoch; durations in seconds, one per track.
export function loopPositionAt(durations: number[], nowMs: number): LoopPosition | null {
  const total = durations.reduce((sum, duration) => sum + Math.max(0, duration), 0);
  if (durations.length === 0 || total <= 0) return null;
  let remaining = (nowMs / 1000) % total;
  for (let index = 0; index < durations.length; index += 1) {
    const duration = Math.max(0, durations[index]);
    if (remaining < duration) return { index, offsetSeconds: remaining };
    remaining -= duration;
  }
  return { index: 0, offsetSeconds: 0 };
}

// The reading after this one, wrapping to the first after the last.
export function nextIndex(current: number, count: number): number {
  return count > 0 ? (current + 1) % count : 0;
}
