'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  ParticipantsAudio,
  useCallStateHooks,
  useCall,
  type Call,
  type StreamVideoParticipant,
} from '@stream-io/video-react-sdk';
import { Radio } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { getChymeTokens } from './chyme-shared';
import { reportError } from 'lib/observability/report';
import { chymeAttendanceLine } from 'lib/chyme/capacity-line';
import type { StreamJoinCredentials } from 'lib/chyme/stream';
import {
  CHYME_CALL_TYPE,
  toCallIdForChyme,
  isWebRtcAvailable,
  isPublishingAudio,
  ChymeSpeakerAvatar,
  ChymeSpeakerStatusBadge,
} from './chyme-audio-room';
import { useAudioCallKeepAlive } from './use-audio-call-keep-alive';

// A first join can fail for reasons that clear on their own: the guest Stream identity was minted
// milliseconds earlier and has not propagated, the SFU is mid-reconnect, or the network blipped
// while the page was still loading. Before this, one such failure ended the visit — the guest saw
// "try refreshing" and nothing retried. Three attempts with a widening gap cover the transient
// cases without hammering Stream when the failure is real.
const GUEST_JOIN_ATTEMPTS = 3;
const GUEST_JOIN_RETRY_BASE_MS = 700;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Join the live call, retrying the transient failures described above. Returns `null` once joined,
// or the last error. `create: false` — a guest only ever joins an existing live call, never starts
// one. Kept out of the component so the effect below stays readable (rule 116).
async function joinLiveCall(activeCall: Call, isCanceled: () => boolean): Promise<unknown | null> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= GUEST_JOIN_ATTEMPTS; attempt += 1) {
    try {
      await activeCall.join({ create: false });
      return null;
    } catch (error) {
      lastError = error;
      if (isCanceled() || attempt === GUEST_JOIN_ATTEMPTS) {
        return lastError;
      }
      await delay(GUEST_JOIN_RETRY_BASE_MS * attempt);
    }
  }
  return lastError;
}

// Did the room end between the server minting the guest token and the guest trying to use it? The
// room counts as "live" whenever a member's presence row is fresh, which outlives their actual
// Stream connection by up to the presence window — so a join can fail simply because there is no
// longer a call to join. Re-reading the public room tells that apart from a genuine fault.
async function isRoomStillLive(): Promise<boolean> {
  try {
    const res = await fetch('/api/chyme/public/room');
    if (!res.ok) {
      return true;
    }
    const data = await res.json();
    return data?.ok ? !!data.isLive : true;
  } catch {
    // Can't tell — treat it as still live so a network blip doesn't hide a room that is up.
    return true;
  }
}

// The listener's presence keepalive, on the member's cadence (35s inside the 45s window). The
// server credits the minute meter from it and the guest cap counts it. Sends the same-origin
// header the route requires; the guest id rides in the httpOnly cookie the listen route set.
const GUEST_HEARTBEAT_MS = 35_000;

function postGuestHeartbeat(onCounts: (counts: GuestRoomCounts) => void): void {
  void fetch('/api/chyme/public/heartbeat', { method: 'POST', headers: { 'x-ctf-csrf': '1' } })
    .then(async (res) => {
      if (!res.ok) return;
      const data: unknown = await res.json().catch(() => null);
      const body = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
      const counts = body.ok === true ? countsFrom(body) : null;
      if (counts) onCounts(counts);
    })
    .catch(() => {
      // no-trace: best-effort keepalive; the next beat reconciles, and a missed one costs a window.
    });
}

function postGuestLeave(): void {
  void fetch('/api/chyme/public/leave', { method: 'POST', headers: { 'x-ctf-csrf': '1' }, keepalive: true }).catch(() => {
    // no-trace: best-effort; the presence window lapses the listener anyway.
  });
}

