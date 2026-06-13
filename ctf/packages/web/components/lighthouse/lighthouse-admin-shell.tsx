'use client';

import { useState } from 'react';
import { Home } from 'lucide-react';
import type { LighthouseMatch, LighthouseProperty } from 'lib/lighthouse/types';

// Admin design tokens (shared admin look). LightHouse accent is cyan.
const COLOR = '#06B6D4';
const BG = '#0F1117';
const PANEL = '#0D0F14';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#6B7280';

type LighthouseAdminStats = {
  seekers: number;
  hosts: number;
  properties: number;
  activeMatches: number;
  completedMatches: number;
  generatedAtIso: string;
};

type Tab = 'properties' | 'matches';

const MATCH_STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  pending: { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: 'rgba(245,158,11,0.3)' },
  accepted: { bg: 'rgba(34,197,94,0.12)', color: '#22C55E', border: 'rgba(34,197,94,0.3)' },
  completed: { bg: 'rgba(6,182,212,0.12)', color: COLOR, border: 'rgba(6,182,212,0.3)' },
  rejected: { bg: 'rgba(239,68,68,0.12)', color: '#EF4444', border: 'rgba(239,68,68,0.3)' },
  cancelled: { bg: 'rgba(107,114,128,0.14)', color: '#9CA3AF', border: 'rgba(107,114,128,0.3)' },
};

function Pill({ label, bg, color, border }: { label: string; bg: string; color: string; border: string }) {
  return (
    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: bg, color, border: `1px solid ${border}` }}>{label}</span>
  );
}

function StatBlock({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 100, padding: '12px 14px', borderRadius: 10, background: SURFACE, border: `1px solid ${BORDER}` }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: accent ?? TEXT }}>{value}</div>
      <div style={{ fontSize: 11, color: SUBTLE, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function formatRent(amount: number | null): string | null {
  if (amount === null || amount === undefined) return null;
  return `$${amount.toLocaleString()}/mo`;
}

export function LighthouseAdminShell({
  stats,
  properties,
  matches,
}: {
  stats: LighthouseAdminStats;
  properties: LighthouseProperty[];
  matches: LighthouseMatch[];
}) {
  const [tab, setTab] = useState<Tab>('properties');

  return (
    <div style={{ minHeight: '100dvh', background: BG, color: TEXT, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '24px 16px 48px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderRadius: 12, background: PANEL, border: `1px solid ${BORDER}`, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: `${COLOR}20`, border: `1px solid ${COLOR}35`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Home size={18} color={COLOR} />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>LightHouse Admin</div>
            <div style={{ fontSize: 12, color: SUBTLE }}>Listings and matches</div>
          </div>
          <span style={{ marginLeft: 'auto', padding: '3px 9px', borderRadius: 6, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', fontSize: 11, color: '#6366F1', fontWeight: 700 }}>ADMIN</span>
        </div>

        {/* Snapshot */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <StatBlock label="Seekers" value={stats.seekers} />
          <StatBlock label="Hosts" value={stats.hosts} />
          <StatBlock label="Properties" value={stats.properties} accent={COLOR} />
          <StatBlock label="Active matches" value={stats.activeMatches} accent="#22C55E" />
          <StatBlock label="Completed" value={stats.completedMatches} />
        </div>
        <div style={{ fontSize: 11, color: SUBTLE, marginBottom: 20 }}>Snapshot generated {new Date(stats.generatedAtIso).toLocaleString()}</div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['properties', 'matches'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              style={{ padding: '6px 16px', borderRadius: 8, textTransform: 'capitalize', background: tab === t ? COLOR : SURFACE, border: `1px solid ${tab === t ? COLOR : BORDER}`, color: tab === t ? '#06210F' : SUBTLE, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'properties' ? (
          properties.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: SUBTLE, fontSize: 14, borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}` }}>No properties yet.</div>
          ) : (
            properties.map((p) => {
              const location = [p.city, p.country].filter(Boolean).join(', ');
              const rent = formatRent(p.monthlyRent);
              return (
                <div key={p.id} style={{ marginBottom: 12, padding: '14px 16px', borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{p.title}</span>
                    {p.isActive
                      ? <Pill label="Active" bg="rgba(34,197,94,0.12)" color="#22C55E" border="rgba(34,197,94,0.3)" />
                      : <Pill label="Hidden" bg="rgba(107,114,128,0.14)" color="#9CA3AF" border="rgba(107,114,128,0.3)" />}
                  </div>
                  <div style={{ fontSize: 12, color: SUBTLE }}>
                    {[location || null, p.propertyType, rent].filter(Boolean).join(' · ')}
                  </div>
                  <div style={{ fontSize: 12, color: SUBTLE, marginTop: 4 }}>Host: {p.hostUserId}</div>
                </div>
              );
            })
          )
        ) : matches.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: SUBTLE, fontSize: 14, borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}` }}>No matches yet.</div>
        ) : (
          matches.map((m) => {
            const s = MATCH_STATUS_STYLE[m.status] ?? MATCH_STATUS_STYLE.pending;
            return (
              <div key={m.id} style={{ marginBottom: 12, padding: '14px 16px', borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>Match on property {m.propertyId}</span>
                  <Pill label={m.status} bg={s.bg} color={s.color} border={s.border} />
                </div>
                <div style={{ fontSize: 12, color: SUBTLE }}>Seeker {m.seekerUserId} → Host {m.hostUserId}</div>
                <div style={{ fontSize: 12, color: SUBTLE, marginTop: 4 }}>Created {new Date(m.createdAtIso).toLocaleDateString()}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
