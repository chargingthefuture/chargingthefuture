/**
 * BeaconVideo — the actual video surface for the Beacon viewer.
 *
 * Plays an HLS livestream (the `.m3u8` playlist Stream produces) or an on-demand
 * recording URL. It uses `expo-video` (the current Expo video player; it replaced the
 * removed `expo-av`), which plays HLS natively on iOS and Android from a plain URL.
 *
 * IMPORTANT (native dependency): `expo-video` is a native module. It does NOT work in
 * Expo Go and needs an EAS dev/production build to run (the same constraint Chyme's
 * Stream Video SDK already has). See the change log in the Beacon feature inventory and
 * the PR notes for the required `expo install expo-video` + EAS rebuild step the owner
 * must run.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

export interface BeaconVideoProps {
  // The HLS playlist URL (live) or the recording URL (replay).
  source: string;
  // Live streams should autoplay muted (browser/app autoplay convention, mirrors the
  // web viewer's muted autoplay). A replay starts paused so the member presses play.
  autoPlay: boolean;
  muted: boolean;
}

export const BeaconVideo: React.FC<BeaconVideoProps> = ({ source, autoPlay, muted }) => {
  // useVideoPlayer re-creates the player when the source URL changes and cleans it up on
  // unmount, so switching from "starting…" to a real HLS URL (or live → replay) never
  // leaks a media session.
  const player = useVideoPlayer(source, (p) => {
    p.muted = muted;
    p.loop = false;
    if (autoPlay) {
      p.play();
    }
  });

  return (
    <View style={styles.frame}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
        nativeControls
      />
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
