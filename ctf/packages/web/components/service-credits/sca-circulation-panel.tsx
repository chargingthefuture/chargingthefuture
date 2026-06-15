'use client';

// Admin circulation tiles: the public aggregates plus the operator levers (mint budget, issuance
// settings, concentration, open disputes). Read-only. Every figure is a bare credit quantity —
// ServiceCredits are never shown at a fiat equivalent. Wired to:
//   GET /api/service-credits/admin/circulation -> { ok, metrics }
import { useCallback, useEffect, useState } from 'react';
import { Feedback } from './sca-fields';
import { type AdminCirculationMetrics, type AdminCirculationResponse } from './sca-shared';

function fmt(n: number): string {
  return n.toLocaleString();
}

function fmtNullable(n: number | null, dash = '—'): string {
  return n === null ? dash : fmt(n);
}

type Tile = { label: string; value: string };

function buildTiles(m: AdminCirculationMetrics): Tile[] {
  return [
    { label: 'In circulation', value: fmt(m.inCirculation) },
    { label: 'Total issued', value: fmt(m.totalIssued) },
    { label: 'Total burned', value: fmt(m.totalBurned) },
    { label: 'Treasury balance', value: fmtNullable(m.treasuryBalance) },
    { label: 'On community credit', value: fmt(m.outstandingMutualCreditDebt) },
    { label: '30-day velocity', value: m.velocity.toFixed(2) },
    { label: 'Mint budget remaining', value: fmtNullable(m.mintBudgetRemaining, 'Not enforced') },
    { label: 'Mint budget ceiling', value: fmtNullable(m.mintBudgetCeiling) },
    { label: 'Minted this period', value: fmt(m.mintedThisPeriod) },
    { label: 'Issuance enforced', value: m.issuanceEnforced ? 'Yes' : 'No' },
    { label: 'Issuance period (days)', value: fmt(m.issuancePeriodDays) },
    { label: 'Top-5 concentration', value: `${(m.concentrationTop5Share * 100).toFixed(1)}%` },
    { label: 'Open disputes', value: fmt(m.openDisputes) },
    { label: 'Treasury tracked', value: m.treasuryUserIdConfigured ? 'Yes' : 'No' },
  ];
}

function Tiles({ metrics }: { metrics: AdminCirculationMetrics }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {buildTiles(metrics).map(({ label, value }) => (
          <div key={label} className="rounded-md border bg-background p-3">
            <div className="text-xl font-semibold">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
      {!metrics.treasuryUserIdConfigured ? (
        <p className="text-xs text-muted-foreground">
          Set policy.treasuryUserId to track the treasury balance.
        </p>
      ) : null}
    </>
  );
}

export function ServiceCreditsCirculationPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<AdminCirculationMetrics | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/service-credits/admin/circulation');
      if (!res.ok) {
        throw new Error(`Could not load circulation figures (${res.status}).`);
      }
      const data = (await res.json()) as AdminCirculationResponse;
      if (!data.metrics) {
        throw new Error('Circulation figures were not returned.');
      }
      setMetrics(data.metrics);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load circulation figures.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-4 rounded-lg border bg-card p-5">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold">Circulation</h2>
        <p className="text-sm text-muted-foreground">
          Live totals for the ServiceCredits economy and the operator levers behind issuance. These
          are bare credit quantities, not money.
        </p>
      </header>

      <Feedback error={error} notice={null} />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : metrics ? (
        <Tiles metrics={metrics} />
      ) : null}
    </section>
  );
}
