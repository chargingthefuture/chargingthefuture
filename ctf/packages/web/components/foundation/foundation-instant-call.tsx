"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { PhoneCall, PhoneIncoming, X } from "lucide-react";
import { COLOR, type ProviderView } from "./foundation-ui";
import { FoundationCallAudio, type FoundationCallCredentials } from "./foundation-call-audio";

// Client orchestration for the Foundation instant 1:1 call ring/answer lifecycle (issue #808 task 3).
// Audio-only for v1. One <FoundationInstantCallController> is mounted once at the shell root; it both:
//   - provides startCall(provider) so the "Connect now" button can place a ring (the caller side), and
//   - polls the incoming-call inbox so a member being rung sees an in-app answer/decline surface (the
//     callee side). The ring is in-app only for now (task 5 adds push). No billing happens here (task 4).

const CSRF_HEADERS = { "Content-Type": "application/json", "x-ctf-csrf": "1" };

// Poll cadence while following a ring/in-call. Kept short so ring/answer/decline/timeout feel live without
// hammering the server.
const RING_POLL_MS = 2000;
const INBOX_POLL_MS = 4000;

type RingStatus = "none" | "ringing" | "answered" | "declined" | "timed_out" | "ended";

type InstantCall = {
  id: string;
  threadId: string;
  callerUserId: string;
  calleeUserId: string;
  ringStatus: RingStatus;
  streamCallId: string;
  ringExpiresAtIso: string | null;
};

type CallStateResponse = {
  ok: boolean;
  call?: InstantCall;
  role?: "caller" | "callee";
  streamApiKey?: string | null;
  streamUserId?: string | null;
  streamToken?: string | null;
  streamChannelId?: string;
};

type InstantCallContextValue = {
  // Place a ring to a provider. Opens (or reuses) the Direct Line thread, then rings.
  startCall: (provider: ProviderView) => Promise<void>;
};

const InstantCallContext = createContext<InstantCallContextValue | null>(null);

// Hook the "Connect now" button uses. Returns null when no controller is mounted (e.g. an isolated story),
// so the button can fall back to a no-op rather than crash.
export function useInstantCall(): InstantCallContextValue | null {
  return useContext(InstantCallContext);
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { code?: string; message?: string };
    if (body.code === "FOUNDATION_RATE_LIMIT_EXCEEDED") {
      return "Too many call attempts — wait a moment and try again.";
    }
    if (body.code === "FOUNDATION_CALLEE_BUSY") {
      return "This person already has an incoming call. Try again shortly.";
    }
    return body.message || fallback;
  } catch {
    return fallback;
  }
}

// What the controller is showing right now: nothing, the caller's outbound ring/call, or the callee's
// inbound ring/call.
type ActiveSide =
  | { kind: "idle" }
  | { kind: "caller"; callId: string; providerName: string; rateLabel: string }
  | { kind: "callee"; callId: string; callerLabel: string };

