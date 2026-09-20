'use client';

import { useCallback, useEffect, useState } from 'react';
import { ClipboardCopy, Repeat } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { getPluginShellTokens } from '@/components/shared/plugin-shell-theme';
import { getAppAccent } from 'lib/theme/theme-tokens';
import type { ExchangeActivityReading, ExchangeDay } from 'lib/engagement/exchange-activity';

type Tokens = ReturnType<typeof getPluginShellTokens>;

function asPlainText(reading: ExchangeActivityReading): string {
  const best = reading.bestDay
    ? `${reading.bestDay.members} on ${reading.bestDay.day}`
    : 'no day on record yet';

  return [
    `Members exchanging per day — read ${reading.readAt.slice(0, 10)} (UTC)`,
    `  target: ${reading.target}`,
    `  today: ${reading.today}`,
    `  best day: ${best}`,
    `  days at or above the target: ${reading.daysAtTarget}`,
    '',
    '  last 30 days:',
    ...reading.days.map((day) => `    ${day.day}: ${day.members}`),
  ].join('\n');
}

function Stat({ label, value, tokens }: { label: string; value: string; tokens: Tokens }) {
  return (
    <div
      style={{
        borderRadius: 12,
        background: tokens.SURFACE,
        border: `1px solid ${tokens.BORDER}`,
        padding: 12,
        flex: '1 1 140px',
      }}
    >
      <div style={{ fontSize: 11, color: tokens.SUBTLE, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: tokens.TITLE, marginTop: 4 }}>{value}</div>
    </div>
  );
}

// One bar per day, drawn against the target rather than against the tallest day, so a run of quiet
// days does not rescale itself into looking busy.
function DayBar({ day, target, tokens }: { day: ExchangeDay; target: number; tokens: Tokens }) {
  const share = Math.min(1, day.members / target);
  const reached = day.members >= target;

  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
      <span style={{ fontSize: 11, color: tokens.SUBTLE, width: 74, flexShrink: 0 }}>{day.day}</span>
      <span
        aria-hidden="true"
        style={{
          height: 8,
          borderRadius: 4,
          background: reached ? tokens.ACCENT : tokens.BORDER,
          width: `${Math.max(share * 100, day.members > 0 ? 2 : 0)}%`,
          minWidth: day.members > 0 ? 3 : 0,
          transition: 'none',
        }}
      />
      <span style={{ fontSize: 11, color: day.members > 0 ? tokens.TEXT : tokens.SUBTLE }}>
        {day.members}
      </span>
    </li>
  );
}

export function DailyExchangeShell() {
  const { theme } = useTheme();
  const t = getPluginShellTokens(getAppAccent('service-credits', theme), theme);

  const [reading, setReading] = useState<ExchangeActivityReading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let canceled = false;

    async function load() {
      try {
        const response = await fetch('/api/admin/daily-exchange');
        const payload = (await response.json()) as { reading?: ExchangeActivityReading; message?: string };
        if (canceled) {
          return;
        }
        if (!response.ok) {
          setError(payload.message ?? `The reading did not load (${response.status}).`);
          return;
        }
        setReading(payload.reading ?? null);
      } catch (caught) {
        if (!canceled) {
          setError(caught instanceof Error ? caught.message : 'The reading did not load.');
        }
      }
    }

    void load();
    return () => {
      canceled = true;
    };
  }, []);

  const onCopy = useCallback(async () => {
    if (!reading) {
      return;
    }
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
        title="Daily exchange"
        accent={t.ACCENT}
        icon={<Repeat size={18} color={t.ACCENT} />}
      />
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '16px 20px 40px' }}>
        <p style={{ fontSize: 13, color: t.SUBTLE, margin: '0 0 14px', lineHeight: 1.5 }}>
          How many members traded with another member on a day. Both sides of an exchange count, and
          a member counts once however much they did. Not the same people each day — the target is a
          day&apos;s worth of people, not a total to accumulate.
        </p>

        {error && (
          <p role="alert" style={{ fontSize: 13, color: '#F87171', margin: '0 0 14px' }}>
            {error}
          </p>
        )}

        {!reading && !error && <p style={{ fontSize: 13, color: t.SUBTLE }}>Reading the days…</p>}

        {reading && (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
              <Stat label="Today" value={String(reading.today)} tokens={t} />
              <Stat label="Target" value={String(reading.target)} tokens={t} />
              <Stat
                label="Best day"
                value={reading.bestDay ? String(reading.bestDay.members) : '—'}
                tokens={t}
              />
              <Stat label="Days at target" value={String(reading.daysAtTarget)} tokens={t} />
            </div>

            <button
              type="button"
              onClick={() => void onCopy()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: t.ACCENT,
                color: '#0B0B0F',
                border: 'none',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                marginBottom: 18,
              }}
            >
              <ClipboardCopy size={15} />
              {copied ? 'Copied' : 'Copy the reading'}
            </button>

            <div style={{ fontSize: 12, color: t.SUBTLE, marginBottom: 6 }}>
              Last 30 days {reading.bestDay ? `· best so far ${reading.bestDay.members} on ${reading.bestDay.day}` : ''}
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {reading.days.map((day) => (
                <DayBar key={day.day} day={day} target={reading.target} tokens={t} />
              ))}
            </ul>

            <p style={{ fontSize: 11, color: t.SUBTLE, marginTop: 16, lineHeight: 1.6 }}>
              Counted: rides completed, rooms stayed in, calls answered, quotes settled, requests
              fulfilled, credits sent, and trainers paid for a learner. Left out: anything with only
              one person on the row, and an ongoing tie, which is confirmed once rather than done on
              a day. Two sources date a finished row by when it was last edited, because their table
              records no completion time, so an edit can move a day.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
