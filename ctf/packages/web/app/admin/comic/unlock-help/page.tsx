import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { listUnlockHelpLog } from 'lib/comic/unlock-help-log';
import type { UnlockHelpLog } from 'lib/comic/unlock-help-log-format';
import { getUnlockHelpReviewSetting, type UnlockHelpReviewSetting } from 'lib/comic/runtime-config';
import { failureReason } from 'lib/errors/failure';
import { ComicUnlockHelpLog } from '../../../../components/comic/comic-unlock-help-log';

export const dynamic = 'force-dynamic';

// The Unlock help log: each @comic conversation about Unlock from a member not yet approved, set
// against whether that member was approved afterward. Admin-gated. The log itself is read-only and
// rendered on the server from lib/comic/unlock-help-log.ts; the one control on the page is the switch
// for sending those answers without review (POST /api/comic/admin/unlock-help-setting), placed here
// so the evidence and the decision sit together.
export default async function ComicUnlockHelpLogPage() {
  const decision = await evaluatePluginAccess({ requiredRoles: ['admin'] });
  if (!decision.allowed) {
    redirect('/');
  }

  let log: UnlockHelpLog | null = null;
  let setting: UnlockHelpReviewSetting | null = null;
  let loadError: string | null = null;
  try {
    [log, setting] = await Promise.all([listUnlockHelpLog(), getUnlockHelpReviewSetting()]);
  } catch (error) {
    loadError = `Could not read the Unlock help log or its setting from the database: ${failureReason(error)}`;
  }

  return <ComicUnlockHelpLog log={log} setting={setting} loadError={loadError} />;
}
