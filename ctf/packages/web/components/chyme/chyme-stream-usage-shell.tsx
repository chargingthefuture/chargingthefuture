'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ClipboardCopy, Gauge, RefreshCw } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { getPluginShellTokens } from '@/components/shared/plugin-shell-theme';
import { getAppAccent } from 'lib/theme/theme-tokens';
import type { StreamVideoUsageSummary } from 'lib/stream-quota/usage';
import type { ChymeQuotaPolicy } from 'lib/stream-quota/policy';
import type { ChymeRoomRemoval } from 'lib/chyme/types';
import { requestJson } from './chyme-shared';

// The Stream Video minute meter, for the owner.
//
// Stream bills audio rooms per participant-minute; the Maker tier allows 333,000 a month. Until
// 2026-09-19 the only place that number could be checked was the Stream dashboard, and the app had
// no idea where in the month it was. This screen reads the app's own count (credited from the
// presence heartbeats) against the budget, names the band the room is under and what the policy is
// doing about it, and copies the whole thing as plain text for pasting into a message.

type UsagePayload = {
  ok: true;
  usage: StreamVideoUsageSummary;
  policy: ChymeQuotaPolicy;
  room: { roomName: string; isLive: boolean; participantCount: number; guestCount: number };
  config: { budgetMinutes: number; maxParticipants: number; maxGuestListeners: number; redBandMaxParticipants: number };
};

const BAND_LABEL: Record<ChymeQuotaPolicy['band'], string> = {
  green: 'Green — under 70% used',
  yellow: 'Yellow — 70% to 85% used',
  orange: 'Orange — 85% to 95% used',
  red: 'Red — 95% or more used',
};

const BAND_COLOR: Record<ChymeQuotaPolicy['band'], string> = {
  green: '#22C55E',
  yellow: '#EAB308',
  orange: '#F97316',
  red: '#EF4444',
};

// One member holding the room open around the clock, as minutes a day and as a share of the month,
// so the number the owner asked about on 2026-09-19 is on the screen rather than worked out again.
const ONE_PERSON_ALL_DAY_MINUTES = 24 * 60;

function surfaceLabel(surface: string): string {
  if (surface === 'chyme:chyme-main-room') return 'Main room (members)';
  if (surface === 'chyme:chyme-contributors-room') return 'Weavers room (members)';
  if (surface === 'chyme:guest') return 'Signed-out listeners';
  if (surface === 'chyme:back-channel') return 'Back Channel calls';
  return surface;
}

function formatMinutes(minutes: number): string {
  return minutes.toLocaleString('en-US');
}

function asPlainText(payload: UsagePayload): string {
  const { usage, policy, room, config } = payload;
  const lines = [
    `Chyme live audio — Stream Video minutes, ${usage.monthStartIso} to ${usage.todayIso} (day ${usage.daysElapsed} of ${usage.daysInMonth})`,
    `Used: ${formatMinutes(usage.usedMinutes)} of ${formatMinutes(usage.budgetMinutes)} participant-minutes (${usage.percentUsed}%)`,
    `Band: ${BAND_LABEL[usage.band]}`,
    `Today so far: ${formatMinutes(usage.todayMinutes)} minutes`,
    `At this month's daily average the month ends at about ${formatMinutes(usage.projectedMonthMinutes)} minutes (${usage.projectedPercent}%)`,
    '',
    'Right now:',
    `  ${room.roomName}: ${room.isLive ? 'live' : 'not live'} — ${room.participantCount} member(s), ${room.guestCount} signed-out listener(s)`,
    `  Room cap in force: ${policy.memberCap} members; guest cap: ${policy.guestCap}`,
    `  Listening without an account: ${policy.guestListenAllowed ? 'open' : 'paused'}; Back Channel: ${policy.backChannelAllowed ? 'open' : 'paused'}`,
    '',
    'This month by surface:',
    ...(usage.bySurface.length === 0
      ? ['  (nothing recorded yet)']
      : usage.bySurface.map((row) => `  ${surfaceLabel(row.surface)}: ${formatMinutes(row.minutes)} minutes`)),
    '',
    'Last 7 days:',
    ...usage.byDay.slice(-7).map((day) => `  ${day.dateIso}: ${formatMinutes(day.minutes)} minutes`),
    '',
    `Settings: budget ${formatMinutes(config.budgetMinutes)} minutes (STREAM_VIDEO_MINUTES_BUDGET); room cap ${config.maxParticipants} (CHYME_MAX_PARTICIPANTS); guest cap ${config.maxGuestListeners} (CHYME_MAX_GUEST_LISTENERS); Red-band room cap ${config.redBandMaxParticipants} (CHYME_RED_BAND_MAX_PARTICIPANTS)`,
    `One person in the room all day costs ${formatMinutes(ONE_PERSON_ALL_DAY_MINUTES)} minutes; all month, about ${Math.round((ONE_PERSON_ALL_DAY_MINUTES * usage.daysInMonth * 100) / config.budgetMinutes)}% of the budget.`,
    '',
    'The count is the app’s own estimate from the presence heartbeats. The Stream dashboard is the bill of record.',
  ];
  return lines.join('\n');
}

