import React, { type ReactNode } from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';

// Shared accessible form field for the mobile app. Mirrors the web `FormField` contract.
//
// Convention (app-wide standard, see ctf/docs/developer/ACCESSIBLE_FORMS_STANDARD.md): fields are
// REQUIRED by default — only optional fields are marked, with a muted "(optional)". The render-prop
// hands the caller an `accessibilityLabel` (with ", optional" folded in) and the hint as
// `accessibilityHint`, so the control is described correctly to a screen reader. Errors are announced
// through a live region.
//
// Usage:
//   <FormField label="Title" error={titleError}>
//     {(a) => <TextInput {...a} value={title} onChangeText={setTitle} />}
//   </FormField>

type FieldChildProps = {
  accessibilityLabel: string;
  accessibilityHint?: string;
};

type FormFieldProps = {
  label: string;
  /** Mark the field as optional. Required fields (the default) carry no marker. */
  optional?: boolean;
  hint?: string;
  error?: string | null;
  children: (_props: FieldChildProps) => ReactNode;
  style?: ViewStyle;
};

export function FormField({ label, optional, hint, error, children, style }: FormFieldProps) {
  const accessibilityLabel = optional ? `${label}, optional` : label;
  return (
    <View style={style}>
      <Text style={styles.label}>
        {label}
        {optional ? <Text style={styles.optional}> (optional)</Text> : null}
      </Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {children({ accessibilityLabel, accessibilityHint: hint })}
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="assertive" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: '#9CA3AF', marginBottom: 6 },
  optional: { color: '#6B7280', fontWeight: '400' },
  hint: { fontSize: 12, color: '#6B7280', marginBottom: 6, lineHeight: 18 },
  error: { fontSize: 12, color: '#EF4444', marginTop: 6 },
});
