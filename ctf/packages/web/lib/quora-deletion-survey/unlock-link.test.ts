import { describe, expect, it, vi } from 'vitest';

vi.mock('lib/db/postgres', () => ({ queryDb: vi.fn() }));
vi.mock('lib/shared/unlock-interface', () => ({
  createOrUpdateUnlockSubmission: vi.fn(),
  getUnlockStatusForUser: vi.fn(),
  insertUnlockAudit: vi.fn(),
  normalizeQuoraProfileUrl: vi.fn(),
}));

import { profileUrlForHandle } from './unlock-link';

describe('profileUrlForHandle', () => {
  it('builds a profile address from a handle, spaces as hyphens', () => {
    expect(profileUrlForHandle('Mary T I 1')).toBe('https://www.quora.com/profile/Mary-T-I-1');
    expect(profileUrlForHandle('@Mary-T-I-1')).toBe('https://www.quora.com/profile/Mary-T-I-1');
  });

  it('keeps a handle typed as an address', () => {
    expect(profileUrlForHandle(' https://www.quora.com/profile/Mary-T-I-1 ')).toBe('https://www.quora.com/profile/Mary-T-I-1');
  });
});
