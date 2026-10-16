import { describe, expect, it } from 'vitest';
import { FULL_ACCOUNT_CONFIRM_PHRASE, isFullAccountConfirmPhrase } from './constants';

// DELETE /api/account/full-account refuses a request without the phrase the member typed (issue
// #2697). The comparison has to match the screens', or a member who typed it correctly is refused.
describe('isFullAccountConfirmPhrase', () => {
  it('accepts the phrase as the screens accept it: any case, surrounding spaces ignored', () => {
    expect(isFullAccountConfirmPhrase(FULL_ACCOUNT_CONFIRM_PHRASE)).toBe(true);
    expect(isFullAccountConfirmPhrase('  Delete My Account ')).toBe(true);
  });

  it('refuses a missing, empty, different or non-text phrase', () => {
    expect(isFullAccountConfirmPhrase(undefined)).toBe(false);
    expect(isFullAccountConfirmPhrase('')).toBe(false);
    expect(isFullAccountConfirmPhrase('delete my acount')).toBe(false);
    expect(isFullAccountConfirmPhrase(['delete my account'])).toBe(false);
  });
});
