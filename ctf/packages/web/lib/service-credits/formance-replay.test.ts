import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryDb = vi.fn();
vi.mock('lib/db/postgres', () => ({
  queryDb: (...args: unknown[]) => queryDb(...args),
  runWithForcedPool: async (_target: string, fn: () => Promise<unknown>) => fn(),
}));
vi.mock('lib/observability/report', () => ({ reportError: vi.fn() }));

const postTransferToFormance = vi.fn();
const postMintToFormance = vi.fn();
vi.mock('./formance-ledger', () => ({
  FORMANCE_DUPLICATE_REFERENCE: 'external_ledger_duplicate_reference',
  getFormanceConfigStatus: vi.fn(async () => ({ configured: true })),
  postTransferToFormance: (...args: unknown[]) => postTransferToFormance(...args),
  postMintToFormance: (...args: unknown[]) => postMintToFormance(...args),
  postBurnToFormance: vi.fn(),
  postDisputeAdjustmentToFormance: vi.fn(),
  postEscrowHoldToFormance: vi.fn(),
  postEscrowRefundToFormance: vi.fn(),
  postEscrowReleaseToFormance: vi.fn(),
  postTreasuryFeeToFormance: vi.fn(),
}));

import { REPLAYABLE_COMMANDS, replayQueuedFormancePosts } from './formance-replay';

const rows = [
  { id: 'r1', command_name: 'governance.mint.grant', idempotency_key: 'k1', payload: { targetUserId: 'u1', amount: 50, governanceTicketId: 't1' } },
  { id: 'r2', command_name: 'transfer.create', idempotency_key: 'k2', payload: { senderUserId: 'u1', recipientUserId: 'u2', amount: 5 } },
  { id: 'r3', command_name: 'transfer.create', idempotency_key: 'k3', payload: { senderUserId: 'u1', recipientUserId: 'u3', amount: 5 } },
];

function updatesFor(id: string): string[] {
  return queryDb.mock.calls.filter(([sql, params]) => String(sql).includes('UPDATE') && (params as unknown[])[0] === id).map(([sql]) => String(sql));
}

describe('Formance replay (issue #2907)', () => {
  beforeEach(() => {
    queryDb.mockReset();
    postTransferToFormance.mockReset();
    postMintToFormance.mockReset();
    queryDb.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id::text AS id')) return { rows };
      if (sql.includes('COUNT(*)')) return { rows: [{ queued: '1', oldest: null }] };
      return { rows: [], rowCount: 1 };
    });
  });

  it('never re-sends a deletion reclaim, which the reclaim sweep runs', () => {
    expect(REPLAYABLE_COMMANDS).not.toContain('account.deletion.reclaim.execute');
    expect(REPLAYABLE_COMMANDS).toHaveLength(8);
  });

  it('re-sends with the original key, marks delivered, reads a duplicate as recorded, keeps a failure queued', async () => {
    postMintToFormance.mockResolvedValue({ transactionId: 'tx-1' });
    postTransferToFormance
      .mockRejectedValueOnce(new Error('external_ledger_duplicate_reference'))
      .mockRejectedValueOnce(new Error('external_ledger_unavailable'));

    const result = await replayQueuedFormancePosts();

    expect(result).toEqual({ tried: 3, delivered: 1, alreadyRecorded: 1, stillQueued: 1, remaining: 1 });
    expect(postMintToFormance).toHaveBeenCalledWith({ targetUserId: 'u1', amount: 50, governanceTicketId: 't1', idempotencyKey: 'k1' });
    expect(postTransferToFormance).toHaveBeenNthCalledWith(1, { senderUserId: 'u1', recipientUserId: 'u2', amount: 5, idempotencyKey: 'k2' });
    expect(updatesFor('r1')[0]).toContain("status = 'delivered'");
    expect(updatesFor('r2')[0]).toContain("status = 'delivered'");
    expect(updatesFor('r3')[0]).not.toContain("status = 'delivered'");
  });
});
