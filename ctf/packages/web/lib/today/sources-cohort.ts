import type { SeTodayCard } from '@ctf/shared';
import { getMyCohort } from 'lib/peer-programming/repository';
import { buildCohortRosters } from 'lib/peer-programming/roster';
import { action, card, startOfTodayIso, weekStartDate, type TodayViewer } from './card';

// The PeerProgramming "with you this week" card (3.1 plan, Plugins in the new screens): for a member
// placed in a cohort, one card naming the cohort and who is in it with them, leading to its goal
// board. Only the viewer's own cohort, and only the names its room already lists to its members. It
// belongs to the week, so a member who marks it done does not see it again until next week's.

export const COHORT_SOURCE = 'peer-programming-cohort';

// How many names the card spells out before "and N more".
const NAMED = 5;

export function withYouLine(names: string[], others: number): string {
  if (others <= 0) return 'Nobody else is in it yet.';
  const shown = names.slice(0, NAMED);
  const rest = others - shown.length;
  if (shown.length === 0) return others === 1 ? '1 other member is in it with you.' : `${others} other members are in it with you.`;
  const list = shown.length === 1 ? shown[0] : `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
  if (rest <= 0) return `With you: ${list}.`;
  return `With you: ${shown.join(', ')} and ${rest} more.`;
}

export async function cohortCard(viewer: TodayViewer, now = new Date()): Promise<SeTodayCard[]> {
  const cohort = await getMyCohort(viewer.userId);
  if (!cohort || cohort.status !== 'active') return [];
  const roster = (await buildCohortRosters([cohort.id], NAMED + 1)).get(cohort.id) ?? [];
  const names = roster.filter((member) => member.userId !== viewer.userId && member.username).map((member) => member.username as string);
  const others = Math.max(0, cohort.memberCount - 1);
  const href = `/apps/peer-programming?cohortId=${encodeURIComponent(cohort.id)}&tab=goals`;
  return [
    card({
      source: COHORT_SOURCE,
      sourceId: `${cohort.id}:${weekStartDate(now)}`,
      kind: 'ask',
      label: 'PeerProgramming · with you this week',
      title: `Cohort ${cohort.cohortLabel}`,
      body: withYouLine(names, others),
      createdAtIso: startOfTodayIso(now),
      href,
      actions: [action('open', 'Open the goal board', href)],
    }),
  ];
}
