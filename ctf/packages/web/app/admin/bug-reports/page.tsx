import { evaluatePluginAccess } from 'lib/auth/server-authz';
import Link from 'next/link';
import { BugReportsAdminShell } from '../../../components/bug-reports/bug-reports-admin-shell';

export const dynamic = 'force-dynamic';

// Admin review of in-app bug reports. Admin-gated server-side; the client shell lists reports
// (held ones first) and releases or rejects them via the admin /api/bug-reports/admin routes.
// Held reports are the ones the sanitizer flagged — they wait here for a human, and are never
// auto-published to the triage repo. Only redacted text is ever shown (rule 129).
export default async function BugReportsAdminPage() {
  const decision = await evaluatePluginAccess({ requiredRoles: ['admin'] });

  if (!decision.allowed) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12 space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Admin access denied</h1>
        <p className="text-sm text-muted-foreground">
          The bug report review area is restricted to admins. Request blocked by server-side role policy.
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

  return <BugReportsAdminShell />;
}
