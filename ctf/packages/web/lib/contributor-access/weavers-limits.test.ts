import { describe, expect, it, vi } from 'vitest';
import { seBringIn, seHasLink } from '@ctf/shared';

const eligible = vi.hoisted(() => ({ value: false }));
vi.mock('./repository', () => ({ isMemberEligible: async () => eligible.value }));

import { refuseNewPicturesUnlessWeaver } from './weavers-limits';

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

describe('seBringIn', () => {
  it('shows the button to a holder in the Main Room, the line to anybody else there, nothing elsewhere', () => {
    expect(seBringIn('main', true)).toBe('button');
    expect(seBringIn('main', false)).toBe('weavers_only');
    expect(seBringIn('main', undefined)).toBe('weavers_only');
    expect(seBringIn('back-channel', true)).toBe('none');
    expect(seBringIn(null, false)).toBe('none');
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
