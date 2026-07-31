"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { PhoneCall, PhoneIncoming, X } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getFoundationTokens, type ProviderView } from "./foundation-ui";
import { FoundationCallAudio, type FoundationCallCredentials } from "./foundation-call-audio";
import type { FoundationCallRingStatus, FoundationInstantCall } from "@/lib/foundation/types";

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

type RingStatus = FoundationCallRingStatus;

// The subset of the server's call row this overlay reads, DERIVED from the server type rather than
// re-declared. Deriving is the point: when the two were independent declarations, a field the route
// sends could be absent from the client's copy and the compiler had nothing to say — which is exactly
// how the streamCallId mix-up (issue #987) stayed invisible until it was found by hand. With Pick, a
// field renamed or dropped server-side is a compile error here instead of an undefined at runtime.
//
// Per-block billing (issue #808 task 4): authorizedBlocks is the buyer-set cap; blocksCharged is how many
// blocks have been paid; paidThroughAtIso is when the current prepaid block runs out (drives the
// countdown); intervalMinutesLocked is the locked block length; endedReason explains a non-hang-up end.
type InstantCall = Pick<
  FoundationInstantCall,
  | "id"
  | "threadId"
  | "callerUserId"
  | "calleeUserId"
  | "ringStatus"
  | "streamCallId"
  | "ringExpiresAtIso"
  | "authorizedBlocks"
  | "blocksCharged"
  | "paidThroughAtIso"
  | "intervalMinutesLocked"
  | "endedReason"
>;

// Two distinct Stream ids come back here and must not be swapped (issue #987):
//   - streamCallId is the Stream **Video** call id the audio room joins (the route surfaces it flat, and it
//     mirrors call.streamCallId).
//   - streamChannelId is the Stream **Chat** channel id for the thread's Direct Line — never a call id.
type CallStateResponse = {
  ok: boolean;
  call?: InstantCall;
  role?: "caller" | "callee";
  streamApiKey?: string | null;
  streamUserId?: string | null;
  streamToken?: string | null;
  streamCallId?: string;
  streamChannelId?: string;
};

// The result of placing a ring: either it started (the overlay takes over) or it failed with a reason the
// confirm dialog can show in place (e.g. not enough ServiceCredits), so the buyer keeps their choices.
type StartCallResult = { ok: true } | { ok: false; error: string };

