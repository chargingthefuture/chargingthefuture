/**
 * BeaconLiveView — the "live" state of the Beacon viewer, copied from the web BeaconLiveView
 * (components/beacon/beacon-viewer.tsx) at phone width, where its two columns stack.
 *
 * The live badge, the event title/description, the HLS player (or a "starting…" frame while the
 * playlist URL is not yet present), the public-notice fineprint, and the live chat panel. The chat
 * panel delegates the member-vs-signed-out branch to BeaconChatGate.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { type BeaconChatCredentials, type BeaconEventLike } from './BeaconApi';
import { BeaconChatGate } from './BeaconChatGate';
import { BeaconVideo, BeaconVideoFrame } from './BeaconVideo';
import { centeredStyle, centeredText, font, panelStyle, radius, type BeaconTokens } from './BeaconTheme';

export interface BeaconLiveViewProps {
  t: BeaconTokens;
  liveEvent: BeaconEventLike;
  hlsUrl: string | null;
  isAuthenticated: boolean;
  chat: BeaconChatCredentials | null;
  chatError: string | null;
  onSignIn: () => void;
}

export const BeaconLiveView: React.FC<BeaconLiveViewProps> = ({ t, liveEvent, hlsUrl, isAuthenticated, chat, chatError, onSignIn }) => (
  <View style={styles.grid}>
    <View>
      <View style={[styles.badge, { borderColor: `${t.ACCENT}55`, borderRadius: radius(t, 999) }]}>
        <View style={[styles.dot, { backgroundColor: t.ACCENT, borderRadius: radius(t, 4) }]} />
        <Text style={[styles.badgeText, { color: t.ACCENT }]}>LIVE AND PUBLIC</Text>
      </View>
      <Text style={[styles.eventTitle, { color: t.TITLE }]}>{liveEvent.title}</Text>
      {liveEvent.description ? (
        <Text style={[styles.eventDesc, { color: t.SUBTLE }]}>{liveEvent.description}</Text>
      ) : null}
      {hlsUrl ? (
        <BeaconVideo t={t} source={hlsUrl} autoPlay muted />
      ) : (
        <BeaconVideoFrame t={t} style={centeredStyle(t)}>
          <Text style={centeredText(t)}>The broadcast is starting…</Text>
        </BeaconVideoFrame>
      )}
      <Text style={[styles.fineprint, { color: t.SUBTLE }]}>
        This broadcast and its chat are public. The event is recorded; the replay is posted to the Commons.
      </Text>
    </View>

    <View style={[panelStyle(t), styles.aside]}>
      <View style={[styles.chatHeader, { borderBottomColor: t.BORDER_SOLID }]}>
        <Text style={[styles.chatHeaderText, { color: t.TITLE }]}>Live chat</Text>
      </View>
      <BeaconChatGate t={t} isAuthenticated={isAuthenticated} chat={chat} chatError={chatError} onSignIn={onSignIn} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  grid: { gap: 16 },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245,158,11,0.14)',
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  dot: { width: 8, height: 8 },
  badgeText: { fontSize: 12, ...font('700'), letterSpacing: 0.48 },
  eventTitle: { fontSize: 20, ...font('700'), marginBottom: 6 },
  eventDesc: { fontSize: 14, marginBottom: 12, ...font('400') },
  fineprint: { fontSize: 12, marginTop: 10, marginBottom: 12, ...font('400') },
  aside: { padding: 0, minHeight: 420, overflow: 'hidden' },
  chatHeader: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1 },
  chatHeaderText: { fontSize: 14, ...font('700') },
});
