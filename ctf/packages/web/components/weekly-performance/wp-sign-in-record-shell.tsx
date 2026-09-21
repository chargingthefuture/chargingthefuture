'use client';

import { useCallback, useEffect, useState } from 'react';
import { ClipboardCopy, LogIn, RefreshCw } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import type { RecordLoginEventOutcome } from 'lib/engagement/login-activity';
import type { SignInRecordHealth } from 'lib/engagement/sign-in-record';
import { getWeeklyPerformanceTokens, type WeeklyPerformanceTokens } from './wp-shared';

// The sign-in record behind Active Members and Daily Active Members, as a health check an admin
// can read from a phone. Opening the screen runs the sign-in write for the admin and shows what
// the database did with it, then the record itself: today, the current week as the dashboard
// computes it, and the last fourteen days. Aggregate only; the one per-member fact shown is the
// admin's own row for today.

type Reading = { selfWrite: RecordLoginEventOutcome; health: SignInRecordHealth };

function utcClock(iso: string | null): string {
  return iso ? `${iso.slice(11, 16)} UTC` : '—';
}

function utcDate(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '—';
}

function asPlainText(reading: Reading): string {
  const { selfWrite, health } = reading;
  const self = selfWrite.recorded
    ? `recorded (${health.selfRecordedAt ? utcClock(health.selfRecordedAt) : 'today'})`
    : `NOT recorded — ${selfWrite.error ?? 'no reason given'}`;
  return [
    `Sign-in record — read ${health.readAt.slice(0, 16).replace('T', ' ')} UTC`,
    `  my sign-in today: ${self}`,
    `  v2 users foreign key present: ${health.usersForeignKeyPresent ? 'YES (writes refused for newer members)' : 'no'}`,
    `  today: ${health.membersToday} member(s), ${health.rowsToday} row(s)`,
    `  this week (from ${health.currentWeek.weekStart}): ${health.currentWeek.activeMembers} active, ${health.currentWeek.memberDays} member-days over ${health.currentWeek.elapsedDays} day(s) = ${health.currentWeek.dailyActiveMembers} per day`,
    `  record: ${health.totalRows} rows, ${health.totalMembers} members, ${utcDate(health.firstRowAt)} to ${utcDate(health.lastRowAt)}`,
    '',
    '  last 14 days (members signed in):',
    ...health.days.map((day) => `    ${day.day}: ${day.members}`),
  ].join('\n');
}

function Stat({ label, value, tokens }: { label: string; value: string; tokens: WeeklyPerformanceTokens }) {
  return (
    <div style={{ borderRadius: 12, background: tokens.SURFACE, border: `1px solid ${tokens.BORDER}`, padding: 12, flex: '1 1 140px' }}>
      <div style={{ fontSize: 11, color: tokens.SUBTLE, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: tokens.TITLE, marginTop: 4 }}>{value}</div>
    </div>
  );
}

// The one line that answers the question this screen exists for. Green when the admin's own row
// for today is on record; red, with the database's words, when the write was refused.
function SelfWriteLine({ reading, tokens }: { reading: Reading; tokens: WeeklyPerformanceTokens }) {
  const { selfWrite, health } = reading;
  const ok = selfWrite.recorded;
  return (
    <div
      role={ok ? undefined : 'alert'}
      style={{
        borderRadius: 12,
        padding: 12,
        marginBottom: 14,
        background: tokens.SURFACE,
        border: `1px solid ${ok ? '#22C55E55' : '#F8717155'}`,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: ok ? '#22C55E' : '#F87171' }}>
        {ok
          ? `Your sign-in today is on record${health.selfRecordedAt ? ` (${utcClock(health.selfRecordedAt)})` : ''}.`
          : 'Your sign-in today was NOT recorded.'}
      </div>
      {!ok && (
        <div style={{ fontSize: 12, color: tokens.TEXT, marginTop: 6, lineHeight: 1.5 }}>
          The database said: {selfWrite.error ?? 'nothing'}
        </div>
      )}
      {health.usersForeignKeyPresent && (
        <div style={{ fontSize: 12, color: '#F87171', marginTop: 6, lineHeight: 1.5 }}>
          The v2 foreign key from this table to the old users table is present again. It refuses a
          sign-in row for every member who joined after v2 stopped.
        </div>
      )}
    </div>
  );
}