type InstantCallContextValue = {
  // Place a ring to a provider with a buyer-set block cap (issue #808 task 4). Opens (or reuses) the Direct
  // Line thread, then rings. Returns whether the ring started or why it failed.
  startCall: (provider: ProviderView, authorizedBlocks: number) => Promise<StartCallResult>;
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
    if (body.code === "FOUNDATION_CALL_INSUFFICIENT_FUNDS") {
      return body.message || "You do not have enough ServiceCredits for this call.";
    }
    if (body.code === "FOUNDATION_CALL_BLOCK_CAP_REACHED") {
      return body.message || "You have reached the number of blocks you authorized for this call.";
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
  | { kind: "caller"; callId: string; providerName: string; rateLabel: string; rateCredits: number }
  | { kind: "callee"; callId: string; callerLabel: string };

// The billing view the caller's overlay needs: how many blocks are paid, the cap, when the current block
// runs out, and the locked block length. Updated from each poll of the active call.
type CallBilling = {
  authorizedBlocks: number | null;
  blocksCharged: number;
  paidThroughAtIso: string | null;
  intervalMinutesLocked: number | null;
  endedReason: string | null;
};

const EMPTY_BILLING: CallBilling = {
  authorizedBlocks: null,
  blocksCharged: 0,
  paidThroughAtIso: null,
  intervalMinutesLocked: null,
  endedReason: null,
};

// Project the billing view out of a server call row. Kept in one place because the same mapping is used
// after placing a ring, on every poll, and after an extend charge.
function billingFromCall(call: InstantCall): CallBilling {
  return {
    authorizedBlocks: call.authorizedBlocks,
    blocksCharged: call.blocksCharged,
    paidThroughAtIso: call.paidThroughAtIso,
    intervalMinutesLocked: call.intervalMinutesLocked,
    endedReason: call.endedReason,
  };
}

// Build the audio-room credentials once the call is answered and every Stream field is present; returns
// null until then, so the caller keeps polling.
function buildCredentialsIfReady(
  data: CallStateResponse,
  call: InstantCall,
  displayName: string,
): FoundationCallCredentials | null {
  const streamCallId = data.streamCallId || call.streamCallId;
  if (
    call.ringStatus === "answered" &&
    data.streamApiKey &&
    data.streamToken &&
    data.streamUserId &&
    streamCallId
  ) {
    return {
      streamApiKey: data.streamApiKey,
      streamUserId: data.streamUserId,
      streamToken: data.streamToken,
      streamCallId,
      displayName,
    };
  }
  return null;
}

// A ring is terminal (declined / timed_out / ended) — the overlay holds the final message, then closes.
function isTerminalRing(status: RingStatus): boolean {
  return status === "declined" || status === "timed_out" || status === "ended";
}

// Poll the active call's state (both caller and callee follow this once a call id exists). Drives the
// transition into the audio room on answer, and tears everything down on a terminal state.
function useActiveCallPoll(
  activeCallId: string | null,
  displayName: string,
  setRingStatus: (status: RingStatus) => void,
  setBilling: (billing: CallBilling) => void,
  setCredentials: (credentials: FoundationCallCredentials | null) => void,
  reset: () => void,
) {
  useEffect(() => {
    if (!activeCallId) {
      return;
    }
    let canceled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const res = await fetch(`/api/foundation/connections/instant-calls/${activeCallId}`);
        if (!res.ok || canceled) {
          return;
        }
        const data = (await res.json()) as CallStateResponse;
        const call = data.call;
        if (!call || canceled) {
          return;
        }
        setRingStatus(call.ringStatus);
        setBilling(billingFromCall(call));
        // Read the video call id from the flat response field, falling back to the nested call row. Wait for
        // a non-empty id before joining: an empty id would send the audio room to a call that does not exist
        // and fail with nothing shown, so keep polling until the id is there instead (issue #987).
        const credentials = buildCredentialsIfReady(data, call, displayName);
        if (credentials) {
          setCredentials(credentials);
        }
        // Terminal: declined / timed_out / ended. Hold the final message briefly, then close.
        if (isTerminalRing(call.ringStatus)) {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => { if (!canceled) reset(); }, 1800);
          return;
        }
      } catch {
        /* transient — the next tick reconciles */
      }
      if (!canceled) {
        timer = setTimeout(() => void tick(), RING_POLL_MS);
      }
    };
    void tick();

    return () => {
      canceled = true;
      if (timer) clearTimeout(timer);
    };
  }, [activeCallId, displayName, reset]);
}

