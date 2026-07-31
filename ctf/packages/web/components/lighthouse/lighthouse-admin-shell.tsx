'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Home, EyeOff, Eye, XCircle } from 'lucide-react';
import type { LighthouseMatch, LighthouseProperty, LighthousePropertyInput } from 'lib/lighthouse/types';
import { useTheme } from '@/hooks/useTheme';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { PluginUserShellButton } from '@/components/shared/plugin-user-shell-button';
import { getLighthouseTokens, type LighthouseTokens } from './shared';

// Admin design tokens (shared admin look) come from the theme-aware LightHouse tokens: accent
// (blue), page background, panel/header, admin card surface, and the solid admin border. The
// default theme keeps the shipped hex values.

type LighthouseAdminStats = {
  seekers: number;
  hosts: number;
  properties: number;
  activeMatches: number;
  completedMatches: number;
  generatedAtIso: string;
};

type Tab = 'properties' | 'matches';

// Statuses an admin can force a match into (e.g. to shut down a problematic match).
const MATCH_CANCELLABLE = new Set(['pending', 'accepted']);

// Status swatches stay raw (no sanctioned status tokens); only the accent-tinted
// "completed" entry follows the theme, so the map is built from the active tokens.
const matchStatusStyle = (t: LighthouseTokens): Record<string, { bg: string; color: string; border: string }> => ({
  pending: { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: 'rgba(245,158,11,0.3)' },
  accepted: { bg: 'rgba(34,197,94,0.12)', color: '#22C55E', border: 'rgba(34,197,94,0.3)' },
  completed: { bg: 'rgba(6,182,212,0.12)', color: t.ACCENT, border: 'rgba(6,182,212,0.3)' },
  rejected: { bg: 'rgba(239,68,68,0.12)', color: '#EF4444', border: 'rgba(239,68,68,0.3)' },
  canceled: { bg: 'rgba(107,114,128,0.14)', color: '#9CA3AF', border: 'rgba(107,114,128,0.3)' },
});

function Pill({ label, bg, color, border }: { label: string; bg: string; color: string; border: string }) {
  return (
    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: bg, color, border: `1px solid ${border}` }}>{label}</span>
  );
}

