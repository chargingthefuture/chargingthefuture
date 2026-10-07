// Goal board helpers shared by the board's components. Same rules as the web board
// (pp-goals-board.tsx, pp-goals-chips.tsx, pp-goals-parts.tsx), so a card reads the same on both.
import type { BoardGoal, BoardTask } from './PeerProgrammingApi';

export const ALL_GOALS = 'all';
export const NEW_GOAL = 'new';

export type Card = { task: BoardTask; goal: BoardGoal };
export type Sections = { grabs: Card[]; doing: Card[]; done: Card[] };

// Account deletion overwrites a helper's id with this value; the result they posted stays.
const DELETED_MEMBER = 'deleted_member';

export function nameOf(userId: string | null, names: Record<string, string>): string {
  if (!userId) return 'A member';
  if (userId === DELETED_MEMBER) return 'A former member';
  const name = names[userId];
  return name ? `@${name}` : `Member ${userId.slice(0, 6)}`;
}

// Each goal gets a color so its cards can be told apart, and its chip carries the same one.
const GOAL_COLORS = ['#8B5CF6', '#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#14B8A6'];

export function goalColor(goalId: string): string {
  let sum = 0;
  for (const ch of goalId) sum = (sum * 31 + ch.charCodeAt(0)) >>> 0;
  return GOAL_COLORS[sum % GOAL_COLORS.length];
}

// The viewer's own open goals first, then everyone else's, newest first within each.
export function chipGoals(goals: BoardGoal[], viewerUserId: string): BoardGoal[] {
  const open = goals.filter((goal) => goal.status === 'open');
  const newestFirst = (a: BoardGoal, b: BoardGoal) => b.createdAtIso.localeCompare(a.createdAtIso);
  const mine = open.filter((goal) => goal.ownerUserId === viewerUserId).sort(newestFirst);
  const others = open.filter((goal) => goal.ownerUserId !== viewerUserId).sort(newestFirst);
  return [...mine, ...others];
}

function isDone(task: BoardTask): boolean {
  return task.status === 'finished' || task.status === 'kept';
}

export function doneCount(goal: BoardGoal): number {
  return goal.tasks.filter(isDone).length;
}

// Open and held cards come only from open goals: a reached goal's leftover cards are no longer
// wanted. Done cards come from every goal on the board, newest first.
export function sortIntoSections(goals: BoardGoal[]): Sections {
  const sections: Sections = { grabs: [], doing: [], done: [] };
  for (const goal of goals) {
    for (const task of goal.tasks) {
      if (isDone(task)) sections.done.push({ task, goal });
      else if (goal.status !== 'open') continue;
      else if (task.status === 'taken') sections.doing.push({ task, goal });
      else sections.grabs.push({ task, goal });
    }
  }
  sections.done.sort((a, b) => (b.task.finishedAtIso ?? '').localeCompare(a.task.finishedAtIso ?? ''));
  return sections;
}

export function statusLine(card: Card, viewerUserId: string, names: Record<string, string>): string | null {
  const mine = card.task.takenByUserId === viewerUserId;
  const helper = mine ? 'you' : nameOf(card.task.takenByUserId, names);
  if (card.task.status === 'open') return null;
  if (card.task.status === 'taken') return mine ? 'You are on it' : `${helper} is on it`;
  if (card.task.status === 'finished') {
    return card.goal.ownerUserId === viewerUserId ? `Done by ${helper}. Did it help?` : `Done by ${helper}, waiting on the goal's owner`;
  }
  return card.task.helped ? `Done by ${helper} · it helped` : `Done by ${helper}`;
}

// When a held card stops being reserved for its holder and reopens for anyone.
export function formatHoldDeadline(takenAtIso: string, holdHours: number): string {
  const deadline = new Date(new Date(takenAtIso).getTime() + holdHours * 60 * 60 * 1000);
  return deadline.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}
