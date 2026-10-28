'use client';

import { useState } from 'react';
import type { PluginShellTokens } from '@/components/shared/plugin-shell-theme';
import type { RetentionCohorts } from 'lib/measures/retention-cohorts';

// The layer cake and the retention curves (owner-approved plan, Measures). One blue ramp by sign-up
// month, newest lightest: the steps are validated as an ordinal ramp on the admin's dark surface.
// Every mark carries its own hover label, and a table shows the same numbers.

const RAMP = ['#184f95', '#256abf', '#3987e5', '#6da7ec', '#9ec5f4', '#cde2fb'];
const W = 320;
const H = 160;
const PAD = { top: 8, right: 8, bottom: 22, left: 30 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

function colorFor(cohorts: string[], cohort: string): string {
  return RAMP[RAMP.length - cohorts.length + cohorts.indexOf(cohort)] ?? RAMP[0];
}

function monthLabel(cohort: string): string {
  if (!/^\d{4}-\d{2}$/.test(cohort)) return cohort;
  return new Date(`${cohort}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
}

function weekLabel(week: string): string {
  return new Date(`${week}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function Legend({ t, data }: { t: PluginShellTokens; data: RetentionCohorts }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', margin: '8px 0' }}>
      {data.cohorts.map((c) => (
        <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.TEXT }}>
          <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: colorFor(data.cohorts, c) }} />
          {monthLabel(c)} ({data.sizes[c] ?? 0})
        </span>
      ))}
    </div>
  );
}

function LayerCake({ t, data }: { t: PluginShellTokens; data: RetentionCohorts }) {
  const totals = data.layers.map((l) => Object.values(l.active).reduce((a, b) => a + b, 0));
  const max = Math.max(1, ...totals);
  const slot = PLOT_W / data.layers.length;
  const barW = Math.max(4, slot - 4);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Members active each week, stacked by sign-up month">
      <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + PLOT_H} y2={PAD.top + PLOT_H} stroke={t.BORDER} />
      <text x={PAD.left - 4} y={PAD.top + 8} textAnchor="end" fontSize="10" fill={t.SUBTLE}>{max}</text>
      <text x={PAD.left - 4} y={PAD.top + PLOT_H} textAnchor="end" fontSize="10" fill={t.SUBTLE}>0</text>
      {data.layers.map((layer, i) => {
        let y = PAD.top + PLOT_H;
        const x = PAD.left + i * slot + (slot - barW) / 2;
        return (
          <g key={layer.week}>
            {data.cohorts.map((c) => {
              const n = layer.active[c] ?? 0;
              if (n === 0) return null;
              const h = (n / max) * PLOT_H;
              y -= h;
              return (
                <rect key={c} x={x} y={y} width={barW} height={Math.max(h - 2, 1)} rx={2} fill={colorFor(data.cohorts, c)}>
                  <title>{`Week of ${weekLabel(layer.week)}: ${n} active who signed up ${monthLabel(c)}`}</title>
                </rect>
              );
            })}
            {i % 3 === 0 || i === data.layers.length - 1 ? (
              <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize="10" fill={t.SUBTLE}>{weekLabel(layer.week)}</text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

function Curves({ t, data }: { t: PluginShellTokens; data: RetentionCohorts }) {
  const weeks = Math.max(2, ...data.curves.map((c) => c.points.length));
  const x = (w: number) => PAD.left + (w / (weeks - 1)) * PLOT_W;
  const y = (share: number) => PAD.top + (1 - share) * PLOT_H;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Share of each sign-up month active in each week since signing up">
      <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke={t.BORDER} />
      <text x={PAD.left - 4} y={y(1) + 8} textAnchor="end" fontSize="10" fill={t.SUBTLE}>100%</text>
      <text x={PAD.left - 4} y={y(0)} textAnchor="end" fontSize="10" fill={t.SUBTLE}>0</text>
      <text x={PAD.left} y={H - 6} fontSize="10" fill={t.SUBTLE}>Week 0</text>
      <text x={W - PAD.right} y={H - 6} textAnchor="end" fontSize="10" fill={t.SUBTLE}>{`Week ${weeks - 1}`}</text>
      {data.curves.map((curve) => {
        if (curve.points.length === 0) return null;
        const color = colorFor(data.cohorts, curve.cohort);
        return (
          <g key={curve.cohort}>
            <polyline points={curve.points.map((p) => `${x(p.week)},${y(p.share)}`).join(' ')} fill="none" stroke={color} strokeWidth={2} />
            {curve.points.map((p) => (
              <circle key={p.week} cx={x(p.week)} cy={y(p.share)} r={4} fill={color} stroke={t.SURFACE} strokeWidth={2}>
                <title>{`${monthLabel(curve.cohort)} sign-ups, week ${p.week}: ${Math.round(p.share * 100)}% active`}</title>
              </circle>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

function CohortTable({ t, data }: { t: PluginShellTokens; data: RetentionCohorts }) {
  const cell = { padding: '4px 6px', fontSize: 12, color: t.TEXT, textAlign: 'right' as const };
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={{ ...cell, textAlign: 'left' }}>Week of</th>
            {data.cohorts.map((c) => (
              <th key={c} style={cell}>{monthLabel(c)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.layers.map((l) => (
            <tr key={l.week}>
              <td style={{ ...cell, textAlign: 'left' }}>{weekLabel(l.week)}</td>
              {data.cohorts.map((c) => (
                <td key={c} style={cell}>{l.active[c] ?? 0}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RetentionCharts({ t, data }: { t: PluginShellTokens; data: RetentionCohorts }) {
  const [table, setTable] = useState(false);
  const heading = { margin: '16px 0 4px', fontSize: 13, fontWeight: 700, color: t.TITLE };
  return (
    <div>
      <p style={heading}>Active each week, by sign-up month</p>
      <p style={{ margin: 0, fontSize: 12, color: t.SUBTLE }}>Active means a day with 30 or more action minutes that week.</p>
      <Legend t={t} data={data} />
      {table ? <CohortTable t={t} data={data} /> : <LayerCake t={t} data={data} />}
      <p style={heading}>Share still active, by weeks since signing up</p>
      {table ? null : <Curves t={t} data={data} />}
      {table ? (
        <p style={{ margin: 0, fontSize: 12, color: t.SUBTLE }}>
          {data.curves
            .filter((c) => c.points.length > 0)
            .map((c) => `${monthLabel(c.cohort)}: ${c.points.map((p) => `${Math.round(p.share * 100)}%`).join(', ')}`)
            .join(' · ') || 'No sign-up month has a full week yet.'}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => setTable((v) => !v)}
        style={{ marginTop: 8, minHeight: 32, padding: '4px 10px', borderRadius: 8, border: `1px solid ${t.BORDER}`, background: 'transparent', color: t.TITLE, fontSize: 12, cursor: 'pointer' }}
      >
        {table ? 'Show as charts' : 'Show as a table'}
      </button>
    </div>
  );
}
