// The small button and text box of the goal board, copied from the web's SmallButton and TextBox
// (web components/peer-programming/pp-goals-parts.tsx).
import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { interFamily } from '../../components/ui';
import { usePPTheme } from './usePPTheme';

export function PPButton({ label, onPress, disabled, primary }: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  const t = usePPTheme();
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.button,
        {
          borderRadius: t.r(8),
          borderColor: primary ? t.ACCENT : t.BORDER_STRONG,
          backgroundColor: primary ? t.ACCENT : 'transparent',
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text style={[styles.label, { color: primary ? '#fff' : t.TEXT }]}>{label}</Text>
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
  const t = usePPTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={t.MUTED}
      accessibilityLabel={placeholder}
      multiline={lines > 1}
      numberOfLines={lines}
      maxLength={maxLength}
      style={[
        styles.box,
        {
          minHeight: 20 * lines + 16,
          borderRadius: t.r(8),
          borderColor: t.BORDER_HI,
          backgroundColor: t.INPUT_BG,
          color: t.TEXT,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  button: { borderWidth: 1, paddingVertical: 6, paddingHorizontal: 12, alignSelf: 'flex-start' },
  label: { fontSize: 13, fontFamily: interFamily('600') },
  box: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, fontFamily: interFamily('400'), textAlignVertical: 'top' },
});
