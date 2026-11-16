import { describe, expect, it, vi } from 'vitest';
import { SE_STORY_REPLIES_VISITORS_VERSION } from '@ctf/shared';

// The visitor agreement on members' stories: agreed only to the current words, recorded with them,
// and withdrawing clears it.
const db = vi.hoisted(() => ({ calls: [] as Array<{ sql: string; values: unknown[] }>, row: null as Record<string, unknown> | null }));
vi.mock('lib/db/postgres', () => ({
  queryDb: async (sql: string, values: unknown[]) => {
    db.calls.push({ sql, values });
    return { rows: db.row ? [db.row] : [] };
  },
}));

import { readStoryRepliesVisitors, setStoryRepliesVisitors } from './story-replies-visitors';

describe('visitors reading my replies on members stories', () => {
  it('is off with no row, off for other words, on for the current words', async () => {
    db.row = null;
    expect(await readStoryRepliesVisitors('u1')).toEqual({ agreed: false });
    db.row = { version: 'old', agreed_at: new Date() };
    expect(await readStoryRepliesVisitors('u1')).toEqual({ agreed: false });
    db.row = { version: SE_STORY_REPLIES_VISITORS_VERSION, agreed_at: new Date() };
    expect(await readStoryRepliesVisitors('u1')).toEqual({ agreed: true });
    db.row = { version: SE_STORY_REPLIES_VISITORS_VERSION, agreed_at: null };
    expect(await readStoryRepliesVisitors('u1')).toEqual({ agreed: false });
  });

  it('stores the current words when agreeing, and sends false to withdraw', async () => {
    db.calls.length = 0;
    await setStoryRepliesVisitors('u1', true);
    await setStoryRepliesVisitors('u1', false);
    expect(db.calls.map((call) => call.values)).toEqual([
      ['u1', true, SE_STORY_REPLIES_VISITORS_VERSION],
      ['u1', false, SE_STORY_REPLIES_VISITORS_VERSION],
    ]);
    expect(db.calls[0].sql).toContain('WHEN NOT $2 THEN NULL');
  });
});
