// The three ways the app learns about a Foundation call, each mirroring the web controller
// (foundation-instant-call.tsx) and adding the native push the web cannot have:
//   - useActiveCallPoll: follows one call every 2 seconds (the web RING_POLL_MS) until it ends.
//   - useIncomingRingPoll: checks the incoming-call inbox every 4 seconds (the web INBOX_POLL_MS) while
//     nothing is showing, the member is signed in and the app is in the foreground.
//   - useRingPushes: a ring push that arrives while the app is open, one the member taps, and the tap
//     that cold-started the app.
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { fetchCallState, fetchIncomingRing, type CallState, type RingStatus } from './FoundationApi';
import { ringCallIdOf } from './callAlerts';
import { reportError } from '../../observability/report';

const RING_POLL_MS = 2000;
const INBOX_POLL_MS = 4000;
// How long the final message (declined, no answer, ended) stays before the overlay closes.
const TERMINAL_HOLD_MS = 1800;

export function isTerminalRing(status: RingStatus): boolean {
  return status === 'declined' || status === 'timed_out' || status === 'ended';
}

type PollOutcome = 'continue' | 'terminal' | 'stop';

async function readOnce(callId: string, onState: (_state: CallState) => void): Promise<PollOutcome> {
  const state = await fetchCallState(callId);
  if (!state) return 'stop';
  onState(state);
  return isTerminalRing(state.call.ringStatus) ? 'terminal' : 'continue';
}

// Follow one call. A failed read is retried on the next tick (one report per run of failures), so a
// single 503 never leaves a caller on the ringing screen or keeps a callee from the credentials.
export function useActiveCallPoll(callId: string | null, onState: (_state: CallState) => void, onDone: () => void) {
  const onStateRef = useRef(onState);
  const onDoneRef = useRef(onDone);
  onStateRef.current = onState;
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!callId) return;
    let canceled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let failureReported = false;

    const tick = async () => {
      let outcome: PollOutcome = 'continue';
      try {
        outcome = await readOnce(callId, (state) => {
          if (!canceled) onStateRef.current(state);
        });
        failureReported = false;
      } catch (error) {
        if (!failureReported) reportError(error, { area: 'foundation', op: 'instant_call_poll', extra: { callId } });
        failureReported = true;
      }
      if (canceled) return;
      if (outcome === 'stop') return void onDoneRef.current();
      const delay = outcome === 'terminal' ? TERMINAL_HOLD_MS : RING_POLL_MS;
      timer = setTimeout(() => (outcome === 'terminal' ? onDoneRef.current() : void tick()), delay);
    };
    void tick();

    return () => {
      canceled = true;
      if (timer) clearTimeout(timer);
    };
  }, [callId]);
}

function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => setActive(next === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

export function useIncomingRingPoll(enabled: boolean, onRing: (_callId: string) => void) {
  const foreground = useAppActive();
  const onRingRef = useRef(onRing);
  onRingRef.current = onRing;
  const running = enabled && foreground;

  useEffect(() => {
    if (!running) return;
    let canceled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const call = await fetchIncomingRing();
        if (call && !canceled) return void onRingRef.current(call.id);
      } catch {
        // no-trace: transient; the next tick tries again, as the web inbox poll does
      }
      if (!canceled) timer = setTimeout(() => void tick(), INBOX_POLL_MS);
    };
    void tick();

    return () => {
      canceled = true;
      if (timer) clearTimeout(timer);
    };
  }, [running]);
}

// A ring push that arrives while the app is open does not need its own banner: the overlay shows it.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const isRing = ringCallIdOf(notification) !== null;
    return { shouldShowBanner: !isRing, shouldShowList: true, shouldPlaySound: !isRing, shouldSetBadge: false };
  },
});

export function useRingPushes(enabled: boolean, onRing: (_callId: string) => void) {
  const onRingRef = useRef(onRing);
  onRingRef.current = onRing;

  useEffect(() => {
    if (!enabled) return;
    let canceled = false;
    const handle = (notification: Notifications.Notification) => {
      const callId = ringCallIdOf(notification);
      if (callId && !canceled) onRingRef.current(callId);
    };
    const received = Notifications.addNotificationReceivedListener(handle);
    const tapped = Notifications.addNotificationResponseReceivedListener((response) => handle(response.notification));
    // The tap that opened the app from closed arrives before this listener exists. It is cleared once
    // read, so signing in again later does not bring back a ring that has long ended.
    void Notifications.getLastNotificationResponseAsync().then(
      (response) => {
        if (!response) return;
        Notifications.clearLastNotificationResponse();
        handle(response.notification);
      },
      (error: unknown) => reportError(error, { area: 'foundation', op: 'ring_push_last_response' }),
    );
    return () => {
      canceled = true;
      received.remove();
      tapped.remove();
    };
  }, [enabled]);
}
