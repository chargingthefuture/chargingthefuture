// Small pieces the web Foundation screens repeat: the gradient hero panel, the red error banner, the
// small uppercase caption, the uppercase section label and the initials avatar.
import React, { type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { alpha, font, initials, useFDTheme } from './useFDTheme';

// The web panel: padding 20/24, radius 16, `linear-gradient(135deg, ACCENT 15 → rgba(239,68,68,0.05))`
// and a 1px ACCENT 20 border. React Native has no CSS gradient, so it is drawn with an SVG behind the
// content.
export function GradientPanel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { t, r } = useFDTheme();
  return (
    <View style={[styles.panel, { borderRadius: r(16), borderColor: alpha(t.ACCENT, '20') }, style]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="fdPanel" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={t.ACCENT} stopOpacity={0x15 / 255} />
            <Stop offset="1" stopColor="#EF4444" stopOpacity={0.05} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#fdPanel)" />
      </Svg>
      {children}
    </View>
  );
}

export function ErrorBanner({ text, style }: { text: string; style?: StyleProp<ViewStyle> }) {
  const { r } = useFDTheme();
  return (
    <View style={[styles.errorBanner, { borderRadius: r(10) }, style]} accessibilityRole="alert">
      <Text style={[font(13), { color: '#fecaca' }]}>{text}</Text>
    </View>
  );
}

// 11px, 700, 0.08em tracking, uppercase — the web's caption over a value.
export function Caption({ text, color, style }: { text: string; color: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <Text style={[font(11, '700'), styles.caption, { color }]}>{text.toUpperCase()}</Text>
    </View>
  );
}

export function InitialsAvatar({ name, size, fontSize, tint }: { name: string; size: number; fontSize: number; tint: string }) {
  const { t, r } = useFDTheme();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: r(size / 2), backgroundColor: alpha(t.ACCENT, tint) }]}>
      <Text style={[font(fontSize, '800'), { color: t.ACCENT }]}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, paddingVertical: 20, paddingHorizontal: 24, overflow: 'hidden', marginBottom: 20 },
  errorBanner: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  caption: { letterSpacing: 0.88 },
  avatar: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
