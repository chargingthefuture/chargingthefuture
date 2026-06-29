import { describe, it, expect } from 'vitest';
import { toMinorUnits, ensurePositiveAmount } from './amounts';

// The deterministic money math behind every credit mutation. A rounding or boundary bug here would
// be silent in a glance and in a code read but wrong in the ledger — exactly what a unit test is for.

describe('toMinorUnits', () => {
  it('converts whole and fractional credits to integer minor units', () => {
    expect(toMinorUnits(1)).toBe(100);
    expect(toMinorUnits(2.5)).toBe(250);
    expect(toMinorUnits(0.01)).toBe(1);
  });

  it('rounds to the nearest minor unit', () => {
    expect(toMinorUnits(1.234)).toBe(123);
    expect(toMinorUnits(1.236)).toBe(124);
  });

  it('rejects zero, negative, and non-finite amounts', () => {
    expect(() => toMinorUnits(0)).toThrow('invalid_payload');
    expect(() => toMinorUnits(-1)).toThrow('invalid_payload');
    expect(() => toMinorUnits(Number.NaN)).toThrow('invalid_payload');
    expect(() => toMinorUnits(Number.POSITIVE_INFINITY)).toThrow('invalid_payload');
  });

  it('rejects a positive amount that rounds down to zero minor units', () => {
    expect(() => toMinorUnits(0.004)).toThrow('invalid_payload');
  });
});

describe('ensurePositiveAmount', () => {
  it('accepts any finite, strictly-positive amount', () => {
    expect(() => ensurePositiveAmount(1)).not.toThrow();
    expect(() => ensurePositiveAmount(0.01)).not.toThrow();
  });

  it('rejects zero, negative, and non-finite amounts', () => {
    expect(() => ensurePositiveAmount(0)).toThrow('invalid_payload');
    expect(() => ensurePositiveAmount(-5)).toThrow('invalid_payload');
    expect(() => ensurePositiveAmount(Number.NaN)).toThrow('invalid_payload');
    expect(() => ensurePositiveAmount(Number.NEGATIVE_INFINITY)).toThrow('invalid_payload');
  });
});
