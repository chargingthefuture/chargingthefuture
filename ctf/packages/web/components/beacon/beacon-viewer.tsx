'use client';

// Beacon public viewer. Watching is public over HLS (no sign-in); chatting/reacting needs a
// signed-in member. This one component serves both: an anonymous visitor sees the player plus a
// "sign in to chat" prompt; a member additionally gets the live chat panel. It polls the public
// /api/beacon/current endpoint for the live event + HLS URL and falls back to a calm idle state or
// the last replay when nothing is live.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Radio, Lock } from 'lucide-react';
import { StreamChatPanel } from '@/components/shared/stream-chat-panel';
import { BEACON_COLOR } from 'lib/beacon/constants';

type BeaconEventLike = {
  id: string;
  title: string;
  description: string;
  status: 'draft' | 'live' | 'ended';
  recordingUrl: string | null;
};

type CurrentResponse = {
  ok: boolean;
  event: BeaconEventLike | null;
  hlsPlaybackUrl: string | null;
  replay: BeaconEventLike | null;
};

type ChatCredentials = {
  streamApiKey: string;
  streamChannelType: string;
  streamChannelId: string;
  streamUserId: string;
  streamToken: string;
};

const PANEL = '#0D0F14';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#9CA3AF';

export function BeaconViewer({ signInUrl, isMember }: { signInUrl: string; isMember: boolean }) {
  const [current, setCurrent] = useState<CurrentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [chat, setChat] = useState<ChatCredentials | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const loadCurrent = useCallback(async () => {
    try {
      const res = await fetch('/api/beacon/current', { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as CurrentResponse;
        setCurrent(data);
      }
    } catch {
      // Network blip — keep the last known state and try again on the next poll.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCurrent();
    const timer = setInterval(() => void loadCurrent(), 15000);
    return () => clearInterval(timer);
  }, [loadCurrent]);

  const liveEvent = current?.event && current.event.status === 'live' ? current.event : null;
  const hlsUrl = liveEvent ? current?.hlsPlaybackUrl ?? null : null;
  const replay = current?.replay ?? null;

  // Attach the HLS source. Safari/iOS play HLS natively; other browsers need hls.js, which is not a
  // dependency here, so we set the source directly and note the limitation rather than failing.
  // TODO(beacon): add hls.js (or a lightweight HLS player) for non-Safari browsers if telemetry shows
  // viewers on Chrome/Firefox cannot play the native source.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hlsUrl) return;
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
    } else {
      video.src = hlsUrl;
    }
  }, [hlsUrl]);

  // A member opts into chat by requesting a token (this is the sign-in-to-chat gate server-side).
  const joinChat = useCallback(async () => {
    if (!liveEvent) return;
    setChatError(null);
    try {
      const res = await fetch(`/api/beacon/${liveEvent.id}/chat-token`, {
        method: 'POST',
        headers: { 'x-ctf-csrf': '1' },
      });
      if (!res.ok) {
        setChatError('Live chat is unavailable right now.');
        return;
      }
      const data = (await res.json()) as { ok: boolean } & ChatCredentials;
      setChat({
        streamApiKey: data.streamApiKey,
        streamChannelType: data.streamChannelType,
        streamChannelId: data.streamChannelId,
        streamUserId: data.streamUserId,
        streamToken: data.streamToken,
      });
    } catch {
      setChatError('Live chat is unavailable right now.');
    }
  }, [liveEvent]);

  useEffect(() => {
    if (isMember && liveEvent && !chat) {
      void joinChat();
    }
    // When the event ends, drop the chat connection.
    if (!liveEvent && chat) {
      setChat(null);
    }
  }, [isMember, liveEvent, chat, joinChat]);

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px', color: TEXT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Radio size={22} style={{ color: BEACON_COLOR }} />
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Beacon</h1>
      </div>
      <p style={{ color: SUBTLE, fontSize: 14, marginTop: 0 }}>
        Live broadcasts from the team. Watch with just a link; sign in to chat and react.
      </p>

      {loading ? (
        <div style={panelStyle}>Loading…</div>
      ) : liveEvent ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 }}>
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr', alignItems: 'start' }} className="beacon-live-grid">
            <section>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'rgba(245,158,11,0.14)',
                  border: `1px solid ${BEACON_COLOR}55`,
                  color: BEACON_COLOR,
                  borderRadius: 999,
                  padding: '4px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  marginBottom: 12,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: BEACON_COLOR, display: 'inline-block' }} />
                LIVE AND PUBLIC
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>{liveEvent.title}</h2>
              {liveEvent.description ? (
                <p style={{ color: SUBTLE, fontSize: 14, margin: '0 0 12px' }}>{liveEvent.description}</p>
              ) : null}
              <div style={{ borderRadius: 12, overflow: 'hidden', background: '#000', border: `1px solid ${BORDER}`, aspectRatio: '16 / 9' }}>
                {hlsUrl ? (
                  <video ref={videoRef} controls autoPlay playsInline muted style={{ width: '100%', height: '100%' }} />
                ) : (
                  <div style={{ ...centeredStyle, height: '100%' }}>The broadcast is starting…</div>
                )}
              </div>
              <p style={{ color: SUBTLE, fontSize: 12, marginTop: 10 }}>
                This broadcast and its chat are public. The event is recorded; the replay is posted to the Commons.
              </p>
            </section>

            <aside style={{ ...panelStyle, padding: 0, minHeight: 420, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, fontWeight: 700, fontSize: 14 }}>Live chat</div>
              {isMember ? (
                chat ? (
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <StreamChatPanel
                      streamApiKey={chat.streamApiKey}
                      streamToken={chat.streamToken}
                      streamUserId={chat.streamUserId}
                      streamChannelId={chat.streamChannelId}
                      channelType={chat.streamChannelType}
                      accentColor={BEACON_COLOR}
                    />
                  </div>
                ) : (
                  <div style={{ ...centeredStyle, flex: 1 }}>{chatError ?? 'Connecting to chat…'}</div>
                )
              ) : (
                <div style={{ ...centeredStyle, flex: 1, flexDirection: 'column', gap: 12, padding: 24, textAlign: 'center' }}>
                  <Lock size={28} style={{ color: SUBTLE }} />
                  <div style={{ fontSize: 14, color: SUBTLE }}>Sign in to chat and react. Anyone can watch — chatting is for members.</div>
                  <a href={signInUrl} style={ctaStyle}>Sign in to chat</a>
                </div>
              )}
            </aside>
          </div>
        </div>
      ) : (
        <div style={{ ...panelStyle, textAlign: 'center', padding: '48px 24px' }}>
          <Radio size={40} style={{ color: SUBTLE, display: 'block', margin: '0 auto 12px' }} />
          <div style={{ fontSize: 16, fontWeight: 600 }}>No live event right now</div>
          <p style={{ color: SUBTLE, fontSize: 14, marginTop: 6 }}>When the team goes live, it will appear here.</p>
          {replay?.recordingUrl ? (
            <div style={{ marginTop: 20, textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: SUBTLE, marginBottom: 8 }}>Last replay</div>
              <div style={{ borderRadius: 12, overflow: 'hidden', background: '#000', border: `1px solid ${BORDER}`, aspectRatio: '16 / 9' }}>
                <video controls playsInline src={replay.recordingUrl} style={{ width: '100%', height: '100%' }} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 8 }}>{replay.title}</div>
            </div>
          ) : null}
        </div>
      )}

      <style>{`
        @media (min-width: 860px) {
          .beacon-live-grid { grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr) !important; }
        }
      `}</style>
    </main>
  );
}

const panelStyle: React.CSSProperties = {
  marginTop: 20,
  borderRadius: 14,
  background: PANEL,
  border: `1px solid ${BORDER}`,
  padding: 20,
  color: TEXT,
};

const centeredStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: SUBTLE,
  fontSize: 14,
  background: SURFACE,
};

const ctaStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '9px 18px',
  borderRadius: 10,
  background: `${BEACON_COLOR}20`,
  border: `1px solid ${BEACON_COLOR}55`,
  color: BEACON_COLOR,
  fontSize: 14,
  fontWeight: 700,
  textDecoration: 'none',
};
