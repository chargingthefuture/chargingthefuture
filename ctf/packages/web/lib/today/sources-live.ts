import type { SeTodayBroadcast, SeTodayCard, SeTodayRoom } from '@ctf/shared';
import { readMoodEligibilityForUser } from 'lib/mood/repository';
import { getDashboard } from 'lib/workforce/repository';
import { getLiveBeaconEvent, listBeaconReplays } from 'lib/beacon/repository';
import { toPublicBeaconReplay } from 'lib/beacon/replays';
import { listRounds } from 'lib/skills-hunt/repository';
import { getPublicRoomLiveState } from 'lib/chyme/repository';
import { action, card, startOfTodayIso, type TodayViewer } from './card';

// The parts of Today that belong to the day or to this moment: the Mood check-in, the numbers, a
// broadcast or its replays, the current SkillsHunt round, and the Main Room.

export async function moodCard(viewer: TodayViewer, now = new Date()): Promise<SeTodayCard[]> {
  const { eligible } = await readMoodEligibilityForUser(viewer.userId);
  if (!eligible) return [];
  const href = '/apps/mood';
  return [
    card({
      source: 'mood',
      sourceId: startOfTodayIso(now).slice(0, 10),
      kind: 'mood',
      label: 'Mood',
      title: 'How is this week?',
      body: 'One tap, no name kept with it.',
      createdAtIso: startOfTodayIso(now),
      href,
      actions: [action('check-in', 'Check in', href)],
    }),
  ];
}

export async function numbersCard(now = new Date()): Promise<SeTodayCard[]> {
  const dashboard = await getDashboard();
  if (!dashboard.skillsCatalogTotal) return [];
  const covered = Math.min(100, Math.round((dashboard.skillsListedTotal / dashboard.skillsCatalogTotal) * 100));
  const href = '/apps/workforce';
  return [
    card({
      source: 'numbers',
      sourceId: startOfTodayIso(now).slice(0, 10),
      kind: 'numbers',
      label: 'Our numbers',
      title: `${covered}% of a small country's skills covered`,
      body: `${dashboard.skillsListedTotal} of ${dashboard.skillsCatalogTotal} skills are held by somebody listed in the Directory.`,
      createdAtIso: startOfTodayIso(now),
      href,
      actions: [action('open', 'Open the full report', href)],
    }),
  ];
}

export async function broadcast(): Promise<SeTodayBroadcast | null> {
  const live = await getLiveBeaconEvent();
  return live ? { live: true, title: live.title, href: '/apps/beacon' } : null;
}

export async function replayCards(): Promise<SeTodayCard[]> {
  const replays = (await listBeaconReplays(2, 0)).map(toPublicBeaconReplay);
  return replays.map((replay) =>
    card({
      source: 'beacon-replay',
      sourceId: replay.id,
      kind: 'replay',
      label: 'Replay',
      title: replay.title,
      body: replay.description || null,
      createdAtIso: replay.endedAtIso ?? replay.startedAtIso ?? new Date().toISOString(),
      href: replay.watchUrl,
      actions: [action('open', 'Watch', replay.watchUrl)],
    }),
  );
}

export async function wantedCard(): Promise<SeTodayCard[]> {
  const round = (await listRounds('active'))[0];
  if (!round) return [];
  const href = '/apps/skills-hunt';
  return [
    card({
      source: 'skills-hunt',
      sourceId: round.id,
      kind: 'match',
      label: 'Wanted · this round',
      title: round.name,
      body: round.description,
      createdAtIso: round.startsAtIso,
      href,
      actions: [action('know-someone', 'Suggest someone', href)],
    }),
  ];
}

export async function mainRoom(): Promise<SeTodayRoom> {
  const state = await getPublicRoomLiveState();
  return {
    key: 'main',
    name: state.roomName,
    live: state.callActive,
    members: state.participantCount,
    guests: state.guestCount,
    href: '/apps/chyme',
  };
}
