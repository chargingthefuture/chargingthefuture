import { evaluatePluginAccess } from 'lib/auth/server-authz';
import {
  getUnlockDashboardSnapshot,
  getUnlockExperimentSplit,
  listUnlockSubmissions,
} from 'lib/unlock/repository';
import { listSpamQuoraUrls } from 'lib/unlock/spam-denylist';
import { redirect } from 'next/navigation';
import { UnlockAdminShell } from '@/components/unlock/unlock-admin-shell';

export const dynamic = 'force-dynamic';

export default async function UnlockAdminPage() {
  const access = await evaluatePluginAccess({ requiredRoles: ['admin'], requireUsername: false });
  if (!access.allowed) {
    redirect('/');
  }

  const [dashboard, submissions, experimentSplit, spamDenylist] = await Promise.all([
    getUnlockDashboardSnapshot(),
    listUnlockSubmissions({ limit: 50 }),
    getUnlockExperimentSplit(),
    listSpamQuoraUrls(),
  ]);

  return (
    <UnlockAdminShell
      dashboard={dashboard}
      submissions={submissions}
      experimentSplit={experimentSplit}
      spamDenylist={spamDenylist}
    />
  );
}
