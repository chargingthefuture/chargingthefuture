// The Back Channel "live" dot, copied from the web's bc-pulse keyframes (web app/globals.css): opacity
// 1 → 0.6 and scale 1 → 1.15 and back, every 1.4 seconds.

import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { useChymeTokens } from './chyme-tokens';

export function PulseDot({ size, color }: { size: number; color: string }) {
  const t = useChymeTokens();
  const phase = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const half = { duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true };
    const loop = Animated.loop(
      Animated.sequence([Animated.timing(phase, { toValue: 1, ...half }), Animated.timing(phase, { toValue: 0, ...half })]),
    );
    loop.start();
    return () => loop.stop();
  }, [phase]);
  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: t.radius(size / 2),
        backgroundColor: color,
        opacity: phase.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] }),
        transform: [{ scale: phase.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) }],
      }}
    />
  );
}
