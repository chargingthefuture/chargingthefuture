/**
 * BeaconIdleView — the "idle" state of the Beacon viewer, copied from the web BeaconIdleView
 * (components/beacon/beacon-viewer.tsx).
 *
 * Shown when nothing is live: the radio icon, "No live event right now", the link to the recordings
 * page on the blog, and, when the current response carries the last replay's recording URL, that
 * replay as a paused, playable recording beneath it.
 */
import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Radio } from 'lucide-react-native';
import { type BeaconEventLike } from './BeaconApi';
import { BeaconVideo } from './BeaconVideo';
import { ctaStyle, ctaText, font, panelStyle, type BeaconTokens } from './BeaconTheme';
import { reportError } from '../../observability/report';

// The blog's recordings page; the same address as the web's BLOG_STREAMS_PAGE_URL (lib/beacon/replays.ts).
const BLOG_STREAMS_PAGE_URL = 'https://chargingthefuture.github.io/chargingthefuture/streams';

function openRecordings(): void {
  Linking.openURL(BLOG_STREAMS_PAGE_URL).catch((error: unknown) => {
    reportError(error, { area: 'beacon', op: 'open_recordings' });
  });
}

export const BeaconIdleView: React.FC<{ t: BeaconTokens; replay: BeaconEventLike | null }> = ({ t, replay }) => (
  <View style={[panelStyle(t), styles.card]}>
    <Radio size={40} color={t.SUBTLE} style={styles.icon} />
    <Text style={[styles.title, { color: t.TITLE }]}>No live event right now</Text>
    <Text style={[styles.body, { color: t.SUBTLE }]}>When Farah goes live, it will appear here.</Text>
    <TouchableOpacity
      style={[ctaStyle(t, 18, 9), styles.cta]}
      onPress={openRecordings}
      accessibilityRole="link"
      accessibilityLabel="Missed it? Watch the recordings"
    >
      <Text style={ctaText(t)}>Missed it? Watch the recordings</Text>
    </TouchableOpacity>
    {replay?.recordingUrl ? (
      <View style={styles.replayBlock}>
        <Text style={[styles.replayLabel, { color: t.SUBTLE }]}>Last replay</Text>
        <BeaconVideo t={t} source={replay.recordingUrl} autoPlay={false} muted={false} />
        <Text style={[styles.replayTitle, { color: t.TITLE }]}>{replay.title}</Text>
      </View>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  card: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  icon: { marginBottom: 12 },
  title: { fontSize: 16, ...font('600'), textAlign: 'center' },
  body: { fontSize: 14, marginTop: 6, marginBottom: 14, textAlign: 'center', ...font('400') },
  cta: { alignSelf: 'center', marginTop: 16 },
  replayBlock: { marginTop: 20, alignSelf: 'stretch' },
  replayLabel: { fontSize: 13, ...font('700'), marginBottom: 8 },
  replayTitle: { fontSize: 14, ...font('600'), marginTop: 8 },
});
