import { createClerkClient } from '@clerk/backend';
import { getClerkSecretKey } from 'lib/auth/clerk-env';
import { failureReason } from 'lib/errors/failure';

// Banning and un-banning an account at the auth provider.
//
// Blocking somebody used to be a row in our own database and nothing else: `review_status` went to
// spam, `access_tier` dropped, and the app stopped letting them in. That was the entire gate while the
// app was the only thing the provider fronted. It is not any more — anything else signing people in
// through the same provider asks the provider, not us, and the provider was still answering yes.
//
// So a blocking decision now bans the account itself. One decision on one screen, and the person is
// out of everything, which is the only version that does not need somebody to remember a second step.
//
// A ban is not a deletion. The account stays, so the record of who arrived stays countable and the
// ban can be lifted: every non-blocking decision calls the unban below, which keeps the existing
// promise that a spam mark is reversible.

export type ProviderBanOutcome =
  | { ok: true }
  | { ok: false; reason: string };

function providerClient(): ReturnType<typeof createClerkClient> | null {
  const secretKey = getClerkSecretKey();
  if (!secretKey) return null;
  return createClerkClient({ secretKey });
}

// Stop this account signing in anywhere the provider fronts. Never throws: the caller has already
// committed the review decision, and a provider outage must not roll that back or fail the request.
// The outcome is returned instead of swallowed so the caller can record it and the admin page can
// show that the ban did not take — a ban an admin believes in but that never happened is worse than
// a visible failure.
export async function banAccountWithProvider(userId: string): Promise<ProviderBanOutcome> {
  const client = providerClient();
  if (!client) {
    return { ok: false, reason: 'the auth provider secret key is not set in this runtime, so the account could not be banned' };
  }

  try {
    await client.users.banUser(userId);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: `the auth provider refused the ban — ${failureReason(error)}` };
  }
}

// Let this account sign in again. Called on every non-blocking review decision, so correcting a wrong
// spam mark restores access without an admin touching the provider dashboard. Never throws, for the
// same reason as the ban above.
export async function unbanAccountWithProvider(userId: string): Promise<ProviderBanOutcome> {
  const client = providerClient();
  if (!client) {
    return { ok: false, reason: 'the auth provider secret key is not set in this runtime, so the ban could not be lifted' };
  }

  try {
    await client.users.unbanUser(userId);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: `the auth provider refused the unban — ${failureReason(error)}` };
  }
}
