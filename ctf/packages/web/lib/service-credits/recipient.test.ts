import { describe, it, expect } from 'vitest';
import { resolveTransferRecipientWith, type RecipientDirectory } from './recipient';

// The Send form takes a username or an account id. Only a value that names a real account may be
// credited; anything else must be refused before a wallet row is created for it.

function directory(accounts: Array<{ id: string; username: string | null }>): RecipientDirectory {
  return {
    async findIdsByUserId(userId) {
      return accounts.filter((account) => account.id === userId).map((account) => account.id);
    },
    async findIdsByUsername(username) {
      return accounts.filter((account) => account.username === username).map((account) => account.id);
    },
  };
}

const members = directory([
  { id: 'user_2abc', username: 'ada' },
  { id: 'user_9xyz', username: null },
]);

describe('resolveTransferRecipientWith', () => {
  it('resolves a username to its account id', async () => {
    expect(await resolveTransferRecipientWith(members, 'ada')).toEqual({ status: 'found', userId: 'user_2abc' });
  });

  it('accepts a leading @, surrounding spaces and any letter case', async () => {
    expect(await resolveTransferRecipientWith(members, '  @Ada ')).toEqual({ status: 'found', userId: 'user_2abc' });
  });

  it('accepts an existing account id', async () => {
    expect(await resolveTransferRecipientWith(members, 'user_9xyz')).toEqual({ status: 'found', userId: 'user_9xyz' });
  });

  it('refuses a value no account holds', async () => {
    expect(await resolveTransferRecipientWith(members, 'grace')).toEqual({ status: 'not_found' });
    expect(await resolveTransferRecipientWith(members, 'user_missing')).toEqual({ status: 'not_found' });
    expect(await resolveTransferRecipientWith(members, '  @ ')).toEqual({ status: 'not_found' });
  });

  it('reports the check as unavailable when the lookup fails', async () => {
    const failing: RecipientDirectory = {
      async findIdsByUserId() {
        throw new Error('network');
      },
      async findIdsByUsername() {
        throw new Error('network');
      },
    };
    expect(await resolveTransferRecipientWith(failing, 'ada')).toEqual({ status: 'unavailable' });
  });
});
