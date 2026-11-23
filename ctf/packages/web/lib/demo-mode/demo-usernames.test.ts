import { describe, expect, it } from 'vitest';
import { demoHelperUsername } from './demo-usernames';

describe('demoHelperUsername', () => {
  it('names a seeded helper account', () => {
    expect(demoHelperUsername('demo-peer-foundation-01')).toBe('saya_r');
    expect(demoHelperUsername('demo-peer-lighthouse-03')).toBe('tombe_p');
  });

  it('names nobody else', () => {
    expect(demoHelperUsername('user_2abc')).toBeNull();
    expect(demoHelperUsername('demo-peer-foundation-07')).toBeNull();
    expect(demoHelperUsername('toString')).toBeNull();
  });
});