// Incoming-ring inbox poll (callee side). Only runs while idle, so a member follows their own active call
// without also being interrupted by the inbox. When a ring appears, switch to the callee surface.
function useIncomingCallPoll(
  activeKind: ActiveSide["kind"],
  setRingStatus: (status: RingStatus) => void,
  setActive: (side: ActiveSide) => void,
) {
  useEffect(() => {
    if (activeKind !== "idle") {
      return;
    }
    let canceled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const res = await fetch("/api/foundation/connections/incoming-call");
        if (res.ok && !canceled) {
          const data = (await res.json()) as { call?: InstantCall | null };
          if (data.call && !canceled) {
            setRingStatus("ringing");
            setActive({ kind: "callee", callId: data.call.id, callerLabel: "Someone is calling you" });
            return;
          }
        }
      } catch {
        /* transient — retry */
      }
      if (!canceled) {
        timer = setTimeout(() => void tick(), INBOX_POLL_MS);
      }
    };
    void tick();

    return () => {
      canceled = true;
      if (timer) clearTimeout(timer);
    };
  }, [activeKind]);
}

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
  const [billing, setBilling] = useState<CallBilling>(EMPTY_BILLING);
  // True while a ring is being placed, so the button cannot fire twice.
  const startingRef = useRef(false);
  // True while an extend charge is in flight, so the buyer cannot fire two extends at once.
  const extendingRef = useRef(false);
  const [extending, setExtending] = useState(false);

  const reset = useCallback(() => {
    setActive({ kind: "idle" });
    setRingStatus("none");
    setCredentials(null);
    setError(null);
    setBilling(EMPTY_BILLING);
    setExtending(false);
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

  // Place a ring (caller side) with the buyer-set block cap. Opens a thread with the provider, then rings.
  // Returns whether the ring started or why it failed, so the confirm dialog can show the reason in place.
  const startCall = useCallback(async (provider: ProviderView, authorizedBlocks: number): Promise<StartCallResult> => {
    if (startingRef.current || active.kind !== "idle") {
      return { ok: false, error: "A call is already in progress." };
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
        return { ok: false, error: await readError(threadRes, "Could not open a connection with this provider.") };
      }
      const threadData = (await threadRes.json()) as { thread?: { id?: string } };
      const threadId = threadData.thread?.id;
      if (!threadId) {
        return { ok: false, error: "Connection response was incomplete." };
      }

      const ringRes = await fetch(`/api/foundation/connections/threads/${threadId}/instant-call`, {
        method: "POST",
        headers: CSRF_HEADERS,
        body: JSON.stringify({ authorizedBlocks }),
      });
      if (!ringRes.ok) {
        return { ok: false, error: await readError(ringRes, "Could not start the call.") };
      }
      const ringData = (await ringRes.json()) as { call?: InstantCall };
      const call = ringData.call;
      if (!call) {
        return { ok: false, error: "Call response was incomplete." };
      }
      const rate = provider.instantCallRateCredits ?? 0;
      const rateLabel = `${rate === 1 ? "1 ServiceCredit" : `${rate} ServiceCredits`} / ${provider.instantCallIntervalMinutes} min`;
      setRingStatus("ringing");
      setBilling(billingFromCall(call));
      setActive({ kind: "caller", callId: call.id, providerName: provider.displayName, rateLabel, rateCredits: rate });
      return { ok: true };
    } finally {
      startingRef.current = false;
    }
  }, [active.kind]);

  // Poll the active call's state (both caller and callee follow this once a call id exists). Drives the
  // transition into the audio room on answer, and tears everything down on a terminal state.
  const activeCallId = active.kind === "caller" || active.kind === "callee" ? active.callId : null;
  useActiveCallPoll(activeCallId, displayName, setRingStatus, setBilling, setCredentials, reset);

  // Incoming-ring inbox poll (callee side). Only runs while idle, so a member follows their own active call
  // without also being interrupted by the inbox. When a ring appears, switch to the callee surface.
  useIncomingCallPoll(active.kind, setRingStatus, setActive);

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

  // Caller-only: pay for one more block. The server charges the next block at the LOCKED rate and advances
  // the paid window; on failure (out of credits, or past the cap) it surfaces the reason and, for
  // insufficient funds, the call has already ended cleanly server-side — the next poll reconciles that.
  const onExtend = useCallback(async () => {
    if (active.kind !== "caller" || extendingRef.current) return;
    extendingRef.current = true;
    setExtending(true);
    setError(null);
    try {
      const res = await fetch(`/api/foundation/connections/instant-calls/${active.callId}/extend`, {
        method: "POST",
        headers: CSRF_HEADERS,
      });
      if (!res.ok) {
        setError(await readError(res, "Could not extend the call."));
        return;
      }
      const data = (await res.json()) as { call?: InstantCall };
      const call = data.call;
      if (call) {
        setRingStatus(call.ringStatus);
        setBilling(billingFromCall(call));
      }
    } finally {
      extendingRef.current = false;
      setExtending(false);
    }
  }, [active]);

  return (
    <InstantCallContext.Provider value={{ startCall }}>
      {children}
      {active.kind !== "idle" ? (
        <CallOverlay
          side={active}
          ringStatus={ringStatus}
          credentials={credentials}
          error={error}
          billing={billing}
          extending={extending}
          onAnswer={() => void onAnswer()}
          onDecline={() => void onDecline()}
          onEnd={() => void onEnd()}
          onExtend={() => void onExtend()}
        />
      ) : null}
    </InstantCallContext.Provider>
  );
}

