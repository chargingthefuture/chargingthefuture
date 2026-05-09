import Link from 'next/link';
import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import {
  getLighthouseAdminStats,
  listLighthouseAdminAnnouncements,
  listLighthouseMatchesAdmin,
  listLighthousePropertiesAdmin,
  listLighthouseProfiles,
} from 'lib/lighthouse/repository';

export const dynamic = 'force-dynamic';

export default async function LighthouseAdminPage() {
  const access = await evaluatePluginAccess({ requireUsername: false });
  if (!access.allowed || !access.isAdmin) {
    redirect('/apps/lighthouse');
  }

  const [stats, seekers, hosts, properties, matches, announcements] = await Promise.all([
    getLighthouseAdminStats(),
    listLighthouseProfiles('seeker'),
    listLighthouseProfiles('host'),
    listLighthousePropertiesAdmin(),
    listLighthouseMatchesAdmin(),
    listLighthouseAdminAnnouncements(),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">LightHouse Admin</h1>
        <p className="text-sm text-muted-foreground">
          Admin monitoring and moderation surface for profile/property/match/announcement and block-risk operations.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <article className="rounded-lg border bg-card p-4 text-sm">
          <p className="text-xs text-muted-foreground">Seekers</p>
          <p className="text-2xl font-semibold">{stats.seekers}</p>
        </article>
        <article className="rounded-lg border bg-card p-4 text-sm">
          <p className="text-xs text-muted-foreground">Hosts</p>
          <p className="text-2xl font-semibold">{stats.hosts}</p>
        </article>
        <article className="rounded-lg border bg-card p-4 text-sm">
          <p className="text-xs text-muted-foreground">Properties</p>
          <p className="text-2xl font-semibold">{stats.properties}</p>
        </article>
        <article className="rounded-lg border bg-card p-4 text-sm">
          <p className="text-xs text-muted-foreground">Active matches</p>
          <p className="text-2xl font-semibold">{stats.activeMatches}</p>
        </article>
        <article className="rounded-lg border bg-card p-4 text-sm">
          <p className="text-xs text-muted-foreground">Completed matches</p>
          <p className="text-2xl font-semibold">{stats.completedMatches}</p>
        </article>
      </section>

      <section className="rounded-lg border bg-card p-5 text-sm space-y-2">
        <h2 className="text-lg font-medium">Dataset snapshot</h2>
        <p>Seeker profiles loaded: {seekers.length}</p>
        <p>Host profiles loaded: {hosts.length}</p>
        <p>Property records loaded: {properties.length}</p>
        <p>Match records loaded: {matches.length}</p>
        <p>Announcement records loaded: {announcements.length}</p>
      </section>

      <section className="rounded-lg border bg-card p-5 text-sm space-y-2">
        <h2 className="text-lg font-medium">Admin API endpoints</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><code>GET /api/lighthouse/admin/stats</code></li>
          <li><code>GET /api/lighthouse/admin/profiles</code></li>
          <li><code>GET /api/lighthouse/admin/seekers</code></li>
          <li><code>GET /api/lighthouse/admin/hosts</code></li>
          <li><code>GET /api/lighthouse/admin/properties</code></li>
          <li><code>PATCH/DELETE /api/lighthouse/admin/properties/:propertyId</code></li>
          <li><code>GET /api/lighthouse/admin/matches</code></li>
          <li><code>PATCH /api/lighthouse/admin/matches/:matchId</code></li>
          <li><code>GET/POST /api/lighthouse/admin/announcements</code></li>
          <li><code>PATCH/DELETE /api/lighthouse/admin/announcements/:announcementId</code></li>
          <li><code>GET /api/lighthouse/admin/audit-events</code></li>
        </ul>
      </section>

      <p className="text-sm">
        <Link className="underline underline-offset-4" href="/apps/lighthouse">Open lighthouse plugin view</Link>
      </p>
    </main>
  );
}
