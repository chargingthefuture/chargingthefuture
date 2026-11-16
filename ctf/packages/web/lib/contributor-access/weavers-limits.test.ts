import { beforeEach, describe, expect, it, vi } from 'vitest';
import { seHasLink } from '@ctf/shared';

const eligible = vi.hoisted(() => ({ value: false }));
const demo = vi.hoisted(() => ({ value: false }));
const channel = vi.hoisted(() => ({ open: false }));
vi.mock('./repository', () => ({
  isMemberEligible: async () => eligible.value,
  getContributorAccessConfig: async () => ({ channelOpen: channel.open }),
}));
vi.mock('lib/demo-mode/demo-accounts', () => ({ runsOnDemoData: async () => demo.value }));

import {
  canEnterWeaversRoom,
  holdsWeaversBadge,
  refuseLinkUnlessWeaver,
  refuseNewPicturesUnlessWeaver,
  refuseUnlessWeaver,
} from './weavers-limits';

beforeEach(() => {
  eligible.value = false;
  demo.value = false;
  channel.open = false;
});

describe('seHasLink', () => {
  it('finds addresses', () => {
    expect(seHasLink('see https://example.org/a')).toBe(true);
    expect(seHasLink('www.example.org')).toBe(true);
    expect(seHasLink('go to example.com now')).toBe(true);
    expect(seHasLink('example.com/path')).toBe(true);
  });
  it('leaves plain words alone', () => {
    expect(seHasLink('I can help on Tuesday.')).toBe(false);
    expect(seHasLink('e.g. a ride. Then lunch.')).toBe(false);
    expect(seHasLink('')).toBe(false);
  });
});

describe('refuseNewPicturesUnlessWeaver', () => {
  it('refuses a new photo from a member without the badge', async () => {
    eligible.value = false;
    const res = await refuseNewPicturesUnlessWeaver('u1', ['a.jpg']);
    expect(res?.status).toBe(403);
    expect(((await res?.json()) as { code: string }).code).toBe('weavers_only');
  });
  it('lets an edit keep photos already on the listing', async () => {
    eligible.value = false;
    expect(await refuseNewPicturesUnlessWeaver('u1', ['a.jpg'], ['a.jpg', 'b.jpg'])).toBeNull();
    expect(await refuseNewPicturesUnlessWeaver('u1', [])).toBeNull();
  });
  it('lets a badge holder add photos', async () => {
    eligible.value = true;
    expect(await refuseNewPicturesUnlessWeaver('u1', ['c.jpg'], ['a.jpg'])).toBeNull();
  });
});

// Owner decision, 2026-11-16: an account on demo data sees every feature as a badge holder would.
describe('an account on demo data counts as a Weavers badge holder', () => {
  it('passes every badge check for a demo account without the badge', async () => {
    demo.value = true;
    expect(await holdsWeaversBadge('u_demo')).toBe(true);
    expect(await refuseUnlessWeaver('u_demo', 'invite')).toBeNull();
    expect(await refuseUnlessWeaver('u_demo', 'picture')).toBeNull();
    expect(await refuseLinkUnlessWeaver('u_demo', 'see https://example.org')).toBeNull();
    expect(await refuseNewPicturesUnlessWeaver('u_demo', ['a.jpg'])).toBeNull();
  });
  it('still refuses a production account without the badge', async () => {
    expect(await holdsWeaversBadge('u1')).toBe(false);
    expect((await refuseUnlessWeaver('u1', 'invite'))?.status).toBe(403);
    expect((await refuseUnlessWeaver('u1', 'picture'))?.status).toBe(403);
    expect((await refuseLinkUnlessWeaver('u1', 'see https://example.org'))?.status).toBe(403);
    expect((await refuseNewPicturesUnlessWeaver('u1', ['a.jpg']))?.status).toBe(403);
  });
});

describe('canEnterWeaversRoom', () => {
  it('opens the room to a demo account while the production channel is closed', async () => {
    demo.value = true;
    expect(await canEnterWeaversRoom('u_demo', false)).toBe(true);
  });
  it('keeps the room shut for a production account while the channel is closed', async () => {
    eligible.value = true;
    expect(await canEnterWeaversRoom('u1', true)).toBe(false);
  });
  it('lets a production badge holder or admin in once the channel is open, and nobody else', async () => {
    channel.open = true;
    expect(await canEnterWeaversRoom('u1', false)).toBe(false);
    expect(await canEnterWeaversRoom('u1', true)).toBe(true);
    eligible.value = true;
    expect(await canEnterWeaversRoom('u1', false)).toBe(true);
  });
});
