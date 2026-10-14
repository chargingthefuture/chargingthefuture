import { describe, expect, it } from 'vitest';
import { VALUE_EVENT_SOURCES } from './value-events';
import { CONTRIBUTOR_VALUE_EVENT_KEYS, DEFAULT_WEIGHTS, EVENT_SOURCE_PLUGIN, effectiveWeight } from './weights';

const DOLLARS = 'value.contributions_confirmed_usd' as const;
const NON_MONEY = 'value.contributions_non_money_confirmed' as const;

function source(key: string) {
  const found = VALUE_EVENT_SOURCES.find((entry) => entry.key === key);
  if (!found) throw new Error(`no value event source for ${key}`);
  return found;
}

describe('Contributions value events', () => {
  it('sums dollars over gift cards only', () => {
    expect(source(DOLLARS).rowSql).toContain("kind = 'gift_card'");
    expect(source(DOLLARS).occurrences).toBe('sum');
  });

  it('counts comments and stars apart from the dollar sum, never as dollars on the dashboard', () => {
    expect(source(NON_MONEY).rowSql).toContain("kind <> 'gift_card'");
    expect(source(NON_MONEY).occurrences).toBe('rows');
  });

  it('scores comments and stars as they were scored inside the dollar event', () => {
    expect(source(NON_MONEY).aggregate).toBe(source(DOLLARS).aggregate);
    expect(source(NON_MONEY).delivers).toBe(source(DOLLARS).delivers);
    expect(DEFAULT_WEIGHTS[NON_MONEY]).toBe(DEFAULT_WEIGHTS[DOLLARS]);
    expect(EVENT_SOURCE_PLUGIN[NON_MONEY]).toBe(EVENT_SOURCE_PLUGIN[DOLLARS]);
  });

  it('has one source per key', () => {
    expect(VALUE_EVENT_SOURCES.map((entry) => entry.key).sort()).toEqual([...CONTRIBUTOR_VALUE_EVENT_KEYS].sort());
  });
});

describe('effectiveWeight', () => {
  it('falls back to the default with no overrides', () => {
    expect(effectiveWeight(NON_MONEY, {})).toBe(DEFAULT_WEIGHTS[NON_MONEY]);
  });

  it('gives the non-money key the dollar key override when it has none of its own', () => {
    expect(effectiveWeight(NON_MONEY, { [DOLLARS]: 0.25 })).toBe(0.25);
  });

  it('prefers the non-money key own override, including zero', () => {
    expect(effectiveWeight(NON_MONEY, { [DOLLARS]: 0.25, [NON_MONEY]: 0 })).toBe(0);
  });

  it('never applies the non-money override to the dollar key', () => {
    expect(effectiveWeight(DOLLARS, { [NON_MONEY]: 0.5 })).toBe(DEFAULT_WEIGHTS[DOLLARS]);
  });

  it('ignores a non-numeric override', () => {
    expect(effectiveWeight(NON_MONEY, { [DOLLARS]: 'high', [NON_MONEY]: null })).toBe(DEFAULT_WEIGHTS[NON_MONEY]);
  });
});
