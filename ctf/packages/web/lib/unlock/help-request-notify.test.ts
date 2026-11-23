import { describe, expect, it } from 'vitest';
import { isAdminAccountMetadata } from './help-request-notify';

describe('who counts as an admin for the help-request alert', () => {
  it('reads the role from the account metadata, in any case', () => {
    expect(isAdminAccountMetadata({ role: 'admin' })).toBe(true);
    expect(isAdminAccountMetadata({ role: ' Admin ' })).toBe(true);
  });

  it('leaves out everybody else', () => {
    expect(isAdminAccountMetadata({ role: 'member' })).toBe(false);
    expect(isAdminAccountMetadata({})).toBe(false);
    expect(isAdminAccountMetadata(null)).toBe(false);
    expect(isAdminAccountMetadata({ role: 1 })).toBe(false);
  });
});
