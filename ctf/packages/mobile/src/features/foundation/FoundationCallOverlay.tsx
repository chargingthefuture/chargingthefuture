/**
 * FoundationCallOverlay — one full-screen surface for every state of a Foundation instant call: the
 * caller's ringing, the callee's Answer / Decline, the live audio call with its time line, and the final
 * message (declined, no answer, ended, out of credits). The Android counterpart of the web CallOverlay
 * (foundation-instant-call.tsx). It is a Modal, so it sits above every tab of the app.
 */
import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { rateLabel, type InstantCall, type RingStatus } from './FoundationApi';
import type { CallView } from './FoundationCallController';
import { FoundationCallAudio, type CallCredentials } from './FoundationCallAudio';
import { CallBlocks } from './FoundationCallBlocks';
import { FDButton } from './FDButton';
import { useFDTheme } from './useFDTheme';

type Actions = {
  onAnswer: () => void;
  onDecline: () => void;
  onEnd: () => void;
  onExtend: () => void;
};

// Endings with a reason of their own, as on the web.
const ENDED_REASON_LABELS: Record<string, string> = {
  caller_insufficient_funds: 'Session ended — out of credits.',
  paid_window_elapsed: 'Session ended — block time used up.',
  provider_not_set_up: 'This provider isn’t set up to take calls right now.',
  caller_cannot_send: 'The call couldn’t start: the caller’s credits can’t be sent right now.',
};

// The final message once a call is over, or null while it is still going. Running out of credits and the
// block time running out come first, as on the web.
function terminalLabel(call: InstantCall | null, ringStatus: RingStatus): string | null {
  const reasonLabel = call?.endedReason ? ENDED_REASON_LABELS[call.endedReason] : undefined;
  if (reasonLabel) return reasonLabel;
  const labels: Partial<Record<RingStatus, string>> = {
    declined: 'Call declined.',
    timed_out: 'No answer.',
    ended: 'Call ended.',
  };
  return labels[ringStatus] ?? null;
}

function heading(view: CallView): { title: string; subline: string } {
  const ringing = view.ringStatus === 'ringing';
  if (view.side.kind === 'caller') {
    return { title: view.side.providerName, subline: ringing ? `Ringing… · ${view.side.rateText}` : '' };
  }
  return { title: 'Incoming call', subline: ringing ? 'Audio call' : '' };
}

// The rate the call runs at, once the server has locked it on answer.
function lockedRate(call: InstantCall | null): string | null {
  if (!call || call.rateCreditsLocked === null || call.intervalMinutesLocked === null) return null;
  return rateLabel(call.rateCreditsLocked, call.intervalMinutesLocked);
}

function LiveCall({ view, call, credentials, actions }: { view: CallView; call: InstantCall; credentials: CallCredentials; actions: Actions }) {
  const side = view.side;
  const rateCredits = call.rateCreditsLocked ?? (side.kind === 'caller' ? side.rateCredits : 0);
  return (
    <>
      <CallBlocks call={call} isCaller={side.kind === 'caller'} rateCredits={rateCredits} extending={view.extending} onExtend={actions.onExtend} />
      <FoundationCallAudio credentials={credentials} onEnd={actions.onEnd} />
    </>
  );
}

function OverlayBody({ view, actions }: { view: CallView; actions: Actions }) {
  const { tokens } = useFDTheme();
  const isCaller = view.side.kind === 'caller';
  if (view.ringStatus === 'answered' && view.credentials && view.call) {
    return <LiveCall view={view} call={view.call} credentials={view.credentials} actions={actions} />;
  }
  const ended = terminalLabel(view.call, view.ringStatus);
  if (ended) return <Text style={[styles.message, { color: tokens.textPrimary }]}>{ended}</Text>;
  if (view.side.kind === 'callee' && view.ringStatus === 'ringing') {
    return (
      <View style={styles.row}>
        <FDButton label="Decline" variant="danger" onPress={actions.onDecline} />
        <FDButton label="Answer" variant="primary" onPress={actions.onAnswer} />
      </View>
    );
  }
  // The caller is ringing, or the callee has answered and the room is being set up.
  return <FDButton label={isCaller && view.ringStatus === 'ringing' ? 'Cancel' : 'End call'} variant="danger" onPress={actions.onEnd} />;
}

export function FoundationCallOverlay({ view, ...actions }: { view: CallView } & Actions) {
  const { tokens, accent } = useFDTheme();
  const { title, subline } = heading(view);
  const rate = lockedRate(view.call);
  return (
    // Back does not close it: leaving a live call is End, so a stray press never hangs up.
    <Modal visible animationType="fade" onRequestClose={() => undefined} statusBarTranslucent>
      <ScrollView
        style={{ backgroundColor: tokens.bg }}
        contentContainerStyle={styles.screen}
        accessibilityViewIsModal
      >
        <View style={[styles.badge, { borderColor: accent, backgroundColor: `${accent}1A` }]}>
          <Text style={styles.badgeIcon}>{view.side.kind === 'callee' ? '📲' : '📞'}</Text>
        </View>
        <Text style={[styles.title, { color: tokens.textPrimary }]}>{title}</Text>
        {subline ? <Text style={[styles.subline, { color: tokens.textSecondary }]}>{subline}</Text> : null}
        {rate && view.ringStatus === 'answered' ? <Text style={[styles.subline, { color: tokens.textSecondary }]}>{rate}</Text> : null}
        {view.error ? <Text style={[styles.message, { color: tokens.danger }]} accessibilityRole="alert">{view.error}</Text> : null}
        <OverlayBody view={view} actions={actions} />
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  badge: { width: 72, height: 72, borderRadius: 36, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  badgeIcon: { fontSize: 30 },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  subline: { fontSize: 14, textAlign: 'center' },
  message: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  row: { flexDirection: 'row', gap: 12 },
});
