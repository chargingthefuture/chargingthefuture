/**
 * FoundationCallOverlay — one card for every state of a Foundation instant call, copied from the web
 * CallOverlay (foundation-instant-call.tsx): the caller's ringing, the callee's Answer / Decline, the live
 * audio call with the caller's block strip, and the final message. It is a Modal, so it sits above every
 * screen of the app.
 */
import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PhoneCall, PhoneIncoming, X } from 'lucide-react-native';
import type { InstantCall, RingStatus } from './FoundationApi';
import type { CallView } from './FoundationCallController';
import { FoundationCallAudio, type CallCredentials } from './FoundationCallAudio';
import { CallBlocks } from './FoundationCallBlocks';
import { FDButton, looks } from './FDButton';
import { alpha, font, useFDTheme } from './useFDTheme';

type Actions = {
  onAnswer: () => void;
  onDecline: () => void;
  onEnd: () => void;
  onExtend: () => void;
};

// Endings with a reason of their own, as on the web; "paid time" reads "block time" because credits are
// not money (CLAUDE.md).
const ENDED_REASON_LABELS: Record<string, string> = {
  caller_insufficient_funds: 'Session ended — out of credits.',
  paid_window_elapsed: 'Session ended — block time used up.',
  provider_not_set_up: 'This provider isn’t set up to take calls right now.',
  caller_cannot_send: 'The call couldn’t start: the caller’s credits can’t be sent right now.',
};

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

function LiveCall({ view, call, credentials, actions }: { view: CallView; call: InstantCall; credentials: CallCredentials; actions: Actions }) {
  const side = view.side;
  return (
    <>
      {side.kind === 'caller' ? (
        <CallBlocks call={call} rateCredits={call.rateCreditsLocked ?? side.rateCredits} extending={view.extending} onExtend={actions.onExtend} />
      ) : null}
      <FoundationCallAudio credentials={credentials} onEnd={actions.onEnd} />
    </>
  );
}

function OverlayBody({ view, actions }: { view: CallView; actions: Actions }) {
  const { t } = useFDTheme();
  const look = looks(t);
  const isCaller = view.side.kind === 'caller';
  if (view.ringStatus === 'answered' && view.credentials && view.call) {
    return <LiveCall view={view} call={view.call} credentials={view.credentials} actions={actions} />;
  }
  const ended = terminalLabel(view.call, view.ringStatus);
  if (ended) return <Text style={[font(14), styles.message]}>{ended}</Text>;
  if (view.side.kind === 'callee' && view.ringStatus === 'ringing') {
    return (
      <View style={styles.row}>
        <FDButton label="Decline" icon={X} look={look.danger} pad={[12, 22]} radius={12} size={14} onPress={actions.onDecline} />
        <FDButton label="Answer" icon={PhoneCall} look={look.primary} weight="800" pad={[12, 22]} radius={12} size={14} onPress={actions.onAnswer} />
      </View>
    );
  }
  // The caller is ringing, or the callee has answered and the room is being set up.
  const label = isCaller && view.ringStatus === 'ringing' ? 'Cancel' : 'End call';
  return <FDButton label={label} icon={X} look={look.danger} pad={[12, 22]} radius={12} size={14} style={styles.center} onPress={actions.onEnd} />;
}

export function FoundationCallOverlay({ view, ...actions }: { view: CallView } & Actions) {
  const { t, r } = useFDTheme();
  const { title, subline } = heading(view);
  const Icon = view.side.kind === 'callee' ? PhoneIncoming : PhoneCall;
  return (
    // Back does not close it: leaving a live call is End, so a stray press never hangs up.
    <Modal visible transparent animationType="fade" onRequestClose={() => undefined} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.card, { borderColor: alpha(t.ACCENT, '30'), borderRadius: r(16) }]} accessibilityViewIsModal accessibilityLabel="Call">
          <ScrollView contentContainerStyle={styles.cardBody}>
            <View style={[styles.badge, { borderRadius: r(32), backgroundColor: alpha(t.ACCENT, '1A'), borderColor: alpha(t.ACCENT, '40') }]}>
              <Icon size={26} color={t.ACCENT} />
            </View>
            <View>
              <Text style={[font(18, '800'), styles.centerText, { color: t.TITLE }]}>{title}</Text>
              {subline ? <Text style={[font(13.5), styles.centerText, styles.subline, { color: t.SUBTLE }]}>{subline}</Text> : null}
            </View>
            {view.error ? <Text style={[font(13), styles.centerText, styles.error]} accessibilityRole="alert">{view.error}</Text> : null}
            <OverlayBody view={view} actions={actions} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(8,9,13,0.82)', justifyContent: 'center', padding: 16 },
  card: { backgroundColor: '#11131A', borderWidth: 1, width: '100%', maxWidth: 440, maxHeight: '100%', alignSelf: 'center' },
  cardBody: { paddingTop: 26, paddingHorizontal: 22, paddingBottom: 22, alignItems: 'center', gap: 16 },
  badge: { width: 64, height: 64, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  subline: { marginTop: 4 },
  error: { color: '#F87171' },
  message: { color: '#D1D5DB', textAlign: 'center', paddingVertical: 8 },
  row: { flexDirection: 'row', gap: 12, justifyContent: 'center', alignSelf: 'stretch' },
  center: { alignSelf: 'center' },
});
