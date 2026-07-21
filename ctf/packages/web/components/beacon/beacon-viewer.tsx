'use client';

// Beacon public viewer. Watching is public over HLS (no sign-in); chatting/reacting needs a
// signed-in member. This one component serves both: an anonymous visitor sees the player plus a
// "sign in to chat" prompt; a member additionally gets the live chat panel. It polls the public
// /api/beacon/current endpoint for the live event + HLS URL and falls back to a calm idle state or
// the last replay when nothing is live.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Radio, Lock } from 'lucide-react';
import type Hls from 'hls.js';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';
import { StreamChatPanel } from '@/components/shared/stream-chat-panel';
import { useTheme } from '@/hooks/useTheme';
import { getBeaconTokens, type BeaconTokens } from './beacon-shared';
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

export function BeaconViewer({ signInUrl, isMember }: { signInUrl: string; isMember: boolean }) {
  const { theme } = useTheme();
  const t = getBeaconTokens(theme);
  const [current, setCurrent] = useState<CurrentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [chat, setChat] = useState<ChatCredentials | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

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

  // Attach the HLS source. Safari/iOS play HLS (application/vnd.apple.mpegurl) natively, so we set the
  // source directly. Every other browser (Chrome/Firefox/Edge) cannot play HLS natively, so we attach
  // the playlist with hls.js, which is loaded only in the browser and only when needed. The hls.js
  // instance is torn down on unmount or whenever the URL changes so we never leak a media session.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hlsUrl) {
      return;
    }

    // Native HLS (Safari/iOS): point the element straight at the playlist.
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
      return () => {
        video.removeAttribute('src');
        video.load();
      };
    }

    // Non-Safari: load hls.js on demand and attach the playlist. Loading is async, so guard against a
    // URL change or unmount that happens before the import resolves.
    let cancelled = false;
    void import('hls.js').then(({ default: Hls }) => {
      if (cancelled || !videoRef.current) {
        return;
      }
      if (!Hls.isSupported()) {
        // Last-resort fallback: let the browser try the native source even though it likely cannot.
        videoRef.current.src = hlsUrl;
        return;
      }
      const hls = new Hls({ enableWorker: true });
      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(videoRef.current);
    });

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
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
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px', color: t.TITLE }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        {!isMember && <PublicShellBackLink />}
        <Radio size={22} style={{ color: t.ACCENT }} />
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Beacon</h1>
      </div>
      <p style={{ color: t.SUBTLE, fontSize: 14, marginTop: 0 }}>
        Live broadcasts from Farah. Watch with just a link; sign in to chat and react.
      </p>

      {loading ? (
        <div style={panelStyle(t)}>Loading…</div>
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
                <p style={{ color: t.SUBTLE, fontSize: 14, margin: '0 0 12px' }}>{liveEvent.description}</p>
              ) : null}
              <div style={{ borderRadius: 12, overflow: 'hidden', background: '#000', border: `1px solid ${t.BORDER_SOLID}`, aspectRatio: '16 / 9' }}>
                {hlsUrl ? (
                  <video ref={videoRef} controls autoPlay playsInline muted style={{ width: '100%', height: '100%' }} />
                ) : (
                  <div style={{ ...centeredStyle(t), height: '100%' }}>The broadcast is starting…</div>
                )}
              </div>
              <p style={{ color: t.SUBTLE, fontSize: 12, marginTop: 10 }}>
                This broadcast and its chat are public. The event is recorded; the replay is posted to the Commons.
              </p>
            </section>

            <aside style={{ ...panelStyle(t), padding: 0, minHeight: 420, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${t.BORDER_SOLID}`, fontWeight: 700, fontSize: 14 }}>Live chat</div>
              {isMember ? (
                chat ? (
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <StreamChatPanel
                      streamApiKey={chat.streamApiKey}
                      streamToken={chat.streamToken}
                      streamUserId={chat.streamUserId}
                      streamChannelId={chat.streamChannelId}
                      channelType={chat.streamChannelType}
                      accentColor={t.ACCENT}
                    />
                  </div>
                ) : (
                  <div style={{ ...centeredStyle(t), flex: 1 }}>{chatError ?? 'Connecting to chat…'}</div>
                )
              ) : (
                <div style={{ ...centeredStyle(t), flex: 1, flexDirection: 'column', gap: 12, padding: 24, textAlign: 'center' }}>
                  <Lock size={28} style={{ color: t.SUBTLE }} />
                  <div style={{ fontSize: 14, color: t.SUBTLE }}>Sign in to chat and react. Anyone can watch — chatting is for members.</div>
                  <a href={signInUrl} style={ctaStyle(t)}>Sign in to chat</a>
                </div>
              )}
            </aside>
          </div>
        </div>
      ) : (
        <div style={{ ...panelStyle(t), textAlign: 'center', padding: '48px 24px' }}>
          <Radio size={40} style={{ color: t.SUBTLE, display: 'block', margin: '0 auto 12px' }} />
          <div style={{ fontSize: 16, fontWeight: 600 }}>No live event right now</div>
          <p style={{ color: t.SUBTLE, fontSize: 14, marginTop: 6 }}>When Farah goes live, it will appear here.</p>
          {replay?.recordingUrl ? (
            <div style={{ marginTop: 20, textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.SUBTLE, marginBottom: 8 }}>Last replay</div>
              <div style={{ borderRadius: 12, overflow: 'hidden', background: '#000', border: `1px solid ${t.BORDER_SOLID}`, aspectRatio: '16 / 9' }}>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption -- known gap (WCAG 1.2.2): recorded broadcasts have no captions track yet; a captions pipeline is tracked in issue #1432. */}
                <video controls playsInline src={replay.recordingUrl} style={{ width: '100%', height: '100%' }} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 8 }}>{replay.title}</div>
            </div>
          ) : null}
        </div>
      )}

    </main>
  );
}

const panelStyle = (t: BeaconTokens): React.CSSProperties => ({
  marginTop: 20,
  borderRadius: 14,
  background: t.HEADER,
  border: `1px solid ${t.BORDER_SOLID}`,
  padding: 20,
  color: t.TITLE,
});

const centeredStyle = (t: BeaconTokens): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: t.SUBTLE,
  fontSize: 14,
  background: t.SURFACE,
});

const ctaStyle = (t: BeaconTokens): React.CSSProperties => ({
  display: 'inline-block',
  padding: '9px 18px',
  borderRadius: 10,
  background: `${t.ACCENT}20`,
  border: `1px solid ${t.ACCENT}55`,
  color: t.ACCENT,
  fontSize: 14,
  fontWeight: 700,
  textDecoration: 'none',
});
