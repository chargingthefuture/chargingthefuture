// The readings loop's playlist and where in it "now" falls.
//
// The playlist is the list the blog publishes at build time: every post with a recording in the
// blog's content/audio, oldest first (wiki-site scripts/src/build-readings.ts). Uploading the audio
// file to the blog is the only step; the post gets its "Listen to this post" player and this loop
// gets the reading. GitHub Pages answers with Access-Control-Allow-Origin: *, so browsers read it
// directly.
export const BLOG_READINGS_URL = 'https://chargingthefuture.github.io/chargingthefuture/readings.json';

export type ReadingsTrack = {
  slug: string;
  title: string;
  postUrl: string;
  audioUrl: string;
};

// Keeps only well-formed https entries, so a malformed list plays what it can instead of nothing.
export function parseBlogReadings(data: unknown): ReadingsTrack[] {
  const list = typeof data === 'object' && data !== null ? (data as { readings?: unknown }).readings : undefined;
  if (!Array.isArray(list)) return [];
  return list.filter((item): item is ReadingsTrack => {
    if (typeof item !== 'object' || item === null) return false;
    const entry = item as Record<string, unknown>;
    return (
      typeof entry.slug === 'string' &&
      typeof entry.title === 'string' &&
      typeof entry.postUrl === 'string' &&
      typeof entry.audioUrl === 'string' &&
      entry.postUrl.startsWith('https://') &&
      entry.audioUrl.startsWith('https://')
    );
  });
}

// Where in the loop "now" falls, from the wall clock alone. Every listener computes the same answer,
// so two people who open the page at the same moment hear the same sentence, the way a radio station
// works. The loop is anchored at the Unix epoch; durations are in seconds, one per track.
export type LoopPosition = { index: number; offsetSeconds: number };

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
