/**
 * BeaconVideo — the video surface for the Beacon viewer.
 *
 * Plays an HLS livestream (the `.m3u8` playlist Stream produces) or an on-demand recording URL with
 * `expo-video`, which plays HLS natively on Android from a plain URL. `expo-video` is a native module,
 * so it needs an EAS build, as Chyme's Stream Video SDK already does.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

export interface BeaconVideoProps {
  // The HLS playlist URL (live) or the recording URL (replay).
  source: string;
  // Live streams autoplay muted (the same convention as the web viewer); the native controls turn
  // sound on. A replay starts paused so the member presses play.
  autoPlay: boolean;
  muted: boolean;
}

export const BeaconVideo: React.FC<BeaconVideoProps> = ({ source, autoPlay, muted }) => {
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
    <View style={styles.frame}>
      <VideoView player={player} style={styles.video} contentFit="contain" nativeControls />
    </View>
  );
};

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
  },
});
