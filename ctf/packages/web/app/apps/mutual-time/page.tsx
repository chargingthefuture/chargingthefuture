import { notFound } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { getHostedSignInUrl } from 'lib/auth/provider-env';
import { getPluginBySlug } from 'lib/plugins/repository';
import { MutualTimeAdmin } from '@/components/mutual-time/mutual-time-admin';
import { MutualTimeMemberInfo } from '@/components/mutual-time/mutual-time-member-info';

export const dynamic = 'force-dynamic';

// /apps/mutual-time — the plugin's dashboard tile. Admins get the create/manage dashboard; approved
// members get a short explainer (events are shared as direct links, not listed here). Signed-out or
// not-yet-approved visitors get a plain sign-in card. Web + mobile-responsive only (no Android).
export default async function MutualTimeAppPage() {
  const plugin = await getPluginBySlug('mutual-time');
  if (!plugin || !plugin.isVisible) {
    notFound();
  }

  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    const signInUrl = getHostedSignInUrl() ?? '/sign-in';
    return (
      <div style={{ minHeight: '100vh', background: '#0F1117', color: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 420, textAlign: 'center', borderRadius: 14, background: '#0D0F14', border: '1px solid #1E2A3A', padding: '32px 24px' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>Mutual Time</h1>
          <p style={{ fontSize: 14, color: '#9CA3AF', margin: '0 0 20px' }}>
            Sign in and get approved to create and vote on meeting-time surveys.
          </p>
          <a href={signInUrl} style={{ display: 'inline-block', padding: '10px 20px', borderRadius: 10, background: 'rgba(244,114,182,0.2)', border: '1px solid rgba(244,114,182,0.35)', color: '#F472B6', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
            Sign in
          </a>
        </div>
      </div>
    );
  }

  if (decision.isAdmin) {
    return <MutualTimeAdmin />;
  }
  return <MutualTimeMemberInfo />;
}
