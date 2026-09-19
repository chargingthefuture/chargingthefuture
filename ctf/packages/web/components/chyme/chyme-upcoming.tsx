'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Radio } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { getChymeTokens } from './chyme-shared';
import { formatUpcomingWhen, pickUpcoming, type ChymeUpcomingSlot } from 'lib/chyme/upcoming';

// Scheduled rooms, MVP (owner decision, 2026-09-19): Chyme shows what is coming up on the TI Radio
// guide and nothing more — no room creation, no room per slot, no search. The guide already is the
// schedule of discussions members host in Chyme; until now Chyme did not read it, so a visitor who
// arrived at a quiet room had no way to know that something was starting at nine.
//
// Read through the guide's own public route rather than a server import: one plugin's code must
// not import another's (the plugin boundary gate), and the route is open to signed-out visitors,
// so the same read works on the member room, the signed-out page, and the Android app.

type UpcomingState =
  | { kind: 'loading' }
  | { kind: 'ready'; slots: ChymeUpcomingSlot[] }
  | { kind: 'error'; message: string };

// The route's own message when it sent one, then the status, so a 429 and a 503 read differently.
async function readUpcoming(): Promise<UpcomingState> {
  const res = await fetch('/api/ti-radio/guide', { cache: 'no-store' });
  const data: unknown = await res.json().catch(() => null);
  const body = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  if (!res.ok) {
    const message = typeof body.message === 'string' ? body.message : 'The server returned an error.';
    return { kind: 'error', message: `${message} (HTTP ${res.status})` };
  }
  const guide = typeof body.guide === 'object' && body.guide !== null ? (body.guide as Record<string, unknown>) : {};
  const slots = Array.isArray(guide.slots) ? guide.slots : [];
  return { kind: 'ready', slots: pickUpcoming(slots, new Date()) };
}

// The list itself, in the room's chrome. `refreshKey` re-reads when the page's refresh control is
// pressed, the same way the guest chat does.
export function ChymeUpcoming({ refreshKey = 0, compact = false }: { refreshKey?: number; compact?: boolean }) {
  const { theme } = useTheme();
  const t = getChymeTokens(theme);
  const [state, setState] = useState<UpcomingState>({ kind: 'loading' });

  const load = useCallback(async () => {
    try {
      setState(await readUpcoming());
    } catch (error) {
      setState({ kind: 'error', message: error instanceof Error ? error.message : 'The request did not complete.' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <section aria-label="Coming up on TI Radio" style={{ padding: compact ? '10px 12px' : '12px 14px', borderBottom: `1px solid ${t.BORDER}`, background: t.HEADER }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.FAINT }}>
          <CalendarClock size={13} /> Coming up on TI Radio
        </div>
        <a href="/ti-radio" style={{ fontSize: 12, fontWeight: 600, color: t.ACCENT, textDecoration: 'none' }}>
          Full guide →
        </a>
      </div>
      <ChymeUpcomingBody state={state} t={t} />
    </section>
  );
}

function ChymeUpcomingBody({ state, t }: { state: UpcomingState; t: ReturnType<typeof getChymeTokens> }) {
  if (state.kind === 'loading') {
    return <div style={{ fontSize: 12, color: t.FAINT }}>Reading the guide…</div>;
  }
  if (state.kind === 'error') {
    return (
      <div style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.5, wordBreak: 'break-word' }}>
        Couldn&apos;t read the TI Radio guide. {state.message}
      </div>
    );
  }
  if (state.slots.length === 0) {
    return (
      <div style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.5 }}>
        Nothing is scheduled this week. Any approved member can{' '}
        <a href="/ti-radio" style={{ color: t.ACCENT, textDecoration: 'none', fontWeight: 600 }}>book a slot on the guide</a>
        {' '}and host a discussion here.
      </div>
    );
  }
  const now = new Date();
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {state.slots.map((slot) => (
        <li
          key={slot.slotStartIso}
          style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 10, background: t.INPUT_BG, border: `1px solid ${slot.isOnAir ? t.ACCENT : t.BORDER}` }}
        >
          <div style={{ flexShrink: 0, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: slot.isOnAir ? t.ACCENT : t.TEXT, whiteSpace: 'nowrap' }}>{formatUpcomingWhen(slot.slotStartIso, slot.slotEndIso, now)}</div>
            {slot.isOnAir ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 2, fontSize: 10, fontWeight: 700, color: t.ACCENT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <Radio size={10} /> On air now
              </div>
            ) : null}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.TITLE, overflowWrap: 'anywhere' }}>{slot.title}</div>
            <div style={{ fontSize: 11, color: t.SUBTLE, marginTop: 2 }}>Hosted by @{slot.hostUsername}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
