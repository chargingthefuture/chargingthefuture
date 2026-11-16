import { describe, expect, it } from 'vitest';
import { seOpens30Page } from '@ctf/shared';

describe('3.1 never opens a 3.0 page', () => {
  it('treats every in-app address but the 3.1 screens as a 3.0 page', () => {
    expect(seOpens30Page('/apps/socket-relay')).toBe(true);
    expect(seOpens30Page('/knowledge')).toBe(true);
    expect(seOpens30Page('/admin')).toBe(true);
    expect(seOpens30Page('/survey/quora-account-deletions')).toBe(true);
    expect(seOpens30Page('/')).toBe(false);
    expect(seOpens30Page('/?tab=people&filter=fits')).toBe(false);
    expect(seOpens30Page('/games')).toBe(false);
    expect(seOpens30Page('https://blog.example.org/post')).toBe(false);
    expect(seOpens30Page('//elsewhere.example.org')).toBe(false);
  });
});