// While listening, keep the guest on the roster and the minute meter fed, and take the room's
// fresh counts back from each beat. A tab in the background stops beating, like the member
// heartbeat, and beats once more when it returns.
function useGuestHeartbeat(listening: boolean, onCounts: (counts: GuestRoomCounts) => void): void {
  useEffect(() => {
    if (!listening) return;
    const beat = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      postGuestHeartbeat(onCounts);
    };
    beat();
    const intervalId = window.setInterval(beat, GUEST_HEARTBEAT_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') beat();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [listening, onCounts]);
}

// Ask the server for listen credentials. This is the tap: it takes one of the guest listening spots
// and mints the browser's one Stream guest identity (the cookie the response sets). The server
// answers with a plain reason when the visitor cannot listen right now — the room is not live,
// guests are paused by the quota policy, every spot is taken, or Stream refused — and that reason
// is what the page shows.
export class GuestListenRefused extends Error {
  readonly roomGone: boolean;
  constructor(message: string, roomGone: boolean) {
    super(message);
    this.name = 'GuestListenRefused';
    this.roomGone = roomGone;
  }
}

// What the room held at the moment the server answered: members in the call, and signed-out
// listeners on the roster (this browser included, once it has been admitted).
export type GuestRoomCounts = {
  participantCount: number;
  guestCount: number;
};

function countsFrom(body: Record<string, unknown>): GuestRoomCounts | null {
  const participantCount = body.participantCount;
  const guestCount = body.guestCount;
  if (typeof participantCount !== 'number' || typeof guestCount !== 'number') {
    return null;
  }
  return { participantCount, guestCount };
}

export async function requestGuestListenCredentials(): Promise<{ credentials: StreamJoinCredentials; counts: GuestRoomCounts | null }> {
  const res = await fetch('/api/chyme/public/listen', { method: 'POST', headers: { 'x-ctf-csrf': '1' } });
  const data: unknown = await res.json().catch(() => null);
  const body = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  if (res.ok && body.ok === true && typeof body.credentials === 'object' && body.credentials !== null) {
    return { credentials: body.credentials as StreamJoinCredentials, counts: countsFrom(body) };
  }
  const message =
    typeof body.message === 'string' ? body.message : typeof body.error === 'string' ? body.error : 'The server returned an error.';
  throw new GuestListenRefused(`${message} (HTTP ${res.status})`, body.isLive === false);
}

// Signed-out listener. On the tap, asks the server for the browser's guest Stream identity and
// connects it to the SAME call members are in, playing its audio — receive-only. The guest never
// publishes: camera and microphone are disabled and there is no unmute/raise-hand control, so this
// is listen-only on the client. Speaking requires signing in.
export function ChymeGuestListen({
  participantCount,
  guestCount,
  accent = '#22C55E',
  onRoomGone,
  onListeningChange,
  leaveKey = 0,
}: {
  participantCount: number;
  // Signed-out listeners already on the roster when the page read the room. This visitor is not
  // one of them until they tap; the listen answer and every heartbeat after it carry the number
  // that includes them.
  guestCount: number;
  accent?: string;
  // Called when the join failed and a fresh read of the public room says the room is no longer
  // live. The parent then drops back to the honest "no public rooms right now" view instead of
  // leaving a dead error box under a room heading that claims the visitor is listening.
  onRoomGone?: () => void;
  // Told whether sound is actually on. The page shows its Leave control only while this is true,
  // so a visitor who has not tapped yet is never offered a way out of something they are not in.
  onListeningChange?: (listening: boolean) => void;
  // Bumped by the page's Leave control. Each new value stops the listen: see the effect below.
  leaveKey?: number;
}) {
  // The room's counts as of the last word from the server: the page's own read to start with, then
  // the listen answer, then each heartbeat. Held here rather than read from the props so the line
  // counts this listener from the moment they are admitted instead of waiting for a page refresh.
  const [counts, setCounts] = useState<GuestRoomCounts>({ participantCount, guestCount });
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  // Minted on the tap (see requestGuestListenCredentials); the join effect keys on it.
  const [credentials, setCredentials] = useState<StreamJoinCredentials | null>(null);
  // 'idle' until the visitor taps: a phone browser (iOS Safari above all) refuses to play sound
  // that a page starts on its own, so a join that ran on page load put the guest on stage with
  // every audio track muted by the browser. Members never hit this because they tap Join. The tap
  // is the browser's permission to play, and everything after it (the join, the audio elements the
  // SDK adds as people speak) inherits it.
  const [status, setStatus] = useState<'idle' | 'connecting' | 'joined' | 'error' | 'unsupported'>('idle');
  // Set once by the tap; the join effect below keys on it rather than on `status`, whose later
  // changes must not tear the call down as soon as it joined.
  const [armed, setArmed] = useState(false);
  // The verbatim reason the join failed. The member room already shows its Stream error this way;
  // the guest path used to swallow it, so a visitor (and the person they report it to) had nothing
  // to go on but "try refreshing".
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  // Report the listening state upward without making the parent's callback a dependency of the
  // effect that reports it — a parent that rebuilt the callback each render would otherwise
  // re-run this on every render.
  const listeningChangeRef = useRef(onListeningChange);
  useEffect(() => {
    listeningChangeRef.current = onListeningChange;
  }, [onListeningChange]);

  useEffect(() => {
    listeningChangeRef.current?.(status === 'joined');
    // Also on unmount: the room ending takes this component away, and the page must not go on
    // offering a Leave control for a call that is no longer there.
    return () => listeningChangeRef.current?.(false);
  }, [status]);

  // The page's Leave control. Clearing `armed` and the credentials runs the join effect's cleanup,
  // which leaves the Stream call, disconnects the guest identity, and posts the leave so the
  // listening spot frees at once; the view drops back to the Tap to listen button. `leaveKey` 0 is
  // the initial value and means nobody has asked to leave. A browser without WebRTC keeps its
  // explanation rather than being handed a listen button that cannot work.
  useEffect(() => {
    if (leaveKey === 0) {
      return;
    }
    setArmed(false);
    setCredentials(null);
    setClient(null);
    setCall(null);
    setErrorDetail(null);
    setStatus((current) => (current === 'unsupported' ? current : 'idle'));
    // One fewer signed-out listener, said at once: this browser has stopped. The next refresh or
    // the next tap replaces it with the server's own number.
    setCounts((current) => ({ participantCount: current.participantCount, guestCount: Math.max(0, current.guestCount - 1) }));
  }, [leaveKey]);

  // The parent re-reads the room on its refresh control; take that answer as the newer one.
  useEffect(() => {
    setCounts({ participantCount, guestCount });
  }, [participantCount, guestCount]);

  // No WebRTC (Safari Lockdown Mode, some hardened/older browsers) → the Stream Video SDK can't
  // connect. Detect it up front and show a clear message rather than a raw error or a misleading
  // "try refreshing". Expected environment state, so it is not reported to Sentry.
  useEffect(() => {
    if (!isWebRtcAvailable()) {
      setStatus('unsupported');
    }
  }, []);

  // The tap → credentials step. Runs once per arm; a refusal lands in the error state with the
  // server's own words, or drops back to the not-live view when the server said the room ended.
  useEffect(() => {
    if (!armed || credentials) {
      return;
    }
    let canceled = false;
    void (async () => {
      try {
        const minted = await requestGuestListenCredentials();
        if (!canceled) {
          setCredentials(minted.credentials);
          if (minted.counts) {
            setCounts(minted.counts);
          }
        }
      } catch (error) {
        if (canceled) {
          return;
        }
        if (error instanceof GuestListenRefused && error.roomGone) {
          onRoomGone?.();
          return;
        }
        setErrorDetail(describeError(error));
        setStatus('error');
      }
    })();
    return () => {
      canceled = true;
    };
  }, [armed, credentials, onRoomGone]);

  useEffect(() => {
    if (!armed || !credentials) {
      return;
    }

    let canceled = false;
    const videoClient = new StreamVideoClient({
      apiKey: credentials.streamApiKey,
      user: { id: credentials.streamUserId, name: 'Guest listener' },
      token: credentials.streamToken,
    });
    const activeCall = videoClient.call(CHYME_CALL_TYPE, toCallIdForChyme(credentials.streamChannelId));

    void (async () => {
      // Disable the mic and camera BEFORE joining so the browser never prompts a guest for device
      // access — they can only listen, so there is nothing to publish and no reason to ask.
      try { await activeCall.camera.disable(); } catch { /* no camera */ }
      try { await activeCall.microphone.disable(); } catch { /* already muted */ }

      const joinError = await joinLiveCall(activeCall, () => canceled);
      if (canceled) {
        return;
      }
      if (!joinError) {
        setClient(videoClient);
        setCall(activeCall);
        setStatus('joined');
        return;
      }

      const stillLive = await isRoomStillLive();
      if (canceled) {
        return;
      }
      if (!stillLive) {
        // The room ended while we were connecting. Expected, not a fault, so it is not reported.
        onRoomGone?.();
        return;
      }

      reportError(joinError, {
        area: 'chyme',
        op: 'guest_listen_join',
        extra: {
          streamUserId: credentials.streamUserId,
          callType: CHYME_CALL_TYPE,
          callId: toCallIdForChyme(credentials.streamChannelId),
          attempts: GUEST_JOIN_ATTEMPTS,
        },
      });
      setErrorDetail(describeError(joinError));
      setStatus('error');
    })();

    return () => {
      canceled = true;
      void (async () => {
        try { await activeCall.leave(); } catch { /* already left */ }
        try { await videoClient.disconnectUser(); } catch { /* ignore */ }
      })();
      // Free the listening spot at once rather than at the end of the presence window.
      postGuestLeave();
    };
  }, [armed, credentials, onRoomGone]);

  useGuestHeartbeat(status === 'joined', setCounts);

  // While listening and the tab is foreground, hold a screen wake lock + Media Session presence so
  // the OS keeps the audio prioritized and the screen doesn't sleep out from under playback. This is
  // the closest a browser gets to the native Android background service; it does not survive a fully
  // backgrounded/locked page.
  useAudioCallKeepAlive(status === 'joined', 'Chyme live listen');

  if (status === 'unsupported') {
    return (
      <GuestNote
        accent={accent}
        text="Live audio needs WebRTC, which this browser has turned off — on iPhone or iPad this usually means Safari Lockdown Mode. Turn it off for this site (address bar → aA → Website Settings) or use another browser to listen."
      />
    );
  }
  if (status === 'idle') {
    return (
      <ListenButton
        accent={accent}
        counts={counts}
        onTap={() => {
          unlockAudioPlayback();
          setStatus('connecting');
          setArmed(true);
        }}
      />
    );
  }
  if (status === 'error') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <GuestNote accent={accent} text="Couldn't connect to the live room." detail={errorDetail} />
        <button
          type="button"
          onClick={() => {
            unlockAudioPlayback();
            setErrorDetail(null);
            setCredentials(null);
            setStatus('connecting');
            setArmed(true);
          }}
          style={{ width: '100%', padding: '12px 18px', borderRadius: 12, background: accent, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          Try again
        </button>
      </div>
    );
  }
  if (status !== 'joined' || !client || !call) {
    return <GuestNote accent={accent} text="Connecting to the live room…" />;
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <GuestAudioSink accent={accent} counts={counts} />
      </StreamCall>
    </StreamVideo>
  );
}

// Inside the tap handler, before anything asynchronous. Two things, both best-effort, and the join
// goes ahead either way:
//  1. The page's audio session is set to "playback" (the Audio Session API, iPhone Safari 17+). A
//     page that only plays and never records is otherwise treated like a ringtone on iPhone: the
//     Silent switch mutes it. Members never hit this because their microphone capture puts the
//     session in play-and-record, which ignores the switch. A listener has no capture, so this is
//     the one way to say "this is media, play it".
//  2. An audio context is resumed, the widely used way to make a phone browser treat the page as
//     allowed to play sound from here on. Nothing is played through it; it is closed at once.
function unlockAudioPlayback(): void {
  const audioSession = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
  if (audioSession) {
    try {
      audioSession.type = 'playback';
    } catch {
      // no-trace: the browser knows the API but not this value; the join goes ahead without it.
    }
  }
  const Ctx =
    typeof window !== 'undefined'
      ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
      : undefined;
  if (!Ctx) {
    return;
  }
  try {
    const ctx = new Ctx();
    void ctx.resume().then(() => ctx.close()).catch(() => undefined);
  } catch {
    // no-trace: an audio context is a courtesy to the browser's autoplay rule, not a requirement.
  }
}

function ListenButton({ accent, counts, onTap }: { accent: string; counts: GuestRoomCounts; onTap: () => void }) {
  const { theme } = useTheme();
  const t = getChymeTokens(theme);
  return (
    <button
      type="button"
      onClick={onTap}
      style={{ display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', padding: '14px 18px', borderRadius: 12, background: `${accent}14`, border: `1px solid ${accent}35`, color: t.TITLE, fontSize: 13, textAlign: 'left', cursor: 'pointer' }}
    >
      <Radio size={16} style={{ color: accent, flexShrink: 0, marginTop: 2 }} />
      <div>
        <div style={{ fontWeight: 600 }}>
          Tap to listen · {chymeAttendanceLine(counts.participantCount, counts.guestCount)}
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: t.MUTED, lineHeight: 1.5 }}>
          Phones only play sound after a tap. You will hear the room and cannot be heard.
        </div>
      </div>
    </button>
  );
}

// Exported so the public shell can show the same note when the room is live but no guest identity
// could be minted — one look for "you are not hearing this room, and here is why".
export function GuestNote({ accent, text, detail }: { accent: string; text: string; detail?: string | null }) {
  const { theme } = useTheme();
  const t = getChymeTokens(theme);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '14px 18px', borderRadius: 12, background: `${accent}12`, border: `1px solid ${accent}30`, color: t.SUBTLE, fontSize: 13 }}>
      <Radio size={16} style={{ color: accent, flexShrink: 0, marginTop: 2 }} />
      <div>
        <div>{text}</div>
        {detail ? (
          <div style={{ marginTop: 6, fontSize: 11, color: t.MUTED, lineHeight: 1.5, wordBreak: 'break-word' }}>{detail}</div>
        ) : null}
      </div>
    </div>
  );
}

