import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryDb = vi.fn();
vi.mock('lib/db/postgres', () => ({ queryDb: (...args: unknown[]) => queryDb(...args), withDbTransaction: vi.fn() }));
vi.mock('lib/auth/account-restrictions', () => ({
  getAccountRestrictionStatus: vi.fn(async () => ({ isRestricted: false })),
}));
vi.mock('./stream', () => ({ ensureTrustTransportTripChannel: vi.fn() }));
vi.mock('lib/presence/live', () => ({ clearMemberPresence: vi.fn(), recordMemberPresence: vi.fn() }));

import { createOffer, getMarketConfig } from './repository';

function answer(config: Record<string, unknown>, activeTrips: number) {
  queryDb.mockImplementation(async (raw: unknown) => {
    const sql = typeof raw === 'string' ? raw : JSON.stringify(raw ?? '');
    if (sql.includes('trust_transport_market_config')) return { rows: [{ config }], rowCount: 1 };
    if (sql.includes('COUNT(*)::int AS count')) return { rows: [{ count: activeTrips }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  });
}

describe('TrustTransport market controls (issue #2858)', () => {
  beforeEach(() => queryDb.mockReset());

  it('reads an unset freeze, and the old default-on key, as off', async () => {
    answer({}, 0);
    expect((await getMarketConfig()).emergencyFreezeEnabled).toBe(false);
    answer({ emergencyFreezeEnabled: true }, 0);
    expect((await getMarketConfig()).emergencyFreezeEnabled).toBe(false);
  });

  it('refuses a new offer while the freeze is on', async () => {
    answer({ emergencyFreezeActive: true, maxConcurrentTrips: 3 }, 0);
    await expect(createOffer('req-1', 'driver-1', { note: null, proposedAmount: null })).rejects.toThrow('market_frozen');
  });

  it('refuses a new offer from a driver already at the limit', async () => {
    answer({ emergencyFreezeActive: false, maxConcurrentTrips: 2 }, 2);
    await expect(createOffer('req-1', 'driver-1', { note: null, proposedAmount: null })).rejects.toThrow('trip_limit_reached');
  });

  it('lets a driver under the limit through to the request checks', async () => {
    answer({ emergencyFreezeActive: false, maxConcurrentTrips: 2 }, 1);
    await expect(createOffer('req-1', 'driver-1', { note: null, proposedAmount: null })).rejects.toThrow('request_not_found');
  });
});
