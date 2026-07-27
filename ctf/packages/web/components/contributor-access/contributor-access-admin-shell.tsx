'use client';

import { useCallback, useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { getContributorAccessTokens } from './contributor-access-shared';
import { EligibleMembersSection, type EligibleMember } from './eligible-members-section';
import { ConfigEditorSection, type ContributorAccessConfigView } from './config-editor-section';

// Contributor Access admin dashboard (module slug contributor-access). Three sections: the eligible
// members list (revoke/reinstate), the owner-tunable eligibility settings (including the gated
// channel's launch-gated open toggle), and the channel status card (open/closed + synced member
// count). Admin chrome uses the neutral admin indigo via getContributorAccessTokens (rule 131).
// The member surface is the gated #contributors channel inside the Commons shell, not here.

type LoadState = 'loading' | 'ready' | 'error';

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init });
  const payload = (await response.json().catch(() => null)) as T | { message?: string } | null;
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload ? payload.message : 'Request failed.';
    throw new Error(typeof message === 'string' ? message : 'Request failed.');
  }
  return payload as T;
}

function StatusCard({
  t,
  eligibleCount,
  needed,
  channelOpen,
  channelMemberCount,
}: {
  t: ReturnType<typeof getContributorAccessTokens>;
  eligibleCount: number;
  needed: number;
  channelOpen: boolean;
  channelMemberCount: number | null;
}) {
  const ready = eligibleCount >= needed;
  return (
    <section style={{ marginBottom: 20, padding: '14px 16px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
      <h2 style={{ fontSize: 14, fontWeight: 800, color: t.TITLE, margin: '0 0 6px' }}>Channel status</h2>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: ready ? '#22C55E' : t.TITLE }}>
          {eligibleCount} / {needed}
        </div>
        <span
          style={{
            padding: '2px 9px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 700,
            background: channelOpen ? 'rgba(34,197,94,0.12)' : 'rgba(148,163,184,0.15)',
            border: channelOpen ? '1px solid rgba(34,197,94,0.3)' : `1px solid ${t.BORDER_SOLID}`,
            color: channelOpen ? '#22C55E' : t.MUTED,
          }}
        >
          {channelOpen ? 'OPEN' : 'CLOSED'}
        </span>
      </div>
      <p style={{ fontSize: 12, color: t.MUTED, margin: '4px 0 0' }}>
        Eligible members vs the minimum needed before the gated channel opens.{' '}
        {channelOpen
          ? channelMemberCount != null
            ? `The channel is open with ${channelMemberCount} synced member${channelMemberCount === 1 ? '' : 's'}.`
            : 'The channel is open; the synced member count is unavailable right now.'
          : ready
            ? 'The minimum is met — the channel can be opened from the settings below.'
            : 'Below the minimum — the open toggle stays locked.'}{' '}
        Membership follows the eligibility flag only; moderators keep read access and the channel says so.
      </p>
    </section>
  );
}

