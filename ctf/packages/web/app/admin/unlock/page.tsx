import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { getUnlockDashboardSnapshot, listUnlockSubmissions } from 'lib/unlock/repository';
import { withMemberIdentities } from 'lib/unlock/member-identity';
import { getUnlockSignupOverview } from 'lib/unlock/signups';
import { listSpamQuoraUrls } from 'lib/unlock/spam-denylist';
import { redirect } from 'next/navigation';
import { UnlockAdminShell } from '@/components/unlock/unlock-admin-shell';

export const dynamic = 'force-dynamic';

export default async function UnlockAdminPage() {
  const access = await evaluatePluginAccess({ requiredRoles: ['admin'], requireUsername: false });
  if (!access.allowed) {
    redirect('/');
  }

  const [dashboard, submissions, spamDenylist, signupOverview] = await Promise.all([
    getUnlockDashboardSnapshot(),
    // Clerk holds the member's name; the queue query reads submissions only, so the name is put on
    // each row here. Never throws — an unresolved id just prints as the raw id on the card.
    listUnlockSubmissions({ limit: 50 }).then(withMemberIdentities),
    listSpamQuoraUrls(),
    // Reads the account roster from the auth provider, so the whole sign-up reading is on this page and
    // the owner does not have to open the provider dashboard. Never throws — a provider failure comes
    // back as an unavailable overview carrying the reason.
    getUnlockSignupOverview(),
  ]);

  return (
    <UnlockAdminShell
      dashboard={dashboard}
      submissions={submissions}
      spamDenylist={spamDenylist}
      signupOverview={signupOverview}
    />
  );
}
