import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryDb = vi.fn();
const getOrCreateWallet = vi.fn();
vi.mock('lib/db/postgres', () => ({ queryDb: (...args: unknown[]) => queryDb(...args), withDbTransaction: vi.fn(async () => ({ trip: {}, request: {} })) }));
vi.mock('lib/shared/credits-interface', () => ({ createTransfer: vi.fn(), getOrCreateWallet: (...args: unknown[]) => getOrCreateWallet(...args) }));
vi.mock('lib/auth/account-restrictions', () => ({ getAccountRestrictionStatus: vi.fn(async () => ({ isRestricted: false })) }));
vi.mock('./stream', () => ({ ensureTrustTransportTripChannel: vi.fn() }));
vi.mock('lib/presence/live', () => ({ clearMemberPresence: vi.fn(), recordMemberPresence: vi.fn() }));

import { acceptOffer } from './repository';
import { InsufficientTripCreditsError } from './errors';

const now = new Date('2026-10-17T00:00:00.000Z');

function requestRow(currency: string, amount: number | null) {
  return {
    id: 'req-1', requester_user_id: 'rider-1', mode: 'ride', title: 't', details: 'd', pickup_city: null, dropoff_city: null,
    pickup_geo_redacted: null, dropoff_geo_redacted: null, status: 'open', price_amount: amount, price_currency: currency,
    created_at: now, updated_at: now,
  };
}

function answer(currency: string, amount: number | null) {
  queryDb.mockImplementation(async (raw: unknown) => {
    const sql = typeof raw === 'string' ? raw : '';
    if (sql.includes('FROM trust_transport_requests')) return { rows: [requestRow(currency, amount)], rowCount: 1 };
    if (sql.includes('trust_transport_market_config')) return { rows: [{ config: {} }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  });
}

describe('accepting a ServiceCredits offer checks the requester can pay (issue #2866)', () => {
  beforeEach(() => {
    queryDb.mockReset();
    getOrCreateWallet.mockReset();
  });

  it('refuses when the requester has fewer credits than the trip settles for', async () => {
    answer('SC', 10);
    getOrCreateWallet.mockResolvedValue({ availableBalance: 4 });
    const result = acceptOffer('req-1', 'offer-1', 'rider-1', 'key-1');
    await expect(result).rejects.toBeInstanceOf(InsufficientTripCreditsError);
    await expect(result).rejects.toMatchObject({ available: 4, needed: 10 });
  });

  it('lets a requester with enough credits through', async () => {
    answer('SC', 10);
    getOrCreateWallet.mockResolvedValue({ availableBalance: 10 });
    await expect(acceptOffer('req-1', 'offer-1', 'rider-1', 'key-1')).resolves.toBeDefined();
  });

  it('does not check a trip settled outside the app', async () => {
    answer('USD', 10);
    await expect(acceptOffer('req-1', 'offer-1', 'rider-1', 'key-1')).resolves.toBeDefined();
    expect(getOrCreateWallet).not.toHaveBeenCalled();
  });
});
