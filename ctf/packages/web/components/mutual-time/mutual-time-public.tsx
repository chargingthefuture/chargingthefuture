'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Copy, Check, Globe, ChevronDown, Clock, Lock, ArrowUpRight } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { BackChevronButton, useSmartBack } from '@/lib/nav/back-history';
import { MUTUAL_TIME_MAX_PICKS } from 'lib/mutual-time/constants';
import type { MutualTimePublicEvent, MutualTimeViewerState } from 'lib/mutual-time/types';
import { SlotPicker, PicksSummary } from './mutual-time-slot-picker';
import {
  getMutualTimeTokens,
  requestJson,
  eventShareUrl,
  copyToClipboard,
  detectTimeZone,
  listTimeZones,
  timeZoneLabel,
  formatSlotDate,
  formatResultDateTime,
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

  // Detect the viewer's timezone on mount (client-only, so SSR stays deterministic).
  useEffect(() => {
    setTz(detectTimeZone());
  }, []);

  const [canVote, setCanVote] = useState(initialViewer.canVote);

  return (
    <div style={{ background: t.BG, minHeight: '100vh', color: t.TITLE }}>
      {/* Way back (rule 134). A signed-in member gets the standard top bar every other screen has —
          back chevron, brand icon, title, and the bug/settings/account cluster — so the way back sits
          where they expect it. A signed-out visitor does not: that bar would offer them an account
          menu and a settings link they cannot use. Their back control lives in the page header below. */}
      {isSignedIn && (
        <MobileScreenHeader title="Mutual Time" accent={t.ACCENT} icon={<CalendarClock size={18} color={t.ACCENT} />} />
      )}
      <div style={{ maxWidth: 780, margin: '0 auto', padding: isSignedIn ? '20px 20px 32px' : '32px 20px' }}>
        <EventHeader event={event} isSignedIn={isSignedIn} t={t} />
        <EventBody
          event={event}
          setEvent={setEvent}
          tz={tz}
          setTz={setTz}
          showTz={showTz}
          setShowTz={setShowTz}
          picks={picks}
          setPicks={setPicks}
          canVote={canVote}
          setCanVote={setCanVote}
          isSignedIn={isSignedIn}
          signInUrl={signInUrl}
          verifyUrl={verifyUrl}
          t={t}
        />
      </div>
    </div>
  );
}

// The page's own header: the event name, the Copy-link button, and — for a signed-out visitor only —
// the shared back chevron.
//
// That chevron shows only when there is somewhere in-app to go back to. A visitor usually arrives here
// from a link pasted somewhere else entirely, so there is nothing in-app behind them; the one-level-up
// fallback would push them to the all-apps page, which needs an account. Their browser's own back still
// returns them to wherever the link came from. A signed-in member never needs it here — they already
// have the standard top bar above.
function EventHeader({ event, isSignedIn, t }: { event: MutualTimePublicEvent; isSignedIn: boolean; t: Tokens }) {
  const [copied, setCopied] = useState(false);
  const { hasHistory } = useSmartBack();
  const showVisitorBack = !isSignedIn && hasHistory;

  const onCopy = useCallback(async () => {
    const ok = await copyToClipboard(eventShareUrl(event.slug));
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  }, [event.slug]);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {showVisitorBack && <BackChevronButton accent={t.ACCENT} size={34} />}
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
}

