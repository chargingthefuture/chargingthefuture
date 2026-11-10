// Beacon replays on Today (owner decision, 2026-11-03), shared by web and Android. A new replay shows
// for 7 days after its broadcast. On top of those, each day brings back one older replay from the
// archive: every replay in order, oldest first, the same one for everybody on the same day, starting
// again from the oldest once all have had their day. A replay whose turn falls while it is still one
// of the 7-day ones is passed over that day for the next older one. Modeled on seStoriesForDay
// (stories/release.ts).

import { SE_TODAY_STORY_DAYS } from './lifetime';

// The first day of the rotation.
export const SE_REPLAY_ROTATION_START = '2026-11-03';

export type SeReplayRef = { id: string; broadcastIso: string };

const DAY_MS = 86_400_000;

function dayNumber(day: string): number {
  return Math.floor(Date.parse(`${day}T00:00:00Z`) / DAY_MS);
}

// Still one of the 7-day replays on that day: broadcast less than 7 days before its end.
export function seReplayIsRecent(replay: SeReplayRef, day: string): boolean {
  return Date.parse(replay.broadcastIso) > (dayNumber(day) + 1) * DAY_MS - SE_TODAY_STORY_DAYS * DAY_MS;
}

// The day's replay from the archive, or null before the first day or when every replay is recent.
export function seArchiveReplayForDay<T extends SeReplayRef>(replays: readonly T[], day: string): T | null {
  const index = dayNumber(day) - dayNumber(SE_REPLAY_ROTATION_START);
  if (index < 0 || replays.length === 0) return null;
  const ordered = [...replays].sort((a, b) => a.broadcastIso.localeCompare(b.broadcastIso) || a.id.localeCompare(b.id));
  for (let step = 0; step < ordered.length; step += 1) {
    const replay = ordered[(index + step) % ordered.length];
    if (!seReplayIsRecent(replay, day)) return replay;
  }
  return null;
}

// "Broadcast on Nov 3, 2026", in UTC, so it reads the same for everybody.
export function seReplayBroadcastLine(iso: string): string {
  return `Broadcast on ${new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`;
}
