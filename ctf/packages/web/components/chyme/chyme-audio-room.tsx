'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  ParticipantsAudio,
  useCall,
  useCallStateHooks,
  SfuModels,
  type Call,
  type StreamVideoParticipant,
} from '@stream-io/video-react-sdk';
import { Mic, Headphones } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { getChymeTokens, chymeHandle, initials, type CurrentUser } from './chyme-shared';
import { ChymeControls } from './chyme-controls';
import { ChymeTipButton } from './chyme-tip-dialog';
import { useBackChannel, type BackChannelController } from './chyme-back-channel';
import { ChymeBackChannelLayer, ChymeBackChannelButton } from './chyme-back-channel-layer';
import { useAudioCallKeepAlive } from './use-audio-call-keep-alive';
import { reportError } from 'lib/observability/report';
import type { ChymeJoinResponse } from 'lib/chyme/types';

// Chyme is open social audio (early-Clubhouse style): everyone who joins can
// speak, so the plain "default" call type — where members may publish audio
// without a backstage/host grant — is the right primitive. We never publish
// video; this is an audio-only room.
const CALL_TYPE = 'default';

// Stream call ids accept [0-9a-zA-Z_-]; coerce anything else so an arbitrary
// room key can never produce an invalid id. Exported so the guest listen-only path joins the
// exact same call as members.
export function toCallIdForChyme(raw: string): string {
  const cleaned = raw.replace(/[^0-9a-zA-Z_-]/g, '-');
  return cleaned.length > 0 ? cleaned : 'chyme-main-room';
}

export const CHYME_CALL_TYPE = CALL_TYPE;

function toCallId(raw: string): string {
  return toCallIdForChyme(raw);
}

function isPublishingAudio(participant: StreamVideoParticipant): boolean {
  return participant.publishedTracks.includes(SfuModels.TrackType.AUDIO);
}

// Live audio needs WebRTC (`RTCPeerConnection`). Safari's Lockdown Mode and some hardened/older
// browsers remove that global, so the Stream Video SDK throws "Can't find variable:
// RTCPeerConnection" on join. Read it off `window` (property access, never a bare reference, so this
// can't itself throw) so we can detect it up front and degrade gracefully instead of crashing.
// Exported so the guest listen path shares the exact same detection.
export function isWebRtcAvailable(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const w = window as unknown as { RTCPeerConnection?: unknown; webkitRTCPeerConnection?: unknown };
  return typeof w.RTCPeerConnection !== 'undefined' || typeof w.webkitRTCPeerConnection !== 'undefined';
}

type ChymeRoomScope = 'main' | 'contributors';

// The room-scope query appended to the presence/hand endpoints so they act on the right room. The
// private contributors room passes `?room=contributors`; the main room passes nothing.
function roomScopeQuery(roomScope: ChymeRoomScope): string {
  return roomScope === 'contributors' ? '?room=contributors' : '';
}

type ChymeAudioRoomProps = {
  joinInfo: ChymeJoinResponse;
  currentUser: CurrentUser;
  showChat: boolean;
  chatPanel: ReactNode;
  isMobile: boolean;
  onLeave: () => void;
  // Clerk user ids (NOT the `chyme-` Stream id) of members whose hand is raised per the server,
  // refreshed by the live shell's room poll. Drives the persistent raised-hand indicator for
  // everyone except the local member (who is driven by their own instant local toggle).
  raisedHandUserIds: ReadonlySet<string>;
  // Which room this call is for. The private "contributors" room is an audio+chat MVP: Back Channel
  // 1:1 calls (which are scoped to the main room's presence) are disabled there for now.
  roomScope: ChymeRoomScope;
};

