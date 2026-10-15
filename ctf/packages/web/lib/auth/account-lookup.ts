import { createClerkClient } from '@clerk/backend';
import { getClerkSecretKey } from './clerk-env';
import { reportError } from 'lib/observability/report';

// Does an account with this id exist? Asked before an admin restriction is written, so a mistyped
// id, or one pasted with a stray character, is refused instead of being reported as a restriction
// while the real account keeps full access.
//
// The sign-in provider is asked rather than a table here: v3 has no central accounts table (`users`
// is not in schema.sql and does not exist in every environment), and the provider is the one place
// every account is recorded.
//
// Three answers, not two. `not_found` means the provider answered and has no such account, which is
// the only answer the caller refuses on. `unverifiable` means the question could not be asked (no
// key in this runtime, or the call failed): an admin restricting an account during an outage at the
// provider must still be able to, so the caller carries on and says the id was not checked.
export type AccountLookup = 'found' | 'not_found' | 'unverifiable';

export async function lookUpAccount(userId: string): Promise<AccountLookup> {
  const secretKey = getClerkSecretKey();
  if (!secretKey) return 'unverifiable';
  try {
    const client = createClerkClient({ secretKey });
    const response = await client.users.getUserList({ userId: [userId], limit: 1 });
    return response.data.some((user) => user.id === userId) ? 'found' : 'not_found';
  } catch (error) {
    reportError(error, { area: 'account-restrictions', op: 'look_up_account' });
    return 'unverifiable';
  }
}
