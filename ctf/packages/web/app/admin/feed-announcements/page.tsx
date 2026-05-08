import { evaluatePluginAccess } from 'lib/auth/server-authz';
import Link from 'next/link';
import { getFeedConfig, listAnnouncements } from 'lib/feed/repository';

export const dynamic = 'force-dynamic';

export default async function FeedAnnouncementsAdminPage() {
  const decision = await evaluatePluginAccess({ requiredRoles: ['admin'] });

  if (!decision.allowed) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12 space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Admin access denied</h1>
        <p className="text-sm text-muted-foreground">
          Request blocked by server-side role policy.
        </p>
        <dl className="rounded-lg border bg-card p-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="font-medium">HTTP status</dt>
            <dd>{decision.status}</dd>
          </div>
          <div className="mt-2 flex justify-between gap-4">
            <dt className="font-medium">Deny code</dt>
            <dd>{decision.code}</dd>
          </div>
          <div className="mt-2 flex justify-between gap-4">
            <dt className="font-medium">Reason</dt>
            <dd>{decision.reason}</dd>
          </div>
        </dl>
      </main>
    );
  }

  const [config, announcements] = await Promise.all([
    getFeedConfig(),
    listAnnouncements(true),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">/admin/feed-announcements</h1>
        <p className="text-sm text-muted-foreground">
          Centralized Feed + Announcements admin lifecycle surface.
        </p>
      </header>

      <section className="rounded-lg border bg-card p-5 text-sm space-y-1">
        <p><span className="font-medium">Render mode:</span> {config.renderMode}</p>
        <p><span className="font-medium">Kill switch:</span> {config.killSwitchEnabled ? 'enabled' : 'disabled'}</p>
        <p><span className="font-medium">Max page size:</span> {config.maxTimelinePageSize}</p>
        <p><span className="font-medium">Enabled channels:</span> {config.enabledChannels.join(', ')}</p>
      </section>

      <section className="rounded-lg border bg-card p-5 space-y-3">
        <h2 className="text-lg font-medium">Announcement lifecycle</h2>
        <ul className="space-y-2 text-sm">
          {announcements.map((announcement: { id: string; title: string; body: string; status: string; priority: number; mandatory: boolean }) => (
            <li key={announcement.id} className="rounded border p-3">
              <p className="font-medium">{announcement.title}</p>
              <p className="text-muted-foreground">{announcement.body}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {announcement.status} · priority {announcement.priority} · {announcement.mandatory ? 'mandatory' : 'optional'}
              </p>
            </li>
          ))}
          {announcements.length === 0 ? (
            <li className="text-sm text-muted-foreground">No announcements available.</li>
          ) : null}
        </ul>
      </section>

      <p className="text-sm">
        <Link className="underline underline-offset-4" href="/admin">Return to admin home</Link>
      </p>
    </main>
  );
}