export function ChymeAudioRoom({ joinInfo, currentUser, showChat, chatPanel, onLeave, raisedHandUserIds, roomScope }: ChymeAudioRoomProps) {
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [status, setStatus] = useState<'connecting' | 'joined' | 'error' | 'unsupported'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { theme } = useTheme();
  const t = getChymeTokens(theme);
  // Back Channel is a main-room feature only for now (its invites are scoped to the main room's
  // presence). In the private room it is disabled, so the polling is off and no UI is rendered.
  const backChannelEnabled = roomScope === 'main';
  const backChannel = useBackChannel(currentUser, backChannelEnabled);

  // Closest a browser gets to the native Android background service: while joined and the tab is
  // foreground, hold a screen wake lock and publish Media Session presence so the OS keeps the audio
  // prioritized and the screen doesn't sleep out from under the call. No web API can hold a live call
  // in a fully backgrounded/locked page, so this does not match Android's leave-the-app behavior.
  useAudioCallKeepAlive(status === 'joined');

  useEffect(() => {
    // If the browser has no WebRTC (Safari Lockdown Mode, some hardened/older browsers), the Stream
    // Video SDK can't connect. Detect it before creating the client and show a clear, actionable
    // message instead of a raw "Can't find variable: RTCPeerConnection" — chat still works. This is an
    // expected environment state, not a fault, so we don't report it to Sentry.
    if (!isWebRtcAvailable()) {
      setStatus('unsupported');
      return;
    }

    let cancelled = false;

    const videoClient = new StreamVideoClient({
      apiKey: joinInfo.streamApiKey,
      user: { id: joinInfo.streamUserId, name: chymeHandle(currentUser.username, currentUser.userId) },
      token: joinInfo.streamToken,
    });
    const activeCall = videoClient.call(CALL_TYPE, toCallId(joinInfo.streamChannelId));

    void (async () => {
      try {
        await activeCall.join({ create: true });
        // Audio-only room: never publish video, and join muted so a new
        // listener is not live until they choose to unmute.
        try { await activeCall.camera.disable(); } catch { /* no camera to disable */ }
        try { await activeCall.microphone.disable(); } catch { /* already muted */ }
        if (cancelled) return;
        setClient(videoClient);
        setCall(activeCall);
        setStatus('joined');
      } catch (error) {
        if (cancelled) return;
        // Surface the real Stream error verbatim in the UI and report it to Sentry
        // with the call coordinates so a failed join is diagnosable without a repro.
        reportError(error, {
          area: 'chyme',
          op: 'audio_join',
          extra: {
            callType: CALL_TYPE,
            callId: toCallId(joinInfo.streamChannelId),
            streamUserId: joinInfo.streamUserId,
          },
        });
        setErrorMessage(error instanceof Error ? error.message : 'Could not connect to the audio room.');
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      void (async () => {
        try { await activeCall.leave(); } catch { /* already left */ }
        try { await videoClient.disconnectUser(); } catch { /* ignore */ }
      })();
    };
  }, [joinInfo.streamApiKey, joinInfo.streamToken, joinInfo.streamUserId, joinInfo.streamChannelId, currentUser.username, currentUser.userId]);

  // While joined AND the tab is visible, ping the presence heartbeat so this member keeps
  // counting as in the call. A backgrounded/forgotten tab stops pinging, so it stops writing
  // to the DB and drops out of presence after the server's freshness window — which also lets
  // the database compute go idle instead of being pinned awake by an open tab.
  useEffect(() => {
    if (status !== 'joined') return;
    const ping = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void fetch(`/api/chyme/heartbeat${roomScopeQuery(roomScope)}`, {
        method: 'POST',
        headers: { 'x-ctf-csrf': '1' },
      }).catch(() => {
        /* best-effort keepalive */
      });
    };
    ping();
    // 35s keeps a visible member comfortably inside the 45s presence window (CHYME_PRESENCE_TTL_SECONDS)
    // while cutting the write rate vs the old 20s.
    const intervalId = window.setInterval(ping, 35000);
    // Ping immediately when the member returns to the tab, so they re-appear without waiting.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') ping();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [status]);

  // Back Channel (spec #1746): a free 1:1 audio sidebar with another member in this room. The controller
  // polls for invites and owns the active call; the layer renders the incoming prompt + active panel as a
  // fixed overlay, so it stays put even while the room reconnects.
  const backChannelLayer = backChannelEnabled ? (
    <ChymeBackChannelLayer controller={backChannel} currentUser={currentUser} isMobile={true} />
  ) : null;

  if (status === 'unsupported') {
    return (
      <>
        <ChymeAudioFrame
          showChat={showChat}
          chatPanel={chatPanel}
          isMobile={true}
          onLeave={onLeave}
          stage={
            <div style={{ fontSize: 14, lineHeight: 1.6, maxWidth: 460 }}>
              <div style={{ color: '#FBBF24', fontWeight: 700, marginBottom: 6 }}>
                Live audio isn’t available in this browser
              </div>
              <div style={{ color: t.SUBTLE }}>
                The audio room needs WebRTC, which this browser has turned off. On iPhone or iPad this
                usually means Safari <strong>Lockdown Mode</strong> is on. You can still read and send chat
                here. To listen or speak, turn off Lockdown Mode for this site (Safari address bar →{' '}
                <strong>aA</strong> → Website Settings) or open the room in another browser.
              </div>
            </div>
          }
        />
        {backChannelLayer}
      </>
    );
  }

  if (status !== 'joined' || !client || !call) {
    return (
      <>
        <ChymeAudioFrame
          showChat={showChat}
          chatPanel={chatPanel}
          isMobile={true}
          onLeave={onLeave}
          stage={
            <div style={{ color: status === 'error' ? '#F87171' : t.FAINT, fontSize: 14 }}>
              {status === 'error'
                ? (errorMessage ?? 'Could not connect to the audio room.')
                : 'Connecting to the audio room…'}
            </div>
          }
        />
        {backChannelLayer}
      </>
    );
  }

  return (
    <>
      <StreamVideo client={client}>
        <StreamCall call={call}>
          <ChymeAudioRoomLive
            showChat={showChat}
            chatPanel={chatPanel}
            isMobile={true}
            onLeave={onLeave}
            raisedHandUserIds={raisedHandUserIds}
            backChannel={backChannel}
            roomScope={roomScope}
            backChannelEnabled={backChannelEnabled}
          />
        </StreamCall>
      </StreamVideo>
      {backChannelLayer}
    </>
  );
}

// Layout shared by the connecting/error state and the live state so the room
// keeps a stable shape. Order top-to-bottom is: the stage (avatars), then the controls
// (mute / raise hand / leave), then the chat. Controls sit directly BELOW the avatars and ABOVE the
// chat so a member can mute/unmute while talking without hunting past the avatars or scrolling the
// chat (owner request 2026-07-23).
function ChymeAudioFrame({
  stage,
  showChat,
  chatPanel,
  controls,
  onLeave,
}: {
  stage: ReactNode;
  showChat: boolean;
  chatPanel: ReactNode;
  controls?: ReactNode;
  isMobile: boolean;
  onLeave: () => void;
}) {
  const { theme } = useTheme();
  const t = getChymeTokens(theme);
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Natural height so the participant avatars always render (a cramped flex/overflow region
          clipped the single avatar under the "On Stage" label). The page flows; chat stays a
          bounded internal scroller. */}
      <div style={{ padding: '20px 24px' }}>{stage}</div>
      {controls ?? (
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${t.BORDER}`, borderBottom: `1px solid ${t.BORDER}`, background: t.HEADER, display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button
            onClick={onLeave}
            style={{ padding: '10px 18px', borderRadius: 12, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#F87171', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            Leave
          </button>
        </div>
      )}
      {showChat && chatPanel}
    </div>
  );
}

function ChymeAudioRoomLive({
  showChat,
  chatPanel,
  onLeave,
  raisedHandUserIds,
  backChannel,
  roomScope,
  backChannelEnabled,
}: {
  showChat: boolean;
  chatPanel: ReactNode;
  isMobile: boolean;
  onLeave: () => void;
  raisedHandUserIds: ReadonlySet<string>;
  backChannel: BackChannelController;
  roomScope: ChymeRoomScope;
  backChannelEnabled: boolean;
}) {
  const { useParticipants } = useCallStateHooks();
  const participants = useParticipants();
  const call = useCall();
  const { theme } = useTheme();
  const t = getChymeTokens(theme);
  // Hand-raise is tracked locally so the toggle is reliable for the person pressing it: their own
  // tile shows ✋ and the button reads "Lower Hand" until they lower it. The state is ALSO persisted
  // server-side (POST /api/chyme/hand) so it rides on the member's presence row and everyone else
  // keeps seeing it until it's lowered or they leave. We still emit the Stream reaction so others
  // get an instant best-effort signal before the next room poll arrives.
  const [handRaised, setHandRaised] = useState(false);
  const onToggleHand = () => {
    const next = !handRaised;
    setHandRaised(next);
    void call?.sendReaction(
      next
        ? { type: 'raised_hand', emoji_code: ':raised_hand:' }
        : { type: 'lower_hand', emoji_code: ':hand:' },
    );
    void fetch(`/api/chyme/hand${roomScopeQuery(roomScope)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
      body: JSON.stringify({ raised: next }),
    }).catch(() => {
      /* best-effort: the next room poll reconciles; local state already reflects the toggle */
    });
  };

  // One tile per user. A member with a lingering/extra Stream session would otherwise show
  // up twice on stage; collapse to a single tile per userId, preferring the local session.
  const uniqueParticipants = useMemo(() => {
    const byUser = new Map<string, StreamVideoParticipant>();
    for (const participant of participants) {
      const existing = byUser.get(participant.userId);
      if (!existing || (participant.isLocalParticipant && !existing.isLocalParticipant)) {
        byUser.set(participant.userId, participant);
      }
    }
    return Array.from(byUser.values());
  }, [participants]);

  const stage = (
    <>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: t.FAINT, textTransform: 'uppercase', marginBottom: 16 }}>
        On Stage · {uniqueParticipants.length} {uniqueParticipants.length === 1 ? 'Participant' : 'Participants'}
      </div>
      {uniqueParticipants.length === 0 ? (
        <div style={{ color: t.FAINT, fontSize: 14 }}>No participants yet.</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
          {uniqueParticipants.map((participant) => (
            <ChymeSpeakerTile
              key={participant.userId}
              participant={participant}
              localHandRaised={handRaised}
              raisedHandUserIds={raisedHandUserIds}
              backChannel={backChannel}
              backChannelEnabled={backChannelEnabled}
            />
          ))}
        </div>
      )}
      {/* Plays every participant's audio track (all sessions). Headless — renders only <audio>. */}
      <ParticipantsAudio participants={participants} />
    </>
  );

  return (
    <ChymeAudioFrame
      showChat={showChat}
      chatPanel={chatPanel}
      isMobile={true}
      onLeave={onLeave}
      stage={stage}
      controls={<ChymeAudioControls onLeave={onLeave} handRaised={handRaised} onToggleHand={onToggleHand} />}
    />
  );
}

