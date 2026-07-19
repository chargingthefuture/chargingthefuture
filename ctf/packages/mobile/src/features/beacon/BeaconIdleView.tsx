/**
 * BeaconIdleView — the "idle" state of the Beacon viewer.
 *
 * Shown when nothing is live: a calm "no live event right now" empty state. When the
 * current response carries the last replay's recording URL, that replay is offered as a
 * paused, playable recording beneath the empty state.
 *
 * This is a decomposition of the markup that previously lived inline in Beacon.tsx;
 * the rendered output and behavior are identical.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { type ThemeTokens } from '../../theme';
import { type BeaconEventLike } from './BeaconApi';
import { BeaconVideo } from './BeaconVideo';

export interface BeaconIdleViewProps {
  tokens: ThemeTokens;
  replay: BeaconEventLike | null;
}

export const BeaconIdleView: React.FC<BeaconIdleViewProps> = ({ tokens, replay }) => {
  const styles = React.useMemo(() => makeStyles(tokens), [tokens]);

  return (
    <View style={styles.idleCard}>
      <Text style={[styles.idleTitle, { color: tokens.textPrimary }]}>No live event right now</Text>
      <Text style={[styles.idleBody, { color: tokens.textSecondary }]}>
        When Farah goes live, it will appear here.
      </Text>
      {replay?.recordingUrl ? (
        <View style={styles.replayBlock}>
          <Text style={[styles.replayLabel, { color: tokens.textSecondary }]}>Last replay</Text>
          <BeaconVideo source={replay.recordingUrl} autoPlay={false} muted={false} />
          <Text style={[styles.replayTitle, { color: tokens.textPrimary }]}>{replay.title}</Text>
        </View>
      ) : null}
    </View>
  );
};

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    idleCard: {
      marginTop: 16,
      padding: 24,
      borderRadius: t.radius,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'center',
    },
    idleTitle: { fontSize: 16, fontWeight: '700' },
    idleBody: { fontSize: 14, marginTop: 6, textAlign: 'center' },
    replayBlock: { marginTop: 20, alignSelf: 'stretch', gap: 8 },
    replayLabel: { fontSize: 13, fontWeight: '700' },
    replayTitle: { fontSize: 14, fontWeight: '600' },
  });
}
