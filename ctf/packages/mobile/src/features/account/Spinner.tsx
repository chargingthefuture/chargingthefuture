// The web's spinning Loader2 icon (the account-data-spin / blocks-spin keyframes: one turn every
// 0.8s, linear).

import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { Loader2 } from 'lucide-react-native';

export function Spinner({ size, color }: { size: number; color: string }) {
  const turn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(turn, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [turn]);
  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Loader2 size={size} color={color} />
    </Animated.View>
  );
}
