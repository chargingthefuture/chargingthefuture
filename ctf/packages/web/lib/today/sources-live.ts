import { SE_TODAY_MOOD_TITLE, type SeTodayBroadcast, type SeTodayCard } from '@ctf/shared';
import { resolveUsernames } from 'lib/identity/resolve-usernames';
import { reportError } from 'lib/observability/report';
import { readMoodEligibilityForUser } from 'lib/mood/repository';
import { getDashboard } from 'lib/workforce/repository';
import { getLiveBeaconEvent } from 'lib/beacon/repository';
import { listRounds } from 'lib/skills-hunt/repository';
import { listMissionsForRoundWithCommunityProgress } from 'lib/skills-hunt/missions';
import { withDbTransaction } from 'lib/db/postgres';
import { action, card, startOfTodayIso, type TodayViewer } from './card';

// The parts of Today that belong to the day or to this moment: the Mood check-in, the numbers, a
// broadcast, the current SkillsHunt round, and the Main Room.

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
      title: SE_TODAY_MOOD_TITLE,
      body: null,
      createdAtIso: startOfTodayIso(now),
      href,
      // The five faces post the check-in from the card (SE_TODAY_MOODS); nothing else is needed.
      actions: [],
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

// The live broadcast, with the host's handle and when it started for the line under the title. A
// handle that cannot be read leaves the host out rather than the card.
async function hostHandle(userId: string): Promise<string | null> {
  try {
    return (await resolveUsernames([userId])).get(userId) ?? null;
  } catch (error) {
    reportError(error, { area: 'today', op: 'broadcast_host' });
    return null;
  }
}

export async function broadcast(): Promise<SeTodayBroadcast | null> {
  const live = await getLiveBeaconEvent();
  if (!live) return null;
  return { live: true, title: live.title, href: '/apps/beacon', host: await hostHandle(live.hostUserId), startedAtIso: live.startedAtIso };
}

export async function wantedCard(): Promise<SeTodayCard[]> {
  const round = (await listRounds('active'))[0];
  if (!round) return [];
  const href = '/apps/skills-hunt';
  return [
    card({
      source: 'skills-hunt',
      sourceId: round.id,
      kind: 'ask',
      label: 'Wanted · this round',
      title: round.name,
      body: round.description,
      createdAtIso: round.startsAtIso,
      href,
      actions: [action('know-someone', 'Suggest someone', href)],
    }),
  ];
}

// One SkillsHunt mission a day, as the day's task: the active round's open missions in turn, a
// different one each day, with how many the community has found so far.
export async function missionCard(now = new Date()): Promise<SeTodayCard[]> {
  const round = (await listRounds('active'))[0];
  if (!round) return [];
  const missions = (await withDbTransaction((client) => listMissionsForRoundWithCommunityProgress(client, round.id))).filter(
    (mission) => mission.status === 'active',
  );
  if (missions.length === 0) return [];
  const day = Math.floor(Date.parse(startOfTodayIso(now)) / 86_400_000);
  const mission = missions[day % missions.length];
  const href = '/apps/skills-hunt';
  const found = `${mission.community.count} of ${mission.goalTarget} found so far.`;
  return [
    card({
      source: 'skills-hunt-mission',
      sourceId: `${mission.id}:${startOfTodayIso(now).slice(0, 10)}`,
      kind: 'ask',
      label: "Wanted · today's mission",
      title: mission.title,
      body: mission.description ? `${mission.description} ${found}` : found,
      createdAtIso: startOfTodayIso(now),
      href,
      actions: [action('know-someone', 'Suggest someone', href)],
    }),
  ];
}
