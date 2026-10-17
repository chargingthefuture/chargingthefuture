import { describe, expect, it, vi } from 'vitest';

vi.mock('lib/db/postgres', () => ({ queryDb: vi.fn(), withDbTransaction: vi.fn() }));

import { keepStoredWhenOmitted } from './repository';
import type { LighthousePropertyInput } from './types';

const hidden = { is_active: false, photos: [] };

describe('who may change whether a listing shows (issue #2819)', () => {
  it('ignores a host turning an admin-hidden listing back on', () => {
    const input = { isActive: true } as LighthousePropertyInput;
    expect(keepStoredWhenOmitted(input, hidden, false).isActive).toBe(false);
  });

  it('lets an admin turn it back on', () => {
    const input = { isActive: true } as LighthousePropertyInput;
    expect(keepStoredWhenOmitted(input, hidden, true).isActive).toBe(true);
  });

  it('keeps the stored value when nobody sends one', () => {
    const input = {} as LighthousePropertyInput;
    expect(keepStoredWhenOmitted(input, hidden, true).isActive).toBe(false);
  });
});
