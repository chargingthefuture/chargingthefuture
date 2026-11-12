import { SE_TODAY_MOOD_TITLE, type SeTodayBroadcast, type SeTodayCard, type SeTodayDay, type SeTodayFigure } from '@ctf/shared';
import { resolveUsernames } from 'lib/identity/resolve-usernames';
import { reportError } from 'lib/observability/report';
import { readMoodEligibilityForUser } from 'lib/mood/repository';
import { getDashboard } from 'lib/workforce/repository';
import { readWeeklyIndexChange } from 'lib/gdp/weekly-change';
import { getLiveBeaconEvent } from 'lib/beacon/repository';
import { listRounds } from 'lib/skills-hunt/repository';
import { listMissionsForRoundWithCommunityProgress } from 'lib/skills-hunt/missions';
import { withDbTransaction } from 'lib/db/postgres';
import { action, card, utcTodayDay, type TodayViewer } from './card';

// The parts of Today that belong to the day or to this moment: the Mood check-in, the numbers, a
// broadcast, the current SkillsHunt round, and the Main Room.

export async function moodCard(viewer: TodayViewer, day: SeTodayDay = utcTodayDay()): Promise<SeTodayCard[]> {
  const { eligible } = await readMoodEligibilityForUser(viewer.userId);
  if (!eligible) return [];
  const href = '/apps/mood';
  return [
    card({
      source: 'mood',
      sourceId: day.day,
      kind: 'mood',
      label: 'Mood',
      title: SE_TODAY_MOOD_TITLE,
      body: null,
      createdAtIso: day.startIso,
      href,
      // The five faces post the check-in from the card (SE_TODAY_MOODS); nothing else is needed.
      actions: [],
    }),
  ];
}

// The Our numbers card (approved board "More cards in Today"): Workforce's skills coverage and, for a
// signed-in member, how much the Community Value Index grew this week (lib/gdp/weekly-change.ts), as
// two figures. The index is a relative measure and is never written as money. A weekly figure that
// cannot be read, or has no last week to compare with, is left out and the card keeps coverage.
async function weeklyIndexFigure(now: Date): Promise<SeTodayFigure | null> {
  try {
    const change = await readWeeklyIndexChange(now);
    return change === null ? null : { value: `+${change.toLocaleString('en-US')}`, line: 'Community Value Index this week' };
  } catch (error) {
    reportError(error, { area: 'today', op: 'numbers_weekly_index' });
    return null;
  }
}

export async function numbersCard(day: SeTodayDay = utcTodayDay(), withWeekly = false, now = new Date()): Promise<SeTodayCard[]> {
  const [dashboard, weekly] = await Promise.all([getDashboard(), withWeekly ? weeklyIndexFigure(now) : Promise.resolve(null)]);
  if (!dashboard.skillsCatalogTotal) return [];
  const covered = Math.min(100, Math.round((dashboard.skillsListedTotal / dashboard.skillsCatalogTotal) * 100));
  const href = '/apps/workforce';
  const coverage: SeTodayFigure = { value: `${covered}%`, line: "of a small country's skills covered" };
  return [
    {
      ...card({
        source: 'numbers',
        sourceId: day.day,
        kind: 'numbers',
        label: weekly ? 'Our numbers · this week' : 'Our numbers',
        title: `${covered}% of a small country's skills covered`,
        body: `${dashboard.skillsListedTotal} of ${dashboard.skillsCatalogTotal} skills are held by somebody listed in the Directory.`,
        createdAtIso: day.startIso,
        href,
        actions: [action('open', 'Open the full report', href)],
      }),
      figures: weekly ? [coverage, weekly] : [coverage],
    },
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
export async function missionCard(day: SeTodayDay = utcTodayDay()): Promise<SeTodayCard[]> {
  const round = (await listRounds('active'))[0];
  if (!round) return [];
  const missions = (await withDbTransaction((client) => listMissionsForRoundWithCommunityProgress(client, round.id))).filter(
    (mission) => mission.status === 'active',
  );
  if (missions.length === 0) return [];
  const index = Math.floor(Date.parse(`${day.day}T00:00:00Z`) / 86_400_000);
  const mission = missions[index % missions.length];
  const href = '/apps/skills-hunt';
  const found = `${mission.community.count} of ${mission.goalTarget} found so far.`;
  return [
    card({
      source: 'skills-hunt-mission',
      sourceId: `${mission.id}:${day.day}`,
      kind: 'ask',
      label: "Wanted · today's mission",
      title: mission.title,
      body: mission.description ? `${mission.description} ${found}` : found,
      createdAtIso: day.startIso,
      href,
      actions: [action('know-someone', 'Suggest someone', href)],
    }),
  ];
}
