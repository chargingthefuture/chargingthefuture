import Link from 'next/link';
import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';

export const dynamic = 'force-dynamic';
import { getLatestPublication } from 'lib/gdp/repository';

export default async function GdpAdminPage() {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed || !decision.isAdmin) {
    redirect('/apps/gdp');
  }

  const report = await getLatestPublication();

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">GDP Admin</h1>
        <p className="text-sm text-muted-foreground">Publication governance with suppression/lawful-basis controls.</p>
      </header>

      <section className="rounded-lg border bg-card p-5 text-sm space-y-2">
        <p>Published report: {report?.publication.title ?? 'none'}</p>
        <p>Metrics in report: {report?.metrics.length ?? 0}</p>
      </section>

      <section className="rounded-lg border bg-card p-5 text-sm space-y-2">
        <h2 className="font-medium">Currency rate factors</h2>
        <p className="text-muted-foreground">
          Review and revise the owner-curated USD factors used only to roll multi-currency volume into the
          single USD-denominated GDP estimate. These are not per-wallet or redemption values.
        </p>
        <p>
          <Link className="underline underline-offset-4" href="/admin/gdp/rates">Open currency rate admin</Link>
        </p>
      </section>

      <p className="text-sm">
        <Link className="underline underline-offset-4" href="/apps/gdp">Open plugin shell</Link>
      </p>
    </main>
  );
}
