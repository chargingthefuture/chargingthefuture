import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SE_MATCHING_WORDS, SE_QUESTIONS, seMatchingToggleShown, seQuestionCardBody } from '@ctf/shared';

// 21 Questions matching on and off. The database is a small in-memory copy of the three tables the
// queries read; the match query is answered in code, and the matching setting is applied only when
// the SQL sent carries the clause that reads it, so a query that drops the setting fails here.

type Store = { answers: Map<string, Map<string, number>>; off: Map<string, boolean>; audit: string[] };
const store: Store = { answers: new Map(), off: new Map(), audit: [] };

const SETTING_CLAUSE = /question_matching_settings s\s+WHERE s\.user_id IN \(\$1, b\.user_id\) AND NOT s\.matching_enabled/;

function matchRows(sql: string, viewer: string, other: string | null, minSame: number) {
  const mine = store.answers.get(viewer) ?? new Map<string, number>();
  const honoursSetting = SETTING_CLAUSE.test(sql);
  const rows = [];
  for (const [userId, theirs] of store.answers) {
    if (userId === viewer || (other && userId !== other)) continue;
    if (honoursSetting && (store.off.get(viewer) || store.off.get(userId))) continue;
    const both = [...theirs.keys()].filter((id) => mine.has(id));
    const sameIds = both.filter((id) => mine.get(id) === theirs.get(id));
    if (sameIds.length >= minSame) rows.push({ user_id: userId, same: sameIds.length, answered_both: both.length, same_ids: sameIds.slice(0, 3) });
  }
  return rows;
}

function answer(sql: string, params: unknown[]) {
  const [userId] = params as [string];
  if (sql.includes('SELECT b.user_id')) {
    const [, minSame, other] = params as [string, number, string | null];
    return matchRows(sql, userId, other, minSame);
  }
  if (sql.includes('INSERT INTO question_answers')) {
    const [, questionId, choice] = params as [string, string, number];
    const mine = store.answers.get(userId) ?? new Map<string, number>();
    const prior = mine.get(questionId);
    if (prior === undefined) {
      store.answers.set(userId, mine.set(questionId, choice));
      if (sql.includes('INSERT INTO question_answer_audit')) store.audit.push(`${userId} answered ${questionId} ${choice}`);
      return [{ saved: true }];
    }
    if (prior !== choice && sql.includes('INSERT INTO question_answer_audit')) store.audit.push(`${userId} answer_refused ${questionId} ${choice} (stands ${prior})`);
    return [{ saved: false }];
  }
  if (sql.includes('INSERT INTO question_matching_settings')) {
    const enabled = params[1] as boolean;
    const was = !store.off.get(userId);
    store.off.set(userId, !enabled);
    if (was !== enabled && sql.includes('INSERT INTO question_answer_audit')) store.audit.push(`${userId} matching_${enabled ? 'on' : 'off'}`);
    return { rowCount: 1 };
  }
  if (sql.includes('FROM question_matching_settings WHERE user_id = $1')) {
    const enabled = store.off.has(userId) ? !store.off.get(userId) : null;
    return [{ answered: store.answers.get(userId)?.size ?? 0, enabled }];
  }
  if (sql.includes('SELECT question_id, choice FROM question_answers')) {
    return [...(store.answers.get(userId) ?? new Map<string, number>())].map(([question_id, choice]) => ({ question_id, choice }));
  }
  throw new Error(`Unexpected SQL in test: ${sql.slice(0, 60)}`);
}

vi.mock('lib/db/postgres', () => ({
  queryDb: vi.fn(async (sql: string, params: unknown[]) => {
    const result = answer(sql, params);
    return Array.isArray(result) ? { rows: result, rowCount: result.length } : { rows: [], ...result };
  }),
}));

import { findMatch, listMatches, readMatchingState, saveAnswer, setMatchingEnabled } from './repository';

const [q1, q2, q3] = SE_QUESTIONS;

async function answerAlike(...userIds: string[]) {
  for (const userId of userIds) for (const question of [q1, q2, q3]) await saveAnswer(userId, question.id, 0);
}