// The fetch, kept out of the screen so the screen is layout and nothing else.
function useStreamUsage(): { payload: UsagePayload | null; error: string | null; loading: boolean; load: () => Promise<void>; setError: (message: string) => void } {
  const [payload, setPayload] = useState<UsagePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/chyme/admin/stream-usage', { cache: 'no-store' });
      const body = (await response.json().catch(() => null)) as UsagePayload | { message?: string } | null;
      if (!response.ok || !body || !('ok' in body) || body.ok !== true) {
        const message = body && 'message' in body && typeof body.message === 'string' ? body.message : 'The server returned an error.';
        setError(`${message} (HTTP ${response.status})`);
        return;
      }
      setError(null);
      setPayload(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The meter did not load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { payload, error, loading, load, setError };
}

type Tokens = ReturnType<typeof getPluginShellTokens>;

function SectionTitle({ children, t }: { children: ReactNode; t: Tokens }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.SUBTLE, marginBottom: 8 }}>{children}</div>
  );
}

function Section({ children, t }: { children: ReactNode; t: Tokens }) {
  return <section style={{ borderRadius: 14, border: `1px solid ${t.BORDER}`, padding: 16, marginBottom: 14 }}>{children}</section>;
}

function MonthSection({ usage, t }: { usage: StreamVideoUsageSummary; t: Tokens }) {
  const bandColor = BAND_COLOR[usage.band];
  const barWidth = Math.min(100, Math.max(0, usage.percentUsed));
  return (
    <Section t={t}>
      <SectionTitle t={t}>This month · day {usage.daysElapsed} of {usage.daysInMonth}</SectionTitle>
      <div style={{ fontSize: 28, fontWeight: 800, color: t.TEXT, lineHeight: 1.1 }}>
        {formatMinutes(usage.usedMinutes)}
        <span style={{ fontSize: 14, fontWeight: 600, color: t.SUBTLE }}> of {formatMinutes(usage.budgetMinutes)} minutes</span>
      </div>
      <div style={{ height: 10, borderRadius: 5, background: t.INPUT_BG, marginTop: 12, overflow: 'hidden' }} aria-hidden="true">
        <div style={{ width: `${barWidth}%`, height: '100%', background: bandColor, transition: 'width 0.3s' }} />
      </div>
      <div style={{ marginTop: 8, fontSize: 13, color: bandColor, fontWeight: 700 }}>
        {usage.percentUsed}% used · {BAND_LABEL[usage.band]}
      </div>
      <div style={{ fontSize: 13, color: t.SUBTLE, marginTop: 10, lineHeight: 1.5 }}>
        Today so far: {formatMinutes(usage.todayMinutes)} minutes. At this month&apos;s daily average the month ends at about{' '}
        {formatMinutes(usage.projectedMonthMinutes)} minutes ({usage.projectedPercent}%).
      </div>
    </Section>
  );
}

