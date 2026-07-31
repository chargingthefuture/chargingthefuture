// Themed pill badge — mirrors web components/ui/badge.
//
// A small rounded label. With an `accent` (or tone='accent') it fills with a faint tint of that
// color and prints the label in the accent; otherwise it uses the neutral faint border tint and
// secondary text. Corners follow tokens.radiusChip (2 in comic, 6 in default).

import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme, type ThemeTokens } from '../../theme';
import { typeScale } from './typography';

export type BadgeTone = 'neutral' | 'accent';

type BadgeProps = {
  label?: string;
  children?: React.ReactNode;
  accent?: string;
  tone?: BadgeTone;
  style?: StyleProp<ViewStyle>;
};

export function Badge({ label, children, accent, tone, style }: BadgeProps) {
  const { tokens } = useTheme();
  // An accent is used when explicitly passed, or when tone='accent' (falling back to tokens.gold).
  const useAccent = tone === 'accent' || accent != null;
  const resolvedAccent = accent ?? tokens.gold;

  const bg = useAccent ? `${resolvedAccent}20` : tokens.borderFaint;
  const textColor = useAccent ? resolvedAccent : tokens.textSecondary;
  const s = makeStyles(tokens);

  return (
    <View style={[s.pill, { backgroundColor: bg }, style]}>
      {children ?? (
        <Text style={[typeScale.label, { color: textColor }]} numberOfLines={1}>
          {label}
        </Text>
      )}
    </View>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    pill: {
      alignSelf: 'flex-start',
      borderRadius: t.radiusChip,
      paddingVertical: 3,
      paddingHorizontal: 8,
    },
  });
}
