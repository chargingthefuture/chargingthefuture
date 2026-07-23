import { notFound } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { getPluginBySlug } from 'lib/plugins/repository';
import { MutualTimeAdmin } from '@/components/mutual-time/mutual-time-admin';

export const dynamic = 'force-dynamic';

// /apps/mutual-time — admin-only. Admins create and manage the meeting-time surveys here. Members
// never use this route: they only ever interact with an event through its shared link
// (/mutual-time/<slug>), so there is no member view of /apps/mutual-time. Non-admins get a 404.
// Web + mobile-responsive only (no Android).
export default async function MutualTimeAppPage() {
  const plugin = await getPluginBySlug('mutual-time');
  if (!plugin || !plugin.isVisible) {
    notFound();
  }

  const decision = await evaluatePluginAccess({ requiredRoles: ['admin'] });
  if (!decision.allowed) {
    notFound();
  }

  return <MutualTimeAdmin />;
}
