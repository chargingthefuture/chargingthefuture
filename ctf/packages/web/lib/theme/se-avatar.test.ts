import { describe, expect, it } from 'vitest';
import { seAvatar, seAvatarDataUri, seAvatarSvg } from '@ctf/shared';

describe('generated avatars', () => {
  it('gives the same account the same picture every time', () => {
    expect(seAvatar('user_2abc')).toEqual(seAvatar('user_2abc'));
    expect(seAvatarSvg('user_2abc')).toBe(seAvatarSvg('user_2abc'));
  });

  it('gives different accounts a spread of pictures', () => {
    const pictures = new Set(Array.from({ length: 200 }, (_, i) => JSON.stringify(seAvatar(`user_${i}`))));
    expect(pictures.size).toBeGreaterThan(100);
  });

  it('draws both kinds, landscapes and cut paper', () => {
    const kinds = new Set(Array.from({ length: 50 }, (_, i) => seAvatar(`user_${i}`).kind));
    expect(kinds).toEqual(new Set(['landscape', 'paper']));
  });

  it('writes a data address with nothing taken from the account id', () => {
    const uri = seAvatarDataUri('"><script>alert(1)</script>');
    expect(uri.startsWith('data:image/svg+xml,')).toBe(true);
    expect(decodeURIComponent(uri)).not.toContain('script');
  });
});
