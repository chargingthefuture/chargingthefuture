/**
 * FoundationCallController — the Foundation instant 1:1 call, mounted once at the app shell.
 *
 * The Android counterpart of the web FoundationInstantCallController (foundation-instant-call.tsx): it
 * provides startCall so the Foundation screen's "Connect now" can place a ring (the caller side), and it
 * watches for rings to this member (the callee side) through the incoming-call poll and the native ring
 * push. Whatever is happening is drawn by one full-screen overlay above every tab.
 *
 * Same routes, same states and same route messages as the web: ringing, answered (live), declined, timed
 * out, ended, out of credits (402) and a provider with no valid rate (409).
 */
import React, { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  postCallAction,
  ringProvider,
  rateLabel,
  type CallAction,
  type CallState,
  type InstantCall,
  type RingStatus,
} from './FoundationApi';
import { useActiveCallPoll, useIncomingRingPoll, useRingPushes } from './useCallPolls';
import { FoundationCallOverlay } from './FoundationCallOverlay';
import type { CallCredentials } from './FoundationCallAudio';

export type ActiveSide =
  | { kind: 'idle' }
  | { kind: 'caller'; callId: string; providerName: string; rateText: string; rateCredits: number }
  | { kind: 'callee'; callId: string };

export type StartCallInput = {
  providerProfileId: string;
  providerName: string;
  rateCredits: number;
  intervalMinutes: number;
  authorizedBlocks: number;
};

export type StartCallResult = { ok: true } | { ok: false; error: string };

type ContextValue = { startCall: (_input: StartCallInput) => Promise<StartCallResult> };

const CallContext = createContext<ContextValue | null>(null);

// The Foundation screen's handle on the controller; null outside the shell.
export function useFoundationCall(): ContextValue | null {
  return useContext(CallContext);
}

export type CallView = {
  side: ActiveSide;
  ringStatus: RingStatus;
  call: InstantCall | null;
  credentials: CallCredentials | null;
  error: string | null;
  extending: boolean;
};

const IDLE_VIEW: CallView = { side: { kind: 'idle' }, ringStatus: 'none', call: null, credentials: null, error: null, extending: false };

function credentialsOf(state: CallState, displayName: string): CallCredentials | null {
  const { call } = state;
  if (call.ringStatus !== 'answered') return null;
  if (!state.streamApiKey || !state.streamToken || !state.streamUserId || !state.streamCallId) return null;
  return {
    streamApiKey: state.streamApiKey,
    streamUserId: state.streamUserId,
    streamToken: state.streamToken,
    streamCallId: state.streamCallId,
    displayName,
  };
}

function useCallActions(view: CallView, setView: React.Dispatch<React.SetStateAction<CallView>>, reset: () => void) {
  const extendingRef = useRef(false);
  const callId = view.side.kind === 'idle' ? null : view.side.callId;

  const act = useCallback(async (action: CallAction) => {
    if (!callId) return null;
    const result = await postCallAction(callId, action);
    if ('error' in result) {
      const message = result.error;
      setView((prev) => ({ ...prev, error: message }));
      return null;
    }
    setView((prev) => ({ ...prev, error: null, call: result.call, ringStatus: result.call.ringStatus }));
    return result.call;
  }, [callId, setView]);

  const onAnswer = useCallback(() => void act('answer'), [act]);
  const onDecline = useCallback(() => void act('decline').then(reset), [act, reset]);
  const onEnd = useCallback(() => void act('end').then(reset), [act, reset]);

  // Caller only. Guarded twice: the ref stops a second tap before React re-renders, the flag disables the
  // button. A failure (out of credits, past the limit) shows the route's reason; the next poll reconciles.
  const onExtend = useCallback(() => {
    if (view.side.kind !== 'caller' || extendingRef.current) return;
    extendingRef.current = true;
    setView((prev) => ({ ...prev, extending: true }));
    void act('extend').finally(() => {
      extendingRef.current = false;
      setView((prev) => ({ ...prev, extending: false }));
    });
  }, [act, setView, view.side.kind]);

  return { onAnswer, onDecline, onEnd, onExtend };
}

function useStartCall(view: CallView, setView: React.Dispatch<React.SetStateAction<CallView>>) {
  const startingRef = useRef(false);
  const idle = view.side.kind === 'idle';
  return useCallback(async (input: StartCallInput): Promise<StartCallResult> => {
    if (startingRef.current || !idle) return { ok: false, error: 'A call is already in progress.' };
    startingRef.current = true;
    try {
      const result = await ringProvider(input.providerProfileId, input.authorizedBlocks);
      if ('error' in result) return { ok: false, error: result.error };
      setView({
        ...IDLE_VIEW,
        side: {
          kind: 'caller',
          callId: result.call.id,
          providerName: input.providerName,
          rateText: rateLabel(input.rateCredits, input.intervalMinutes),
          rateCredits: input.rateCredits,
        },
        ringStatus: 'ringing',
        call: result.call,
      });
      return { ok: true };
    } finally {
      startingRef.current = false;
    }
  }, [idle, setView]);
}

export function FoundationCallController({ signedIn, displayName, children }: {
  signedIn: boolean;
  displayName: string;
  children: ReactNode;
}) {
  const [view, setView] = useState<CallView>(IDLE_VIEW);
  const reset = useCallback(() => setView(IDLE_VIEW), []);
  const idle = view.side.kind === 'idle';

  const onState = useCallback((state: CallState) => {
    setView((prev) => ({
      ...prev,
      call: state.call,
      ringStatus: state.call.ringStatus,
      credentials: prev.credentials ?? credentialsOf(state, displayName),
    }));
  }, [displayName]);

  // A ring from the inbox poll or a push: show it unless something is already on screen.
  const onRing = useCallback((callId: string) => {
    setView((prev) => (prev.side.kind === 'idle' ? { ...IDLE_VIEW, side: { kind: 'callee', callId }, ringStatus: 'ringing' } : prev));
  }, []);

  useActiveCallPoll(idle ? null : (view.side as { callId: string }).callId, onState, reset);
  useIncomingRingPoll(signedIn && idle, onRing);
  useRingPushes(signedIn, onRing);

  const startCall = useStartCall(view, setView);
  const actions = useCallActions(view, setView, reset);
  const value = useMemo(() => ({ startCall }), [startCall]);

  return (
    <CallContext.Provider value={value}>
      {children}
      {idle ? null : <FoundationCallOverlay view={view} {...actions} />}
    </CallContext.Provider>
  );
}
