// The web Apps panel's Sort control (.appsSortWrap / .appsSortLabel / .appsSortSelect). The closed
// box is drawn as the web draws it. The web's open list is the browser's own <select> list, which
// React Native has no equivalent of, so a plain list opens under the box instead, painted as the
// web paints <option> (globals.css: the surface color behind the text color).

import React, { useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { useTheme, type ThemeTokens } from '../../theme';
import { interFamily } from '../../components/ui';
import type { AppSortMode } from './useAppsOrder';

const OPTIONS: Array<{ value: AppSortMode; label: string }> = [
  { value: 'recent', label: 'Recent' },
  { value: 'alpha', label: 'A-Z' },
  { value: 'most-used', label: 'Most Used' },
];

export function AppsSortSelect({ value, onChange }: { value: AppSortMode; onChange: (_mode: AppSortMode) => void }) {
  const { tokens } = useTheme();
  const s = useMemo(() => makeStyles(tokens), [tokens]);
  const boxRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<{ top: number; left: number; width: number } | null>(null);
  const current = OPTIONS.find((option) => option.value === value) ?? OPTIONS[0];

  const open = () => {
    boxRef.current?.measureInWindow((x, y, w, h) => setAnchor({ top: y + h + 2, left: x, width: w }));
  };

  return (
    <View style={s.wrap}>
      <Text style={s.label}>Sort</Text>
      <TouchableOpacity
        ref={boxRef}
        style={s.select}
        onPress={open}
        accessibilityRole="combobox"
        accessibilityLabel={`Sort, ${current.label}`}
      >
        <Text style={s.selectText} numberOfLines={1}>
          {current.label}
        </Text>
        <View style={s.chevron} pointerEvents="none">
          <ChevronDown size={12} color="#9CA3AF" strokeWidth={2} />
        </View>
      </TouchableOpacity>
      <Modal visible={Boolean(anchor)} transparent animationType="none" onRequestClose={() => setAnchor(null)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setAnchor(null)} accessibilityLabel="Close list" />
        {anchor ? (
          <View style={[s.list, { top: anchor.top, left: anchor.left, minWidth: anchor.width }]}>
            {OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={s.option}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: option.value === value }}
                onPress={() => {
                  setAnchor(null);
                  onChange(option.value);
                }}
              >
                <Text style={s.optionText}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    wrap: { gap: 6, minWidth: 132 },
    label: {
      fontSize: 11,
      fontFamily: interFamily('700'),
      letterSpacing: 0.66,
      textTransform: 'uppercase',
      color: t.isComic ? t.textSecondary : '#6B7280',
    },
    select: {
      borderRadius: t.isComic ? 0 : 10,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.14)',
      backgroundColor: 'rgba(17, 24, 39, 0.8)',
      paddingTop: 7,
      paddingBottom: 7,
      paddingLeft: 10,
      paddingRight: 28,
      justifyContent: 'center',
    },
    selectText: { fontSize: 12, fontFamily: interFamily('600'), color: '#F3F4F6' },
    chevron: { position: 'absolute', right: 8, top: 0, bottom: 0, justifyContent: 'center' },
    list: {
      position: 'absolute',
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: t.isComic ? 0 : 4,
      paddingVertical: 4,
    },
    option: { paddingVertical: 10, paddingHorizontal: 12 },
    optionText: { fontSize: 14, fontFamily: interFamily('400'), color: t.textPrimary },
  });
}
