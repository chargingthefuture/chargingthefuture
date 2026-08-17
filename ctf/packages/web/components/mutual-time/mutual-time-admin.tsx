'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Copy, Check, Link2 } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { MUTUAL_TIME_MEETING_PLUGINS } from 'lib/mutual-time/constants';
import { meetingPluginName } from 'lib/mutual-time/meeting-plugin';
import type { MutualTimeEvent } from 'lib/mutual-time/types';
import {
  getMutualTimeTokens,
  requestJson,
  eventShareUrl,
  copyToClipboard,
  detectTimeZone,
  formatResultDateTime,
} from './mutual-time-shared';

type Tokens = ReturnType<typeof getMutualTimeTokens>;

const chipStyleFor = (t: Tokens): React.CSSProperties => ({ padding: '6px 12px', borderRadius: 6, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.TITLE, fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 });

function ClosedResult({ ev, t, tz }: { ev: MutualTimeEvent; t: Tokens; tz: string }) {
  return (
    <>
      {ev.effectiveState === 'closed' && ev.resultSlotStartIso && (
        <span style={{ fontSize: 12, color: t.SUBTLE, alignSelf: 'center' }}>
          ✓ {formatResultDateTime(ev.resultSlotStartIso, tz)} · {ev.resultCanMakeIt} can make it
        </span>
      )}
      {ev.effectiveState === 'closed' && !ev.resultSlotStartIso && (
        <span style={{ fontSize: 12, color: t.SUBTLE, alignSelf: 'center' }}>No time chosen (no votes)</span>
      )}
    </>
  );
}

function EventActions({ ev, t, tz, isCopied, isClosing, onCopy, onClose }: { ev: MutualTimeEvent; t: Tokens; tz: string; isCopied: boolean; isClosing: boolean; onCopy: (slug: string) => void; onClose: (id: string) => void }) {
  const chipStyle = chipStyleFor(t);
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <button onClick={() => onCopy(ev.slug)} style={{ ...chipStyle, color: isCopied ? t.ACCENT : t.TITLE, border: `1px solid ${isCopied ? t.ACCENT : t.BORDER_SOLID}` }}>
        {isCopied ? <Check size={12} /> : <Copy size={12} />}
        {isCopied ? 'Copied' : 'Copy link'}
      </button>
      <a href={`/mutual-time/${ev.slug}`} target="_blank" rel="noreferrer" style={chipStyle}>
        <Link2 size={12} /> View
      </a>
      {ev.effectiveState !== 'closed' && (
        <button onClick={() => onClose(ev.id)} disabled={isClosing} style={{ ...chipStyle, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.30)', color: isClosing ? t.SUBTLE : '#F87171' }}>
          {isClosing ? 'Closing…' : 'Close and choose the time'}
        </button>
      )}
      <ClosedResult ev={ev} t={t} tz={tz} />
    </div>
  );
}

