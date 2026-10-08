/**
 * BeaconVideo — the video surface for the Beacon viewer.
 *
 * Plays an HLS livestream (the `.m3u8` playlist Stream produces) or an on-demand recording URL with
 * `expo-video`, which plays HLS natively on Android from a plain URL. `expo-video` is a native module,
 * so it needs an EAS build, as Chyme's Stream Video SDK already does.
 */
import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { radius, type BeaconTokens } from './BeaconTheme';

export interface BeaconVideoProps {
  // The HLS playlist URL (live) or the recording URL (replay).
  source: string;
  // Live streams autoplay muted (the same convention as the web viewer); the native controls turn
  // sound on. A replay starts paused so the member presses play.
  autoPlay: boolean;
  muted: boolean;
  t: BeaconTokens;
}

// The web player frame: 16:9, black, a 12px corner and the solid card border.
export function BeaconVideoFrame({ t, style, children }: { t: BeaconTokens; style?: ViewStyle; children?: React.ReactNode }) {
  return (
    <View style={[styles.frame, { borderRadius: radius(t, 12), borderColor: t.BORDER_SOLID }, style]}>{children}</View>
  );
}

export const BeaconVideo: React.FC<BeaconVideoProps> = ({ source, autoPlay, muted, t }) => {
  // useVideoPlayer re-creates the player when the source URL changes and cleans it up on unmount, so
  // switching from "starting…" to a real HLS URL (or live → replay) never leaks a media session.
  const player = useVideoPlayer(source, (p) => {
    p.muted = muted;
    p.loop = false;
    if (autoPlay) {
      p.play();
    }
  });

  return (
    <BeaconVideoFrame t={t}>
      <VideoView player={player} style={styles.video} contentFit="contain" nativeControls />
    </BeaconVideoFrame>
  );
};

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    borderWidth: 1,
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
  },
});
