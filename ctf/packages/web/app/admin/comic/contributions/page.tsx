import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { ComicContributionReview } from '../../../../components/comic/comic-contribution-review';

export const dynamic = 'force-dynamic';

// Review of member-contributed writing (`/knowledge` submissions). Admin-gated server-side.
//
// This is the human step the knowledge page promises a contributor: a member's writing sits inert in
// comic_contribution_entries and cannot reach the assistant until someone accepts it here. Accepting
// promotes the chosen entries into comic_knowledge_entries and makes the ServiceCredits recognition
// grant — which only lands for a member who has finished Unlock.
export default async function ComicContributionReviewPage() {
  const decision = await evaluatePluginAccess({ requiredRoles: ['admin'] });

  if (!decision.allowed) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12 space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Admin access denied</h1>
        <p className="text-sm text-muted-foreground">
          Contributed-writing review is for admins only. Your account does not have admin access.
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

  return <ComicContributionReview />;
}
