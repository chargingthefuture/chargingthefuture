import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { listUnlockHelpLog } from 'lib/comic/unlock-help-log';
import type { UnlockHelpLog } from 'lib/comic/unlock-help-log-format';
import { failureReason } from 'lib/errors/failure';
import { ComicUnlockHelpLog } from '../../../../components/comic/comic-unlock-help-log';

export const dynamic = 'force-dynamic';

// The Unlock help log: each @comic conversation about Unlock from a member not yet approved, set
// against whether that member was approved afterward. Admin-gated and read-only; rendered on the
// server from lib/comic/unlock-help-log.ts, so there is no API route behind it.
export default async function ComicUnlockHelpLogPage() {
  const decision = await evaluatePluginAccess({ requiredRoles: ['admin'] });
  if (!decision.allowed) {
    redirect('/');
  }

  let log: UnlockHelpLog | null = null;
  let loadError: string | null = null;
  try {
    log = await listUnlockHelpLog();
  } catch (error) {
    loadError = `Could not read the Unlock help log from the database: ${failureReason(error)}`;
  }

  return <ComicUnlockHelpLog log={log} loadError={loadError} />;
}
