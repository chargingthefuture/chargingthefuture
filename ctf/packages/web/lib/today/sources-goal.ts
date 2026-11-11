import { seGoalCardLabel, seGoalProgress, type SeTodayCard } from '@ctf/shared';
import type { Goal } from 'lib/peer-programming/goals';
import { action, author, card } from './card';

// One PeerProgramming goal as a Today card. Somebody else's open goal is an ask with I can help and
// I know someone. The viewer's own goal is the "Your goal" card of the approved 3.1 board "Today, a
// quiet day": how many of its tasks are taken, a bar, and Share this goal. Once the viewer marks it
// reached it comes back as its own card under the source 'goal-reached' for 7 days (lifetime.ts),
// dated from the day it was reached, so the member can still share it after the ask has closed.

export const GOAL_HREF = '/apps/peer-programming';

export const GOAL_REACHED_SOURCE = 'goal-reached';

function othersGoal(goal: Goal, handle: string | undefined): SeTodayCard {
  const open = goal.tasks.filter((task) => task.status === 'open').length;
  return card({
    source: 'peer-programming',
    sourceId: goal.id,
    kind: 'ask',
    label: 'Ask · a goal',
    title: goal.title,
    body: open > 0 ? `${open} small task${open === 1 ? '' : 's'} open` : null,
    author: author(goal.ownerUserId, handle),
    createdAtIso: goal.createdAtIso,
    href: GOAL_HREF,
    actions: [action('help', 'I can help', GOAL_HREF), action('know-someone', 'I know someone', GOAL_HREF)],
  });
}

function ownGoal(goal: Goal, handle: string | undefined): SeTodayCard {
  const reached = goal.status === 'reached';
  const progress = seGoalProgress(goal.tasks, goal.ownerUserId, reached);
  const base = card({
    source: reached ? GOAL_REACHED_SOURCE : 'peer-programming',
    sourceId: goal.id,
    kind: 'ask',
    label: seGoalCardLabel(progress),
    title: goal.title,
    author: author(goal.ownerUserId, handle),
    createdAtIso: reached && goal.closedAtIso ? goal.closedAtIso : goal.createdAtIso,
    href: GOAL_HREF,
    actions: [],
  });
  return { ...base, goal: progress };
}

// Open goals for everyone; a reached goal only for its owner.
export function goalCard(goal: Goal, viewerUserId: string, names: Record<string, string>): SeTodayCard | null {
  const handle = names[goal.ownerUserId];
  if (goal.ownerUserId === viewerUserId && goal.status !== 'withdrawn') return ownGoal(goal, handle);
  return goal.status === 'open' ? othersGoal(goal, handle) : null;
}
