import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from './theme-context';
import { type ThemeName } from './theme-tokens';
import { interFamily } from '../components/ui/typography';

// Two-state segmented control for the app theme, mirroring the web's ThemeToggle
// (components/theme/theme-toggle.tsx). Styled from the active theme tokens so it reads
// correctly in both themes. Lives in the Account & Data screen's header, where the web puts it.
// Colors follow the web's CSS variables: --ctf-border, --ctf-control-radius, --ctf-surface,
// --ctf-brand / --ctf-brand-text for the active option and --ctf-text-subtle for the other.

const OPTIONS: { value: ThemeName; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'comic', label: 'Comic' },
];

export const ThemeToggle: React.FC = () => {
  const { theme, setTheme, tokens } = useTheme();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="App theme"
      style={[
        styles.group,
        {
          borderColor: tokens.border,
          borderRadius: tokens.radiusControl,
          backgroundColor: tokens.surface,
        },
      ]}
    >
      {OPTIONS.map((option) => {
        const active = theme === option.value;
        return (
          <TouchableOpacity
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => setTheme(option.value)}
            style={[
              styles.option,
              active && { backgroundColor: tokens.brand },
            ]}
          >
            <Text
              style={[
                styles.optionText,
                { color: active ? tokens.brandText : textSubtle(tokens.isComic, tokens.textSecondary) },
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// web --ctf-text-subtle: #6B7280 in the default theme, the ink-dim shade in comic.
function textSubtle(isComic: boolean, comicValue: string): string {
  return isComic ? comicValue : '#6B7280';
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  optionText: {
    fontSize: 12,
    fontFamily: interFamily('700'),
    letterSpacing: 0.72,
    textTransform: 'uppercase',
  },
});
