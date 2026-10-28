import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryDb = vi.fn();
vi.mock('lib/db/postgres', () => ({ queryDb: (...args: unknown[]) => queryDb(...args) }));

import { getUserUiPreferences, setUserUiPreferences } from './ui-preferences-repository';

describe('user UI preferences', () => {
  beforeEach(() => queryDb.mockReset());

  it('reads 3.1 and the default theme when the member has no row', async () => {
    queryDb.mockResolvedValue({ rows: [] });
    await expect(getUserUiPreferences('user_1')).resolves.toEqual({ theme: 'default', interfaceVersion: '3.1' });
  });

  it('reads a saved 3.1', async () => {
    queryDb.mockResolvedValue({ rows: [{ theme: 'comic', interface_version: '3.1' }] });
    await expect(getUserUiPreferences('user_1')).resolves.toEqual({ theme: 'comic', interfaceVersion: '3.1' });
  });

  it('treats an unknown stored version as 3.1, the default', async () => {
    queryDb.mockResolvedValue({ rows: [{ theme: 'default', interface_version: '9.9' }] });
    await expect(getUserUiPreferences('user_1')).resolves.toMatchObject({ interfaceVersion: '3.1' });
  });

  it('saving only the interface leaves the theme to the stored value', async () => {
    queryDb.mockResolvedValue({ rows: [{ theme: 'comic', interface_version: '3.1' }] });
    const saved = await setUserUiPreferences('user_1', { interfaceVersion: '3.1' });
    expect(queryDb.mock.calls[0][1]).toEqual(['user_1', null, '3.1']);
    expect(saved).toEqual({ theme: 'comic', interfaceVersion: '3.1' });
  });
});