function GuestAudioSink({ accent, counts }: { accent: string; counts: GuestRoomCounts }) {
  const { useParticipants } = useCallStateHooks();
  const participants = useParticipants();
  const { theme } = useTheme();
  const t = getChymeTokens(theme);
  // One tile per identity, the local session preferred, exactly as the member room collapses its
  // list: a member with a lingering extra Stream session would otherwise appear twice.
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
  // The server-side counts — members with fresh presence, and signed-out listeners on the guest
  // roster — are what the room itself holds; the stage below shows everyone Stream has in the call,
  // which is what the members in the room see on their own stage. Both are shown so neither number
  // surprises. The line names members and guests separately because they are different things: a
  // member can speak, a guest can only listen, and one merged number would hide which is which.
  const attendance = chymeAttendanceLine(counts.participantCount, counts.guestCount);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderRadius: 12, background: `${accent}14`, border: `1px solid ${accent}35`, color: t.TITLE, fontSize: 13, fontWeight: 600 }}>
        <Radio size={16} style={{ color: accent }} />
        Listening live · {attendance}
        {/* Headless audio sink — plays every participant's audio track. */}
        <ParticipantsAudio participants={participants} />
      </div>
      <GuestHearingAid accent={accent} />
      <GuestStage participants={uniqueParticipants} />
    </div>
  );
}

