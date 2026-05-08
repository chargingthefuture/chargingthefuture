import Link from 'next/link';

type AdminPanelProps = {
  kpis: {
    enrollments: number;
    completions: number;
    avgDaysToFirstTrainerPayout: number;
  };
};

export function AdminPanel({ kpis }: AdminPanelProps) {
  return (
    <section className="rounded-lg border bg-card p-5 space-y-3">
      <h2 className="text-lg font-medium">Admin Panel</h2>
      <p className="text-sm text-muted-foreground">
        Configure refund policies, adjust credits, and monitor cohort performance metrics.
      </p>

      <div className="grid gap-3 md:grid-cols-3 text-sm">
        <article className="rounded border p-3">
          <p className="text-xs text-muted-foreground">Enrollments</p>
          <p className="text-lg font-semibold">{kpis.enrollments}</p>
        </article>
        <article className="rounded border p-3">
          <p className="text-xs text-muted-foreground">Completions</p>
          <p className="text-lg font-semibold">{kpis.completions}</p>
        </article>
        <article className="rounded border p-3">
          <p className="text-xs text-muted-foreground">Avg days to first trainer payout</p>
          <p className="text-lg font-semibold">{kpis.avgDaysToFirstTrainerPayout} days</p>
        </article>
      </div>

      <p className="text-sm">
        <Link className="underline underline-offset-4" href="/admin/levelup">Open /admin/levelup</Link>
      </p>
    </section>
  );
}
