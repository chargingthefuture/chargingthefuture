// The small button and text box the PeerProgramming screen uses everywhere, so every control on the
// board, in the chat and in the call looks the same.
import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { usePPTheme } from './usePPTheme';

export function PPButton({ label, onPress, disabled, primary, danger }: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  const { tokens, accent } = usePPTheme();
  const color = danger ? tokens.danger : accent;
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.button,
        {
          borderRadius: tokens.radiusControl,
          borderColor: primary || danger ? color : tokens.border,
          backgroundColor: primary ? color : 'transparent',
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text style={[styles.label, { color: primary ? '#fff' : danger ? color : tokens.textPrimary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function PPTextBox({ value, onChange, placeholder, lines = 1, maxLength }: {
  value: string;
  onChange: (_value: string) => void;
  placeholder: string;
  lines?: number;
  maxLength: number;
}) {
  const { tokens } = usePPTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={tokens.textMuted}
      accessibilityLabel={placeholder}
      multiline={lines > 1}
      numberOfLines={lines}
      maxLength={maxLength}
      style={[
        styles.box,
        {
          minHeight: 20 * lines + 16,
          borderRadius: tokens.radiusControl,
          borderColor: tokens.border,
          backgroundColor: tokens.surfaceAlt,
          color: tokens.textPrimary,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  button: { borderWidth: 1, paddingVertical: 8, paddingHorizontal: 12, alignSelf: 'flex-start' },
  label: { fontSize: 13, fontWeight: '600' },
  box: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15, textAlignVertical: 'top' },
});
