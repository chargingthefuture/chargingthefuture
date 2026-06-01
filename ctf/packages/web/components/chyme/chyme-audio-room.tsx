'use client';

import { useEffect, useState, type ReactNode } from 'react';
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
import { Mic } from 'lucide-react';
import { BORDER, PRIMARY, initials, type CurrentUser } from './chyme-shared';
import { ChymeControls } from './chyme-controls';
import { reportError } from 'lib/observability/report';
import type { ChymeJoinResponse } from 'lib/chyme/types';

// Chyme is open social audio (early-Clubhouse style): everyone who joins can
// speak, so the plain "default" call type — where members may publish audio
// without a backstage/host grant — is the right primitive. We never publish
// video; this is an audio-only room.
const CALL_TYPE = 'default';

// Stream call ids accept [0-9a-zA-Z_-]; coerce anything else so an arbitrary
// room key can never produce an invalid id.
function toCallId(raw: string): string {
  const cleaned = raw.replace(/[^0-9a-zA-Z_-]/g, '-');
  return cleaned.length > 0 ? cleaned : 'chyme-main-room';
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
      user: { id: joinInfo.streamUserId, name: currentUser.displayName },
      token: joinInfo.streamToken,
    });
    const activeCall = videoClient.call(CALL_TYPE, toCallId(joinInfo.streamChannelId));

    void (async () => {
      try {
        await activeCall.join({ create: true });
        // Audio-only safe space: never publish video, and join muted so a new
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
  }, [joinInfo.streamApiKey, joinInfo.streamToken, joinInfo.streamUserId, joinInfo.streamChannelId, currentUser.displayName]);

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

  const stage = (
    <>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#4B5563', textTransform: 'uppercase', marginBottom: 16 }}>
        On Stage · {participants.length} {participants.length === 1 ? 'Participant' : 'Participants'}
      </div>
      {participants.length === 0 ? (
        <div style={{ color: '#4B5563', fontSize: 14 }}>No participants yet.</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
          {participants.map((participant) => (
            <ChymeSpeakerTile key={participant.sessionId} participant={participant} />
          ))}
        </div>
      )}
      {/* Plays every participant's audio track. Headless — renders only <audio> elements. */}
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
      controls={<ChymeAudioControls onLeave={onLeave} />}
    />
  );
}

function ChymeSpeakerTile({ participant }: { participant: StreamVideoParticipant }) {
  const isSelf = participant.isLocalParticipant;
  const speaking = participant.isSpeaking;
  const publishingAudio = isPublishingAudio(participant);
  const handRaised = participant.reaction?.type === 'raised_hand';
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
            background: publishingAudio ? PRIMARY : 'rgba(120,120,120,0.9)',
            border: '2px solid #021006',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Mic size={10} style={{ color: '#fff', opacity: publishingAudio ? 1 : 0.5 }} />
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
          background: publishingAudio ? `${PRIMARY}20` : 'rgba(255,255,255,0.05)',
          color: publishingAudio ? PRIMARY : '#6B7280',
          border: `1px solid ${publishingAudio ? `${PRIMARY}35` : 'transparent'}`,
          padding: '1px 8px',
          borderRadius: 20,
        }}
      >
        {publishingAudio ? 'speaking' : 'muted'}
      </span>
    </div>
  );
}

function ChymeAudioControls({ onLeave }: { onLeave: () => void }) {
  const { useMicrophoneState } = useCallStateHooks();
  const { microphone, isMute } = useMicrophoneState();
  const call = useCall();
  const [handRaised, setHandRaised] = useState(false);

  return (
    <ChymeControls
      muted={isMute}
      onToggleMute={() => void microphone.toggle()}
      handRaised={handRaised}
      onToggleHand={() => {
        // Broadcast a raised-hand reaction to everyone in the room, then clear
        // the local pressed state shortly after (the reaction is transient).
        void call?.sendReaction({ type: 'raised_hand', emoji_code: ':raised_hand:' });
        setHandRaised(true);
        window.setTimeout(() => setHandRaised(false), 2500);
      }}
      joinReady
      onLeave={onLeave}
    />
  );
}
