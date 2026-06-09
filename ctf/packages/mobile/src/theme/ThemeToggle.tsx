import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from './theme-context';
import { type ThemeName } from './theme-tokens';

// Two-state segmented control for the app theme, mirroring the web's ThemeToggle
// (components/theme/theme-toggle.tsx). Styled from the active theme tokens so it reads
// correctly in both themes. Lives in the Account & Data screen.

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
          borderRadius: tokens.radiusChip,
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
              active && { backgroundColor: tokens.isComic ? tokens.border : tokens.textPrimary },
            ]}
          >
            <Text
              style={[
                styles.optionText,
                { color: active ? tokens.bg : tokens.textSecondary },
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

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    borderWidth: 1.5,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  optionText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
});
