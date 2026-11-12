import { describe, expect, it } from 'vitest';
import { ErrorCode, StandardResolutionReasons } from '@openfeature/server-sdk';
import { flagAnswered } from './server';

describe('flagAnswered', () => {
  it('counts a targeting match or a static value as an answer', () => {
    expect(flagAnswered(StandardResolutionReasons.TARGETING_MATCH, undefined)).toBe(true);
    expect(flagAnswered(StandardResolutionReasons.STATIC, undefined)).toBe(true);
  });

  it('does not count a default, an error, the no-op provider or a missing reason', () => {
    expect(flagAnswered(StandardResolutionReasons.DEFAULT, undefined)).toBe(false);
    expect(flagAnswered(StandardResolutionReasons.ERROR, ErrorCode.GENERAL)).toBe(false);
    expect(flagAnswered('No-op', undefined)).toBe(false);
    expect(flagAnswered(undefined, undefined)).toBe(false);
    expect(flagAnswered(StandardResolutionReasons.TARGETING_MATCH, ErrorCode.PROVIDER_NOT_READY)).toBe(false);
  });
});
