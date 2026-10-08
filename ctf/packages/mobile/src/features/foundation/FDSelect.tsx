// The web <select> for React Native, which has no built-in one: a box styled like the web select that
// opens the option list in a dialog, the way Android's browser shows a <select>.
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { alpha, font, useFDTheme } from './useFDTheme';

export type SelectOption<V extends string | number> = { value: V; label: string };

export function FDSelect<V extends string | number>({ value, options, onChange, label, boxStyle, textStyle, disabled }: {
  value: V;
  options: SelectOption<NoInfer<V>>[];
  onChange: (_value: NoInfer<V>) => void;
  label: string;
  boxStyle: StyleProp<ViewStyle>;
  textStyle: StyleProp<TextStyle>;
  disabled?: boolean;
}) {
  const { t, r } = useFDTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value)?.label ?? '';
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current}`}
        style={[styles.box, boxStyle]}
      >
        <Text style={[styles.value, textStyle]} numberOfLines={1}>{current}</Text>
        <ChevronDown size={16} color={t.SUBTLE} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close">
          <View style={[styles.sheet, { borderRadius: r(16), borderColor: alpha(t.ACCENT, '30') }]}>
            <ScrollView>
              {options.map((o) => {
                const selected = o.value === value;
                return (
                  <Pressable
                    key={String(o.value)}
                    onPress={() => { onChange(o.value); setOpen(false); }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={[styles.option, selected ? { backgroundColor: alpha(t.ACCENT, '1A') } : null]}
                  >
                    <Text style={[font(14, selected ? '700' : '500'), { color: selected ? t.ACCENT : t.TITLE }]}>{o.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  value: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(8,9,13,0.72)', justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: '#11131A', borderWidth: 1, maxHeight: '70%', paddingVertical: 8 },
  option: { paddingVertical: 12, paddingHorizontal: 18 },
});