describe('21 Questions matching setting', () => {
  beforeEach(() => {
    store.answers.clear();
    store.off.clear();
    store.audit.length = 0;
  });

  it('is on for a member who never touched it', async () => {
    await answerAlike('ann', 'bo');
    expect(await readMatchingState('ann')).toEqual({ answered: 3, enabled: true });
    expect((await listMatches('ann')).map((match) => match.userId)).toEqual(['bo']);
  });

  it('leaves a member who turned it off out of everyone else’s matches, at once', async () => {
    await answerAlike('ann', 'bo', 'cy');
    await setMatchingEnabled('bo', false);
    expect((await listMatches('ann')).map((match) => match.userId)).toEqual(['cy']);
    expect((await listMatches('cy')).map((match) => match.userId)).toEqual(['ann']);
    expect(await findMatch('ann', 'bo')).toBeNull();
  });

  it('shows a member who turned it off no matches of their own', async () => {
    await answerAlike('ann', 'bo');
    await setMatchingEnabled('ann', false);
    expect(await listMatches('ann')).toEqual([]);
    expect(await findMatch('ann', 'bo')).toBeNull();
  });

  it('brings the matches back when it is turned back on, with the answers kept', async () => {
    await answerAlike('ann', 'bo');
    await setMatchingEnabled('bo', false);
    expect(await listMatches('ann')).toEqual([]);
    await setMatchingEnabled('bo', true);
    expect((await listMatches('ann')).map((match) => match.userId)).toEqual(['bo']);
    expect(await readMatchingState('bo')).toEqual({ answered: 3, enabled: true });
  });

  it('stays off when the member answers another question', async () => {
    await saveAnswer('ann', q1.id, 0);
    await setMatchingEnabled('ann', false);
    await saveAnswer('ann', q2.id, 1);
    expect(await readMatchingState('ann')).toEqual({ answered: 2, enabled: false });
  });
});

describe('21 Questions audit record', () => {
  beforeEach(() => {
    store.answers.clear();
    store.off.clear();
    store.audit.length = 0;
  });

  it('records each answer and each refused attempt to change one, not a repeat of the same answer', async () => {
    expect(await saveAnswer('ann', q1.id, 0)).toBe(true);
    expect(await saveAnswer('ann', q1.id, 0)).toBe(false);
    expect(await saveAnswer('ann', q1.id, 2)).toBe(false);
    expect(store.audit).toEqual([`ann answered ${q1.id} 0`, `ann answer_refused ${q1.id} 2 (stands 0)`]);
    expect(store.answers.get('ann')?.get(q1.id)).toBe(0);
  });

  it('records matching turned off and on, and nothing when it does not change', async () => {
    await setMatchingEnabled('ann', true);
    await setMatchingEnabled('ann', false);
    await setMatchingEnabled('ann', false);
    await setMatchingEnabled('ann', true);
    expect(store.audit).toEqual(['ann matching_off', 'ann matching_on']);
  });
});

describe('the matching toggle and the question card', () => {
  it('hides the toggle before the first answer', () => {
    expect(seMatchingToggleShown(null)).toBe(false);
    expect(seMatchingToggleShown({ answered: 0, enabled: true })).toBe(false);
    expect(seMatchingToggleShown({ answered: 1, enabled: true })).toBe(true);
    expect(seMatchingToggleShown({ answered: 4, enabled: false })).toBe(true);
  });

  it('explains matching on the card while it is on', () => {
    expect(seQuestionCardBody(2, 5, true).split('\n')).toEqual([
      SE_MATCHING_WORDS.optIn,
      SE_MATCHING_WORDS.reachOut,
      SE_MATCHING_WORDS.optOut,
      '2 of 5 answered so far.',
    ]);
  });

  it('says matching is off on the card while it is off', () => {
    expect(seQuestionCardBody(2, 5, false).split('\n')).toEqual([SE_MATCHING_WORDS.off, '2 of 5 answered so far.']);
  });
});
