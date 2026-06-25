'use client';

// Beacon admin broadcaster + controls. Dark admin design system (rule 131). One column, mobile
// responsive. The admin can:
//   - create an event (title + description)
//   - go live: see the per-event RTMP url/key (for a phone broadcaster app) and a "Share screen"
//     button (desktop in-browser screen-share), both feeding the same livestream call
//   - read the live chat and moderate (mute / ban / slow-mode)
//   - end the event (stops the broadcast and billing)
//   - see event history with recordings
//
// Binds the Beacon API routes: POST /api/beacon, GET /api/beacon/admin, GET /api/beacon/[id]/ingest,
// POST /api/beacon/[id]/go-live, POST /api/beacon/[id]/end, POST /api/beacon/[id]/moderate, and the
// member chat token route for the admin's own chat view.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Radio, Copy, Check } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { StreamChatPanel } from '@/components/shared/stream-chat-panel';
import { BeaconHostStage, type BeaconHostCredentials } from './beacon-host-stage';
import { BEACON_COLOR } from 'lib/beacon/constants';

const BG = '#0F1117';
const PANEL = '#0D0F14';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#9CA3AF';

type BeaconEvent = {
  id: string;
  title: string;
  description: string;
  status: 'draft' | 'live' | 'ended';
  startedAtIso: string | null;
  endedAtIso: string | null;
  recordingUrl: string | null;
  commonsLivePostId: string | null;
  commonsRecordingPostId: string | null;
  createdAtIso: string;
};

type IngestResponse = {
  ok: boolean;
  rtmpIngestUrl: string;
  streamKey: string;
  streamApiKey: string;
  streamCallType: string;
  streamCallId: string;
  streamUserId: string;
  hostToken: string;
};

type ChatCredentials = {
  streamApiKey: string;
  streamChannelType: string;
  streamChannelId: string;
  streamUserId: string;
  streamToken: string;
};

async function adminMutate<T = unknown>(url: string, method: 'POST', body?: unknown): Promise<{ ok: boolean; data: T | null; message?: string }> {
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as (T & { message?: string; code?: string }) | null;
    if (res.ok) return { ok: true, data: data as T };
    return { ok: false, data: null, message: data?.message ?? data?.code ?? `Request failed (${res.status}).` };
  } catch {
    return { ok: false, data: null, message: 'Network error. Try again.' };
  }
}

