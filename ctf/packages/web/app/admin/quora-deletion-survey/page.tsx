import Link from 'next/link';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { QuoraSurveyAdminShell } from '@/components/quora-deletion-survey/survey-admin-shell';

export const dynamic = 'force-dynamic';

// Admin reader for the public Quora account-deletion survey. Admin-gated server-side here and
// again in every admin route behind it (rule 131). There is no member-facing view of this data:
// what gets published is decided by a person reading the consent flags, not by a route.
export default async function QuoraDeletionSurveyAdminPage() {
  const decision = await evaluatePluginAccess({ requiredRoles: ['admin'] });

  if (!decision.allowed) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12 space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Admin access denied</h1>
        <p className="text-sm text-muted-foreground">
          The survey review area is restricted to admins. Request blocked by server-side role policy.
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

  return <QuoraSurveyAdminShell />;
}
