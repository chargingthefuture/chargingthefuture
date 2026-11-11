// Settings → Theme on Android, the copy of the web's theme-screen.tsx, built to the approved board
// "Theme": dark or light first, then the four colors (the same as the wallpapers), and where to get
// the wallpapers and the Android app. The choice is saved on the account.

import React, { useMemo } from 'react';
import { Linking, Text, TouchableOpacity, View } from 'react-native';
import {
  SE_ME_LINKS,
  SE_SETTINGS_WORDS as W,
  SE_THEME_LABELS,
  SE_THEME_MODES,
  SE_THEME_ORDER,
  SE_THEME_SWATCHES,
  seThemeNote,
  type SeThemeChoice,
  type SeThemeTokens,
} from '@ctf/shared';
import { makeMeStyles } from './meStyles';
import { BackHeader } from './SettingsParts';

type Props = { t: SeThemeTokens; theme: SeThemeChoice; onChange: (_next: SeThemeChoice) => void; onBack: () => void };

export function ThemeScreen({ t, theme, onChange, onBack }: Props) {
  const s = useMemo(() => makeMeStyles(t), [t]);
  return (
    <View style={s.settingsStack}>
      <BackHeader s={s} t={t} title={W.theme} back={W.backToSettings} onBack={onBack} />
      <View accessibilityLabel={W.lightOrDark} style={s.segment}>
        {SE_THEME_MODES.map((mode) => {
          const picked = theme.mode === mode;
          return (
            <TouchableOpacity
              key={mode}
              accessibilityRole="button"
              accessibilityState={{ selected: picked }}
              onPress={() => onChange({ ...theme, mode })}
              style={[s.segmentButton, picked ? s.segmentPicked : null]}
            >
              <Text style={[s.segmentLabel, picked ? s.segmentLabelPicked : null]}>{mode === 'dark' ? W.dark : W.light}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={s.settingsNote}>{W.sameColors}</Text>
      <View style={s.themes}>
        {SE_THEME_ORDER.map((color) => {
          const swatch = SE_THEME_SWATCHES[color];
          const picked = theme.color === color;
          return (
            <TouchableOpacity
              key={color}
              accessibilityRole="button"
              accessibilityState={{ selected: picked }}
              onPress={() => onChange({ ...theme, color })}
              style={[s.themeButton, picked ? s.themePicked : null]}
            >
              <View style={[s.swatch, { backgroundColor: swatch.bg }]}>
                <View style={[s.dot, { backgroundColor: swatch.a }]} />
                <View style={[s.dot, { backgroundColor: swatch.b }]} />
              </View>
              <Text style={s.themeName}>{SE_THEME_LABELS[color]}</Text>
              <Text style={s.themeNote}>{seThemeNote(color)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={s.group}>
        <Text accessibilityRole="header" style={s.groupTitle}>
          {W.get}
        </Text>
        {[
          [W.wallpapersIn, SE_ME_LINKS.wallpapers],
          [W.androidApp, SE_ME_LINKS.androidApp],
        ].map(([label, url]) => (
          <TouchableOpacity key={url} accessibilityRole="link" onPress={() => void Linking.openURL(url)} style={s.getLink}>
            <Text style={s.getLabel}>{label}</Text>
            <Text style={[s.getLabel, s.getArrow]}>↗</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