export function BeaconAdminShell() {
  const isMobile = useIsMobile();
  const [events, setEvents] = useState<BeaconEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [ingest, setIngest] = useState<IngestResponse | null>(null);
  const [host, setHost] = useState<BeaconHostCredentials | null>(null);
  const [chat, setChat] = useState<ChatCredentials | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [moderateTarget, setModerateTarget] = useState('');
  const broadcastSectionRef = useRef<HTMLElement | null>(null);

  const loadEvents = useCallback(async () => {
    const res = await fetch('/api/beacon/admin', { cache: 'no-store' });
    if (!res.ok) throw new Error('Could not load events.');
    const data = (await res.json()) as { ok: boolean; events: BeaconEvent[] };
    setEvents(data.events ?? []);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await loadEvents();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not load the admin data.');
      } finally {
        setLoading(false);
      }
    })();
  }, [loadEvents]);

  const activeEvent = events.find((event) => event.id === activeEventId) ?? null;

  // When an event is selected (Open in the history list, or Create draft), scroll the Broadcast
  // section into view. On mobile the Broadcast section renders above the Event history, so without
  // this the selection happens off-screen and Open looks like it did nothing.
  useEffect(() => {
    if (activeEventId && broadcastSectionRef.current) {
      broadcastSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeEventId]);

  const createEvent = useCallback(async () => {
    if (title.trim().length === 0) {
      setError('Add a title first.');
      return;
    }
    setCreating(true);
    setError(null);
    setNotice(null);
    const result = await adminMutate<{ event: BeaconEvent }>('/api/beacon', 'POST', {
      title: title.trim(),
      description: description.trim(),
    });
    if (!result.ok || !result.data) {
      setError(result.message ?? 'Could not create the event.');
    } else {
      setNotice('Event created.');
      setTitle('');
      setDescription('');
      setActiveEventId(result.data.event.id);
      try { await loadEvents(); } catch { /* non-fatal */ }
    }
    setCreating(false);
  }, [title, description, loadEvents]);

  // Fetch the RTMP ingest + host token. Used to populate the broadcaster panel before going live.
  const loadIngest = useCallback(async (eventId: string) => {
    const res = await fetch(`/api/beacon/${eventId}/ingest`, { cache: 'no-store' });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      setError(data?.message ?? 'Broadcast input is unavailable.');
      return null;
    }
    const data = (await res.json()) as IngestResponse;
    setIngest(data);
    return data;
  }, []);

  const goLive = useCallback(async (eventId: string) => {
    setError(null);
    setNotice(null);
    const data = await loadIngest(eventId);
    // Ingest failed (loadIngest already set the error banner). Stop here — calling go-live now would
    // overwrite the real ingest error with a generic one and try to go live on a call that is not set up.
    if (!data) return;
    const result = await adminMutate<{ event: BeaconEvent }>(`/api/beacon/${eventId}/go-live`, 'POST');
    if (!result.ok) {
      setError(result.message ?? 'Could not start the broadcast.');
      return;
    }
    setNotice('You are live. A "live now" notice was posted to the Commons.');
    if (data) {
      setHost({
        streamApiKey: data.streamApiKey,
        streamCallType: data.streamCallType,
        streamCallId: data.streamCallId,
        streamUserId: data.streamUserId,
        hostToken: data.hostToken,
        displayName: 'Beacon host',
      });
    }
    // Connect the admin's own chat view (the admin is a signed-in member; this is the moderator seat).
    try {
      const chatRes = await fetch(`/api/beacon/${eventId}/chat-token`, { method: 'POST', headers: { 'x-ctf-csrf': '1' } });
      if (chatRes.ok) {
        const chatData = (await chatRes.json()) as ChatCredentials;
        setChat({
          streamApiKey: chatData.streamApiKey,
          streamChannelType: chatData.streamChannelType,
          streamChannelId: chatData.streamChannelId,
          streamUserId: chatData.streamUserId,
          streamToken: chatData.streamToken,
        });
      }
    } catch { /* chat is additive; broadcast still works */ }
    try { await loadEvents(); } catch { /* non-fatal */ }
  }, [loadIngest, loadEvents]);

  const endEvent = useCallback(async (eventId: string) => {
    setError(null);
    const result = await adminMutate(`/api/beacon/${eventId}/end`, 'POST');
    if (!result.ok) {
      setError(result.message ?? 'Could not end the broadcast.');
      return;
    }
    setNotice('Broadcast ended. The replay posts to the Commons when the recording is ready.');
    setHost(null);
    setChat(null);
    setIngest(null);
    try { await loadEvents(); } catch { /* non-fatal */ }
  }, [loadEvents]);

  const moderate = useCallback(async (eventId: string, action: 'mute' | 'ban' | 'slow_mode', extra?: { targetUserId?: string; cooldownSeconds?: number }) => {
    setError(null);
    const result = await adminMutate(`/api/beacon/${eventId}/moderate`, 'POST', { action, ...extra });
    if (!result.ok) {
      setError(result.message ?? 'Could not apply moderation.');
      return;
    }
    setNotice(action === 'slow_mode' ? 'Slow-mode updated.' : `Member ${action === 'mute' ? 'muted' : 'banned'}.`);
  }, []);

  const copy = useCallback((label: string, value: string) => {
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    });
  }, []);

  return (
    <main
      style={{
        background: BG,
        // Desktop locks html/body to 100vh + overflow:hidden (globals.css), so each admin shell must
        // own its vertical scroll or its lower rows are clipped and unreachable. On mobile the document
        // scrolls, so only set a min-height there. Matches the unlock / skills-hunt admin shells.
        ...(isMobile ? { minHeight: '100dvh' } : { height: '100dvh', overflowY: 'auto' }),
        color: TEXT,
      }}
    >
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '32px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Radio size={22} style={{ color: BEACON_COLOR }} />
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Beacon admin</h1>
        </div>
        <p style={{ color: SUBTLE, fontSize: 14, marginTop: 4 }}>
          Go live with a one-way broadcast. Watching is public; chatting needs a signed-in member.
          {' '}<Link href="/apps/beacon" style={{ color: BEACON_COLOR }}>Open the public viewer</Link>.
        </p>

        {error ? <div style={{ ...bannerStyle, color: '#F87171', borderColor: 'rgba(239,68,68,0.35)' }}>{error}</div> : null}
        {notice ? <div style={{ ...bannerStyle, color: BEACON_COLOR, borderColor: `${BEACON_COLOR}55` }}>{notice}</div> : null}

        <section style={cardStyle}>
          <h2 style={cardTitleStyle}>Create an event</h2>
          <label style={labelStyle}>Title</label>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="State of the TI Skills Economy" style={inputStyle} />
          <label style={labelStyle}>Description</label>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          <button type="button" onClick={() => void createEvent()} disabled={creating} style={primaryButtonStyle}>
            {creating ? 'Creating…' : 'Create draft'}
          </button>
        </section>

        {activeEvent && activeEvent.status !== 'ended' ? (
          <section ref={broadcastSectionRef} style={cardStyle}>
            <h2 style={cardTitleStyle}>Broadcast: {activeEvent.title}</h2>
            {activeEvent.status === 'draft' ? (
              <button type="button" onClick={() => void goLive(activeEvent.id)} style={primaryButtonStyle}>Go live</button>
            ) : (
              <button type="button" onClick={() => void endEvent(activeEvent.id)} style={{ ...primaryButtonStyle, background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.35)', color: '#F87171' }}>End broadcast</button>
            )}

            {ingest ? (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: SUBTLE, marginBottom: 8 }}>Phone demo — push to this RTMP target from a broadcaster app</div>
                <CopyRow label="RTMP URL" value={ingest.rtmpIngestUrl} copied={copied === 'RTMP URL'} onCopy={() => copy('RTMP URL', ingest.rtmpIngestUrl)} />
                <CopyRow label="Stream key" value={ingest.streamKey} copied={copied === 'Stream key'} onCopy={() => copy('Stream key', ingest.streamKey)} masked />
              </div>
            ) : null}

            {host ? (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: SUBTLE, marginBottom: 8 }}>Computer demo — share a screen or window from this browser</div>
                <BeaconHostStage credentials={host} eventId={activeEvent.id} />
              </div>
            ) : null}

            {activeEvent.status === 'live' ? (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: SUBTLE, marginBottom: 8 }}>Moderate the chat</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input value={moderateTarget} onChange={(event) => setModerateTarget(event.target.value)} placeholder="member user id" style={{ ...inputStyle, marginBottom: 0, maxWidth: 240 }} />
                  <button type="button" onClick={() => moderateTarget && void moderate(activeEvent.id, 'mute', { targetUserId: moderateTarget })} style={chipButtonStyle}>Mute</button>
                  <button type="button" onClick={() => moderateTarget && void moderate(activeEvent.id, 'ban', { targetUserId: moderateTarget })} style={chipButtonStyle}>Ban</button>
                  <button type="button" onClick={() => void moderate(activeEvent.id, 'slow_mode', { cooldownSeconds: 10 })} style={chipButtonStyle}>Slow-mode 10s</button>
                  <button type="button" onClick={() => void moderate(activeEvent.id, 'slow_mode', { cooldownSeconds: 0 })} style={chipButtonStyle}>Slow-mode off</button>
                </div>
                {chat ? (
                  <div style={{ marginTop: 14, height: 360, borderRadius: 12, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
                    <StreamChatPanel
                      streamApiKey={chat.streamApiKey}
                      streamToken={chat.streamToken}
                      streamUserId={chat.streamUserId}
                      streamChannelId={chat.streamChannelId}
                      channelType={chat.streamChannelType}
                      accentColor={BEACON_COLOR}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        <section style={cardStyle}>
          <h2 style={cardTitleStyle}>Event history</h2>
          {loading ? (
            <div style={{ color: SUBTLE, fontSize: 14 }}>Loading…</div>
          ) : events.length === 0 ? (
            <div style={{ color: SUBTLE, fontSize: 14 }}>No events yet. Create one above.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {events.map((event) => (
                <div key={event.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, background: SURFACE, border: `1px solid ${BORDER}` }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.title}</div>
                    <div style={{ fontSize: 12, color: SUBTLE }}>
                      {event.status}
                      {event.recordingUrl ? ' · recording ready' : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {event.recordingUrl ? (
                      <a href={event.recordingUrl} target="_blank" rel="noreferrer" style={chipButtonStyle}>Replay</a>
                    ) : null}
                    {event.status !== 'ended' ? (
                      <button type="button" onClick={() => setActiveEventId(event.id)} style={chipButtonStyle}>Open</button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function CopyRow({ label, value, copied, onCopy, masked }: { label: string; value: string; copied: boolean; onCopy: () => void; masked?: boolean }) {
  const shown = value.length === 0 ? '(not provided by Stream)' : masked ? '••••••••••••' : value;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <span style={{ fontSize: 12, color: SUBTLE, width: 88, flexShrink: 0 }}>{label}</span>
      <code style={{ flex: 1, fontSize: 12, color: TEXT, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shown}</code>
      <button type="button" onClick={onCopy} disabled={value.length === 0} style={{ ...chipButtonStyle, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

const cardStyle: React.CSSProperties = { marginTop: 18, borderRadius: 14, background: PANEL, border: `1px solid ${BORDER}`, padding: 18 };
const cardTitleStyle: React.CSSProperties = { fontSize: 16, fontWeight: 700, margin: '0 0 12px' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: SUBTLE, margin: '8px 0 4px' };
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 12px', color: TEXT, fontSize: 14, marginBottom: 8 };
const primaryButtonStyle: React.CSSProperties = { marginTop: 8, padding: '10px 18px', borderRadius: 10, background: `${BEACON_COLOR}20`, border: `1px solid ${BEACON_COLOR}55`, color: BEACON_COLOR, fontSize: 14, fontWeight: 700, cursor: 'pointer' };
const chipButtonStyle: React.CSSProperties = { padding: '7px 12px', borderRadius: 8, background: SURFACE, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' };
const bannerStyle: React.CSSProperties = { marginTop: 14, padding: '10px 14px', borderRadius: 10, background: SURFACE, border: '1px solid', fontSize: 14 };
