import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import {
  getLighthouseAdminStats,
  listLighthouseAdminAnnouncements,
  listLighthouseMatchesAdmin,
  listLighthousePropertiesAdmin,
} from 'lib/lighthouse/repository';
import { LighthouseAdminShell } from '@/components/lighthouse/lighthouse-admin-shell';

export const dynamic = 'force-dynamic';

export default async function LighthouseAdminPage() {
  const access = await evaluatePluginAccess({ requireUsername: false });
  if (!access.allowed || !access.isAdmin) {
    redirect('/apps/lighthouse');
  }

  const [stats, properties, matches, announcements] = await Promise.all([
    getLighthouseAdminStats(),
    listLighthousePropertiesAdmin(),
    listLighthouseMatchesAdmin(),
    listLighthouseAdminAnnouncements(),
  ]);

  return <LighthouseAdminShell stats={stats} properties={properties} matches={matches} announcements={announcements} />;
}
