// The tinted heading card at the top of the Cohorts and Session tabs, copied from the web
// (pp-cohorts-tab.tsx and pp-session-tab.tsx): a 135-degree fade from the accent at 15/255 to
// purple at 5%, a faint accent border, the heading and one line under it.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { interFamily } from '../../components/ui';
import { usePPTheme } from './usePPTheme';

export function PPHero({ id, title, line }: { id: string; title: string; line: string }) {
  const t = usePPTheme();
  return (
    <View style={[styles.hero, { borderRadius: t.r(16), borderColor: `${t.ACCENT}25` }]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={t.ACCENT} stopOpacity={0x15 / 255} />
            <Stop offset="1" stopColor="#8B5CF6" stopOpacity={0.05} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      <Text style={[styles.title, { color: t.TITLE }]}>{title}</Text>
      <Text style={[styles.line, { color: t.SUBTLE }]}>{line}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { marginBottom: 20, paddingVertical: 18, paddingHorizontal: 24, borderWidth: 1, overflow: 'hidden' },
  title: { fontSize: 20, fontFamily: interFamily('800'), marginBottom: 4 },
  line: { fontSize: 14, fontFamily: interFamily('400') },
});
