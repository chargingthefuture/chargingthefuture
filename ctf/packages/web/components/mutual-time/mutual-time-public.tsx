'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Copy, Check, Globe, ChevronDown, Clock, Lock } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { MUTUAL_TIME_MAX_PICKS } from 'lib/mutual-time/constants';
import type { MutualTimePublicEvent, MutualTimeViewerState } from 'lib/mutual-time/types';
import {
  getMutualTimeTokens,
  requestJson,
  eventShareUrl,
  copyToClipboard,
  detectTimeZone,
  listTimeZones,
  timeZoneLabel,
  formatSlotTime,
  formatSlotRange,
  formatSlotDate,
  formatResultDateTime,
  localDateKey,
  localPeriod,
} from './mutual-time-shared';

type Props = {
  initialEvent: MutualTimePublicEvent;
  initialViewer: MutualTimeViewerState;
  isSignedIn: boolean;
  signInUrl: string;
  verifyUrl?: string;
};

// The public, one-link surface for a Mutual Time event (spec #1780). Renders one of three states from
// the event's effective state + the viewer's access: the result (closed), the vote grid (open + an
// approved member), or the sign-in/listen-in gate (open + signed-out or locked). Everything renders in
// the viewer's own timezone (auto-detected, changeable).
export function MutualTimePublic({ initialEvent, initialViewer, isSignedIn, signInUrl, verifyUrl }: Props) {
  const { theme } = useTheme();
  const t = getMutualTimeTokens(theme);

  const [event, setEvent] = useState(initialEvent);
  const [picks, setPicks] = useState<string[]>(initialViewer.picks);
  const [tz, setTz] = useState<string>('UTC');
  const [showTz, setShowTz] = useState(false);
  const [copied, setCopied] = useState(false);

  // Detect the viewer's timezone on mount (client-only, so SSR stays deterministic).
  useEffect(() => {
    setTz(detectTimeZone());
  }, []);

  const [canVote, setCanVote] = useState(initialViewer.canVote);

  const onCopy = useCallback(async () => {
    const ok = await copyToClipboard(eventShareUrl(event.slug));
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  }, [event.slug]);

  const header = (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <CalendarClock size={22} style={{ color: t.ACCENT }} />
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{event.title || 'Meeting time'}</h1>
      </div>
      <button
        onClick={onCopy}
        style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: copied ? t.ACCENT : t.SUBTLE, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? 'Copied' : 'Copy link'}
      </button>
    </div>
  );

  const closesLabel = event.closesAtIso ? formatSlotDate(event.closesAtIso, tz) : null;

  return (
    <div style={{ background: t.BG, minHeight: '100vh', color: t.TITLE }}>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '32px 20px' }}>
        {header}
        {event.description && <p style={{ color: t.SUBTLE, fontSize: 14, margin: '0 0 16px' }}>{event.description}</p>}

        {event.effectiveState === 'closed' ? (
          <ResultView event={event} tz={tz} canVote={canVote} t={t} />
        ) : event.effectiveState === 'scheduled' ? (
          <ScheduledView event={event} tz={tz} t={t} />
        ) : canVote ? (
          <VoteView
            event={event}
            tz={tz}
            picks={picks}
            setPicks={setPicks}
            setEvent={setEvent}
            setCanVote={setCanVote}
            showTz={showTz}
            setShowTz={setShowTz}
            setTz={setTz}
            closesLabel={closesLabel}
            t={t}
          />
        ) : (
          <GateView isSignedIn={isSignedIn} signInUrl={signInUrl} verifyUrl={verifyUrl} closesLabel={closesLabel} t={t} />
        )}
      </div>
    </div>
  );
}

type Tokens = ReturnType<typeof getMutualTimeTokens>;

function StatusChip({ label, accentActive, t }: { label: string; accentActive: boolean; t: Tokens }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 12px', borderRadius: 999, background: accentActive ? `${t.ACCENT}14` : t.SURFACE, border: `1px solid ${accentActive ? `${t.ACCENT}44` : t.BORDER_SOLID}`, fontSize: 12, fontWeight: 600, color: accentActive ? t.ACCENT : t.SUBTLE, marginBottom: 14 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: accentActive ? t.ACCENT : t.SUBTLE }} />
      {label}
    </div>
  );
}