// Seconds left until `iso`, recomputed every second so the in-call block countdown ticks live. Returns
// null when there is no paid-through time yet (e.g. still ringing). Never goes below 0.
function useSecondsUntil(iso: string | null): number | null {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!iso) {
      setSecondsLeft(null);
      return;
    }
    const target = new Date(iso).getTime();
    const tick = () => setSecondsLeft(Math.max(0, Math.round((target - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [iso]);
  return secondsLeft;
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// The window (in seconds) before the current block runs out where the caller is prompted to extend, so the
// call does not silently drop when the prepaid time ends.
const EXTEND_PROMPT_SECONDS = 60;

type FoundationTokens = ReturnType<typeof getFoundationTokens>;

// The caller's derived billing view: whether the authorized-block cap is reached, the extend cost label,
// and whether the current block is near its end (so the Extend prompt highlights). The callee side has no
// billing, so these collapse to their neutral values.
function deriveBillingView(
  side: ActiveSide,
  billing: CallBilling,
  secondsLeft: number | null,
): { atCap: boolean; extendLabel: string; nearBlockEnd: boolean } {
  const atCap = billing.authorizedBlocks !== null && billing.blocksCharged >= billing.authorizedBlocks;
  const rateCredits = side.kind === "caller" ? side.rateCredits : 0;
  const extendLabel = rateCredits === 1 ? "1 credit" : `${rateCredits} credits`;
  const nearBlockEnd = secondsLeft !== null && secondsLeft <= EXTEND_PROMPT_SECONDS;
  return { atCap, extendLabel, nearBlockEnd };
}

// The overlay's heading and subline for the current side/ring state.
function computeHeadingSubline(side: ActiveSide, ringStatus: RingStatus): { heading: string; subline: string } {
  if (side.kind === "caller") {
    return {
      heading: side.providerName,
      subline: ringStatus === "ringing" ? `Ringing… · ${side.rateLabel}` : "",
    };
  }
  if (side.kind === "callee") {
    return {
      heading: "Incoming call",
      subline: ringStatus === "ringing" ? "Audio call" : "",
    };
  }
  return { heading: "Connect now", subline: "" };
}

// The terminal message shown when a call has ended, or null while it is still live. Out-of-credits and
// paid-time-elapsed take precedence over the plain ring-status endings.
function computeTerminalLabel(billing: CallBilling, ringStatus: RingStatus): string | null {
  if (billing.endedReason === "caller_insufficient_funds") return "Session ended — out of credits.";
  if (billing.endedReason === "paid_window_elapsed") return "Session ended — paid time used up.";
  if (ringStatus === "declined") return "Call declined.";
  if (ringStatus === "timed_out") return "No answer.";
  if (ringStatus === "ended") return "Call ended.";
  return null;
}

// A single fixed overlay that renders every call state: the caller's "ringing…", the callee's incoming
// answer/decline, the live audio room (with the caller's block countdown + extend prompt), and the
// terminal (declined/timed-out/ended/out-of-credits) message. Mobile-responsive: it fills small screens
// and centers a card on larger ones.
function CallOverlay({
  side,
  ringStatus,
  credentials,
  error,
  billing,
  extending,
  onAnswer,
  onDecline,
  onEnd,
  onExtend,
}: {
  side: ActiveSide;
  ringStatus: RingStatus;
  credentials: FoundationCallCredentials | null;
  error: string | null;
  billing: CallBilling;
  extending: boolean;
  onAnswer: () => void;
  onDecline: () => void;
  onEnd: () => void;
  onExtend: () => void;
}) {
  const { theme } = useTheme();
  const t = getFoundationTokens(theme);
  const isCallee = side.kind === "callee";
  const isCaller = side.kind === "caller";
  const inCall = ringStatus === "answered" && credentials !== null;

  // Live countdown for the current prepaid block (caller side only — the callee does not pay or extend).
  const secondsLeft = useSecondsUntil(isCaller ? billing.paidThroughAtIso : null);
  const { atCap, extendLabel, nearBlockEnd } = deriveBillingView(side, billing, secondsLeft);
  const { heading, subline } = computeHeadingSubline(side, ringStatus);
  const terminalLabel = computeTerminalLabel(billing, ringStatus);

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
          border: `1px solid ${t.ACCENT}30`,
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
            background: `${t.ACCENT}1A`, border: `1px solid ${t.ACCENT}40`,
            display: "flex", alignItems: "center", justifyContent: "center", color: t.ACCENT,
          }}
        >
          {isCallee ? <PhoneIncoming size={26} /> : <PhoneCall size={26} />}
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: t.TITLE }}>{heading}</div>
          {subline ? <div style={{ fontSize: 13.5, color: t.SUBTLE, marginTop: 4 }}>{subline}</div> : null}
        </div>

        {error ? (
          <div style={{ fontSize: 13, color: "#F87171", textAlign: "center" }}>{error}</div>
        ) : null}

        <CallOverlayContent
          t={t}
          inCall={inCall}
          credentials={credentials}
          isCaller={isCaller}
          isCallee={isCallee}
          ringStatus={ringStatus}
          terminalLabel={terminalLabel}
          billing={billing}
          secondsLeft={secondsLeft}
          atCap={atCap}
          nearBlockEnd={nearBlockEnd}
          extendLabel={extendLabel}
          extending={extending}
          onAnswer={onAnswer}
          onDecline={onDecline}
          onEnd={onEnd}
          onExtend={onExtend}
        />
      </div>
    </div>
  );
}