function ChymeSpeakerTile({
  participant,
  localHandRaised = false,
  raisedHandUserIds,
  backChannel,
  backChannelEnabled,
}: {
  participant: StreamVideoParticipant;
  localHandRaised?: boolean;
  raisedHandUserIds: ReadonlySet<string>;
  backChannel: BackChannelController;
  backChannelEnabled: boolean;
}) {
  const { theme } = useTheme();
  const t = getChymeTokens(theme);
  const isSelf = participant.isLocalParticipant;
  // Signed-out guests join as listen-only (their Stream id is minted as `chyme-guest-…`). They can
  // never publish, so a mic icon is misleading — show a headphones "listening" indicator instead.
  const isGuest = participant.userId.startsWith('chyme-guest-');
  const speaking = participant.isSpeaking;
  const publishingAudio = isPublishingAudio(participant);
  // The local member's raised hand is driven by their own toggle so it is reliable and instant.
  // Everyone else's comes from the server-persisted set (keyed by clerk user id): Stream ids are
  // `chyme-<clerkUserId>`, so strip the prefix and look it up. Guests never show a hand.
  const clerkUserId = participant.userId.startsWith('chyme-') ? participant.userId.slice('chyme-'.length) : participant.userId;
  const handRaised = isSelf
    ? localHandRaised
    : !isGuest && raisedHandUserIds.has(clerkUserId);
  const name = participant.name || participant.userId;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 100 }}>
      <div style={{ position: 'relative' }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: `${t.ACCENT}20`,
            border: `3px solid ${speaking ? t.ACCENT : isSelf ? `${t.ACCENT}80` : 'transparent'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: speaking ? `0 0 20px ${t.ACCENT}80` : isSelf ? `0 0 12px ${t.ACCENT}40` : 'none',
            transition: 'box-shadow 0.15s, border-color 0.15s',
          }}
        >
          <span style={{ fontSize: 20, fontWeight: 800, color: t.ACCENT }}>{initials(name)}</span>
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 2,
            right: 2,
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: !isGuest && publishingAudio ? t.ACCENT : 'rgba(120,120,120,0.9)',
            border: '2px solid #021006',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isGuest ? (
            <Headphones size={10} style={{ color: '#fff', opacity: 0.85 }} />
          ) : (
            <Mic size={10} style={{ color: '#fff', opacity: publishingAudio ? 1 : 0.5 }} />
          )}
        </div>
        {handRaised && (
          <div style={{ position: 'absolute', top: -6, right: -6, fontSize: 16 }} aria-label="hand raised">
            ✋
          </div>
        )}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: t.TEXT, textAlign: 'center' }}>{name}</div>
      <span
        style={{
          fontSize: 10,
          background: !isGuest && publishingAudio ? `${t.ACCENT}20` : 'rgba(255,255,255,0.05)',
          color: !isGuest && publishingAudio ? t.ACCENT : t.MUTED,
          border: `1px solid ${!isGuest && publishingAudio ? `${t.ACCENT}35` : 'transparent'}`,
          padding: '1px 8px',
          borderRadius: 20,
        }}
      >
        {isGuest ? 'listening' : publishingAudio ? 'speaking' : 'muted'}
      </span>
      {!isSelf && !isGuest ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
          <ChymeTipButton recipientUserId={clerkUserId} recipientName={name} />
          {backChannelEnabled ? (
            <ChymeBackChannelButton recipientUserId={clerkUserId} controller={backChannel} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ChymeAudioControls({
  onLeave,
  handRaised,
  onToggleHand,
}: {
  onLeave: () => void;
  handRaised: boolean;
  onToggleHand: () => void;
}) {
  const { useMicrophoneState } = useCallStateHooks();
  const { microphone, isMute } = useMicrophoneState();

  return (
    <ChymeControls
      muted={isMute}
      onToggleMute={() => void microphone.toggle()}
      handRaised={handRaised}
      onToggleHand={onToggleHand}
      joinReady
      onLeave={onLeave}
    />
  );
}
