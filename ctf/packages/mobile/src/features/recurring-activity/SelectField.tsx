// The web form's <select>, drawn with the same box (padding, radius, colors, border). React Native
// has no select element, so the box opens the choices in a list over the screen, the way a phone
// browser opens its own picker for a <select>; the chevron stands in for the browser's arrow.

import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { interFamily } from '../../components/ui';
import { getRecurringActivityTokens, rr } from './shared';

export function SelectField<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled = false,
  style,
  fontSize = 13,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (_value: T) => void;
  label: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  fontSize?: number;
}) {
  const { tokens } = useTheme();
  const t = getRecurringActivityTokens(tokens);
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value)?.label ?? '';
  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[
          { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: rr(tokens, 8), backgroundColor: t.INPUT_BG, borderWidth: 1, borderColor: t.BORDER_STRONG },
          style,
        ]}
      >
        <Text style={{ flex: 1, fontSize, fontFamily: interFamily('400'), color: t.TEXT }}>{current}</Text>
        <ChevronDown size={14} color={t.MUTED} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }} onPress={() => setOpen(false)}>
          <View style={{ backgroundColor: t.SURFACE, borderRadius: rr(tokens, 12), borderWidth: 1, borderColor: t.BORDER_SOLID, maxHeight: '70%', overflow: 'hidden' }}>
            <ScrollView>
              {options.map((o) => (
                <TouchableOpacity
                  key={o.value}
                  onPress={() => {
                    setOpen(false);
                    onChange(o.value);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: o.value === value }}
                  style={{ paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: t.BORDER_SOLID }}
                >
                  <Text style={{ fontSize: 14, fontFamily: interFamily(o.value === value ? '700' : '400'), color: o.value === value ? t.ACCENT : t.TEXT }}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