function StatBlock({ label, value, accent }: { label: string; value: number; accent?: string }) {
  const { theme } = useTheme();
  const t = getLighthouseTokens(theme);
  return (
    <div style={{ flex: 1, minWidth: 100, padding: '12px 14px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: accent ?? t.TITLE }}>{value}</div>
      <div style={{ fontSize: 11, color: t.MUTED, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function formatRent(amount: number | null): string | null {
  if (amount === null || amount === undefined) return null;
  return `$${amount.toLocaleString()}/mo`;
}

// The admin property endpoint takes a full LighthousePropertyInput (it validates the whole
// record), so to hide/unhide we resend the property with isActive flipped.
function propertyToInput(p: LighthouseProperty, isActive: boolean): LighthousePropertyInput {
  return {
    title: p.title,
    description: p.description,
    propertyType: p.propertyType,
    addressLine: p.addressLine,
    city: p.city,
    state: p.state,
    country: p.country,
    zipCode: p.zipCode,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    monthlyRent: p.monthlyRent,
    // Preserve currency choices on hide/unhide so a full-record resend doesn't drop them.
    rentCurrency: p.rentCurrency,
    acceptedCurrencies: p.acceptedCurrencies,
    availableFromIso: p.availableFromIso,
    amenities: p.amenities,
    houseRules: p.houseRules,
    photos: p.photos,
    airbnbProfileUrl: p.airbnbProfileUrl,
    isActive,
  };
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
  const { theme } = useTheme();
  const t = getLighthouseTokens(theme);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('properties');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function togglePropertyActive(p: LighthouseProperty) {
    if (busyId) return;
    setBusyId(p.id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/lighthouse/admin/properties/${p.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify(propertyToInput(p, !p.isActive)),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string; reason?: string } | null;
        setError(data?.message ?? data?.reason ?? `Update failed (${res.status}).`);
        return;
      }
      setMessage(p.isActive ? 'Listing hidden.' : 'Listing restored.');
      router.refresh();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusyId(null);
    }
  }

  async function cancelMatch(m: LighthouseMatch) {
    if (busyId) return;
    setBusyId(m.id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/lighthouse/admin/matches/${m.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify({ status: 'canceled', hostResponse: null }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string; reason?: string } | null;
        setError(data?.message ?? data?.reason ?? `Update failed (${res.status}).`);
        return;
      }
      setMessage('Match canceled.');
      router.refresh();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div
      style={{
        // The document scrolls, so set a min-height on the shell. Matches the unlock / skills-hunt
        // admin shells.
        minHeight: '100dvh',
        background: t.BG,
        color: t.TITLE,
        fontFamily: "'Inter',system-ui,sans-serif",
      }}
    >
      <MobileScreenHeader title="LightHouse Admin" accent={t.ACCENT} icon={<Home size={18} color={t.ACCENT} />} actions={<PluginUserShellButton href="/apps/lighthouse" accent={t.ACCENT} />} />
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '24px 16px 48px' }}>
        {/* No in-page title card here: MobileScreenHeader above already names the screen and
            carries the icon, back control, and Member view. Repeating it cost a screen of phone
            height for no new information (owner report, 2026-07-27). */}
        {/* Snapshot */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <StatBlock label="Seekers" value={stats.seekers} />
          <StatBlock label="Hosts" value={stats.hosts} />
          <StatBlock label="Properties" value={stats.properties} accent={t.ACCENT} />
          <StatBlock label="Active matches" value={stats.activeMatches} accent="#22C55E" />
          <StatBlock label="Completed" value={stats.completedMatches} />
        </div>
        <div style={{ fontSize: 11, color: t.MUTED, marginBottom: 20 }}>Snapshot generated {new Date(stats.generatedAtIso).toLocaleString()}</div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['properties', 'matches'] as const).map((tabKey) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => setTab(tabKey)}
              aria-pressed={tab === tabKey}
              style={{ padding: '6px 16px', borderRadius: 8, textTransform: 'capitalize', background: tab === tabKey ? t.ACCENT : t.SURFACE, border: `1px solid ${tab === tabKey ? t.ACCENT : t.BORDER_SOLID}`, color: tab === tabKey ? '#06210F' : t.MUTED, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {tabKey}
            </button>
          ))}
        </div>

        {error ? <div role="alert" style={{ marginBottom: 12, fontSize: 13, color: '#EF4444' }}>{error}</div> : null}
        {message ? <div role="status" style={{ marginBottom: 12, fontSize: 13, color: t.ACCENT }}>{message}</div> : null}

        {tab === 'properties' ? (
          properties.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: t.MUTED, fontSize: 14, borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>No properties yet.</div>
          ) : (
            properties.map((p) => {
              const location = [p.city, p.country].filter(Boolean).join(', ');
              const rent = formatRent(p.monthlyRent);
              return (
                <div key={p.id} style={{ marginBottom: 12, padding: '14px 16px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{p.title}</span>
                    {p.isActive
                      ? <Pill label="Active" bg="rgba(34,197,94,0.12)" color="#22C55E" border="rgba(34,197,94,0.3)" />
                      : <Pill label="Hidden" bg="rgba(107,114,128,0.14)" color="#9CA3AF" border="rgba(107,114,128,0.3)" />}
                  </div>
                  <div style={{ fontSize: 12, color: t.MUTED }}>
                    {[location || null, p.propertyType, rent].filter(Boolean).join(' · ')}
                  </div>
                  <div style={{ fontSize: 12, color: t.MUTED, marginTop: 4, marginBottom: 10 }}>Host: {p.hostUserId}</div>
                  <button
                    type="button"
                    disabled={busyId === p.id}
                    onClick={() => void togglePropertyActive(p)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: p.isActive ? 'rgba(107,114,128,0.12)' : 'rgba(34,197,94,0.12)', border: `1px solid ${p.isActive ? 'rgba(107,114,128,0.3)' : 'rgba(34,197,94,0.3)'}`, color: p.isActive ? '#9CA3AF' : '#22C55E', fontSize: 13, fontWeight: 600, cursor: busyId === p.id ? 'not-allowed' : 'pointer', opacity: busyId === p.id ? 0.6 : 1 }}
                  >
                    {p.isActive ? <><EyeOff size={13} /> Hide listing</> : <><Eye size={13} /> Restore listing</>}
                  </button>
                </div>
              );
            })
          )
        ) : (
          matches.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: t.MUTED, fontSize: 14, borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>No matches yet.</div>
          ) : (
            matches.map((m) => {
              const statusStyles = matchStatusStyle(t);
              const s = statusStyles[m.status] ?? statusStyles.pending;
              return (
                <div key={m.id} style={{ marginBottom: 12, padding: '14px 16px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>Match on property {m.propertyId}</span>
                    <Pill label={m.status} bg={s.bg} color={s.color} border={s.border} />
                  </div>
                  <div style={{ fontSize: 12, color: t.MUTED }}>Seeker {m.seekerUserId} → Host {m.hostUserId}</div>
                  <div style={{ fontSize: 12, color: t.MUTED, marginTop: 4, marginBottom: MATCH_CANCELLABLE.has(m.status) ? 10 : 0 }}>Created {new Date(m.createdAtIso).toLocaleDateString()}</div>
                  {MATCH_CANCELLABLE.has(m.status) ? (
                    <button type="button" disabled={busyId === m.id} onClick={() => void cancelMatch(m)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444', fontSize: 13, fontWeight: 600, cursor: busyId === m.id ? 'not-allowed' : 'pointer', opacity: busyId === m.id ? 0.6 : 1 }}>
                      <XCircle size={13} /> Cancel match
                    </button>
                  ) : null}
                </div>
              );
            })
          )
        )}
      </div>
    </div>
  );
}
