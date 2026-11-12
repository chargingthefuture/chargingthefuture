import { describe, expect, it } from 'vitest';
import { seHasLink } from '@ctf/shared';

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
