import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import {
  countHiddenCommonsRows,
  countPendingFlaggedAnswers,
  listCommonsAuthors,
  listCommonsModerationQueue,
  listFlaggedAnswers,
} from 'lib/feed/moderation';
import { failureReason } from 'lib/errors/failure';
import { reportError } from 'lib/observability/report';
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
  // and the page's own reload button retries. Each read that fails is reported and named in the
  // banner with its reason (rule 137), so an outage does not look like a day with no moderation work.
  const failures: string[] = [];
  function soft<T>(read: Promise<T>, what: string, op: string, fallback: T): Promise<T> {
    return read.catch((error: unknown) => {
      reportError(error, { area: 'feed-announcements', op });
      failures.push(`${what}: ${failureReason(error)}`);
      return fallback;
    });
  }
  const [rows, hidden, authors, flagged, pendingFlagged] = await Promise.all([
    soft(listCommonsModerationQueue({ limit: 50 }), 'the moderation queue', 'admin_page_queue', []),
    soft(countHiddenCommonsRows(), 'the hidden counts', 'admin_page_hidden_counts', { posts: 0, replies: 0 }),
    soft(listCommonsAuthors(50), 'the author list', 'admin_page_authors', []),
    soft(listFlaggedAnswers(50), 'the flagged answers', 'admin_page_flagged', []),
    soft(countPendingFlaggedAnswers(), 'the pending flagged count', 'admin_page_pending_flagged', 0),
  ]);
  const loadError =
    failures.length > 0 ? `Could not read from the database. ${failures.join('; ')}.` : null;

  return (
    <CommonsModerationAdminShell
      rows={rows}
      hidden={hidden}
      authors={authors}
      flagged={flagged}
      pendingFlagged={pendingFlagged}
      loadError={loadError}
    />
  );
}
