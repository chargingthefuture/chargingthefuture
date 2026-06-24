import { evaluatePluginAccess } from 'lib/auth/server-authz';
import Link from 'next/link';
import { SafetyAdminShell } from '../../../components/safety/safety-admin-shell';

export const dynamic = 'force-dynamic';

// Admin review of member safety reports (issue #809, task 3). Admin-gated server-side; the client
// shell lists reports (open first) and marks them reviewed or dismissed via the admin
// /api/safety/admin routes. A report exists only when a member blocked someone AND flagged them as a
// suspected predator / human trafficker — ordinary blocks never reach here. The global ban is a
// separate, later admin action (task 5); this surface is read + triage only.
export default async function SafetyAdminPage() {
  const decision = await evaluatePluginAccess({ requiredRoles: ['admin'] });

  if (!decision.allowed) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12 space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Admin access denied</h1>
        <p className="text-sm text-muted-foreground">
          The safety report review area is restricted to admins. Request blocked by server-side role policy.
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
          <Link className="underline underline-offset-4" href="/admin">Back to admin</Link>
        </p>
      </main>
    );
  }

  return <SafetyAdminShell />;
}
