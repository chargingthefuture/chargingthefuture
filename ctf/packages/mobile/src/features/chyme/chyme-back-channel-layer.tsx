/**
 * Back Channel on top of the room, copied from the web (web components/chyme/
 * chyme-back-channel-layer.tsx): the incoming invite card, the live call card, and a notice at the
 * top for a failed invite, hang-up or join, all drawn over the room without blocking it. Also the
 * per-tile Back Channel action. Rendered once by the Chyme screen, outside its scrolling content.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Phone } from 'lucide-react-native';
import { interFamily } from '../../components/ui';
import type { MobileBackChannelController } from './useChymeBackChannel';
import { ChymeBackChannelInvite } from './chyme-back-channel-invite';
import { ChymeBackChannelPanel } from './chyme-back-channel-panel';
import { PulseDot } from './chyme-pulse-dot';
import { useChymeTokens } from './chyme-tokens';

const PRIMARY = '#22C55E';

export const ChymeBackChannelLayer: React.FC<{ controller: MobileBackChannelController; displayName: string }> = ({ controller, displayName }) => {
  const { activeCall, joinCredentials, error } = controller;
  // Do not ring while already in a call.
  const incomingInvite = activeCall ? null : controller.incomingInvite;
  const live = activeCall && joinCredentials && joinCredentials.callId === activeCall.callId ? { activeCall, credentials: joinCredentials } : null;
  return (
    <>
      {incomingInvite ? (
        <ChymeBackChannelInvite
          fromName={incomingInvite.fromUsername ? `@${incomingInvite.fromUsername}` : 'A member'}
          busy={controller.busy}
          error={error}
          onAccept={() => void controller.accept(incomingInvite.callId)}
          onDecline={() => void controller.decline(incomingInvite.callId)}
        />
      ) : null}
      {live ? (
        <ChymeBackChannelPanel
          credentials={live.credentials}
          displayName={displayName}
          otherName={live.activeCall.otherUsername ? `@${live.activeCall.otherUsername}` : 'Member'}
          onHangUp={() => void controller.hangUp(live.activeCall.callId)}
        />
      ) : null}
      {/* A failed invite, hang-up or /join has no prompt to sit in, so it gets its own notice. */}
      <ErrorNotice message={incomingInvite ? null : error} onDismiss={controller.clearError} />
    </>
  );
};

function ErrorNotice({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  const t = useChymeTokens();
  if (!message) return null;
  return (
    <View accessibilityRole="alert" style={[styles.notice, { borderRadius: t.radius(12) }]}>
      <Text style={styles.noticeText}>{message}</Text>
      <TouchableOpacity onPress={onDismiss} accessibilityRole="button">
        <Text style={styles.dismiss}>Dismiss</Text>
      </TouchableOpacity>
    </View>
  );
}

// The per-tile action: start, "Invite sent…" while pending, and the "BC" badge while in a call with
// this member. Hidden while in a call with somebody else. Never on the member's own tile.
export const ChymeBackChannelButton: React.FC<{ recipientUserId: string; controller: MobileBackChannelController }> = ({ recipientUserId, controller }) => {
  const t = useChymeTokens();
  if (controller.activeCall?.otherUserId === recipientUserId) {
    return (
      <View accessibilityLabel="Back Channel active" style={[styles.badge, { borderRadius: t.radius(20) }]}>
        <PulseDot size={6} color={PRIMARY} />
        <Text style={styles.badgeText}>BC</Text>
      </View>
    );
  }
  if (controller.outgoingInvite?.toUserId === recipientUserId) {
    return (
      <View accessibilityLabel="Back Channel invite sent" style={styles.pending}>
        <PulseDot size={6} color={PRIMARY} />
        <Text style={styles.pendingText}>Invite sent…</Text>
      </View>
    );
  }
  if (controller.activeCall) return null;
  return (
    <TouchableOpacity
      onPress={() => void controller.sendInvite(recipientUserId)}
      disabled={controller.busy}
      accessibilityRole="button"
      style={[styles.start, { borderRadius: t.radius(20), opacity: controller.busy ? 0.7 : 1 }]}
    >
      <Phone size={10} color={PRIMARY} strokeWidth={2.5} />
      <Text style={styles.badgeText}>Back Channel</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  notice: {
    position: 'absolute',
    zIndex: 61,
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#0d0f14',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.45)',
    boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
  },
  noticeText: { flex: 1, minWidth: 0, color: '#f87171', fontSize: 12, fontFamily: interFamily('400') },
  dismiss: { color: '#9ca3af', fontSize: 12, fontFamily: interFamily('600') },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: 'rgba(34,197,94,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.4)',
  },
  badgeText: { fontSize: 10, color: PRIMARY, fontFamily: interFamily('700') },
  pending: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pendingText: { fontSize: 10, color: '#9ca3af', fontFamily: interFamily('600') },
  start: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.35)',
  },
});
