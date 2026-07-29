import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { countHiddenCommonsRows, listCommonsModerationQueue } from 'lib/feed/moderation';
import { CommonsModerationAdminShell } from '@/components/feed-announcements/commons-moderation-admin-shell';

export const dynamic = 'force-dynamic';

// Commons moderation admin surface. Separate page from /admin/feed-announcements on purpose: that one
// is an authoring tool for the owner's own announcements, this one is about member-authored content
// and carries a different power (taking someone else's words out of view).
export default async function CommonsModerationAdminPage() {
  const decision = await evaluatePluginAccess({ requiredRoles: ['admin'] });
  if (!decision.allowed) {
    redirect('/');
  }

  // Failing soft on the read: an empty queue with a working page beats a 500 on the admin surface,
  // and the page's own reload button retries.
  const [rows, hidden] = await Promise.all([
    listCommonsModerationQueue({ limit: 50 }).catch(() => []),
    countHiddenCommonsRows().catch(() => ({ posts: 0, replies: 0 })),
  ]);

  return <CommonsModerationAdminShell rows={rows} hidden={hidden} />;
}
