// Where in the readings loop "now" falls, from the wall clock alone. Every listener computes the same
// answer, so two people who open the page at the same moment hear the same sentence, the way a radio
// station works. No server keeps time for this; the loop is anchored at the Unix epoch.

export type ReadingsTrack = {
  id: string;
  title: string;
  postUrl: string | null;
  audioUrl: string;
  durationSeconds: number;
};

export type LoopPosition = { index: number; offsetSeconds: number };

export function loopPositionAt(tracks: ReadingsTrack[], nowMs: number): LoopPosition | null {
  const total = tracks.reduce((sum, track) => sum + Math.max(0, track.durationSeconds), 0);
  if (tracks.length === 0 || total <= 0) return null;
  let remaining = (nowMs / 1000) % total;
  for (let index = 0; index < tracks.length; index += 1) {
    const duration = Math.max(0, tracks[index].durationSeconds);
    if (remaining < duration) return { index, offsetSeconds: remaining };
    remaining -= duration;
  }
  return { index: 0, offsetSeconds: 0 };
}