function ResultView({ event, tz, canVote, t }: { event: MutualTimePublicEvent; tz: string; canVote: boolean; t: Tokens }) {
  return (
    <>
      <StatusChip label="Closed — time chosen" accentActive={false} t={t} />
      <div style={{ borderRadius: 14, background: t.HEADER, border: `1px solid ${t.BORDER_SOLID}`, padding: '32px 24px', marginTop: 16, textAlign: 'center' }}>
        <CalendarClock size={32} style={{ color: t.ACCENT, display: 'block', margin: '0 auto 12px' }} />
        {event.resultSlotStartIso ? (
          <>
            <div style={{ fontSize: 22, fontWeight: 700, color: t.TITLE, marginBottom: 6 }}>{formatResultDateTime(event.resultSlotStartIso, tz)}</div>
            <div style={{ fontSize: 14, color: t.SUBTLE, marginBottom: 6 }}>Times shown in {timeZoneLabel(tz)}</div>
            <div style={{ fontSize: 13, color: t.SUBTLE, marginBottom: 20 }}>{event.resultCanMakeIt} member{event.resultCanMakeIt === 1 ? '' : 's'} can make it</div>
            <div style={{ fontSize: 14, color: t.TITLE, marginBottom: 16 }}>
              We&apos;re meeting in <strong style={{ color: t.ACCENT }}>{event.meetingPluginName}</strong>
            </div>
            <a href={event.meetingPluginRoute} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, background: `${t.ACCENT}20`, border: `1px solid ${t.ACCENT}55`, color: t.ACCENT, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              <Clock size={15} /> Go to {event.meetingPluginName}
            </a>
            {!canVote && (
              <div style={{ marginTop: 24, padding: '14px 18px', borderRadius: 14, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, fontSize: 13, color: t.SUBTLE, textAlign: 'left' }}>
                You didn&apos;t vote, but you&apos;re still welcome to join. Head to <strong style={{ color: t.ACCENT }}>{event.meetingPluginName}</strong> at the time above — the meeting is there, and listeners are always welcome.
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 15, color: t.SUBTLE }}>This survey closed with no votes, so no time was chosen.</div>
        )}
      </div>
    </>
  );
}

function ScheduledView({ event, tz, t }: { event: MutualTimePublicEvent; tz: string; t: Tokens }) {
  const opensLabel = event.opensAtIso ? formatResultDateTime(event.opensAtIso, tz) : 'soon';
  return (
    <>
      <StatusChip label="Voting hasn't opened yet" accentActive={false} t={t} />
      <div style={{ borderRadius: 14, background: t.HEADER, border: `1px solid ${t.BORDER_SOLID}`, padding: '32px 24px', marginTop: 16, textAlign: 'center' }}>
        <Clock size={28} style={{ color: t.SUBTLE, display: 'block', margin: '0 auto 12px' }} />
        <div style={{ fontSize: 15, fontWeight: 600, color: t.TITLE, marginBottom: 6 }}>Voting opens {opensLabel}</div>
        <div style={{ fontSize: 13, color: t.SUBTLE }}>Times shown in {timeZoneLabel(tz)}. Check back when voting opens to pick your times.</div>
      </div>
    </>
  );
}

function GateView({ isSignedIn, signInUrl, verifyUrl, closesLabel, t }: { isSignedIn: boolean; signInUrl: string; verifyUrl?: string; closesLabel: string | null; t: Tokens }) {
  return (
    <>
      <StatusChip label={closesLabel ? `Voting open · closes ${closesLabel}` : 'Voting open'} accentActive t={t} />
      <div style={{ borderRadius: 14, background: t.HEADER, border: `1px solid ${t.BORDER_SOLID}`, padding: '36px 24px', marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12 }}>
        <Lock size={28} style={{ color: t.SUBTLE }} />
        <div style={{ fontSize: 15, fontWeight: 600, color: t.TITLE }}>
          {isSignedIn ? 'Approved members can vote' : 'Sign in and get approved to vote'}
        </div>
        <p style={{ fontSize: 13, color: t.SUBTLE, margin: 0, maxWidth: 400 }}>
          {isSignedIn
            ? "Voting is for members who've been approved through the Unlock process. Once your approval comes through you'll be able to vote here. No vote yet? You're still welcome — come listen in at whatever time we land on."
            : "Voting is for approved members. If you don't have an account yet, you can still come listen in at the time we land on — this link is your invite."}
        </p>
        <a href={isSignedIn && verifyUrl ? verifyUrl : signInUrl} style={{ display: 'inline-block', padding: '10px 20px', borderRadius: 10, background: `${t.ACCENT}20`, border: `1px solid ${t.ACCENT}55`, color: t.ACCENT, fontSize: 14, fontWeight: 700, textDecoration: 'none', marginTop: 4 }}>
          {isSignedIn && verifyUrl ? 'Go to verification' : 'Sign in to vote'}
        </a>
      </div>
    </>
  );
}

