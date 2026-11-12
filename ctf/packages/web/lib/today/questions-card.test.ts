import { describe, expect, it, vi } from 'vitest';
import { SE_QUESTIONS, seQuestionOfDay } from '@ctf/shared';

// Today's 21 Questions card stays once answered: done, with the answer picked, so the day's work
// stays in view. A question missed on an earlier day gets its own catching-up card beside it.

const answers = new Map<string, number>();
vi.mock('lib/auth/server-authz', () => ({ evaluatePluginAccess: async () => ({ allowed: true }) }));
vi.mock('lib/identity/resolve-usernames', () => ({ resolveUsernames: async () => new Map() }));
vi.mock('lib/questions/repository', () => ({
  listAnswers: async () => answers,
  listMatches: async () => [],
  readMatchingState: async () => ({ answered: answers.size, enabled: true }),
  summarizeConversations: async () => new Map(),
}));

import { questionCards } from './sources-questions';

const viewer = { userId: 'ann', isAdmin: false };
const thirdDay = { day: '2026-11-05', startIso: '2026-11-05T00:00:00.000Z' };
const today = seQuestionOfDay('2026-11-05');

describe("Today's 21 Questions card", () => {
  it('asks the question, not done, before it is answered', async () => {
    answers.clear();
    const [first] = await questionCards(viewer, thirdDay);
    expect(first.id).toBe(`questions:${today.id}`);
    expect(first.done).toBe(false);
    expect(first.body).not.toContain('You picked');
  });

  it('stays once answered, done, with the answer picked, and a missed one gets its own card', async () => {
    answers.clear();
    answers.set(today.id, 1);
    const cards = await questionCards(viewer, thirdDay);
    expect(cards[0].id).toBe(`questions:${today.id}`);
    expect(cards[0].done).toBe(true);
    expect(cards[0].body?.split('\n')[0]).toBe(`You picked: ${today.choices[1]}`);
    expect(cards[1].id).toBe(`questions:${SE_QUESTIONS[0].id}`);
    expect(cards[1].label).toBe('21 Questions · catching up');
    expect(cards[1].done).toBe(false);
  });

  it('marks the answered card done on Today', async () => {
    answers.clear();
    for (const question of SE_QUESTIONS.slice(0, 3)) answers.set(question.id, 0);
    const cards = await questionCards(viewer, thirdDay);
    expect(cards).toHaveLength(1);
    expect(cards[0].done).toBe(true);
  });
});
