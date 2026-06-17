import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { ComicReviewConsole } from '../../../components/comic/comic-review-console';

export const dynamic = 'force-dynamic';

// Owner Review & Correction Dashboard for the AI Assistant (@comic). Admin-gated server-side; the
// client screen fetches the pending queue and resolves items via the admin /api/comic/review*
// routes. This is the supervision surface that keeps unreviewed drafts away from survivors.
export default async function ComicReviewConsolePage() {
  const decision = await evaluatePluginAccess({ requiredRoles: ['admin'] });

  if (!decision.allowed) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12 space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Admin access denied</h1>
        <p className="text-sm text-muted-foreground">
          The AI Assistant review dashboard is for admins only. Your account does not have admin access.
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

  return <ComicReviewConsole />;
}
