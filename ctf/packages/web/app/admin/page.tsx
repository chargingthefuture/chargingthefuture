import { evaluatePluginAccess } from 'lib/auth/server-authz';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

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
    <main className="mx-auto max-w-3xl px-6 py-12 space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Admin baseline access confirmed</h1>
      <p className="text-sm text-muted-foreground">
        Route access passed middleware and server-side role verification.
      </p>
      <dl className="rounded-lg border bg-card p-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="font-medium">Authorized user</dt>
          <dd>{decision.userId}</dd>
        </div>
        <div className="mt-2 flex justify-between gap-4">
          <dt className="font-medium">Role</dt>
          <dd>{decision.role ?? 'not set'}</dd>
        </div>
      </dl>
      <p className="text-sm">
        <Link className="underline underline-offset-4" href="/apps/chyme">Open plugin route</Link>
      </p>
      <p className="text-sm">
        <Link className="underline underline-offset-4" href="/admin/unlock">Open Unlock admin queue</Link>
      </p>
    </main>
  );
}
