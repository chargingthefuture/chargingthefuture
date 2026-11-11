// The pieces of Android Settings and Theme, the copies of the web's back-header.tsx and
// settings-rows.tsx: the back button with a title, a group of rows, and one row with its value.

import React, { type ReactNode } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { SeThemeTokens } from '@ctf/shared';
import type { MeStyles } from './meStyles';

export function BackHeader({ s, t, title, back, onBack }: { s: MeStyles; t: SeThemeTokens; title: string; back: string; onBack: () => void }) {
  return (
    <View style={s.top}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={back} onPress={onBack} style={s.back}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={t.ink} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M15 5l-7 7 7 7" />
        </Svg>
      </TouchableOpacity>
      <Text accessibilityRole="header" style={s.title}>
        {title}
      </Text>
    </View>
  );
}

type RowProps = { s: MeStyles; t: SeThemeTokens; label: string; value?: string; onPress?: () => void; pressed?: boolean; expanded?: boolean; last?: boolean };

export function SettingsRow({ s, t, label, value, onPress, pressed, expanded, last }: RowProps) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: pressed, expanded, disabled: !onPress }}
      disabled={!onPress}
      onPress={onPress}
      style={[s.setRow, last ? s.setRowLast : null]}
    >
      <Text style={s.rowLabel}>{label}</Text>
      {value ? <Text style={s.rowValue}>{value}</Text> : null}
      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={t.soft} strokeWidth={2.2} strokeLinecap="round">
        <Path d="M9 6l6 6-6 6" />
      </Svg>
    </TouchableOpacity>
  );
}

export function SettingsGroup({ s, title, children, after }: { s: MeStyles; title?: string; children: ReactNode; after?: ReactNode }) {
  return (
    <View style={s.group}>
      {title ? (
        <Text accessibilityRole="header" style={s.groupTitle}>
          {title}
        </Text>
      ) : null}
      <View style={s.box}>{children}</View>
      {after}
    </View>
  );
}
