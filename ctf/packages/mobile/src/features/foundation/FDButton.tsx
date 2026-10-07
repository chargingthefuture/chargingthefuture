// The one button the Foundation call screens use, so every control looks the same.
import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useFDTheme } from './useFDTheme';

type Variant = 'plain' | 'primary' | 'danger';

export function FDButton({ label, onPress, disabled, variant = 'plain', wide }: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: Variant;
  wide?: boolean;
}) {
  const { tokens, accent } = useFDTheme();
  const colors: Record<Variant, { border: string; background: string; text: string }> = {
    plain: { border: tokens.border, background: 'transparent', text: tokens.textPrimary },
    primary: { border: accent, background: accent, text: '#1a1205' },
    danger: { border: tokens.danger, background: 'transparent', text: tokens.danger },
  };
  const color = colors[variant];
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={[
        styles.button,
        wide ? styles.wide : null,
        {
          borderRadius: tokens.radiusControl,
          borderColor: color.border,
          backgroundColor: color.background,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text style={[styles.label, { color: color.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { borderWidth: 1, paddingVertical: 11, paddingHorizontal: 18, alignItems: 'center' },
  wide: { alignSelf: 'stretch' },
  label: { fontSize: 14, fontWeight: '700' },
});
