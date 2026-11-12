import { AsyncLocalStorage } from 'node:async_hooks';
import { describe, expect, it, vi } from 'vitest';
import type { SeTodayCard } from '@ctf/shared';

// Which schema each read ran against: 'demo' inside runWithForcedPool('demo', ...), 'public' outside.
const schema = vi.hoisted(() => ({ store: null as AsyncLocalStorage<string> | null, reads: [] as Array<[string, string]> }));

vi.mock('lib/db/postgres', async () => {
  const { AsyncLocalStorage: Storage } = await import('node:async_hooks');
  schema.store = new Storage<string>();
  return { runWithForcedPool: (target: string, fn: () => Promise<unknown>) => schema.store!.run(target, fn) };
});

function readFrom(name: string): string {
  const target = schema.store?.getStore() ?? 'public';
  schema.reads.push([name, target]);
  return target;
}

function stub(id: string): SeTodayCard {
  const [source] = id.split(':');
  return { id, kind: 'story', source, label: '', title: id, body: null, author: { accountId: 'a', handle: 'h' }, createdAtIso: '2026-11-10T10:00:00.000Z', href: '/', actions: [] };
}

vi.mock('lib/observability/report', () => ({ reportError: vi.fn() }));
vi.mock('lib/measures/action-minutes', () => ({
  readDaysWon: vi.fn(async () => ({ total: readFrom('days-won') === 'demo' ? 52 : 999, thisWeek: 3 })),
}));
vi.mock('lib/trust-transport/repository', () => ({
  listAvailableRequests: vi.fn(async () => {
    readFrom('trust-transport');
    return { items: [{ id: 'r1', createdAtIso: '2026-11-10T09:00:00.000Z' }] };
  }),
}));
vi.mock('./sources-offers', () => ({
  cohortOffers: vi.fn(async () => {
    readFrom('skill-up');
    return [stub('skill-up:c1')];
  }),
}));
vi.mock('./sources-live', () => ({
  numbersCard: vi.fn(async () => (readFrom('numbers'), [stub('numbers:1')])),
  replayCards: vi.fn(async () => (readFrom('beacon-replays'), [])),
  wantedCard: vi.fn(async () => (readFrom('skills-hunt'), [stub('skills-hunt:1')])),
  missionCard: vi.fn(async () => (readFrom('skills-hunt-mission'), [])),
  broadcast: vi.fn(async () => null),
}));
vi.mock('./sources-blog', () => ({ blogStories: vi.fn(async () => (readFrom('blog-stories'), [stub('blog-story:a')])) }));
vi.mock('./sources-daily', () => ({ dailyPuzzleCard: vi.fn(async () => []) }));
vi.mock('./sources-rooms', () => ({
  nextTalk: vi.fn(async () => null),
  weekTalks: vi.fn(async () => []),
  mainRoom: vi.fn(async () => (readFrom('chyme'), { key: 'main', name: 'Main Room', live: true, members: 4, guests: 2, speakers: 0, faces: [], href: '/apps/chyme', nextTalk: null })),
}));
vi.mock('./build', () => ({ TODAY_MAX_CARDS: 30 }));

import { buildPublicToday } from './build-public';

describe('signed-out Today', () => {
  it('reads Days won and ride asks from the demo schema, and Skill Up from production, tagging the demo ones as sample', async () => {
    schema.reads.length = 0;
    const today = await buildPublicToday(new Date('2026-11-10T12:00:00.000Z'));
    const where = Object.fromEntries(schema.reads);
    expect(where['days-won']).toBe('demo');
    expect(where['trust-transport']).toBe('demo');
    expect(where['skill-up']).toBe('public');
    expect(today.daysWon).toEqual({ total: 52, thisWeek: 3, sample: true });
    expect(today.cards.find((c) => c.source === 'trust-transport')?.sample).toBe(true);
    expect(today.cards.find((c) => c.source === 'skill-up')?.sample).toBeUndefined();
  });

  it('keeps stories, numbers, SkillsHunt and the room real and untagged', async () => {
    schema.reads.length = 0;
    const today = await buildPublicToday(new Date('2026-11-10T12:00:00.000Z'));
    const where = Object.fromEntries(schema.reads);
    for (const name of ['blog-stories', 'numbers', 'skills-hunt', 'chyme']) expect(where[name]).toBe('public');
    for (const source of ['blog-story', 'numbers', 'skills-hunt']) {
      expect(today.cards.find((c) => c.source === source)?.sample).toBeUndefined();
    }
    expect(today.rooms[0]).toMatchObject({ members: 4, guests: 2, faces: [] });
  });

  it('names nobody on any card', async () => {
    const today = await buildPublicToday(new Date('2026-11-10T12:00:00.000Z'));
    expect(today.cards.every((c) => c.author === null)).toBe(true);
    expect(today.presence).toBeNull();
  });
});
