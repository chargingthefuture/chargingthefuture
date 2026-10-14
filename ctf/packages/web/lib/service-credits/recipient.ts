import { createClerkClient } from '@clerk/backend';
import { getClerkSecretKey } from 'lib/auth/clerk-env';

// Resolve what a member typed in the Send form's recipient field to a real account id before any
// credits move. The field accepts a username (with or without a leading @) or an account id. Clerk is
// the authoritative account and username store, so both forms are checked there; a value no account
// holds is refused rather than credited to a wallet nobody can sign in as.
//
// 'unavailable' means the check itself could not run (no Clerk key in this runtime, or the call
// failed). The caller refuses the send in that case too: crediting an unchecked value is the defect
// this exists to prevent.

export type TransferRecipientLookup =
  | { status: 'found'; userId: string }
  | { status: 'not_found' }
  | { status: 'unavailable' };

// The two Clerk reads this needs, so the resolution rules can be tested without a Clerk account.
export type RecipientDirectory = {
  findIdsByUserId(userId: string): Promise<string[]>;
  findIdsByUsername(username: string): Promise<string[]>;
};

const ACCOUNT_ID_PREFIX = 'user_';

export async function resolveTransferRecipientWith(
  directory: RecipientDirectory,
  typed: string,
): Promise<TransferRecipientLookup> {
  const value = typed.trim().replace(/^@/, '').trim();
  if (value.length === 0) {
    return { status: 'not_found' };
  }

  try {
    if (value.startsWith(ACCOUNT_ID_PREFIX)) {
      const byId = await directory.findIdsByUserId(value);
      if (byId.includes(value)) {
        return { status: 'found', userId: value };
      }
    }

    const byUsername = await directory.findIdsByUsername(value.toLowerCase());
    // A username names one account; anything else is not a match we can act on.
    if (byUsername.length === 1 && byUsername[0]) {
      return { status: 'found', userId: byUsername[0] };
    }
    return { status: 'not_found' };
  } catch {
    // no-trace: the caller maps 'unavailable' to a 503 that names the failed check
    return { status: 'unavailable' };
  }
}

function clerkRecipientDirectory(): RecipientDirectory | null {
  const secretKey = getClerkSecretKey();
  if (!secretKey) {
    return null;
  }
  const client = createClerkClient({ secretKey });
  return {
    async findIdsByUserId(userId) {
      const response = await client.users.getUserList({ userId: [userId], limit: 1 });
      return response.data.map((user) => user.id);
    },
    async findIdsByUsername(username) {
      const response = await client.users.getUserList({ username: [username], limit: 2 });
      return response.data.map((user) => user.id);
    },
  };
}

export async function resolveTransferRecipient(typed: string): Promise<TransferRecipientLookup> {
  let directory: RecipientDirectory | null;
  try {
    directory = clerkRecipientDirectory();
  } catch {
    // no-trace: a Clerk client that cannot be built is reported as 'unavailable' by the caller
    return { status: 'unavailable' };
  }
  if (!directory) {
    return { status: 'unavailable' };
  }
  return resolveTransferRecipientWith(directory, typed);
}
