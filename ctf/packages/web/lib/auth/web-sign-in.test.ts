import { describe, expect, it } from 'vitest';
import { safeNextPath, webSignInPath } from './web-sign-in';

describe('safeNextPath', () => {
  it('keeps a path on this site', () => {
    expect(safeNextPath('/apps/directory?tab=2')).toBe('/apps/directory?tab=2');
  });

  it('sends anything that could leave the site to the home page', () => {
    for (const next of ['https://evil.example', '//evil.example', '/\\evil.example', 'apps', '', null, 42, '/a\nb']) {
      expect(safeNextPath(next)).toBe('/');
    }
  });

  it('never points back at the hand-off page', () => {
    expect(safeNextPath('/auth/handoff?next=/x')).toBe('/');
  });
});

describe('webSignInPath', () => {
  it('puts the token after the # so it never reaches the server', () => {
    const path = webSignInPath('/apps/mood', 'tok_123');
    expect(path).toBe('/auth/handoff?next=%2Fapps%2Fmood#ticket=tok_123');
    expect(path.split('#')[0]).not.toContain('tok_123');
  });
});
