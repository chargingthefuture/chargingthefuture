// The Join Room row, copied from the web (web components/chyme/chyme-sidebar.tsx): the join pill,
// whose label and color follow the join request and then the live connection, with the refresh
// control on the same line, and "Loading room…" under it while the first read is in flight.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Mic, RefreshCw } from 'lucide-react-native';
import { interFamily } from '../../components/ui';
import { useChymeTokens } from './chyme-tokens';
import type { ChymeConnectionState, JoinState } from './useChymeRoomState';

type Pill = { label: string; from: string; to: string };

function joinPill(joinState: JoinState, connection: ChymeConnectionState, accent: string): Pill {
  if (joinState === 'joining') return { label: 'Joining…', from: accent, to: '#16A34A' };
  if (joinState !== 'ready') return { label: 'Join Room', from: accent, to: '#16A34A' };
  if (connection === 'reconnecting') return { label: 'Reconnecting…', from: '#CA8A04', to: '#A16207' };
  if (connection === 'lost') return { label: 'Connection lost — leave and rejoin', from: '#DC2626', to: '#991B1B' };
  return { label: '✓ Joined', from: accent, to: '#16A34A' };
}

// The web's linear-gradient(135deg, from, to) (or 90deg with `horizontal`), drawn behind the label.
// gradients, so it is an SVG fill sized to the button.
export function GradientFill({ from, to, id, horizontal = false }: { from: string; to: string; id: string; horizontal?: boolean }) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={onLayout}>
      {size ? (
        <Svg width={size.width} height={size.height}>
          <Defs>
            <LinearGradient id={id} x1={0} y1={0} x2={1} y2={horizontal ? 0 : 1}>
              <Stop offset={0} stopColor={from} />
              <Stop offset={1} stopColor={to} />
            </LinearGradient>
          </Defs>
          <Rect width={size.width} height={size.height} fill={`url(#${id})`} />
        </Svg>
      ) : null}
    </View>
  );
}

// The web's ctf-spin keyframes on the refresh icon while a refresh is in flight.
export function Spin({ spinning, children }: { spinning: boolean; children: React.ReactNode }) {
  const turn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!spinning) return;
    turn.setValue(0);
    const loop = Animated.loop(Animated.timing(turn, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spinning, turn]);
  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return <Animated.View style={spinning ? { transform: [{ rotate }] } : null}>{children}</Animated.View>;
}

export function ChymeJoinBar({
  loading,
  joinState,
  connection,
  onJoin,
  onRefresh,
  refreshing,
}: {
  loading: boolean;
  joinState: JoinState;
  connection: ChymeConnectionState;
  onJoin: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const t = useChymeTokens();
  const pill = joinPill(joinState, connection, t.ACCENT);
  const dimmed = joinState !== 'idle' && connection === 'joined';
  return (
    <View style={[styles.bar, { borderBottomColor: t.BORDER, backgroundColor: t.RAIL }]}>
      <View style={styles.row}>
        <TouchableOpacity
          onPress={onJoin}
          disabled={joinState !== 'idle'}
          accessibilityRole="button"
          accessibilityLiveRegion="polite"
          style={[styles.join, { borderRadius: t.radius(12), opacity: dimmed ? 0.7 : 1 }]}
        >
          <GradientFill from={pill.from} to={pill.to} id="chyme-join-pill" />
          <Mic size={16} color="#fff" />
          <Text style={styles.joinText}>{pill.label}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onRefresh}
          disabled={refreshing}
          accessibilityRole="button"
          accessibilityLabel="Refresh the room and chat"
          style={[styles.refresh, { borderRadius: t.radius(12), backgroundColor: t.INPUT_BG }]}
        >
          <Spin spinning={refreshing}>
            <RefreshCw size={16} color={t.MUTED} />
          </Spin>
        </TouchableOpacity>
      </View>
      {loading ? <Text style={styles.loading}>Loading room…</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { width: '100%', borderBottomWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16 },
  join: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  joinText: { color: '#fff', fontSize: 14, fontFamily: interFamily('700') },
  refresh: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: { paddingHorizontal: 16, paddingBottom: 12, color: '#16A34A', fontSize: 13, fontFamily: interFamily('400') },
});