export function FoundationInstantCallController({
  displayName,
  children,
}: {
  displayName: string;
  children: ReactNode;
}) {
  const [active, setActive] = useState<ActiveSide>({ kind: "idle" });
  const [ringStatus, setRingStatus] = useState<RingStatus>("none");
  const [credentials, setCredentials] = useState<FoundationCallCredentials | null>(null);
  const [error, setError] = useState<string | null>(null);
  // True while a ring is being placed, so the button cannot fire twice.
  const startingRef = useRef(false);

  const reset = useCallback(() => {
    setActive({ kind: "idle" });
    setRingStatus("none");
    setCredentials(null);
    setError(null);
  }, []);

  // POST a lifecycle action (answer/decline/end) and reconcile from the returned call row.
  const postAction = useCallback(async (callId: string, action: "answer" | "decline" | "end") => {
    const res = await fetch(`/api/foundation/connections/instant-calls/${callId}/${action}`, {
      method: "POST",
      headers: CSRF_HEADERS,
    });
    if (!res.ok) {
      setError(await readError(res, "Could not update the call."));
      return null;
    }
    const data = (await res.json()) as { call?: InstantCall };
    return data.call ?? null;
  }, []);

  // Place a ring (caller side). Opens a thread with the provider, then rings the provider.
  const startCall = useCallback(async (provider: ProviderView) => {
    if (startingRef.current || active.kind !== "idle") {
      return;
    }
    startingRef.current = true;
    setError(null);
    try {
      const threadRes = await fetch("/api/foundation/connections/threads", {
        method: "POST",
        headers: CSRF_HEADERS,
        body: JSON.stringify({ providerId: provider.profileId }),
      });
      if (!threadRes.ok) {
        setError(await readError(threadRes, "Could not open a connection with this provider."));
        return;
      }
      const threadData = (await threadRes.json()) as { thread?: { id?: string } };
      const threadId = threadData.thread?.id;
      if (!threadId) {
        setError("Connection response was incomplete.");
        return;
      }

      const ringRes = await fetch(`/api/foundation/connections/threads/${threadId}/instant-call`, {
        method: "POST",
        headers: CSRF_HEADERS,
      });
      if (!ringRes.ok) {
        setError(await readError(ringRes, "Could not start the call."));
        return;
      }
      const ringData = (await ringRes.json()) as { call?: InstantCall };
      const call = ringData.call;
      if (!call) {
        setError("Call response was incomplete.");
        return;
      }
      const rate = provider.instantCallRateCredits ?? 0;
      const rateLabel = `${rate === 1 ? "1 ServiceCredit" : `${rate} ServiceCredits`} / ${provider.instantCallIntervalMinutes} min`;
      setRingStatus("ringing");
      setActive({ kind: "caller", callId: call.id, providerName: provider.displayName, rateLabel });
    } finally {
      startingRef.current = false;
    }
  }, [active.kind]);

  // Poll the active call's state (both caller and callee follow this once a call id exists). Drives the
  // transition into the audio room on answer, and tears everything down on a terminal state.
  const activeCallId = active.kind === "caller" || active.kind === "callee" ? active.callId : null;
  useEffect(() => {
    if (!activeCallId) {
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const res = await fetch(`/api/foundation/connections/instant-calls/${activeCallId}`);
        if (!res.ok || cancelled) {
          return;
        }
        const data = (await res.json()) as CallStateResponse;
        const call = data.call;
        if (!call || cancelled) {
          return;
        }
        setRingStatus(call.ringStatus);
        if (call.ringStatus === "answered" && data.streamApiKey && data.streamToken && data.streamUserId) {
          setCredentials({
            streamApiKey: data.streamApiKey,
            streamUserId: data.streamUserId,
            streamToken: data.streamToken,
            streamCallId: call.streamCallId,
            displayName,
          });
        }
        // Terminal: declined / timed_out / ended. Hold the final message briefly, then close.
        if (call.ringStatus === "declined" || call.ringStatus === "timed_out" || call.ringStatus === "ended") {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => { if (!cancelled) reset(); }, 1800);
          return;
        }
      } catch {
        /* transient — the next tick reconciles */
      }
      if (!cancelled) {
        timer = setTimeout(() => void tick(), RING_POLL_MS);
      }
    };
    void tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [activeCallId, displayName, reset]);

  // Incoming-ring inbox poll (callee side). Only runs while idle, so a member follows their own active call
  // without also being interrupted by the inbox. When a ring appears, switch to the callee surface.
  useEffect(() => {
    if (active.kind !== "idle") {
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const res = await fetch("/api/foundation/connections/incoming-call");
        if (res.ok && !cancelled) {
          const data = (await res.json()) as { call?: InstantCall | null };
          if (data.call && !cancelled) {
            setRingStatus("ringing");
            setActive({ kind: "callee", callId: data.call.id, callerLabel: "Someone is calling you" });
            return;
          }
        }
      } catch {
        /* transient — retry */
      }
      if (!cancelled) {
        timer = setTimeout(() => void tick(), INBOX_POLL_MS);
      }
    };
    void tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [active.kind]);

  const onAnswer = useCallback(async () => {
    if (active.kind !== "callee") return;
    const call = await postAction(active.callId, "answer");
    if (call) setRingStatus(call.ringStatus);
  }, [active, postAction]);

  const onDecline = useCallback(async () => {
    if (active.kind !== "callee") return;
    await postAction(active.callId, "decline");
    reset();
  }, [active, postAction, reset]);

  const onEnd = useCallback(async () => {
    if (active.kind === "idle") return;
    await postAction(active.callId, "end");
    reset();
  }, [active, postAction, reset]);

  return (
    <InstantCallContext.Provider value={{ startCall }}>
      {children}
      {active.kind !== "idle" ? (
        <CallOverlay
          side={active}
          ringStatus={ringStatus}
          credentials={credentials}
          error={error}
          onAnswer={() => void onAnswer()}
          onDecline={() => void onDecline()}
          onEnd={() => void onEnd()}
        />
      ) : null}
    </InstantCallContext.Provider>
  );
}

