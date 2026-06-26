/**
 * FoundationInstantCallController — the Android (React Native) orchestration for the
 * Foundation instant 1:1 call ring/answer lifecycle and per-block billing display
 * (issue #808 tasks 3 and 4). It mirrors the web controller
 * (ctf/packages/web/components/foundation/foundation-instant-call.tsx).
 *
 * One controller is mounted once at the app root. It both:
 *   - provides startCall(provider, authorizedBlocks) so the "Connect now" button can
 *     place a ring (the caller side), and
 *   - polls the incoming-call inbox (~4s) so a member being rung sees an in-app
 *     answer/decline surface (the callee side), and polls the live call state (~2s)
 *     while a call is active to follow ringing -> answered -> ended/declined/timed_out.
 *
 * Display + REST only: the controller never moves money or computes billing — every
 * charge and transition runs server-side. It shows the returned state and joins the
 * audio room from the answered-call credentials. The ring is delivered by in-app
 * polling (Expo native push is a deferred follow-up), exactly like the web fallback.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../../auth/auth-context';
import {
  answerInstantCall,
  createConnectionThread,
  declineInstantCall,
  describeCallError,
  endInstantCall,
  extendInstantCall,
  getIncomingCall,
  getInstantCallState,
  ringInstantCall,
  type FoundationInstantCall,
  type FoundationCallRingStatus,
} from './api';
import {
  FoundationInstantCallAudio,
  type FoundationCallCredentials,
} from './FoundationInstantCallAudio';

const COLOR = '#F59E0B';
const TEXT = '#F9FAFB';
const TEXT_DIM = '#9CA3AF';
const SUBTLE = '#6B7280';

// Foreground display for the Foundation ring native push (issue #884). When a push
// arrives while the app is open, show the system alert so the member still notices
// the incoming call even if they are on another screen. Set once at module load;
// harmless on Expo Go (no remote push is delivered there anyway).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Poll cadence while following a ring/in-call. Kept short so ring/answer/decline/
// timeout feel live without hammering the server. Matches the web cadence.
const RING_POLL_MS = 2000;
const INBOX_POLL_MS = 4000;

// The window (in seconds) before the current block runs out where the caller is
// prompted to extend, so the call does not silently drop when the prepaid time ends.
const EXTEND_PROMPT_SECONDS = 60;

// A minimal view of a provider the caller is ringing — only what the overlay needs.
export interface ConnectNowProvider {
  profileId: string;
  displayName: string;
  instantCallRateCredits: number;
  instantCallIntervalMinutes: number;
}

// The result of placing a ring: either it started (the overlay takes over) or it
// failed with a reason the confirm dialog can show in place (e.g. not enough
// ServiceCredits), so the buyer keeps their choices.
export type StartCallResult = { ok: true } | { ok: false; error: string };

interface InstantCallContextValue {
  // Place a ring to a provider with a buyer-set block cap. Opens (or reuses) the
  // Direct Line thread, then rings. Returns whether the ring started or why it failed.
  startCall: (_provider: ConnectNowProvider, _authorizedBlocks: number) => Promise<StartCallResult>;
  // Whether the controller is mounted and idle (no call in flight) — the button can
  // use this to gate a second ring.
  ready: boolean;
}

const InstantCallContext = createContext<InstantCallContextValue | null>(null);

// Hook the "Connect now" button uses. Returns null when no controller is mounted, so
// the button can fall back to disabled rather than crash.
export function useInstantCall(): InstantCallContextValue | null {
  return useContext(InstantCallContext);
}

// What the controller is showing right now: nothing, the caller's outbound call, or
// the callee's inbound call.
type ActiveSide =
  | { kind: 'idle' }
  | { kind: 'caller'; callId: string; providerName: string; rateLabel: string; rateCredits: number }
  | { kind: 'callee'; callId: string };

// The billing view the caller's overlay needs, refreshed from each poll.
interface CallBilling {
  authorizedBlocks: number | null;
  blocksCharged: number;
  paidThroughAtIso: string | null;
  intervalMinutesLocked: number | null;
  endedReason: string | null;
}

const EMPTY_BILLING: CallBilling = {
  authorizedBlocks: null,
  blocksCharged: 0,
  paidThroughAtIso: null,
  intervalMinutesLocked: null,
  endedReason: null,
};

function billingFromCall(call: FoundationInstantCall): CallBilling {
  return {
    authorizedBlocks: call.authorizedBlocks,
    blocksCharged: call.blocksCharged,
    paidThroughAtIso: call.paidThroughAtIso,
    intervalMinutesLocked: call.intervalMinutesLocked,
    endedReason: call.endedReason,
  };
}

export const FoundationInstantCallController: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const displayName = user?.username ?? user?.id ?? 'You';

  const [active, setActive] = useState<ActiveSide>({ kind: 'idle' });
  const [ringStatus, setRingStatus] = useState<FoundationCallRingStatus>('none');
  const [credentials, setCredentials] = useState<FoundationCallCredentials | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [billing, setBilling] = useState<CallBilling>(EMPTY_BILLING);
  // True while a ring is being placed, so the button cannot fire twice.
  const startingRef = useRef(false);
  // True while an extend charge is in flight, so the buyer cannot fire two extends.
  const extendingRef = useRef(false);
  const [extending, setExtending] = useState(false);

  const reset = useCallback(() => {
    setActive({ kind: 'idle' });
    setRingStatus('none');
    setCredentials(null);
    setError(null);
    setBilling(EMPTY_BILLING);
    setExtending(false);
  }, []);

  // Place a ring (caller side) with the buyer-set block cap. Opens a thread with the
  // provider, then rings. Returns whether the ring started or why it failed.
  const startCall = useCallback(
    async (provider: ConnectNowProvider, authorizedBlocks: number): Promise<StartCallResult> => {
      if (startingRef.current || active.kind !== 'idle') {
        return { ok: false, error: 'A call is already in progress.' };
      }
      startingRef.current = true;
      setError(null);
      try {
        // Open (or reuse) the Direct Line thread with this provider.
        let threadId: string;
        try {
          const thread = await createConnectionThread(provider.profileId);
          threadId = thread.threadId;
        } catch (e) {
          return { ok: false, error: describeCallError(e, 'Could not open a connection with this provider.').message };
        }
        if (!threadId) {
          return { ok: false, error: 'Connection response was incomplete.' };
        }

        // Ring the provider.
        let call: FoundationInstantCall | undefined;
        try {
          const ringResp = await ringInstantCall(threadId, authorizedBlocks);
          call = ringResp.call;
        } catch (e) {
          return { ok: false, error: describeCallError(e, 'Could not start the call.').message };
        }
        if (!call) {
          return { ok: false, error: 'Call response was incomplete.' };
        }

        const rate = provider.instantCallRateCredits;
        const rateLabel = `${rate === 1 ? '1 ServiceCredit' : `${rate} ServiceCredits`} / ${provider.instantCallIntervalMinutes} min`;
        setRingStatus('ringing');
        setBilling(billingFromCall(call));
        setActive({
          kind: 'caller',
          callId: call.id,
          providerName: provider.displayName,
          rateLabel,
          rateCredits: rate,
        });
        return { ok: true };
      } finally {
        startingRef.current = false;
      }
    },
    [active.kind],
  );

  // Poll the active call's state (both caller and callee follow this once a call id
  // exists). Drives the transition into the audio room on answer, and tears
  // everything down on a terminal state.
  const activeCallId = active.kind === 'caller' || active.kind === 'callee' ? active.callId : null;
  useEffect(() => {
    if (!activeCallId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const data = await getInstantCallState(activeCallId);
        if (cancelled) return;
        const call = data.call;
        if (!call) return;
        setRingStatus(call.ringStatus);
        setBilling(billingFromCall(call));
        if (call.ringStatus === 'answered' && data.streamApiKey && data.streamToken && data.streamUserId) {
          setCredentials({
            streamApiKey: data.streamApiKey,
            streamUserId: data.streamUserId,
            streamToken: data.streamToken,
            streamCallId: call.streamCallId,
            displayName,
          });
        }
        // Terminal: declined / timed_out / ended. Hold the final message briefly,
        // then close.
        if (call.ringStatus === 'declined' || call.ringStatus === 'timed_out' || call.ringStatus === 'ended') {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            if (!cancelled) reset();
          }, 1800);
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

  // Show one incoming ring if there is one (callee side). Shared by the idle inbox
  // poll and the push-tap handler so both reach the same answer/decline surface.
  // Only acts while idle so a member following their own active call is not
  // interrupted. Returns true when a ring was shown.
  const showIncomingIfAny = useCallback(async (): Promise<boolean> => {
    try {
      const data = await getIncomingCall();
      if (data.call) {
        setRingStatus('ringing');
        setBilling(billingFromCall(data.call));
        setActive({ kind: 'callee', callId: data.call.id });
        return true;
      }
    } catch {
      /* transient — the next poll reconciles */
    }
    return false;
  }, []);

  // Incoming-ring inbox poll (callee side). Only runs while idle and signed in, so a
  // member follows their own active call without also being interrupted by the inbox.
  // When a ring appears, switch to the callee surface. This is the fallback that
  // works with no push configured; native push (issue #884) only wakes the device
  // sooner — the answer/decline surface still comes from this poll.
  useEffect(() => {
    if (active.kind !== 'idle' || !isAuthenticated) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      const shown = !cancelled && (await showIncomingIfAny());
      if (!cancelled && !shown) {
        timer = setTimeout(() => void tick(), INBOX_POLL_MS);
      }
    };
    void tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [active.kind, isAuthenticated, showIncomingIfAny]);

  // Native-push tap handling (issue #884). When the member taps the incoming-call
  // notification — delivered by Expo native push when "call alerts" is on — the OS
  // opens the app and fires this listener; we immediately check the incoming-call
  // inbox so the answer/decline surface appears at once rather than waiting for the
  // next poll tick. The poll above remains the source of truth for the ring state.
  useEffect(() => {
    if (!isAuthenticated) return;
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = (response.notification.request.content.data ?? {}) as { type?: unknown };
      if (data.type === 'foundation.instant_call.ring') {
        void showIncomingIfAny();
      }
    });
    return () => subscription.remove();
  }, [isAuthenticated, showIncomingIfAny]);

  const onAnswer = useCallback(async () => {
    if (active.kind !== 'callee') return;
    const callId = active.callId;
    try {
      const data = await answerInstantCall(callId);
      if (data.call) setRingStatus(data.call.ringStatus);
      // The answer response carries no Stream credentials, so fetch the call state once right away rather
      // than waiting up to RING_POLL_MS for the next scheduled tick — this gets the callee into the audio
      // room without a "Connecting…" gap (issue #991). The poll remains the source of truth.
      try {
        const state = await getInstantCallState(callId);
        if (state.call?.ringStatus === 'answered' && state.streamApiKey && state.streamToken && state.streamUserId) {
          setCredentials({
            streamApiKey: state.streamApiKey,
            streamUserId: state.streamUserId,
            streamToken: state.streamToken,
            streamCallId: state.call.streamCallId,
            displayName,
          });
        }
      } catch {
        /* transient — the active-call poll reconciles on its next tick */
      }
    } catch (e) {
      setError(describeCallError(e, 'Could not answer the call.').message);
    }
  }, [active, displayName]);

  const onDecline = useCallback(async () => {
    if (active.kind !== 'callee') return;
    try {
      await declineInstantCall(active.callId);
    } catch {
      /* terminal anyway; closing */
    }
    reset();
  }, [active, reset]);

  const onEnd = useCallback(async () => {
    if (active.kind === 'idle') return;
    try {
      await endInstantCall(active.callId);
    } catch {
      /* terminal anyway; closing */
    }
    reset();
  }, [active, reset]);

  // Caller-only: pay for one more block. The server charges the next block at the
  // locked rate and advances the paid window; on failure (out of credits, or past
  // the cap) it surfaces the reason and, for insufficient funds, the call has already
  // ended cleanly server-side — the next poll reconciles that.
  const onExtend = useCallback(async () => {
    if (active.kind !== 'caller' || extendingRef.current) return;
    extendingRef.current = true;
    setExtending(true);
    setError(null);
    try {
      const data = await extendInstantCall(active.callId);
      if (data.call) {
        setRingStatus(data.call.ringStatus);
        setBilling(billingFromCall(data.call));
      }
    } catch (e) {
      setError(describeCallError(e, 'Could not extend the call.').message);
    } finally {
      extendingRef.current = false;
      setExtending(false);
    }
  }, [active]);

  return (
    <InstantCallContext.Provider value={{ startCall, ready: active.kind === 'idle' }}>
      {children}
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
    </InstantCallContext.Provider>
  );
};