// The switchable middle of the call card: the live audio room (with the caller's billing strip), the
// terminal message, the callee's answer/decline pair, or the single end/cancel control while ringing.
function CallOverlayContent({
  t,
  inCall,
  credentials,
  isCaller,
  isCallee,
  ringStatus,
  terminalLabel,
  billing,
  secondsLeft,
  atCap,
  nearBlockEnd,
  extendLabel,
  extending,
  onAnswer,
  onDecline,
  onEnd,
  onExtend,
}: {
  t: FoundationTokens;
  inCall: boolean;
  credentials: FoundationCallCredentials | null;
  isCaller: boolean;
  isCallee: boolean;
  ringStatus: RingStatus;
  terminalLabel: string | null;
  billing: CallBilling;
  secondsLeft: number | null;
  atCap: boolean;
  nearBlockEnd: boolean;
  extendLabel: string;
  extending: boolean;
  onAnswer: () => void;
  onDecline: () => void;
  onEnd: () => void;
  onExtend: () => void;
}) {
  if (inCall && credentials) {
    return (
      <>
        {isCaller ? (
          <CallerBillingStrip
            secondsLeft={secondsLeft}
            blocksCharged={billing.blocksCharged}
            authorizedBlocks={billing.authorizedBlocks}
            atCap={atCap}
            nearBlockEnd={nearBlockEnd}
            extendLabel={extendLabel}
            extending={extending}
            onExtend={onExtend}
          />
        ) : null}
        <FoundationCallAudio credentials={credentials} onEnd={onEnd} />
      </>
    );
  }

  if (terminalLabel) {
    return (
      <div style={{ fontSize: 14, color: "#D1D5DB", textAlign: "center", padding: "8px 0" }}>{terminalLabel}</div>
    );
  }

  if (isCallee && ringStatus === "ringing") {
    return (
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
            background: t.ACCENT, border: "none",
            color: "#1a1205", fontSize: 14, fontWeight: 800, cursor: "pointer",
          }}
        >
          <PhoneCall size={16} /> Answer
        </button>
      </div>
    );
  }

  // Caller is ringing (or callee just answered and the audio room is connecting): a single
  // end/cancel control covers both. Connecting is shown by FoundationCallAudio once credentials land.
  return (
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
  );
}