export function ContributorAccessAdminShell() {
  const { theme } = useTheme();
  const t = getContributorAccessTokens(theme);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [members, setMembers] = useState<EligibleMember[]>([]);
  const [eligibleCount, setEligibleCount] = useState(0);
  const [config, setConfig] = useState<ContributorAccessConfigView | null>(null);
  const [channelMemberCount, setChannelMemberCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [eligiblePayload, configPayload] = await Promise.all([
        requestJson<{ members: EligibleMember[]; eligibleCount: number }>('/api/contributor-access/admin/eligible'),
        requestJson<{ config: ContributorAccessConfigView; channelMemberCount: number | null }>('/api/contributor-access/admin/config'),
      ]);
      setMembers(eligiblePayload.members);
      setEligibleCount(eligiblePayload.eligibleCount);
      setConfig(configPayload.config);
      setChannelMemberCount(configPayload.channelMemberCount ?? null);
      setLoadState('ready');
      setError(null);
    } catch (loadError) {
      setLoadState('error');
      setError(loadError instanceof Error ? loadError.message : 'Unable to load Contributor Access data.');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const mutate = useCallback(
    async (url: string, body: Record<string, unknown>, failMessage: string) => {
      setError(null);
      try {
        await requestJson(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
          body: JSON.stringify(body),
        });
        await refresh();
      } catch (mutateError) {
        setError(mutateError instanceof Error ? mutateError.message : failMessage);
      }
    },
    [refresh],
  );

  // Revoke is for-cause only: a non-empty reason is required, and the admin confirms before it lands.
  const revoke = useCallback(
    async (userId: string) => {
      if (typeof window === 'undefined') return;
      const reason = window.prompt('Reason for revoking (required — for-cause only, e.g. a reviewed harm or abuse action):');
      if (reason === null) return;
      if (reason.trim().length === 0) {
        setError('A non-empty reason is required to revoke.');
        return;
      }
      if (!window.confirm('Revoke this member for cause? Their access flag turns off until reinstated.')) return;
      setBusyId(userId);
      await mutate('/api/contributor-access/admin/revoke', { userId, reason: reason.trim() }, 'Unable to revoke.');
      setBusyId(null);
    },
    [mutate],
  );

  const reinstate = useCallback(
    async (userId: string) => {
      if (typeof window !== 'undefined' && !window.confirm('Reinstate this member? Their earned eligibility returns.')) {
        return;
      }
      setBusyId(userId);
      await mutate('/api/contributor-access/admin/reinstate', { userId }, 'Unable to reinstate.');
      setBusyId(null);
    },
    [mutate],
  );

  const saveConfig = useCallback(
    async (update: ContributorAccessConfigView) => {
      setSaving(true);
      setError(null);
      try {
        await requestJson('/api/contributor-access/admin/config', {
          method: 'PUT',
          headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
          body: JSON.stringify(update),
        });
        await refresh();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Unable to save settings.');
      } finally {
        setSaving(false);
      }
    },
    [refresh],
  );

  return (
    <div
      style={{
        // Desktop locks html/body to 100vh + overflow:hidden (globals.css), so each admin shell must
        // own its vertical scroll or its lower rows are clipped. On mobile the document scrolls, so
        // only set a min-height there. Matches the bug-reports / unlock admin shells.
        minHeight: '100dvh',
        background: t.BG,
        color: t.TITLE,
        fontFamily: "'Inter',system-ui,sans-serif",
      }}
    >
      <MobileScreenHeader title="Contributor Access Admin" accent={t.ACCENT} icon={<KeyRound size={18} color={t.ACCENT} />} />
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 16px 48px' }}>
        {/* No in-page title card here: MobileScreenHeader above already names the screen and
            carries the icon, back control, and Member view. Repeating it cost a screen of phone
            height for no new information (owner report, 2026-07-27). */}
        <p style={{ fontSize: 13, color: t.MUTED, lineHeight: 1.6, marginBottom: 16 }}>
          Members earn a single categorical standing — eligible or not-yet — through steady, broad contribution across
          plugins. The weekly recompute only ever admits; revoking is for cause only, never for going quiet. No score is
          shown anywhere, to admins or members.
        </p>

        {error ? (
          <div role="status" style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: 13 }}>
            {error}
          </div>
        ) : null}

        {loadState === 'loading' ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: t.MUTED, fontSize: 14, borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
            Loading…
          </div>
        ) : null}

        {loadState === 'ready' && config ? (
          <>
            <EligibleMembersSection t={t} members={members} busyId={busyId} onRevoke={(id) => void revoke(id)} onReinstate={(id) => void reinstate(id)} />
            <ConfigEditorSection key={config.threshold + JSON.stringify(config.weights) + String(config.channelOpen)} t={t} config={config} eligibleCount={eligibleCount} saving={saving} onSave={(update) => void saveConfig(update)} />
            <StatusCard t={t} eligibleCount={eligibleCount} needed={config.minEligibleToOpenChannel} channelOpen={config.channelOpen} channelMemberCount={channelMemberCount} />
          </>
        ) : null}
      </div>
    </div>
  );
}