// Seconds left until `iso`, recomputed every second so the in-call block countdown
// ticks live. Returns null when there is no paid-through time yet. Never below 0.
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
  return `${m}:${String(s).padStart(2, '0')}`;
}

// A single modal that renders every call state: the caller's "ringing…", the callee's
// incoming answer/decline, the live audio room (with the caller's block countdown +
// extend prompt), and the terminal message.
const CallOverlay: React.FC<{
  side: ActiveSide;
  ringStatus: FoundationCallRingStatus;
  credentials: FoundationCallCredentials | null;
  error: string | null;
  billing: CallBilling;
  extending: boolean;
  onAnswer: () => void;
  onDecline: () => void;
  onEnd: () => void;
  onExtend: () => void;
}> = ({ side, ringStatus, credentials, error, billing, extending, onAnswer, onDecline, onEnd, onExtend }) => {
  const isCallee = side.kind === 'callee';
  const isCaller = side.kind === 'caller';
  const inCall = ringStatus === 'answered' && credentials !== null;

  // Live countdown for the current prepaid block (caller side only).
  const secondsLeft = useSecondsUntil(isCaller ? billing.paidThroughAtIso : null);
  const atCap = billing.authorizedBlocks !== null && billing.blocksCharged >= billing.authorizedBlocks;
  const rateCredits = side.kind === 'caller' ? side.rateCredits : 0;
  const extendLabel = rateCredits === 1 ? '1 credit' : `${rateCredits} credits`;
  const nearBlockEnd = secondsLeft !== null && secondsLeft <= EXTEND_PROMPT_SECONDS;

  let heading = 'Connect now';
  let subline = '';
  if (side.kind === 'caller') {
    heading = side.providerName;
    subline = ringStatus === 'ringing' ? `Ringing… · ${side.rateLabel}` : '';
  } else if (isCallee) {
    heading = 'Incoming call';
    subline = ringStatus === 'ringing' ? 'Audio call' : '';
  }

  const terminalLabel =
    billing.endedReason === 'caller_insufficient_funds'
      ? 'Session ended — out of credits.'
      : billing.endedReason === 'paid_window_elapsed'
        ? 'Session ended — paid time used up.'
        : ringStatus === 'declined'
          ? 'Call declined.'
          : ringStatus === 'timed_out'
            ? 'No answer.'
            : ringStatus === 'ended'
              ? 'Call ended.'
              : null;

  return (
    <Modal visible={side.kind !== 'idle'} transparent animationType="fade" onRequestClose={onEnd}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconGlyph}>{isCallee ? '📲' : '📞'}</Text>
          </View>

          <Text style={styles.heading}>{heading}</Text>
          {subline ? <Text style={styles.subline}>{subline}</Text> : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {inCall && credentials ? (
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
              <FoundationInstantCallAudio credentials={credentials} onEnd={onEnd} />
            </>
          ) : terminalLabel ? (
            <Text style={styles.terminalText}>{terminalLabel}</Text>
          ) : ringStatus === 'answered' ? (
            // Answered but the audio-join credentials have not arrived yet: show an explicit connecting
            // state (not a blank card) with an end control, until the next poll/fetch sets credentials
            // and the audio room renders (issue #991).
            <>
              <Text style={styles.terminalText}>Connecting…</Text>
              <TouchableOpacity
                style={[styles.actionBtn, styles.declineBtn, styles.fullWidthBtn]}
                onPress={onEnd}
                accessibilityRole="button"
                accessibilityLabel="End call"
              >
                <Text style={styles.declineText}>End call</Text>
              </TouchableOpacity>
            </>
          ) : isCallee && ringStatus === 'ringing' ? (
            <View style={styles.answerRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.declineBtn]}
                onPress={onDecline}
                accessibilityRole="button"
                accessibilityLabel="Decline call"
              >
                <Text style={styles.declineText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.primaryBtn]}
                onPress={onAnswer}
                accessibilityRole="button"
                accessibilityLabel="Answer call"
              >
                <Text style={styles.primaryText}>Answer</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // Caller is ringing (or callee just answered and the audio room is
            // connecting): a single end/cancel control covers both.
            <TouchableOpacity
              style={[styles.actionBtn, styles.declineBtn, styles.fullWidthBtn]}
              onPress={onEnd}
              accessibilityRole="button"
              accessibilityLabel={isCaller && ringStatus === 'ringing' ? 'Cancel call' : 'End call'}
            >
              <Text style={styles.declineText}>{isCaller && ringStatus === 'ringing' ? 'Cancel' : 'End call'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

// The caller's in-call billing strip (issue #808 task 4): the live countdown for the
// current paid block, how many blocks are paid out of the authorized cap, and an
// Extend control. As the block nears its end the Extend prompt highlights; at the cap
// it is disabled with a clear message. The callee never sees this (they do not pay).
const CallerBillingStrip: React.FC<{
  secondsLeft: number | null;
  blocksCharged: number;
  authorizedBlocks: number | null;
  atCap: boolean;
  nearBlockEnd: boolean;
  extendLabel: string;
  extending: boolean;
  onExtend: () => void;
}> = ({ secondsLeft, blocksCharged, authorizedBlocks, atCap, nearBlockEnd, extendLabel, extending, onExtend }) => {
  const countdown = secondsLeft === null ? '—' : formatCountdown(secondsLeft);
  const capText = authorizedBlocks === null ? `${blocksCharged} paid` : `${blocksCharged} of ${authorizedBlocks} blocks`;
  const canExtend = !atCap && !extending;
  const highlight = nearBlockEnd && !atCap;

  return (
    <View style={[styles.billingStrip, highlight ? styles.billingStripHot : null]}>
      <View style={styles.billingTop}>
        <View>
          <Text style={styles.billingLabel}>This block</Text>
          <Text style={[styles.billingCountdown, highlight ? styles.billingCountdownHot : null]}>{countdown}</Text>
        </View>
        <Text style={styles.billingCap}>{capText}</Text>
      </View>

      {atCap ? (
        <Text style={styles.billingNote}>
          You&apos;ve used all the blocks you authorized. The call will end when this block&apos;s time runs out.
        </Text>
      ) : (
        <TouchableOpacity
          style={[styles.extendBtn, highlight ? styles.extendBtnHot : null, !canExtend ? styles.extendBtnDisabled : null]}
          onPress={onExtend}
          disabled={!canExtend}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canExtend }}
          accessibilityLabel={`Extend, plus ${extendLabel}`}
        >
          <Text style={[styles.extendText, highlight ? styles.extendTextHot : null]}>
            {extending ? 'Adding block…' : `Extend (+${extendLabel})`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,9,13,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#11131A',
    borderWidth: 1,
    borderColor: `${COLOR}30`,
    borderRadius: 16,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 22,
    alignItems: 'center',
    gap: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${COLOR}1A`,
    borderWidth: 1,
    borderColor: `${COLOR}40`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: { fontSize: 26 },
  heading: { fontSize: 18, fontWeight: '800', color: TEXT, textAlign: 'center' },
  subline: { fontSize: 13.5, color: TEXT_DIM, textAlign: 'center', marginTop: -8 },
  errorText: { fontSize: 13, color: '#F87171', textAlign: 'center' },
  terminalText: { fontSize: 14, color: '#D1D5DB', textAlign: 'center', paddingVertical: 8 },
  answerRow: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
  actionBtn: { paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  fullWidthBtn: { alignSelf: 'stretch' },
  primaryBtn: { backgroundColor: COLOR },
  primaryText: { color: '#1a1205', fontSize: 14, fontWeight: '800' },
  declineBtn: { backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  declineText: { color: '#F87171', fontSize: 14, fontWeight: '700' },
  billingStrip: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    padding: 14,
    gap: 10,
  },
  billingStripHot: { borderColor: `${COLOR}55` },
  billingTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  billingLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.9, color: SUBTLE, textTransform: 'uppercase' },
  billingCountdown: { fontSize: 22, fontWeight: '800', color: TEXT, fontVariant: ['tabular-nums'] },
  billingCountdownHot: { color: COLOR },
  billingCap: { fontSize: 12.5, color: TEXT_DIM, textAlign: 'right' },
  billingNote: { fontSize: 12.5, color: TEXT_DIM, lineHeight: 18 },
  extendBtn: {
    width: '100%',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  extendBtnHot: { backgroundColor: COLOR, borderColor: COLOR },
  extendBtnDisabled: { opacity: 0.6 },
  extendText: { fontSize: 13.5, fontWeight: '700', color: TEXT },
  extendTextHot: { color: '#1a1205' },
});
