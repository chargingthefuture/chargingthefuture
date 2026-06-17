'use client';

// Admin circulation tiles: the public aggregates plus the operator levers (mint budget, issuance
// settings, concentration, open disputes). Read-only. Every figure is a bare credit quantity —
// ServiceCredits are never shown at a fiat equivalent. Wired to:
//   GET /api/service-credits/admin/circulation -> { ok, metrics }
import { useCallback, useEffect, useState } from 'react';
import { Feedback } from './sca-fields';
import { type AdminCirculationMetrics, type AdminCirculationResponse } from './sca-shared';

// Admin design tokens (shared dark admin look). ServiceCredits accent is purple #A855F7.
const SURFACE = '#161B27';
const BG = '#0F1117';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#6B7280';

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
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
        {buildTiles(metrics).map(({ label, value }) => (
          <div
            key={label}
            style={{ borderRadius: 10, border: `1px solid ${BORDER}`, background: BG, padding: '10px 12px' }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: TEXT }}>{value}</div>
            <div style={{ fontSize: 11, color: SUBTLE, marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>
      {!metrics.treasuryUserIdConfigured ? (
        <p style={{ fontSize: 11, color: SUBTLE, margin: 0 }}>
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
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        borderRadius: 12,
        border: `1px solid ${BORDER}`,
        background: SURFACE,
        padding: 18,
        marginBottom: 16,
      }}
    >
      <header>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: TEXT, margin: '0 0 4px' }}>Circulation</h2>
        <p style={{ fontSize: 13, color: SUBTLE, margin: 0, lineHeight: 1.5 }}>
          Live totals for the ServiceCredits economy and the operator levers behind issuance. These
          are bare credit quantities, not money.
        </p>
      </header>

      <Feedback error={error} notice={null} />

      {loading ? (
        <p style={{ fontSize: 13, color: SUBTLE, margin: 0 }}>Loading…</p>
      ) : metrics ? (
        <Tiles metrics={metrics} />
      ) : null}
    </section>
  );
}