// The audio tracks arrive seconds after the tap, and the SDK starts each one with play() outside
// any gesture. When the phone browser refuses that (its autoplay rule), the SDK records the element
// as blocked and this shows one button whose tap retries them all, which the rule allows. Below it,
// always, the one line that explains the other silent case: the phone's Silent switch, which the
// SDK cannot see and no code can override on a page that never records.
function GuestHearingAid({ accent }: { accent: string }) {
  const call = useCall();
  const { useIsAutoplayBlocked } = useCallStateHooks();
  const blocked = useIsAutoplayBlocked();
  const { theme } = useTheme();
  const t = getChymeTokens(theme);
  const retry = () => {
    unlockAudioPlayback();
    void call?.resumeAudio().catch((error: unknown) => {
      reportError(error, { area: 'chyme', op: 'guest_listen_resume_audio' });
    });
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {blocked ? (
        <button
          type="button"
          onClick={retry}
          style={{ width: '100%', padding: '12px 18px', borderRadius: 12, background: accent, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          Tap to hear the room
        </button>
      ) : null}
      <button
        type="button"
        onClick={retry}
        style={{ background: 'transparent', border: 'none', padding: 0, textAlign: 'left', color: t.MUTED, fontSize: 11, lineHeight: 1.5, cursor: 'pointer' }}
      >
        No sound? Take the phone off Silent (the switch or the Action button), turn the volume up, then tap here.
      </button>
    </div>
  );
}

// The same tiles the member room draws (avatar ring, headphones badge for a listener, status pill),
// without the member-only actions: a guest cannot tip, raise a hand, or open a Back Channel.
function GuestStage({ participants }: { participants: StreamVideoParticipant[] }) {
  const { theme } = useTheme();
  const t = getChymeTokens(theme);
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: t.FAINT, textTransform: 'uppercase', marginBottom: 16 }}>
        On Stage · {participants.length} {participants.length === 1 ? 'Participant' : 'Participants'}
      </div>
      {participants.length === 0 ? (
        <div style={{ color: t.FAINT, fontSize: 14 }}>No participants yet.</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
          {participants.map((participant) => {
            const isGuest = participant.userId.startsWith('chyme-guest-');
            const audioActive = !isGuest && isPublishingAudio(participant);
            const name = participant.name || participant.userId;
            return (
              <div key={participant.userId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 100 }}>
                <ChymeSpeakerAvatar
                  name={name}
                  speaking={participant.isSpeaking}
                  isSelf={Boolean(participant.isLocalParticipant)}
                  isGuest={isGuest}
                  audioActive={audioActive}
                  handRaised={false}
                />
                <div style={{ fontSize: 12, fontWeight: 600, color: t.TEXT, textAlign: 'center' }}>
                  {participant.isLocalParticipant ? 'You (listening)' : name}
                </div>
                <ChymeSpeakerStatusBadge isGuest={isGuest} audioActive={audioActive} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
