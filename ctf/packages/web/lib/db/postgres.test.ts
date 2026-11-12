import { beforeEach, describe, expect, it, vi } from 'vitest';

// Which pool a query reaches. The pools are told apart by the search_path the demo pool sets.
const queries = vi.hoisted(() => ({ demo: 0, public: 0 }));
const demoMode = vi.hoisted(() => ({ on: false, asked: 0 }));

vi.mock('pg', () => ({
  Pool: class {
    private readonly demo: boolean;
    constructor(config: { options?: string }) {
      this.demo = Boolean(config.options?.includes('search_path=demo'));
    }
    async query() {
      if (this.demo) queries.demo += 1;
      else queries.public += 1;
      return { rows: [] };
    }
  },
}));

vi.mock('../demo-mode/demo-accounts', () => ({
  isDemoMode: vi.fn(async () => {
    demoMode.asked += 1;
    return demoMode.on;
  }),
}));

import { queryDb, runWithForcedPool } from './postgres';

beforeEach(() => {
  process.env.DATABASE_URL = 'postgres://example/test';
  queries.demo = 0;
  queries.public = 0;
  demoMode.on = false;
  demoMode.asked = 0;
});

describe('pool selection', () => {
  it('sends a signed-out read pinned to demo to the demo schema without asking the demo list', async () => {
    await runWithForcedPool('demo', () => queryDb('SELECT 1'));
    expect(queries).toEqual({ demo: 1, public: 0 });
    expect(demoMode.asked).toBe(0);
  });

  it('keeps a read pinned to public on public even for an account on the demo list', async () => {
    demoMode.on = true;
    await runWithForcedPool('public', () => queryDb('SELECT 1'));
    expect(queries).toEqual({ demo: 0, public: 1 });
    expect(demoMode.asked).toBe(0);
  });

  it('follows the demo list when nothing is pinned', async () => {
    demoMode.on = true;
    await queryDb('SELECT 1');
    demoMode.on = false;
    await queryDb('SELECT 1');
    expect(queries).toEqual({ demo: 1, public: 1 });
  });
});
