import { beforeEach, describe, expect, it, vi } from 'vitest';

const insertServiceCreditsAudit = vi.fn();
const reportError = vi.fn();

vi.mock('./repository', () => ({ insertServiceCreditsAudit: (...args: unknown[]) => insertServiceCreditsAudit(...args) }));
vi.mock('../observability/report', () => ({ reportError: (...args: unknown[]) => reportError(...args) }));
vi.mock('../auth/server-authz', () => ({ evaluatePluginAccess: vi.fn() }));
vi.mock('./policy', () => ({ ensureServiceCreditsAdmin: vi.fn() }));

import { auditServiceCreditsFailure, serviceCreditsErrorResponse } from './_lib';

const base = { actorId: 'user_a', command: 'service-credits.transfer.create', targetType: 'wallet', targetId: 'user_b' };

describe('auditServiceCreditsFailure', () => {
  beforeEach(() => {
    insertServiceCreditsAudit.mockReset();
    reportError.mockReset();
  });

  it('records a known refusal as a deny row with its code as the reason', async () => {
    await auditServiceCreditsFailure({ ...base, error: new Error('insufficient_balance') });
    expect(insertServiceCreditsAudit).toHaveBeenCalledWith(
      expect.objectContaining({ policyStatus: 'deny', reason: 'insufficient_balance', metadata: { result: 'failure' } }),
    );
  });

  it('records an unexpected error as a failure without the error text', async () => {
    await auditServiceCreditsFailure({ ...base, error: new Error('relation "x" does not exist') });
    expect(insertServiceCreditsAudit).toHaveBeenCalledWith(
      expect.objectContaining({ policyStatus: 'allow', reason: 'failed', metadata: { result: 'failure' } }),
    );
  });

  it('never throws when the audit write fails, and reports it', async () => {
    insertServiceCreditsAudit.mockRejectedValueOnce(new Error('audit table down'));
    await expect(auditServiceCreditsFailure({ ...base, error: new Error('self_transfer') })).resolves.toBeUndefined();
    expect(reportError).toHaveBeenCalledTimes(1);
  });
});

describe('serviceCreditsErrorResponse', () => {
  it.each([
    ['not_found', 404],
    ['invalid_state', 409],
    ['transfer_conflict', 409],
    ['self_transfer', 400],
    ['dispute_case_not_found', 404],
    ['dispute_parties_mismatch', 409],
    ['dispute_forbidden', 403],
  ])('maps %s to %i instead of a 500', (code, status) => {
    expect(serviceCreditsErrorResponse(new Error(code), 'fallback').status).toBe(status);
  });

  it('answers an unknown error with the fallback 500', () => {
    expect(serviceCreditsErrorResponse(new Error('boom'), 'fallback').status).toBe(500);
  });
});