function NowSection({ payload, t }: { payload: UsagePayload; t: Tokens }) {
  const { room, policy } = payload;
  return (
    <Section t={t}>
      <SectionTitle t={t}>Right now</SectionTitle>
      <div style={{ fontSize: 13, lineHeight: 1.7 }}>
        <div>
          <strong>{room.roomName}</strong>: {room.isLive ? 'live' : 'not live'} — {room.participantCount}{' '}
          {room.participantCount === 1 ? 'member' : 'members'}, {room.guestCount} signed-out {room.guestCount === 1 ? 'listener' : 'listeners'}
        </div>
        <div>Room cap in force: {policy.memberCap} members · guest cap: {policy.guestCap}</div>
        <div>
          Listening without an account: <strong>{policy.guestListenAllowed ? 'open' : 'paused'}</strong> · Back Channel:{' '}
          <strong>{policy.backChannelAllowed ? 'open' : 'paused'}</strong>
        </div>
        {policy.memberNotice ? <div style={{ marginTop: 6, color: BAND_COLOR[policy.band] }}>Members see: “{policy.memberNotice}”</div> : null}
      </div>
    </Section>
  );
}

function MinuteRows({ rows, t }: { rows: { key: string; label: string; minutes: number }[]; t: Tokens }) {
  if (rows.length === 0) {
    return <div style={{ fontSize: 13, color: t.SUBTLE }}>Nothing recorded yet this month.</div>;
  }
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 13, lineHeight: 1.7 }}>
      {rows.map((row) => (
        <li key={row.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span>{row.label}</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatMinutes(row.minutes)} min</span>
        </li>
      ))}
    </ul>
  );
}

function SettingsSection({ payload, t }: { payload: UsagePayload; t: Tokens }) {
  const { config, usage } = payload;
  const monthShare = Math.round((ONE_PERSON_ALL_DAY_MINUTES * usage.daysInMonth * 100) / config.budgetMinutes);
  return (
    <Section t={t}>
      <SectionTitle t={t}>Settings in force</SectionTitle>
      <div style={{ fontSize: 13, lineHeight: 1.7, color: t.SUBTLE }}>
        <div>Budget: {formatMinutes(config.budgetMinutes)} minutes a month (<code>STREAM_VIDEO_MINUTES_BUDGET</code>)</div>
        <div>Room cap: {config.maxParticipants} members (<code>CHYME_MAX_PARTICIPANTS</code>)</div>
        <div>Guest cap: {config.maxGuestListeners} listeners (<code>CHYME_MAX_GUEST_LISTENERS</code>)</div>
        <div>Room cap in the Red band: {config.redBandMaxParticipants} members (<code>CHYME_RED_BAND_MAX_PARTICIPANTS</code>)</div>
        <div style={{ marginTop: 6 }}>
          One person in the room all day costs {formatMinutes(ONE_PERSON_ALL_DAY_MINUTES)} minutes — about {monthShare}% of the budget over a whole month.
        </div>
      </div>
    </Section>
  );
}

