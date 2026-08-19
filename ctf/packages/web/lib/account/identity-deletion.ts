import { createClerkClient } from '@clerk/backend';
import { getClerkSecretKey } from 'lib/auth/clerk-env';
import { failureReason } from 'lib/errors/failure';

// Removing the sign-in itself, which is the last thing a full account deletion has to do.
//
// Deleting a member's data does not remove their identity: the auth provider holds the account, not
// us. Leaving it behind means someone who asked to be forgotten still exists as an account — they can
// sign back in to an empty app, they are still counted in every roster read from the provider, and the
// owner has to reconcile a sign-up list against a member list that no longer agrees with it.
//
// Deliberately best-effort. The data deletion has already committed by the time this runs, so a
// provider outage must not turn a completed deletion into a failed request; the caller reports what
// happened and the account can be cleared afterwards through the operator delete route. The provider
// fires its own `user.deleted` webhook on success, which our receiver skips because the deletion event
// row already exists — so this never double-runs the cleanup.
export type IdentityDeletionOutcome = { deleted: boolean; error: string | null };

export async function deleteAuthIdentity(userId: string): Promise<IdentityDeletionOutcome> {
  const secretKey = getClerkSecretKey();
  if (!secretKey) {
    return { deleted: false, error: 'The auth provider secret key is not set in this runtime, so the sign-in could not be removed.' };
  }

  try {
    await createClerkClient({ secretKey }).users.deleteUser(userId);
    return { deleted: true, error: null };
  } catch (error) {
    return { deleted: false, error: failureReason(error) };
  }
}