// Picks the one view the visitor should see: the result (closed), the not-yet-open notice, the vote
// grid (open + an approved member), or the sign-in / listen-in gate.
function EventBody({
  event,
  setEvent,
  tz,
  setTz,
  showTz,
  setShowTz,
  picks,
  setPicks,
  canVote,
  setCanVote,
  isSignedIn,
  signInUrl,
  verifyUrl,
  t,
}: {
  event: MutualTimePublicEvent;
  setEvent: (next: MutualTimePublicEvent) => void;
  tz: string;
  setTz: (v: string) => void;
  showTz: boolean;
  setShowTz: (v: boolean) => void;
  picks: string[];
  setPicks: (next: string[]) => void;
  canVote: boolean;
  setCanVote: (v: boolean) => void;
  isSignedIn: boolean;
  signInUrl: string;
  verifyUrl?: string;
  t: Tokens;
}) {
  const closesLabel = event.closesAtIso ? formatSlotDate(event.closesAtIso, tz) : null;

  return (
    <>
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
        <GateView event={event} tz={tz} isSignedIn={isSignedIn} signInUrl={signInUrl} verifyUrl={verifyUrl} closesLabel={closesLabel} t={t} />
      )}
    </>
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
      <MeetingPlaceRow event={event} t={t} />
      <div style={{ borderRadius: 14, background: t.HEADER, border: `1px solid ${t.BORDER_SOLID}`, padding: '32px 24px', textAlign: 'center' }}>
        <Clock size={28} style={{ color: t.SUBTLE, display: 'block', margin: '0 auto 12px' }} />
        <div style={{ fontSize: 15, fontWeight: 600, color: t.TITLE, marginBottom: 6 }}>Voting opens {opensLabel}</div>
        <div style={{ fontSize: 13, color: t.SUBTLE }}>Times shown in {timeZoneLabel(tz)}. Check back when voting opens to pick your times.</div>
      </div>
    </>
  );
}

// Where the meeting itself happens, shown before the time is picked as well as after. A visitor who
// lands on the link should know what they're being invited to — and be able to go look at it — without
// waiting for the survey to close. The href is the in-app plugin route, so it stays on this host.
function MeetingPlaceRow({ event, t }: { event: MutualTimePublicEvent; t: Tokens }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '12px 16px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, marginBottom: 16 }}>
      <span style={{ fontSize: 13, color: t.SUBTLE }}>
        We&apos;ll meet in <strong style={{ color: t.ACCENT, fontWeight: 700 }}>{event.meetingPluginName}</strong>
      </span>
      <a href={event.meetingPluginRoute} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, background: `${t.ACCENT}18`, border: `1px solid ${t.ACCENT}44`, color: t.ACCENT, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
        Go to {event.meetingPluginName} <ArrowUpRight size={13} />
      </a>
    </div>
  );
}

// The signed-out / not-yet-approved view. It shows the real voting form underneath the sign-in prompt,
// grayed out and inert, so a visitor sees the actual days and times on offer rather than only a locked
// box — the reason to sign in is visible, not described.
function GateView({ event, tz, isSignedIn, signInUrl, verifyUrl, closesLabel, t }: { event: MutualTimePublicEvent; tz: string; isSignedIn: boolean; signInUrl: string; verifyUrl?: string; closesLabel: string | null; t: Tokens }) {
  return (
    <>
      <StatusChip label={closesLabel ? `Voting open · closes ${closesLabel}` : 'Voting open'} accentActive t={t} />
      <p style={{ color: t.SUBTLE, fontSize: 14, margin: '0 0 16px' }}>When works for everyone? Pick up to {MUTUAL_TIME_MAX_PICKS} windows — we&apos;ll find the overlap.</p>

      <MeetingPlaceRow event={event} t={t} />

      <div style={{ borderRadius: 14, background: t.HEADER, border: `1px solid ${t.BORDER_SOLID}`, padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12 }}>
        <Lock size={26} style={{ color: t.SUBTLE }} />
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

      <div style={{ fontSize: 12, fontWeight: 600, color: t.SUBTLE, margin: '20px 0 8px', textAlign: 'center' }}>
        Here are the times on offer — sign in to pick yours
      </div>
      {/* Inert preview of the real form: no taps, no keyboard focus, skipped by screen readers (the
          prompt above already says everything a non-voter needs). */}
      <div aria-hidden="true" style={{ borderRadius: 14, background: t.HEADER, border: `1px solid ${t.BORDER_SOLID}`, padding: 20, opacity: 0.45, pointerEvents: 'none', userSelect: 'none' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: t.SUBTLE, fontSize: 13, fontWeight: 500, marginBottom: 18 }}>
          <Globe size={13} /> Times shown in {timeZoneLabel(tz)}
        </div>
        <SlotPicker event={event} tz={tz} picks={[]} toggle={() => {}} disabled t={t} />
      </div>
    </>
  );
}

