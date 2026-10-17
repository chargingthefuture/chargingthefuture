import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('lib/feature-flags', () => ({ isDemoMode: vi.fn(async () => false) }));

import { FORMANCE_DUPLICATE_REFERENCE, postTransferToFormance } from './formance-ledger';

const input = { senderUserId: 'u1', recipientUserId: 'u2', amount: 5, idempotencyKey: 'k1' };

describe('a reused Formance reference (issue #2907)', () => {
  beforeEach(() => {
    process.env.FORMANCE_API_URL = 'https://formance.test';
    process.env.FORMANCE_LEDGER = 'main';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.FORMANCE_API_URL;
    delete process.env.FORMANCE_LEDGER;
  });

  it('is told apart from an outage, for a 409 and for a CONFLICT error code', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 409 })));
    await expect(postTransferToFormance(input)).rejects.toThrow(FORMANCE_DUPLICATE_REFERENCE);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ errorCode: 'CONFLICT' }), { status: 400 })));
    await expect(postTransferToFormance(input)).rejects.toThrow(FORMANCE_DUPLICATE_REFERENCE);
  });

  it('still reads any other refusal as the ledger being unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ errorCode: 'INSUFFICIENT_FUND' }), { status: 400 })));
    await expect(postTransferToFormance(input)).rejects.toThrow('external_ledger_unavailable');
  });
});