function EventRow({ ev, t, tz, copiedSlug, closingId, onCopy, onClose }: { ev: MutualTimeEvent; t: Tokens; tz: string; copiedSlug: string | null; closingId: string | null; onCopy: (slug: string) => void; onClose: (id: string) => void }) {
  const isScheduled = ev.effectiveState === 'scheduled';
  const isCopied = copiedSlug === ev.slug;
  const isClosing = closingId === ev.id;
  const active = ev.effectiveState !== 'closed' && !isScheduled;
  const statusText = ev.effectiveState === 'closed' ? 'closed' : isScheduled ? 'scheduled' : 'open';
  return (
    <div style={{ padding: '12px 14px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{ev.title || 'Untitled event'}</div>
          <div style={{ fontSize: 12, color: t.SUBTLE, marginTop: 2 }}>
            {ev.voterCount} voter{ev.voterCount === 1 ? '' : 's'} · {meetingPluginName(ev.meetingPlugin)}
          </div>
        </div>
        <div style={{ flexShrink: 0, padding: '3px 10px', borderRadius: 999, background: active ? `${t.ACCENT}14` : t.SURFACE, border: `1px solid ${active ? `${t.ACCENT}44` : t.BORDER_SOLID}`, fontSize: 11, fontWeight: 700, color: active ? t.ACCENT : t.SUBTLE }}>
          {statusText}
        </div>
      </div>

      <EventActions ev={ev} t={t} tz={tz} isCopied={isCopied} isClosing={isClosing} onCopy={onCopy} onClose={onClose} />
    </div>
  );
}

// Admin dashboard for Mutual Time (spec #1780): create an event (one shareable link) and manage the
// list of events you created — copy the link, open it, close a survey and choose the winning time.
// Admin-only surface (gated by the page). No credits anywhere.
export function MutualTimeAdmin() {
  const { theme } = useTheme();
  const t = getMutualTimeTokens(theme);
  const tz = detectTimeZone();

  const [events, setEvents] = useState<MutualTimeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [meetingPlugin, setMeetingPlugin] = useState<string>('chyme');
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [closingId, setClosingId] = useState<string | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await requestJson<{ ok: true; events: MutualTimeEvent[] }>('/api/mutual-time/events');
      setEvents(data.events);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load your events.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toIsoOrUndefined = (local: string): string | undefined => {
    if (!local) return undefined;
    const ms = Date.parse(local); // datetime-local is parsed in the viewer's local timezone
    return Number.isNaN(ms) ? undefined : new Date(ms).toISOString();
  };

  async function handleCreate() {
    setCreating(true);
    setFormError(null);
    setNotice(null);
    try {
      const data = await requestJson<{ ok: true; event: MutualTimeEvent }>('/api/mutual-time/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || undefined,
          description: description.trim() || undefined,
          meetingPlugin,
          opensAt: toIsoOrUndefined(opensAt),
          closesAt: toIsoOrUndefined(closesAt),
        }),
      });
      setEvents((prev) => [data.event, ...prev]);
      setNotice(`Event created. Share this link: ${eventShareUrl(data.event.slug)}`);
      setTitle('');
      setDescription('');
      setMeetingPlugin('chyme');
      setOpensAt('');
      setClosesAt('');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not create the event.');
    } finally {
      setCreating(false);
    }
  }

  async function handleClose(id: string) {
    setClosingId(id);
    try {
      const data = await requestJson<{ ok: true; event: MutualTimeEvent }>(`/api/mutual-time/events/${id}/close`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      setEvents((prev) => prev.map((e) => (e.id === id ? data.event : e)));
      setNotice(data.event.resultSlotStartIso ? 'Survey closed. Winning time chosen.' : 'Survey closed. No votes were cast, so no time was chosen.');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not close the event.');
    } finally {
      setClosingId(null);
    }
  }

  async function handleCopy(slug: string) {
    const ok = await copyToClipboard(eventShareUrl(slug));
    if (ok) {
      setCopiedSlug(slug);
      window.setTimeout(() => setCopiedSlug(null), 1500);
    }
  }

  const card: React.CSSProperties = { marginTop: 20, borderRadius: 14, background: t.HEADER, border: `1px solid ${t.BORDER_SOLID}`, padding: 20 };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: t.SUBTLE, margin: '10px 0 4px' };
  // maxWidth + minWidth 0 keep a field inside the phone-width column even when the control has a wide
  // intrinsic size — a `datetime-local` input reports one wider than the column on iOS Safari.
  const inputStyle: React.CSSProperties = { width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, borderRadius: 10, padding: '10px 12px', color: t.TITLE, fontSize: 14, fontFamily: 'inherit' };

  return (
    <div style={{ background: t.BG, minHeight: '100vh', color: t.TITLE }}>
      {/* Shared top nav (same as other pages): accent back chevron + brand icon + title, plus the
          bug/settings/avatar actions cluster. */}
      <MobileScreenHeader title="Mutual Time" accent={t.ACCENT} icon={<CalendarClock size={18} color={t.ACCENT} />} />
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '20px 20px 32px' }}>
        <p style={{ color: t.SUBTLE, fontSize: 14, marginTop: 4 }}>
          Create a one-link scheduling survey. Members vote in their own timezone; the app picks the time with the most overlap.
        </p>

        {notice && (
          <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.ACCENT}55`, fontSize: 13, color: t.ACCENT, wordBreak: 'break-word' }}>
            {notice}
          </div>
        )}

        {/* Create form */}
        <section style={card}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px' }}>Create a new event</h2>

          <label htmlFor="mt-title" style={labelStyle}>Title (optional)</label>
          <input id="mt-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Weekly check-in — when works for everyone?" style={inputStyle} />

          <label htmlFor="mt-description" style={labelStyle}>Description (optional)</label>
          <textarea id="mt-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Add context for voters…" style={{ ...inputStyle, resize: 'vertical' }} />

          <label htmlFor="mt-plugin" style={labelStyle}>Where we&apos;ll meet</label>
          <select id="mt-plugin" value={meetingPlugin} onChange={(e) => setMeetingPlugin(e.target.value)} style={inputStyle}>
            {MUTUAL_TIME_MEETING_PLUGINS.map((p) => (
              <option key={p} value={p}>{meetingPluginName(p)}</option>
            ))}
          </select>
          <p style={{ fontSize: 12, color: t.SUBTLE, margin: '4px 0 10px' }}>After the time is chosen, voters see a link directly to this plugin.</p>

          {/* Stack the two datetime-local fields: side by side they overflowed the phone-width column
              (each datetime picker has a wide intrinsic min-width). Mobile-first = one column.
              `minmax(0, 1fr)` + `minWidth: 0` are both needed: a grid track defaults to a floor of the
              item's min-content width, so without them the datetime picker's wide intrinsic size grew
              the track and pushed the field past the right edge of the card. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <label htmlFor="mt-opens" style={labelStyle}>Survey opens (optional)</label>
              <input id="mt-opens" type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} style={inputStyle} />
              <p style={{ fontSize: 11, color: t.SUBTLE, margin: '4px 0 0' }}>Leave blank to open immediately.</p>
            </div>
            <div style={{ minWidth: 0 }}>
              <label htmlFor="mt-closes" style={labelStyle}>Survey closes (optional)</label>
              <input id="mt-closes" type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} style={inputStyle} />
              <p style={{ fontSize: 11, color: t.SUBTLE, margin: '4px 0 0' }}>Leave blank to close manually below.</p>
            </div>
          </div>

          {formError && <div style={{ marginTop: 12, fontSize: 13, color: '#F87171' }}>{formError}</div>}

          <button
            onClick={handleCreate}
            disabled={creating}
            style={{ padding: '10px 20px', borderRadius: 10, background: `${t.ACCENT}20`, border: `1px solid ${t.ACCENT}55`, color: t.ACCENT, fontSize: 14, fontWeight: 700, cursor: creating ? 'not-allowed' : 'pointer', marginTop: 16 }}
          >
            {creating ? 'Creating…' : 'Create event'}
          </button>
        </section>

        {/* Event list */}
        <section style={card}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px' }}>Your events</h2>
          {loading ? (
            <div style={{ color: t.SUBTLE, fontSize: 14 }}>Loading…</div>
          ) : loadError ? (
            <div style={{ color: '#F87171', fontSize: 14 }}>{loadError}</div>
          ) : events.length === 0 ? (
            <div style={{ color: t.SUBTLE, fontSize: 14 }}>No events yet. Create one above and share its link.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {events.map((ev) => (
                <EventRow key={ev.id} ev={ev} t={t} tz={tz} copiedSlug={copiedSlug} closingId={closingId} onCopy={handleCopy} onClose={handleClose} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
