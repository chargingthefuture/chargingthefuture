import { describe, expect, it } from 'vitest';
import {
  SE_GOAL_SHARE_LINK,
  SE_SHARE_HELPER_SEED,
  seGoalCardLabel,
  seGoalPercent,
  seGoalProgress,
  seGoalShareCredit,
  seGoalSharePicture,
  seGoalShareText,
  seQrPath,
  seTheme,
  seWrapLines,
} from '@ctf/shared';
import type { Goal } from 'lib/peer-programming/goals';
import { goalCard } from './sources-goal';

const task = (status: string, takenByUserId: string | null) => ({ status, takenByUserId });

describe('goal share', () => {
  it('counts taken tasks and distinct helpers, never the owner', () => {
    const tasks = [task('open', null), task('taken', 'a'), task('finished', 'a'), task('kept', 'b'), task('kept', 'owner')];
    expect(seGoalProgress(tasks, 'owner', false)).toEqual({ taken: 4, total: 5, reached: false, helpers: 2 });
  });

  it('labels the card and the bar', () => {
    expect(seGoalCardLabel({ taken: 2, total: 5, reached: false, helpers: 0 })).toBe('Your goal · 2 of 5 tasks taken');
    expect(seGoalCardLabel({ taken: 1, total: 1, reached: true, helpers: 1 })).toBe('Your goal · reached');
    expect(seGoalPercent({ taken: 2, total: 5, reached: false, helpers: 0 })).toBe(40);
    expect(seGoalPercent({ taken: 0, total: 0, reached: true, helpers: 0 })).toBe(100);
  });

  it('never names a helper', () => {
    expect(seGoalShareCredit({ taken: 1, total: 1, reached: true, helpers: 1 })).toBe('Thanks to a member of the Avenhood');
    expect(seGoalShareCredit({ taken: 3, total: 3, reached: true, helpers: 3 })).toBe('Thanks to 3 members of the Avenhood');
    expect(seGoalShareCredit({ taken: 0, total: 3, reached: false, helpers: 0 })).toBeNull();
  });

  it('copies a plain sentence and the link', () => {
    const text = seGoalShareText({ title: 'A ride to the pharmacy', taken: 1, total: 1, reached: true, helpers: 1 });
    expect(text.startsWith('Goal reached: A ride to the pharmacy. Thanks to a member of the Avenhood.')).toBe(true);
    expect(text.endsWith(SE_GOAL_SHARE_LINK)).toBe(true);
  });

  it('wraps and cuts long text', () => {
    expect(seWrapLines('one two three four', 9, 5)).toEqual(['one two', 'three', 'four']);
    expect(seWrapLines('abcdefghijkl', 5, 5)).toEqual(['abcde', 'fghij', 'kl']);
    expect(seWrapLines('aa bb cc dd', 2, 2)).toEqual(['aa', 'b…']);
  });

  it('draws a QR path from dark modules', () => {
    expect(seQrPath(2, (row, col) => row === col)).toBe('M0 0h1v1h-1zM1 1h1v1h-1z');
  });

  it('lays out the picture with the helper seed and the sharer', () => {
    const picture = seGoalSharePicture({ title: 'Test', taken: 1, total: 1, reached: true, helpers: 1 }, { handle: 'me', accountId: 'acc' }, seTheme('burgundy', 'light'), { modules: 21, d: '' });
    const avatars = picture.items.filter((item) => item.type === 'avatar').map((item) => (item.type === 'avatar' ? item.accountId : ''));
    expect(avatars).toEqual([SE_SHARE_HELPER_SEED, 'acc']);
    expect(picture.items.some((item) => item.type === 'qr')).toBe(true);
    expect(picture.height).toBeGreaterThan(150);
  });
});

function goal(over: Partial<Goal>): Goal {
  return { id: 'g1', cohortId: 'c', ownerUserId: 'owner', title: 'T', status: 'open', createdAtIso: '2026-11-01T00:00:00.000Z', closedAtIso: null, tasks: [], ...over };
}

describe('goal cards on Today', () => {
  it("gives the owner a Your goal card and others an ask", () => {
    const own = goalCard(goal({}), 'owner', { owner: 'me' });
    expect(own?.goal).toEqual({ taken: 0, total: 0, reached: false, helpers: 0 });
    expect(own?.actions).toEqual([]);
    const other = goalCard(goal({}), 'viewer', {});
    expect(other?.goal).toBeUndefined();
    expect(other?.label).toBe('Ask · a goal');
  });

  it('shows a reached goal only to its owner, dated from the day it was reached', () => {
    const reached = goal({ status: 'reached', closedAtIso: '2026-11-05T00:00:00.000Z' });
    const own = goalCard(reached, 'owner', {});
    expect(own?.id).toBe('goal-reached:g1');
    expect(own?.createdAtIso).toBe('2026-11-05T00:00:00.000Z');
    expect(goalCard(reached, 'viewer', {})).toBeNull();
    expect(goalCard(goal({ status: 'withdrawn' }), 'owner', {})).toBeNull();
  });
});