// The caller's in-call billing strip (issue #808 task 4): the live countdown for the current paid block,
// how many blocks are paid out of the authorized cap, and an Extend control. As the block nears its end
// the Extend prompt highlights; at the cap it is disabled with a clear message. The callee never sees this
// (they do not pay). Mobile-responsive: it is a full-width column inside the call card.
function CallerBillingStrip({
  secondsLeft,
  blocksCharged,
  authorizedBlocks,
  atCap,
  nearBlockEnd,
  extendLabel,
  extending,
  onExtend,
}: {
  secondsLeft: number | null;
  blocksCharged: number;
  authorizedBlocks: number | null;
  atCap: boolean;
  nearBlockEnd: boolean;
  extendLabel: string;
  extending: boolean;
  onExtend: () => void;
}) {
  const { theme } = useTheme();
  const t = getFoundationTokens(theme);
  const countdown = secondsLeft === null ? "—" : formatCountdown(secondsLeft);
  const capText = authorizedBlocks === null ? `${blocksCharged} paid` : `${blocksCharged} of ${authorizedBlocks} blocks`;

  return (
    <div
      style={{
        width: "100%",
        borderRadius: 12,
        background: t.INPUT_BG,
        border: `1px solid ${nearBlockEnd && !atCap ? `${t.ACCENT}55` : t.BORDER_HI}`,
        padding: "12px 14px",
        display: "flex", flexDirection: "column", gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.MUTED, textTransform: "uppercase" }}>
            This block
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: nearBlockEnd && !atCap ? t.ACCENT : t.TITLE, fontVariantNumeric: "tabular-nums" }}>
            {countdown}
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: t.SUBTLE, textAlign: "right" }}>{capText}</div>
      </div>

      {atCap ? (
        <div style={{ fontSize: 12.5, color: t.SUBTLE, lineHeight: 1.5 }}>
          You&apos;ve used all the blocks you authorized. The call will end when this block&apos;s time runs
          out.
        </div>
      ) : (
        <ExtendButton
          t={t}
          atCap={atCap}
          nearBlockEnd={nearBlockEnd}
          extendLabel={extendLabel}
          extending={extending}
          onExtend={onExtend}
        />
      )}
    </div>
  );
}

// The Extend control inside the caller's billing strip: pays for one more block at the locked rate. It
// highlights as the current block nears its end, and is disabled while an extend is already in flight (or
// at the authorized-block cap, though the strip renders a notice instead of this button in that case).
function ExtendButton({
  t,
  atCap,
  nearBlockEnd,
  extendLabel,
  extending,
  onExtend,
}: {
  t: FoundationTokens;
  atCap: boolean;
  nearBlockEnd: boolean;
  extendLabel: string;
  extending: boolean;
  onExtend: () => void;
}) {
  const canExtend = !atCap && !extending;
  return (
    <button
      type="button"
      onClick={onExtend}
      disabled={!canExtend}
      aria-disabled={!canExtend}
      style={{
        width: "100%",
        padding: "10px 16px",
        borderRadius: 10,
        background: nearBlockEnd ? t.ACCENT : t.BORDER,
        color: nearBlockEnd ? "#1a1205" : t.TITLE,
        border: nearBlockEnd ? "none" : "1px solid rgba(255,255,255,0.12)",
        fontSize: 13.5, fontWeight: 700,
        cursor: canExtend ? "pointer" : "not-allowed",
        opacity: canExtend ? 1 : 0.6,
      }}
    >
      {extending ? "Adding block…" : `Extend (+${extendLabel})`}
    </button>
  );
}