// Everything shown once the record has loaded, as its own component so the shell above it stays
// inside the complexity limit: the shell owns state and chrome, this owns the reading.
function SignInRecordBody({
  reading,
  tokens,
  loading,
  copied,
  onCopy,
  onReload,
}: {
  reading: Reading;
  tokens: WeeklyPerformanceTokens;
  loading: boolean;
  copied: boolean;
  onCopy: () => void;
  onReload: () => void;
}) {
  const { health } = reading;
  const week = health.currentWeek;
  const plural = (n: number) => (n === 1 ? '' : 's');
  return (
    <>
      <SelfWriteLine reading={reading} tokens={tokens} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <Stat label="Members today" value={String(health.membersToday)} tokens={tokens} />
        <Stat label="Active this week" value={String(week.activeMembers)} tokens={tokens} />
        <Stat label="Per day this week" value={String(week.dailyActiveMembers)} tokens={tokens} />
        <Stat label="Members on record" value={String(health.totalMembers)} tokens={tokens} />
      </div>

      <div style={{ fontSize: 12, color: tokens.SUBTLE, marginBottom: 14, lineHeight: 1.6 }}>
        Week from {week.weekStart}: {week.memberDays} member-day{plural(week.memberDays)} over{' '}
        {week.elapsedDays} day{plural(week.elapsedDays)} so far. Record holds {health.totalRows} rows
        from {utcDate(health.firstRowAt)} to {utcDate(health.lastRowAt)}; last row at{' '}
        {utcClock(health.lastRowAt)}.
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onCopy}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: tokens.ACCENT, color: '#0B0B0F', border: 'none', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          <ClipboardCopy size={15} />
          {copied ? 'Copied' : 'Copy the reading'}
        </button>
        <button
          type="button"
          onClick={onReload}
          disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: tokens.BTN_BG, color: tokens.TITLE, border: `1px solid ${tokens.BORDER_HI}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          <RefreshCw size={15} />
          {loading ? 'Reading…' : 'Read again'}
        </button>
      </div>

      <div style={{ fontSize: 12, color: tokens.SUBTLE, marginBottom: 6 }}>Last 14 days · members signed in</div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {health.days.map((day) => (
          <li key={day.day} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '3px 0', fontSize: 12, color: day.members > 0 ? tokens.TEXT : tokens.SUBTLE }}>
            <span>{day.day}</span>
            <span>{day.members}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

export function WeeklyPerformanceSignInRecordShell() {
  const { theme } = useTheme();
  const t = getWeeklyPerformanceTokens(theme);

  const [reading, setReading] = useState<Reading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/weekly-performance/admin/sign-in-record', { cache: 'no-store' });
      const payload = (await response.json()) as Partial<Reading> & { message?: string };
      if (!response.ok || !payload.health || !payload.selfWrite) {
        setError(payload.message ?? `The record did not load (${response.status}).`);
        return;
      }
      setError(null);
      setReading({ selfWrite: payload.selfWrite, health: payload.health });
    } catch (caught) {
      setError(caught instanceof Error ? `The record did not load: ${caught.message}` : 'The record did not load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onCopy = useCallback(async () => {
    if (!reading) return;
    try {
      await navigator.clipboard.writeText(asPlainText(reading));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch (caught) {
      setError(caught instanceof Error ? `Copy failed: ${caught.message}` : 'Copy failed.');
    }
  }, [reading]);

  return (
    <div style={{ background: t.BG, minHeight: '100vh', color: t.TEXT }}>
      <MobileScreenHeader
        title="Sign-in record"
        accent={t.ACCENT}
        icon={<LogIn size={18} color={t.ACCENT} />}
        backHref="/admin/weekly-performance"
      />
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '16px 20px 40px' }}>
        <p style={{ fontSize: 13, color: t.SUBTLE, margin: '0 0 14px', lineHeight: 1.5 }}>
          Active Members and Daily Active Members count this record and nothing else: one row per
          member per day they signed in. Opening this screen records your own sign-in and shows
          what the database did with it, so a zero on the dashboard is answered here.
        </p>

        {error && (
          <p role="alert" style={{ fontSize: 13, color: '#F87171', margin: '0 0 14px' }}>
            {error}
          </p>
        )}

        {loading && !reading && <p style={{ fontSize: 13, color: t.SUBTLE }}>Reading the record…</p>}

        {reading && (
          <SignInRecordBody
            reading={reading}
            tokens={t}
            loading={loading}
            copied={copied}
            onCopy={() => void onCopy()}
            onReload={() => void load()}
          />
        )}
      </div>
    </div>
  );
}
