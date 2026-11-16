// Why the step exists, what opens once approved, and what gets an account banned (closed until
// opened), on Android: the copy of the web's unlock-why.tsx.

import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SE_UNLOCK_SCREEN_WORDS as W } from '@ctf/shared';
import type { UnlockStyles } from './unlockStyles';

export function UnlockWhy({ s }: { s: UnlockStyles }) {
  const [banOpen, setBanOpen] = useState(false);
  return (
    <>
      <View style={s.sunk}>
        <Text accessibilityRole="header" style={s.sectionTitle}>
          {W.whyTitle}
        </Text>
        {W.why.map((item) => (
          <View key={item.title} style={s.whyItem}>
            <Text style={s.whyTitle}>{item.title}</Text>
            <Text style={s.text}>{item.text}</Text>
          </View>
        ))}
      </View>
      <View style={s.sunk}>
        <Text accessibilityRole="header" style={s.sectionTitle}>
          {W.opensTitle}
        </Text>
        {W.opens.map((line) => (
          <View key={line} style={s.item}>
            <Text style={s.text}>•</Text>
            <Text style={[s.text, { flex: 1 }]}>{line}</Text>
          </View>
        ))}
      </View>
      <View style={s.sunk}>
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: banOpen }} onPress={() => setBanOpen((value) => !value)} style={s.banToggle}>
          <Text style={s.banLabel}>{W.banTitle}</Text>
          <Text style={s.note}>{banOpen ? W.hide : W.read}</Text>
        </TouchableOpacity>
        {banOpen
          ? W.ban.map((line) => (
              <Text key={line} style={s.text}>
                {line}
              </Text>
            ))
          : null}
      </View>
    </>
  );
}