// Members an admin removed from a room, with the one control that lets them back in. Read from
// /api/chyme/admin/removals; "Let back in" posts to /api/chyme/admin/lift-removal for the row's
// room and re-reads the list.
function RemovedMembersSection({ t }: { t: Tokens }) {
  const [rows, setRows] = useState<ChymeRoomRemoval[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const payload = await requestJson<{ ok: true; removals: ChymeRoomRemoval[] }>('/api/chyme/admin/removals');
      setRows(payload.removals);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The removed-members list did not load.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const letBackIn = useCallback(
    async (row: ChymeRoomRemoval) => {
      setBusyId(row.id);
      try {
        const scope = row.roomKey === 'chyme-contributors-room' ? '?room=contributors' : '';
        const result = await requestJson<{ ok: true; streamNotice?: string }>(`/api/chyme/admin/lift-removal${scope}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ userId: row.userId }),
        });
        setError(result.streamNotice ?? null);
        await load();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'The action did not complete.');
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  return (
    <Section t={t}>
      <SectionTitle t={t}>Removed members</SectionTitle>
      {error ? <p role="alert" style={{ fontSize: 13, color: '#FDE68A', margin: '0 0 8px' }}>{error}</p> : null}
      {rows === null && !error ? <div style={{ fontSize: 13, color: t.SUBTLE }}>Loading…</div> : null}
      {rows && rows.length === 0 ? <div style={{ fontSize: 13, color: t.SUBTLE }}>Nobody is removed from a room right now.</div> : null}
      {rows && rows.length > 0 ? (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((row) => (
            <li key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, lineHeight: 1.5 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{row.username ? `@${row.username}` : `user-${row.userId.slice(0, 8)}`}</div>
                <div style={{ color: t.SUBTLE, fontSize: 12 }}>
                  {row.roomName} · removed {new Date(row.removedAtIso).toLocaleString('en-US')}
                  {row.reason ? ` · ${row.reason}` : ''}
                </div>
              </div>
              <button
                type="button"
                disabled={busyId === row.id}
                onClick={() => void letBackIn(row)}
                style={{ padding: '8px 12px', borderRadius: 10, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: busyId === row.id ? 'wait' : 'pointer', flexShrink: 0 }}
              >
                Let back in
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  );
}

function UsageActions({ loading, canCopy, copied, onRefresh, onCopy, t }: { loading: boolean; canCopy: boolean; copied: boolean; onRefresh: () => void; onCopy: () => void; t: Tokens }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderRadius: 10, background: t.INPUT_BG, border: `1px solid ${t.BORDER}`, color: t.TEXT, fontSize: 13, fontWeight: 600, cursor: loading ? 'wait' : 'pointer' }}
      >
        <RefreshCw size={14} className={loading ? 'ctf-spin' : undefined} /> Refresh
      </button>
      <button
        type="button"
        onClick={onCopy}
        disabled={!canCopy}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderRadius: 10, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: canCopy ? 'pointer' : 'not-allowed', opacity: canCopy ? 1 : 0.6 }}
      >
        <ClipboardCopy size={14} /> {copied ? 'Copied' : 'Copy as text'}
      </button>
    </div>
  );
}

export function ChymeStreamUsageShell() {
  const { theme } = useTheme();
  const t = getPluginShellTokens(getAppAccent('chyme', theme), theme);
  const { payload, error, loading, load, setError } = useStreamUsage();
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    if (!payload) {
      return;
    }
    try {
      await navigator.clipboard.writeText(asPlainText(payload));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch (caught) {
      setError(caught instanceof Error ? `Copy failed: ${caught.message}` : 'Copy failed.');
    }
  }, [payload, setError]);

  return (
    <div style={{ background: t.BG, minHeight: '100vh', color: t.TEXT }}>
      <MobileScreenHeader title="Live audio usage" accent={t.ACCENT} icon={<Gauge size={18} color={t.ACCENT} />} backHref="/admin" />
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '16px 20px 40px' }}>
        <p style={{ fontSize: 13, color: t.SUBTLE, margin: '0 0 14px', lineHeight: 1.5 }}>
          How much of the month&apos;s Stream Video allowance the Chyme rooms have used, counted from the
          presence heartbeats. The Stream dashboard is the bill of record; this is the number the app
          acts on.
        </p>

        <UsageActions loading={loading} canCopy={payload !== null} copied={copied} onRefresh={() => void load()} onCopy={() => void onCopy()} t={t} />

        {error && (
          <p role="alert" style={{ fontSize: 13, color: '#F87171', margin: '0 0 14px' }}>
            {error}
          </p>
        )}

        {!payload && !error && <p style={{ fontSize: 13, color: t.SUBTLE }}>Loading the meter…</p>}

        {payload && (
          <>
            <MonthSection usage={payload.usage} t={t} />
            <NowSection payload={payload} t={t} />
            <Section t={t}>
              <SectionTitle t={t}>This month by surface</SectionTitle>
              <MinuteRows rows={payload.usage.bySurface.map((row) => ({ key: row.surface, label: surfaceLabel(row.surface), minutes: row.minutes }))} t={t} />
            </Section>
            <Section t={t}>
              <SectionTitle t={t}>Last 7 days</SectionTitle>
              <MinuteRows rows={payload.usage.byDay.slice(-7).map((day) => ({ key: day.dateIso, label: day.dateIso, minutes: day.minutes }))} t={t} />
            </Section>
            <SettingsSection payload={payload} t={t} />
          </>
        )}

        <RemovedMembersSection t={t} />
      </div>
    </div>
  );
}
