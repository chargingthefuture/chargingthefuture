import { createClerkClient } from '@clerk/backend';
import { getClerkSecretKey } from 'lib/auth/clerk-env';
import { notifySafe } from 'lib/notifications/repository';
import { reportError } from 'lib/observability/report';

// Tell the admins, on their phones, that somebody asked for help with Unlock (owner decision,
// 2026-11-23). It goes through the existing notification path: one Activity row per admin, and the
// device push that row brings with it when the admin has pushes on and is outside quiet hours.
//
// The text never carries the member's message, name or account: the push can show on a lock screen,
// and the help list at /admin/unlock is where the detail is read, behind sign-in.
//
// Best-effort end to end. The member's request is already saved when this runs, and nothing here may
// fail it: every failure is logged with the reason and swallowed.

export const UNLOCK_HELP_NOTIFICATION_TYPE = 'unlock.help.requested';
export const UNLOCK_HELP_NOTIFICATION_SUMMARY = 'Someone asked for help with Unlock.';
export const UNLOCK_HELP_NOTIFICATION_LINK = '/admin/unlock';

// One page of the provider's account list (its maximum), and a stop so a much larger roster cannot
// turn one help request into a long series of provider calls.
const PAGE_SIZE = 500;
const MAX_ACCOUNTS = 5000;

// Admin is a role on the account's public metadata, the same field sign-in reads.
export function isAdminAccountMetadata(publicMetadata: unknown): boolean {
  if (!publicMetadata || typeof publicMetadata !== 'object') return false;
  const role = (publicMetadata as Record<string, unknown>).role;
  return typeof role === 'string' && role.trim().toLowerCase() === 'admin';
}

// Who holds the admin role. The role lives only in the auth provider, so the account list is read
// there; there is no table of admins to ask instead.
async function listAdminUserIds(): Promise<string[]> {
  const secretKey = getClerkSecretKey();
  if (!secretKey) {
    throw new Error('the auth provider secret key is not set in this runtime, so the admins cannot be found');
  }
  const client = createClerkClient({ secretKey });
  const admins: string[] = [];
  let offset = 0;
  for (;;) {
    const page = await client.users.getUserList({ limit: PAGE_SIZE, offset });
    for (const user of page.data) {
      if (isAdminAccountMetadata(user.publicMetadata)) admins.push(user.id);
    }
    offset += page.data.length;
    if (page.data.length < PAGE_SIZE || offset >= MAX_ACCOUNTS) return admins;
  }
}

// `requestRef` names this help request without naming the member (see recordUnlockHelpRequest), so
// the Activity row an admin keeps says nothing about who asked, and a repeat of the same event dedupes.
export async function notifyAdminsOfUnlockHelpRequest(requestRef: string): Promise<void> {
  let admins: string[];
  try {
    admins = await listAdminUserIds();
  } catch (error) {
    reportError(error, { area: 'unlock', op: 'help_request_notify_admins_lookup' });
    return;
  }
  if (admins.length === 0) {
    console.info('[unlock] help request saved; no account holds the admin role, so nobody was notified');
    return;
  }
  await Promise.all(
    admins.map((userId) =>
      notifySafe({
        userId,
        sourcePlugin: 'unlock',
        notificationType: UNLOCK_HELP_NOTIFICATION_TYPE,
        category: 'activity',
        summary: UNLOCK_HELP_NOTIFICATION_SUMMARY,
        linkPath: UNLOCK_HELP_NOTIFICATION_LINK,
        targetRef: requestRef,
      }),
    ),
  );
}