function VoteView({
  event,
  tz,
  picks,
  setPicks,
  setEvent,
  setCanVote,
  showTz,
  setShowTz,
  setTz,
  closesLabel,
  t,
}: {
  event: MutualTimePublicEvent;
  tz: string;
  picks: string[];
  setPicks: (next: string[]) => void;
  setEvent: (next: MutualTimePublicEvent) => void;
  setCanVote: (v: boolean) => void;
  showTz: boolean;
  setShowTz: (v: boolean) => void;
  setTz: (v: string) => void;
  closesLabel: string | null;
  t: Tokens;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const atMax = picks.length >= MUTUAL_TIME_MAX_PICKS;

  // Group candidate slots by the viewer's LOCAL date, then by local period. Recomputed when tz changes.
  const { dateKeys, dateLabels, slotsByDate } = useMemo(() => {
    const byDate = new Map<string, string[]>();
    const labels = new Map<string, string>();
    for (const iso of event.candidateSlots) {
      const key = localDateKey(iso, tz);
      if (!byDate.has(key)) {
        byDate.set(key, []);
        labels.set(key, formatSlotDate(iso, tz));
      }
      byDate.get(key)!.push(iso);
    }
    const keys = Array.from(byDate.keys()).sort();
    return { dateKeys: keys, dateLabels: labels, slotsByDate: byDate };
  }, [event.candidateSlots, tz]);

  const currentDate = activeDate && dateKeys.includes(activeDate) ? activeDate : dateKeys[0] ?? null;

  const periods = useMemo(() => {
    if (!currentDate) return [] as { label: string; order: number; slots: string[] }[];
    const groups = new Map<number, { label: string; order: number; slots: string[] }>();
    for (const iso of slotsByDate.get(currentDate) ?? []) {
      const p = localPeriod(iso, tz);
      if (!groups.has(p.order)) {
        groups.set(p.order, { label: p.label, order: p.order, slots: [] });
      }
      groups.get(p.order)!.slots.push(iso);
    }
    return Array.from(groups.values()).sort((a, b) => a.order - b.order);
  }, [currentDate, slotsByDate, tz]);

  const toggle = (iso: string) => {
    setSaved(false);
    if (picks.includes(iso)) {
      setPicks(picks.filter((p) => p !== iso));
    } else if (!atMax) {
      setPicks([...picks, iso]);
    }
  };

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const data = await requestJson<{ ok: true; picks: string[] }>(`/api/mutual-time/event/${event.slug}/vote`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slots: picks }),
      });
      setPicks(data.picks);
      setSaved(true);
      // Refresh the voter count shown in the status area, and reconcile the viewer's own state
      // (canVote, picks) from the same fresh read so the UI never renders off a load-time snapshot —
      // e.g. if the event closed or the viewer's approval changed between load and save.
      try {
        const refreshed = await requestJson<{ ok: true; event: MutualTimePublicEvent; viewer: MutualTimeViewerState }>(
          `/api/mutual-time/event/${event.slug}`,
        );
        setEvent(refreshed.event);
        if (refreshed.viewer) {
          setCanVote(refreshed.viewer.canVote);
          setPicks(refreshed.viewer.picks);
        }
      } catch {
        /* count refresh is best-effort */
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your picks.');
    } finally {
      setSaving(false);
    }
  }

  const picksOnDate = (key: string) => picks.filter((p) => localDateKey(p, tz) === key).length;

  return (
    <>
      <StatusChip label={closesLabel ? `Voting open · closes ${closesLabel}` : 'Voting open'} accentActive t={t} />
      <p style={{ color: t.SUBTLE, fontSize: 14, margin: '0 0 16px' }}>When works for everyone? Pick up to {MUTUAL_TIME_MAX_PICKS} windows — we&apos;ll find the overlap.</p>

      {saved && (
        <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.ACCENT}55`, color: t.ACCENT, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Check size={14} /> Your picks are saved.
        </div>
      )}

      <div style={{ borderRadius: 14, background: t.HEADER, border: `1px solid ${t.BORDER_SOLID}`, padding: 20, marginTop: 4 }}>
        {/* Timezone row */}
        <div style={{ marginBottom: 18 }}>
          <button onClick={() => setShowTz(!showTz)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: t.SUBTLE, fontSize: 13, fontWeight: 500, padding: 0 }}>
            <Globe size={13} /> Times shown in {timeZoneLabel(tz)}
            <ChevronDown size={12} style={{ transform: showTz ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          </button>
          {showTz && (
            <div style={{ marginTop: 8 }}>
              <select value={tz} onChange={(e) => setTz(e.target.value)} style={{ background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, borderRadius: 10, color: t.TITLE, fontSize: 13, padding: '8px 10px', maxWidth: 320, width: '100%' }}>
                {listTimeZones().map((z) => (
                  <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>
                ))}
              </select>
              <div style={{ fontSize: 11, color: t.SUBTLE, marginTop: 4 }}>Traveling or using a VPN? Pick the timezone you&apos;re actually in.</div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: t.TITLE }}>Pick up to {MUTUAL_TIME_MAX_PICKS} one-hour windows you&apos;re free</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: atMax ? t.ACCENT : t.SUBTLE }}>{picks.length} of {MUTUAL_TIME_MAX_PICKS} selected</span>
        </div>

        {/* Date chips */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 14 }}>
          {dateKeys.map((key) => {
            const isActive = key === currentDate;
            const count = picksOnDate(key);
            return (
              <button key={key} onClick={() => setActiveDate(key)} style={{ position: 'relative', flexShrink: 0, padding: '7px 12px', borderRadius: 6, background: isActive ? `${t.ACCENT}22` : t.SURFACE, border: `1px solid ${isActive ? t.ACCENT : t.BORDER_SOLID}`, color: isActive ? t.ACCENT : t.SUBTLE, fontSize: 12, fontWeight: isActive ? 700 : 400, cursor: 'pointer' }}>
                {dateLabels.get(key)}
                {count > 0 && <span style={{ position: 'absolute', top: -5, right: -5, width: 14, height: 14, borderRadius: '50%', background: t.ACCENT, color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Slot grid */}
        <div style={{ borderRadius: 14, border: `1px solid ${t.BORDER_SOLID}`, background: t.HEADER, marginBottom: 16, overflow: 'hidden' }}>
          {periods.length === 0 ? (
            <div style={{ padding: 14, color: t.SUBTLE, fontSize: 13 }}>No times on this day.</div>
          ) : (
            periods.map((period) => (
              <div key={period.order} style={{ padding: '10px 14px', borderBottom: `1px solid ${t.BORDER_SOLID}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.SUBTLE, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{period.label}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {period.slots.map((iso) => {
                    const isSel = picks.includes(iso);
                    const isDis = !isSel && atMax;
                    return (
                      <button key={iso} onClick={() => !isDis && toggle(iso)} style={{ padding: '5px 10px', borderRadius: 6, background: isSel ? `${t.ACCENT}22` : t.SURFACE, border: `1px solid ${isSel ? t.ACCENT : t.BORDER_SOLID}`, color: isSel ? t.ACCENT : isDis ? t.SUBTLE : t.TITLE, fontSize: 12, fontWeight: isSel ? 700 : 400, cursor: isDis ? 'not-allowed' : 'pointer', opacity: isDis ? 0.4 : 1, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {isSel && <Check size={11} />}
                        {formatSlotTime(iso, tz)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Picks summary */}
        {picks.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.SUBTLE, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your picks</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[...picks].sort().map((iso) => (
                <div key={iso} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 6, background: `${t.ACCENT}12`, border: `1px solid ${t.ACCENT}40`, fontSize: 13, color: t.TITLE }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={12} style={{ color: t.ACCENT }} /> {formatSlotDate(iso, tz)} · {formatSlotRange(iso, tz)}
                  </span>
                  <button onClick={() => toggle(iso)} style={{ background: 'transparent', border: 'none', color: t.SUBTLE, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>remove</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <div style={{ marginBottom: 10, fontSize: 13, color: '#F87171' }}>{error}</div>}

        <button
          onClick={save}
          disabled={saving}
          style={{ padding: '10px 20px', borderRadius: 10, background: `${t.ACCENT}22`, border: `1px solid ${t.ACCENT}`, color: t.ACCENT, fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}
        >
          {saving ? 'Saving…' : picks.length === 0 ? 'Clear my picks' : 'Save my picks'}
        </button>
      </div>
    </>
  );
}
