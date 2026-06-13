import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { getFeedConfig, listAnnouncements } from 'lib/feed/repository';
import { FeedAnnouncementsAdminShell } from '@/components/feed-announcements/feed-announcements-admin-shell';

export const dynamic = 'force-dynamic';

export default async function FeedAnnouncementsAdminPage() {
  const decision = await evaluatePluginAccess({ requiredRoles: ['admin'] });
  if (!decision.allowed) {
    redirect('/');
  }

  const [config, announcements] = await Promise.all([
    getFeedConfig(),
    listAnnouncements(true),
  ]);

  return <FeedAnnouncementsAdminShell config={config} announcements={announcements} />;
}
