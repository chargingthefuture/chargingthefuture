import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query, release, reportError } = vi.hoisted(() => ({
  query: vi.fn(),
  release: vi.fn(),
  reportError: vi.fn(),
}));

vi.mock('pg', () => ({
  Pool: class {
    connect() {
      return Promise.resolve({ query, release });
    }
  },
}));

vi.mock('../observability/report', () => ({ reportError }));

import { runWithForcedPool, withDbTransaction } from './postgres';

describe('withDbTransaction', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = 'postgres://test';
    query.mockReset();
    release.mockReset();
    reportError.mockReset();
  });

  it('releases the client normally after a rollback that succeeds', async () => {
    query.mockResolvedValue({ rows: [] });
    const cause = new Error('duplicate key value violates unique constraint');
    await expect(
      runWithForcedPool('public', () => withDbTransaction(async () => Promise.reject(cause))),
    ).rejects.toBe(cause);
    expect(query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalledWith(undefined);
    expect(reportError).not.toHaveBeenCalled();
  });

  it('rethrows the original error, reports the rollback failure and discards the client', async () => {
    const rollbackFailure = new Error('Client was closed and is not queryable');
    query.mockImplementation((text: string) =>
      text === 'ROLLBACK' ? Promise.reject(rollbackFailure) : Promise.resolve({ rows: [] }),
    );
    const cause = new Error('Connection terminated unexpectedly');
    await expect(
      runWithForcedPool('public', () => withDbTransaction(async () => Promise.reject(cause))),
    ).rejects.toBe(cause);
    expect(reportError).toHaveBeenCalledWith(rollbackFailure, { area: 'db', op: 'transaction_rollback' });
    expect(release).toHaveBeenCalledWith(rollbackFailure);
  });
});