function TimeZoneRow({ tz, showTz, setShowTz, setTz, t }: { tz: string; showTz: boolean; setShowTz: (v: boolean) => void; setTz: (v: string) => void; t: Tokens }) {
  return (
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
  );
}

// The button under the grid. It only offers to clear when there is something saved to clear: with no
// picks selected and nothing saved yet it reads "Save my picks" and is switched off, so a first-time
// voter is never shown a Clear button before they have picked anything.
function SaveBar({ saving, picks, hasSavedPicks, save, t }: { saving: boolean; picks: string[]; hasSavedPicks: boolean; save: () => void; t: Tokens }) {
  const hasSelection = picks.length > 0;
  const isClear = !hasSelection && hasSavedPicks;
  const nothingToDo = !hasSelection && !hasSavedPicks;
  const inactive = saving || nothingToDo;
  const tone: React.CSSProperties = inactive
    ? { background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.SUBTLE, cursor: 'not-allowed' }
    : { background: `${t.ACCENT}22`, border: `1px solid ${t.ACCENT}`, color: t.ACCENT, cursor: 'pointer' };
  const label = saving ? 'Saving…' : isClear ? 'Clear my picks' : 'Save my picks';
  const showHint = nothingToDo && !saving;
  return (
    <div>
      <button onClick={save} disabled={inactive} style={{ ...tone, padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700 }}>
        {label}
      </button>
      {showHint && <div style={{ fontSize: 12, color: t.SUBTLE, marginTop: 8 }}>Pick a time above, then save.</div>}
    </div>
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
  // What the server currently holds for this voter, as opposed to what they have selected on screen.
  // The two differ the moment they deselect everything, and that gap is what makes "Clear my picks"
  // the right label — without it the button offered to clear picks nobody had made yet.
  const [savedPicks, setSavedPicks] = useState<string[]>(picks);
  const atMax = picks.length >= MUTUAL_TIME_MAX_PICKS;

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
      setSavedPicks(data.picks);
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
          setSavedPicks(refreshed.viewer.picks);
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

  return (
    <>
      <StatusChip label={closesLabel ? `Voting open · closes ${closesLabel}` : 'Voting open'} accentActive t={t} />
      <p style={{ color: t.SUBTLE, fontSize: 14, margin: '0 0 16px' }}>When works for everyone? Pick up to {MUTUAL_TIME_MAX_PICKS} windows — we&apos;ll find the overlap.</p>

      <MeetingPlaceRow event={event} t={t} />

      {saved && (
        <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.ACCENT}55`, color: t.ACCENT, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Check size={14} /> Your picks are saved.
        </div>
      )}

      <div style={{ borderRadius: 14, background: t.HEADER, border: `1px solid ${t.BORDER_SOLID}`, padding: 20, marginTop: 4 }}>
        {/* Timezone row */}
        <TimeZoneRow tz={tz} showTz={showTz} setShowTz={setShowTz} setTz={setTz} t={t} />

        {/* Count row, day chips, and the grid of one-hour windows */}
        <SlotPicker event={event} tz={tz} picks={picks} toggle={toggle} t={t} />

        {/* Picks summary */}
        <PicksSummary picks={picks} tz={tz} toggle={toggle} t={t} />

        {error && <div style={{ marginBottom: 10, fontSize: 13, color: '#F87171' }}>{error}</div>}

        <SaveBar saving={saving} picks={picks} hasSavedPicks={savedPicks.length > 0} save={save} t={t} />
      </div>
    </>
  );
}
