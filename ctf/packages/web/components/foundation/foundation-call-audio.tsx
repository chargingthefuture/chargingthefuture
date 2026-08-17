"use client";

import { useEffect, useState } from "react";
import {
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  ParticipantsAudio,
  useCallStateHooks,
  type Call,
} from "@stream-io/video-react-sdk";
import { Mic, MicOff, PhoneOff } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getFoundationTokens, type FoundationTokens } from "./foundation-ui";
import { reportError } from "@/lib/observability/report";

// Audio-only 1:1 call room for Foundation "Connect now" (issue #808 task 3). Reuses the same Stream Video
// pattern as Chyme's audio room (the plain "default" call type, camera always disabled) so calls behave
// consistently across the app. No video tracks or camera UI exist in v1 (owner decision). The Stream
// credentials and call id come from the answered-call state (the participant-only Direct Line token path).

const CALL_TYPE = "default";

// Stream call ids accept [0-9a-zA-Z_-]; coerce anything else so an id can never be rejected.
function toCallId(raw: string): string {
  const cleaned = raw.replace(/[^0-9a-zA-Z_-]/g, "-");
  return cleaned.length > 0 ? cleaned : "foundation-call";
}

export type FoundationCallCredentials = {
  streamApiKey: string;
  streamUserId: string;
  streamToken: string;
  streamCallId: string;
  displayName: string;
};

type ConnState = "connecting" | "in-call" | "error";

export function FoundationCallAudio({
  credentials,
  onEnd,
}: {
  credentials: FoundationCallCredentials;
  onEnd: () => void;
}) {
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [status, setStatus] = useState<ConnState>("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    const videoClient = new StreamVideoClient({
      apiKey: credentials.streamApiKey,
      user: { id: credentials.streamUserId, name: credentials.displayName },
      token: credentials.streamToken,
    });
    const activeCall = videoClient.call(CALL_TYPE, toCallId(credentials.streamCallId));

    void (async () => {
      try {
        await activeCall.join({ create: true });
        // Audio only: never publish video. Microphone is enabled so the two parties can talk; the member
        // can mute with the control below.
        try { await activeCall.camera.disable(); } catch { /* no camera to disable */ }
        try { await activeCall.microphone.enable(); } catch { /* no mic available */ }
        if (canceled) return;
        setClient(videoClient);
        setCall(activeCall);
        setStatus("in-call");
      } catch (error) {
        if (canceled) return;
        reportError(error, {
          area: "foundation",
          op: "instant_call_audio_join",
          extra: { callType: CALL_TYPE, callId: toCallId(credentials.streamCallId) },
        });
        setErrorMessage(error instanceof Error ? error.message : "Could not connect the call.");
        setStatus("error");
      }
    })();

    return () => {
      canceled = true;
      void (async () => {
        try { await activeCall.leave(); } catch { /* already left */ }
        try { await videoClient.disconnectUser(); } catch { /* ignore */ }
      })();
    };
  }, [credentials.streamApiKey, credentials.streamToken, credentials.streamUserId, credentials.streamCallId, credentials.displayName]);

  if (status !== "in-call" || !client || !call) {
    return (
      <CallShell
        state={status === "error" ? "error" : "connecting"}
        message={status === "error" ? (errorMessage ?? "Could not connect the call.") : "Connecting…"}
        onEnd={onEnd}
      />
    );
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <FoundationCallLive onEnd={onEnd} />
      </StreamCall>
    </StreamVideo>
  );
}

function FoundationCallLive({ onEnd }: { onEnd: () => void }) {
  const { useParticipants, useMicrophoneState } = useCallStateHooks();
  const participants = useParticipants();
  const { microphone, isMute } = useMicrophoneState();
  // The other party is present once there is more than one participant on the call.
  const otherJoined = participants.length > 1;

  return (
    <>
      <CallShell
        state="in-call"
        message={otherJoined ? "Connected" : "Waiting for the other person to join…"}
        muted={isMute}
        onToggleMute={() => void microphone.toggle()}
        onEnd={onEnd}
      />
      {/* Headless — plays every participant's audio track. */}
      <ParticipantsAudio participants={participants} />
    </>
  );
}

// One shared frame for connecting / error / in-call so the call card keeps a stable shape. Mute is only
// rendered in the in-call state.
function CallShell({
  state,
  message,
  muted,
  onToggleMute,
  onEnd,
}: {
  state: ConnState;
  message: string;
  muted?: boolean;
  onToggleMute?: () => void;
  onEnd: () => void;
}) {
  const { theme } = useTheme();
  const t = getFoundationTokens(theme);
  const stateLabel =
    state === "in-call" ? "In call" : state === "error" ? "Call error" : "Connecting";
  const stateColor = state === "error" ? "#F87171" : t.ACCENT;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "center" }}>
      <div
        aria-live="polite"
        style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: stateColor }}
      >
        {stateLabel}
      </div>
      <div style={{ fontSize: 14, color: "#D1D5DB", textAlign: "center", minHeight: 20 }}>{message}</div>

      <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
        {state === "in-call" && onToggleMute ? (
          <MuteButton muted={!!muted} onToggleMute={onToggleMute} t={t} />
        ) : null}
        <button
          type="button"
          onClick={onEnd}
          aria-label="End call"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "11px 18px", borderRadius: 12,
            background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
            color: "#F87171", fontSize: 14, fontWeight: 700, cursor: "pointer",
          }}
        >
          <PhoneOff size={16} />
          <span>End call</span>
        </button>
      </div>
    </div>
  );
}

// The mute toggle, only shown in the in-call state.
function MuteButton({
  muted,
  onToggleMute,
  t,
}: {
  muted: boolean;
  onToggleMute: () => void;
  t: FoundationTokens;
}) {
  return (
    <button
      type="button"
      onClick={onToggleMute}
      aria-label={muted ? "Unmute microphone" : "Mute microphone"}
      aria-pressed={muted}
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "11px 18px", borderRadius: 12,
        background: muted ? t.BORDER : `${t.ACCENT}1A`,
        border: `1px solid ${muted ? "rgba(255,255,255,0.12)" : t.ACCENT + "40"}`,
        color: muted ? t.SUBTLE : t.ACCENT,
        fontSize: 14, fontWeight: 600, cursor: "pointer",
      }}
    >
      {muted ? <MicOff size={16} /> : <Mic size={16} />}
      <span>{muted ? "Muted" : "Mute"}</span>
    </button>
  );
}
