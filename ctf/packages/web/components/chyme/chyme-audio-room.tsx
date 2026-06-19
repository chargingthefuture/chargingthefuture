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
import { BORDER, PRIMARY, chymeHandle, initials, type CurrentUser } from './chyme-shared';
import { ChymeControls } from './chyme-controls';
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

type ChymeAudioRoomProps = {
  joinInfo: ChymeJoinResponse;
  currentUser: CurrentUser;
  showChat: boolean;
  chatPanel: ReactNode;
  isMobile: boolean;
  onLeave: () => void;
};

export function ChymeAudioRoom({ joinInfo, currentUser, showChat, chatPanel, isMobile, onLeave }: ChymeAudioRoomProps) {
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [status, setStatus] = useState<'connecting' | 'joined' | 'error'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
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
      void fetch('/api/chyme/heartbeat', { method: 'POST' }).catch(() => {
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

  if (status !== 'joined' || !client || !call) {
    return (
      <ChymeAudioFrame
        showChat={showChat}
        chatPanel={chatPanel}
        isMobile={isMobile}
        onLeave={onLeave}
        stage={
          <div style={{ color: status === 'error' ? '#F87171' : '#4B5563', fontSize: 14 }}>
            {status === 'error'
              ? (errorMessage ?? 'Could not connect to the audio room.')
              : 'Connecting to the audio room…'}
          </div>
        }
      />
    );
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <ChymeAudioRoomLive showChat={showChat} chatPanel={chatPanel} isMobile={isMobile} onLeave={onLeave} />
      </StreamCall>
    </StreamVideo>
  );
}

// Layout shared by the connecting/error state and the live state so the room
// keeps a stable shape (stage + optional chat, controls pinned to the bottom).
function ChymeAudioFrame({
  stage,
  showChat,
  chatPanel,
  controls,
  isMobile,
  onLeave,
}: {
  stage: ReactNode;
  showChat: boolean;
  chatPanel: ReactNode;
  controls?: ReactNode;
  isMobile: boolean;
  onLeave: () => void;
}) {
  return (
    <>
      <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', overflow: isMobile ? 'visible' : 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>{stage}</div>
        {showChat && chatPanel}
      </div>
      {controls ?? (
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${BORDER}`, background: '#030d05', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button
            onClick={onLeave}
            style={{ padding: '10px 18px', borderRadius: 12, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#F87171', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            Leave
          </button>
        </div>
      )}
    </>
  );
}

function ChymeAudioRoomLive({
  showChat,
  chatPanel,
  isMobile,
  onLeave,
}: {
  showChat: boolean;
  chatPanel: ReactNode;
  isMobile: boolean;
  onLeave: () => void;
}) {
  const { useParticipants } = useCallStateHooks();
  const participants = useParticipants();
  const call = useCall();
  // Hand-raise is tracked locally so the toggle is reliable for the person pressing it: their own
  // tile shows ✋ and the button reads "Lower Hand" until they lower it. Stream reactions are
  // transient (the SDK clears participant.reaction after a few seconds), so they can't carry a
  // persistent state on their own; we still emit one so others get a best-effort signal.
  const [handRaised, setHandRaised] = useState(false);
  const onToggleHand = () => {
    if (handRaised) {
      void call?.sendReaction({ type: 'lower_hand', emoji_code: ':hand:' });
      setHandRaised(false);
      return;
    }
    void call?.sendReaction({ type: 'raised_hand', emoji_code: ':raised_hand:' });
    setHandRaised(true);
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
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#4B5563', textTransform: 'uppercase', marginBottom: 16 }}>
        On Stage · {uniqueParticipants.length} {uniqueParticipants.length === 1 ? 'Participant' : 'Participants'}
      </div>
      {uniqueParticipants.length === 0 ? (
        <div style={{ color: '#4B5563', fontSize: 14 }}>No participants yet.</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
          {uniqueParticipants.map((participant) => (
            <ChymeSpeakerTile key={participant.userId} participant={participant} localHandRaised={handRaised} />
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
      isMobile={isMobile}
      onLeave={onLeave}
      stage={stage}
      controls={<ChymeAudioControls onLeave={onLeave} handRaised={handRaised} onToggleHand={onToggleHand} />}
    />
  );
}

function ChymeSpeakerTile({ participant, localHandRaised = false }: { participant: StreamVideoParticipant; localHandRaised?: boolean }) {
  const isSelf = participant.isLocalParticipant;
  // Signed-out guests join as listen-only (their Stream id is minted as `chyme-guest-…`). They can
  // never publish, so a mic icon is misleading — show a headphones "listening" indicator instead.
  const isGuest = participant.userId.startsWith('chyme-guest-');
  const speaking = participant.isSpeaking;
  const publishingAudio = isPublishingAudio(participant);
  // The local member's raised hand is driven by their own toggle so it is reliable and persists
  // until they lower it; everyone else's comes from the (transient) Stream reaction, best-effort.
  const handRaised = isSelf ? localHandRaised : participant.reaction?.type === 'raised_hand';
  const name = participant.name || participant.userId;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 100 }}>
      <div style={{ position: 'relative' }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: `${PRIMARY}20`,
            border: `3px solid ${speaking ? PRIMARY : isSelf ? `${PRIMARY}80` : 'transparent'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: speaking ? `0 0 20px ${PRIMARY}80` : isSelf ? `0 0 12px ${PRIMARY}40` : 'none',
            transition: 'box-shadow 0.15s, border-color 0.15s',
          }}
        >
          <span style={{ fontSize: 20, fontWeight: 800, color: PRIMARY }}>{initials(name)}</span>
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 2,
            right: 2,
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: !isGuest && publishingAudio ? PRIMARY : 'rgba(120,120,120,0.9)',
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
      <div style={{ fontSize: 12, fontWeight: 600, color: '#E8EAF0', textAlign: 'center' }}>{name}</div>
      <span
        style={{
          fontSize: 10,
          background: !isGuest && publishingAudio ? `${PRIMARY}20` : 'rgba(255,255,255,0.05)',
          color: !isGuest && publishingAudio ? PRIMARY : '#6B7280',
          border: `1px solid ${!isGuest && publishingAudio ? `${PRIMARY}35` : 'transparent'}`,
          padding: '1px 8px',
          borderRadius: 20,
        }}
      >
        {isGuest ? 'listening' : publishingAudio ? 'speaking' : 'muted'}
      </span>
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
