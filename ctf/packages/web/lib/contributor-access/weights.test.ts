import { describe, expect, it } from 'vitest';
import { VALUE_EVENT_SOURCES } from './value-events';
import { CONTRIBUTOR_VALUE_EVENT_KEYS, DEFAULT_WEIGHTS, effectiveWeight } from './weights';

const DOLLARS = 'value.contributions_confirmed_usd' as const;

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

  it('has no event for Quora comments or GitHub stars', () => {
    expect(CONTRIBUTOR_VALUE_EVENT_KEYS).not.toContain('value.contributions_non_money_confirmed');
    expect(VALUE_EVENT_SOURCES.some((entry) => entry.rowSql.includes("kind <> 'gift_card'"))).toBe(false);
  });

  it('has one source per key', () => {
    expect(VALUE_EVENT_SOURCES.map((entry) => entry.key).sort()).toEqual([...CONTRIBUTOR_VALUE_EVENT_KEYS].sort());
  });
});

describe('SocketRelay value events', () => {
  const relay = () => source('value.socket_relay_requests_fulfilled');

  it('counts a 3.1 ask closed from Today as done with a named helper, credited to the helper', () => {
    expect(relay().tables).toEqual(['socket_relay_fulfillments', 'today_card_windows']);
    expect(relay().rowSql).toContain('SELECT helper_user_id AS member_id');
    expect(relay().rowSql).toContain("card_id LIKE 'socket-relay:%'");
    expect(relay().rowSql).toContain("outcome = 'done'");
  });

  it('never credits a deleted account or the asker themselves', () => {
    expect(relay().rowSql).toContain("helper_user_id <> 'deleted_member'");
    expect(relay().rowSql).toContain('helper_user_id <> owner_user_id');
  });
});

describe('effectiveWeight', () => {
  it('falls back to the default with no overrides', () => {
    expect(effectiveWeight(DOLLARS, {})).toBe(DEFAULT_WEIGHTS[DOLLARS]);
  });

  it('uses a saved override, including zero', () => {
    expect(effectiveWeight(DOLLARS, { [DOLLARS]: 0 })).toBe(0);
  });

  it('ignores a non-numeric override', () => {
    expect(effectiveWeight(DOLLARS, { [DOLLARS]: 'high' })).toBe(DEFAULT_WEIGHTS[DOLLARS]);
  });
});
