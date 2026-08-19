import { redirect } from 'next/navigation';
import { resolveRequestIdentity } from '../../lib/auth/request-identity';
import { getAccountRestrictionStatus, type AccountRestrictionStatus } from '../../lib/auth/account-restrictions';
import { getAccountPortalOrigin, getHostedSignInUrl } from '../../lib/auth/provider-env';
import { UNLOCK_DUPLICATE_RESTRICTION_REASON } from '../../lib/unlock/spam-denylist';
import { AccountClosedNotice } from '../../components/account-closed/account-closed-notice';

// Where a member goes when their account has been closed platform-wide.
//
// Before this page there was nowhere to go. A closed account still resolved to a stored access tier, so
// the home page let them through to the Commons shell — where every single call answered 403 and the
// screen simply failed, with nothing saying why. That reads as the app being broken rather than as a
// decision somebody made, and it is the same either way whether the account was closed for spam or
// because the person already has one.
//
// The page is deliberately reachable while restricted: it performs its own check rather than sitting
// behind the gate that would deny it.
export const dynamic = 'force-dynamic';

export default async function AccountClosedPage() {
  const identity = await resolveRequestIdentity().catch(() => null);
  const userId = identity?.isAuthenticated ? identity.userId : null;
  if (!userId) {
    redirect('/');
  }

  const restriction: AccountRestrictionStatus = await getAccountRestrictionStatus(userId, 'all').catch(
    () => ({ isRestricted: false }),
  );
  // Not closed (or the check failed, which must not strand a member here) — send them back to the app,
  // where the ordinary gates decide as usual.
  if (!restriction.isRestricted) {
    redirect('/');
  }

  const isDuplicate = restriction.reason === UNLOCK_DUPLICATE_RESTRICTION_REASON;
  const portalOrigin = getAccountPortalOrigin();

  return (
    <AccountClosedNotice
      isDuplicate={isDuplicate}
      // Their own identity is the one thing they can still act on: sign in as the other account, or
      // delete this one. Both live on the provider's hosted portal, outside anything we gate.
      signInUrl={getHostedSignInUrl() ?? '/sign-in'}
      manageAccountUrl={portalOrigin ? `${portalOrigin}/user` : null}
    />
  );
}
