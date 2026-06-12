import { evaluatePluginAccess } from 'lib/auth/server-authz';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

// The admin landing page: a single directory of every admin area. Each link points at a
// route that is itself server-role-gated, so this page only renders for admins. Keep this
// list in step with the pages under app/admin/* — add a row when a new admin area ships.
const ADMIN_AREAS: { href: string; name: string; description: string }[] = [
  { href: '/admin/unlock', name: 'Unlock', description: 'Review and decide who gets full access to the app.' },
  { href: '/admin/directory', name: 'Directory', description: 'Manage member directory listings and visibility.' },
  { href: '/admin/socketrelay', name: 'SocketRelay', description: 'Moderate mutual-aid requests and offers.' },
  { href: '/admin/lighthouse', name: 'LightHouse', description: 'Manage LightHouse listings and review reports.' },
  { href: '/admin/trusttransport', name: 'TrustTransport', description: 'Oversee transport coordination and disputes.' },
  { href: '/admin/comic', name: 'AI Assistant', description: 'Review answers from the @comic assistant before they post.' },
  { href: '/admin/whatworks', name: 'WhatWorks', description: 'Curate problems and the products that solve them.' },
  { href: '/admin/skills-hunt', name: 'SkillsHunt', description: 'Manage missions, scouts, and the leaderboard.' },
  { href: '/admin/peer-programming', name: 'Peer Programming', description: 'Set topics and manage pairing assignments.' },
  { href: '/admin/levelup', name: 'LevelUp', description: 'Run skills-training cohorts and stipend milestones.' },
  { href: '/admin/weekly-performance', name: 'Weekly Performance', description: 'Manage weekly performance reporting.' },
  { href: '/admin/workforce', name: 'Workforce', description: 'Manage workforce records and assignments.' },
  { href: '/admin/foundation', name: 'Foundation', description: 'Manage foundation-level settings and records.' },
  { href: '/admin/contributions', name: 'Contributions', description: 'Run fundraising drives and review the donation queue.' },
  { href: '/admin/service-credits', name: 'ServiceCredits', description: 'Treasury, disputes, and governance for the credits ledger.' },
  { href: '/admin/gdp', name: 'GDP', description: 'Manage GDP figures.' },
  { href: '/admin/gdp/rates', name: 'GDP Rates', description: 'Manage GDP exchange and conversion rates.' },
  { href: '/admin/feed-announcements', name: 'Feed Announcements', description: 'Post and manage announcements in the community feed.' },
];

export default async function AdminPage() {
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
        <p className="text-sm">
          <Link className="underline underline-offset-4" href="/">Return to home</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">
          Pick an area to manage. Each area is restricted to admins.
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ADMIN_AREAS.map((area) => (
          <li key={area.href}>
            <Link
              href={area.href}
              className="block rounded-lg border bg-card p-4 transition hover:border-foreground/30 hover:bg-card/80"
            >
              <span className="block text-sm font-medium">{area.name}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{area.description}</span>
            </Link>
          </li>
        ))}
      </ul>

      <footer className="border-t pt-4 text-sm text-muted-foreground">
        Signed in as <span className="font-medium">{decision.userId}</span> · role{' '}
        <span className="font-medium">{decision.role ?? 'not set'}</span> ·{' '}
        <Link className="underline underline-offset-4" href="/">Return to home</Link>
      </footer>
    </main>
  );
}
