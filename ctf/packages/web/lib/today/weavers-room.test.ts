import { beforeEach, describe, expect, it, vi } from 'vitest';

// The Weavers of the Commons room on Today and its Chyme room gate, for an account on demo data and
// for a production account (owner decision, 2026-11-16).
const state = vi.hoisted(() => ({ demo: false, eligible: false, open: false }));
vi.mock('lib/demo-mode/demo-accounts', () => ({ runsOnDemoData: async () => state.demo }));
vi.mock('lib/contributor-access/repository', () => ({
  isMemberEligible: async () => state.eligible,
  getContributorAccessConfig: async () => ({ channelOpen: state.open }),
}));
vi.mock('lib/chyme/repository', () => ({
  getPublicRoomLiveState: vi.fn(),
  readRoomFaces: async () => ({ members: 2, speakers: 1, faces: [] }),
}));
vi.mock('lib/ti-radio/repository', () => ({ getGuide: vi.fn() }));
vi.mock('lib/auth/server-authz', () => ({
  evaluatePluginAccess: async () => ({ allowed: true, userId: 'u1', username: 'u1', isAdmin: false }),
}));
vi.mock('lib/unlock/access', () => ({ getUnlockAccessTier: vi.fn() }));

import { weaversRoom } from './sources-rooms';
import { requireChymeContributorAccess } from '../../app/api/chyme/_lib';
import type { TodayViewer } from './card';

const viewer = { userId: 'u1', isAdmin: false } as TodayViewer;

beforeEach(() => {
  state.demo = false;
  state.eligible = false;
  state.open = false;
});

describe('Weavers room for an account on demo data', () => {
  it('shows on Today and opens in Chyme while the production channel is closed', async () => {
    state.demo = true;
    expect((await weaversRoom(viewer))?.key).toBe('weavers');
    expect((await requireChymeContributorAccess()).allowed).toBe(true);
  });
});

describe('Weavers room for a production account', () => {
  it('stays hidden and answers 404 without the badge, or while the channel is closed', async () => {
    state.open = true;
    expect(await weaversRoom(viewer)).toBeNull();
    const gate = await requireChymeContributorAccess();
    expect(gate.allowed ? 200 : gate.response.status).toBe(404);
    state.open = false;
    state.eligible = true;
    expect(await weaversRoom(viewer)).toBeNull();
    expect((await requireChymeContributorAccess()).allowed).toBe(false);
  });
  it('shows and opens for a badge holder once the channel is open', async () => {
    state.open = true;
    state.eligible = true;
    expect((await weaversRoom(viewer))?.key).toBe('weavers');
    expect((await requireChymeContributorAccess()).allowed).toBe(true);
  });
});
