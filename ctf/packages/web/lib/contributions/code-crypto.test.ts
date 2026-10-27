import { afterEach, describe, expect, it } from 'vitest';
import { codeEncryptionReady, decryptGiftCardCode, encryptGiftCardCode } from './code-crypto';
import { isValidGiftCardAmount, normalizeGiftCardCode } from './repository';

const KEY = 'a-long-random-password-of-more-than-32-characters';
const original = process.env.CONTRIBUTIONS_CODE_KEY;

afterEach(() => {
  if (original === undefined) delete process.env.CONTRIBUTIONS_CODE_KEY;
  else process.env.CONTRIBUTIONS_CODE_KEY = original;
});

describe('gift card code sealing', () => {
  it('is paused without a long enough key', () => {
    delete process.env.CONTRIBUTIONS_CODE_KEY;
    expect(codeEncryptionReady()).toBe(false);
    expect(() => encryptGiftCardCode('ABCD-EFGHIJ-KLMN', 'user_1')).toThrow('contributions_paused');
    process.env.CONTRIBUTIONS_CODE_KEY = 'short';
    expect(codeEncryptionReady()).toBe(false);
  });

  it('round-trips for the same member and never stores the code in clear', () => {
    process.env.CONTRIBUTIONS_CODE_KEY = KEY;
    const sealed = encryptGiftCardCode('ABCD-EFGHIJ-KLMN', 'user_1');
    expect(sealed).not.toContain('ABCD');
    expect(sealed.startsWith('v1.')).toBe(true);
    expect(decryptGiftCardCode(sealed, 'user_1')).toEqual({ ok: true, code: 'ABCD-EFGHIJ-KLMN' });
  });

  it('does not open on another member or after the key changes', () => {
    process.env.CONTRIBUTIONS_CODE_KEY = KEY;
    const sealed = encryptGiftCardCode('ABCD-EFGHIJ-KLMN', 'user_1');
    expect(decryptGiftCardCode(sealed, 'user_2').ok).toBe(false);
    process.env.CONTRIBUTIONS_CODE_KEY = `${KEY}-changed`;
    expect(decryptGiftCardCode(sealed, 'user_1').ok).toBe(false);
  });
});

describe('gift card input', () => {
  it('takes whole dollars from 1 to 500', () => {
    expect(isValidGiftCardAmount(10)).toBe(true);
    expect(isValidGiftCardAmount(0)).toBe(false);
    expect(isValidGiftCardAmount(501)).toBe(false);
    expect(isValidGiftCardAmount(10.5)).toBe(false);
  });

  it('cleans spaces and case, and refuses what is not a code', () => {
    expect(normalizeGiftCardCode(' abcd efghij klmn ')).toBe('ABCDEFGHIJKLMN');
    expect(normalizeGiftCardCode('abc')).toBeNull();
    expect(normalizeGiftCardCode('<script>')).toBeNull();
  });
});
