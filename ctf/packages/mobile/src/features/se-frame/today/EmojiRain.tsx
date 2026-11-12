// Emoji rain on Android, the copy of the web's emoji-rain.tsx (3.1 plan, Look): when the member has
// the switch on and the Days won total is higher than the last total their account saw, a few seconds
// of emoji fall over Today. No sound, nothing to tap (pointerEvents none), and nothing at all when the
// phone asks for less motion. The decision and the drops are shared with the web (seEmojiRainStep,
// seEmojiRainDrops). Today decides; the frame draws it over the screen, outside the scrolling list.

import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SE_EMOJI_RAIN_MS, seEmojiRainDrops, seEmojiRainStep } from '@ctf/shared';

const DROPS = seEmojiRainDrops();

export type EmojiRainProps = {
  on: boolean;
  daysWon: { total: number; sample?: boolean } | null | undefined;
  seen: number | null | undefined;
  onSeen: (_total: number) => void;
  onRain: () => void;
};

// Decides once per new total, records it, and asks the frame to rain unless the phone asks for less
// motion.
export function useEmojiRainTrigger({ on, daysWon, seen, onSeen, onRain }: EmojiRainProps) {
  const step = seEmojiRainStep({ on, total: daysWon?.total, sample: daysWon?.sample, seen });
  const latest = useRef({ onSeen, onRain });
  latest.current = { onSeen, onRain };

  useEffect(() => {
    if (step.record === null) return;
    latest.current.onSeen(step.record);
    if (!step.rain) return;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((less) => {
        if (!less) latest.current.onRain();
      })
      .catch(() => undefined);
  }, [step.record, step.rain]);
}

// One falling drop: from above the screen to below it, fading in and out.
function Drop({ drop, height }: { drop: (typeof DROPS)[number]; height: number }) {
  const fall = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const run = Animated.timing(fall, { toValue: 1, duration: drop.fallMs, delay: drop.delayMs, easing: Easing.linear, useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [fall, drop.fallMs, drop.delayMs]);
  const translateY = fall.interpolate({ inputRange: [0, 1], outputRange: [-48, height + 48] });
  const rotate = fall.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '40deg'] });
  const opacity = fall.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 0.95, 0.95, 0] });
  return (
    <Animated.View style={[styles.drop, { left: `${drop.leftPct}%`, opacity, transform: [{ translateY }, { rotate }] }]}>
      <Text style={{ fontSize: drop.sizePx, lineHeight: drop.sizePx + 4 }}>{drop.emoji}</Text>
    </Animated.View>
  );
}

// Drawn by the frame: each new `run` (counted up by Today) rains once for a few seconds.
export function EmojiRain({ run }: { run: number }) {
  const { height } = useWindowDimensions();
  const [raining, setRaining] = useState(false);
  useEffect(() => {
    if (run === 0) return;
    setRaining(true);
    const timer = setTimeout(() => setRaining(false), SE_EMOJI_RAIN_MS);
    return () => clearTimeout(timer);
  }, [run]);
  if (!raining) return null;
  return (
    <View pointerEvents="none" style={styles.rain} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {DROPS.map((drop) => (
        <Drop key={`${run}-${drop.key}`} drop={drop} height={height} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rain: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', zIndex: 20 },
  drop: { position: 'absolute', top: 0 },
});