// A single fixed overlay that renders every call state: the caller's "ringing…", the callee's incoming
// answer/decline, the live audio room, and the terminal (declined/timed-out/ended) message. Mobile-
// responsive: it fills small screens and centers a card on larger ones.
function CallOverlay({
  side,
  ringStatus,
  credentials,
  error,
  onAnswer,
  onDecline,
  onEnd,
}: {
  side: ActiveSide;
  ringStatus: RingStatus;
  credentials: FoundationCallCredentials | null;
  error: string | null;
  onAnswer: () => void;
  onDecline: () => void;
  onEnd: () => void;
}) {
  const isCallee = side.kind === "callee";
  const isCaller = side.kind === "caller";
  const inCall = ringStatus === "answered" && credentials !== null;

  let heading = "Connect now";
  let subline = "";
  if (isCaller && side.kind === "caller") {
    heading = side.providerName;
    subline = ringStatus === "ringing" ? `Ringing… · ${side.rateLabel}` : "";
  } else if (isCallee) {
    heading = "Incoming call";
    subline = ringStatus === "ringing" ? "Audio call" : "";
  }

  const terminalLabel =
    ringStatus === "declined" ? "Call declined."
      : ringStatus === "timed_out" ? "No answer."
        : ringStatus === "ended" ? "Call ended." : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Call"
      style={{
        position: "fixed", inset: 0, zIndex: 80,
        background: "rgba(8,9,13,0.82)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%", maxWidth: 440,
          background: "#11131A",
          border: `1px solid ${COLOR}30`,
          borderRadius: 16,
          padding: "26px 22px 22px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          maxHeight: "calc(100dvh - 32px)", overflowY: "auto",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
        }}
      >
        <div
          style={{
            width: 64, height: 64, borderRadius: "50%",
            background: `${COLOR}1A`, border: `1px solid ${COLOR}40`,
            display: "flex", alignItems: "center", justifyContent: "center", color: COLOR,
          }}
        >
          {isCallee ? <PhoneIncoming size={26} /> : <PhoneCall size={26} />}
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#F9FAFB" }}>{heading}</div>
          {subline ? <div style={{ fontSize: 13.5, color: "#9CA3AF", marginTop: 4 }}>{subline}</div> : null}
        </div>

        {error ? (
          <div style={{ fontSize: 13, color: "#F87171", textAlign: "center" }}>{error}</div>
        ) : null}

        {inCall && credentials ? (
          <FoundationCallAudio credentials={credentials} onEnd={onEnd} />
        ) : terminalLabel ? (
          <div style={{ fontSize: 14, color: "#D1D5DB", textAlign: "center", padding: "8px 0" }}>{terminalLabel}</div>
        ) : isCallee && ringStatus === "ringing" ? (
          <div style={{ display: "flex", gap: 12, width: "100%", justifyContent: "center" }}>
            <button
              type="button"
              onClick={onDecline}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 22px", borderRadius: 12,
                background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
                color: "#F87171", fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}
            >
              <X size={16} /> Decline
            </button>
            <button
              type="button"
              onClick={onAnswer}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 22px", borderRadius: 12,
                background: COLOR, border: "none",
                color: "#1a1205", fontSize: 14, fontWeight: 800, cursor: "pointer",
              }}
            >
              <PhoneCall size={16} /> Answer
            </button>
          </div>
        ) : (
          // Caller is ringing (or callee just answered and the audio room is connecting): a single
          // end/cancel control covers both. Connecting is shown by FoundationCallAudio once credentials land.
          <button
            type="button"
            onClick={onEnd}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 22px", borderRadius: 12,
              background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
              color: "#F87171", fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}
          >
            <X size={16} /> {isCaller && ringStatus === "ringing" ? "Cancel" : "End call"}
          </button>
        )}
      </div>
    </div>
  );
}
