import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Mic, Radio } from 'lucide-react-native';
import { type ThemeTokens } from '../../theme';
import { interFamily } from '../../components/ui';

type Props = {
  onStartRoom: () => void;
  tokens: ThemeTokens;
  accent: string;
};

export const ChymeEmpty: React.FC<Props> = ({ onStartRoom, tokens, accent }) => {
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  return (
    <View style={styles.container}>
      <View style={styles.statusBar}>
        <Text style={styles.clock}>9:41</Text>
        <Text style={styles.signal}>●●●</Text>
      </View>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chyme</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.iconRing}>
          <Radio size={30} color={accent} strokeWidth={2} />
        </View>
        <Text style={styles.title}>No rooms live yet</Text>
        <Text style={styles.subtitle}>
          Be the first to start a room. Topics can be healing, skills, or anything your community needs.
        </Text>
        {/* Start Room: backed by POST /api/chyme/join */}
        <TouchableOpacity style={styles.primaryBtn} onPress={onStartRoom}>
          <Text style={styles.primaryBtnText}>+ Start a Room</Text>
        </TouchableOpacity>
        {/* Schedule: no backend endpoint for scheduling yet — omitted as interactive action */}
        <View style={styles.scheduleBtn}>
          <Text style={styles.scheduleBtnText}>Schedule for Later</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <Mic size={12} color={tokens.textSecondary} strokeWidth={2} />
          <Text style={styles.footerText}>Rooms are members-only</Text>
        </View>
      </View>
    </View>
  );
};

function makeStyles(t: ThemeTokens, accent: string) {
  const chrome = t.surfaceAlt;
  const divider = t.border;
  const r = t.radius;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    statusBar: {
      backgroundColor: chrome,
      paddingTop: 12,
      paddingBottom: 6,
      paddingHorizontal: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    clock: { fontSize: 13, fontWeight: '600', fontFamily: interFamily('600'), color: t.textPrimary },
    signal: { fontSize: 11, color: t.textSecondary, fontFamily: interFamily('400') },
    header: {
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderBottomWidth: t.isComic ? 2 : 1,
      borderBottomColor: divider,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerTitle: { fontSize: 15, fontWeight: '700', fontFamily: interFamily('700'), color: t.textPrimary, letterSpacing: t.isComic ? 0.6 : 0, textTransform: t.isComic ? 'uppercase' : 'none' },
    body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
    iconRing: {
      width: 72,
      height: 72,
      borderRadius: t.isComic ? 0 : 36,
      backgroundColor: t.isComic ? `${t.border}12` : `${accent}15`,
      borderWidth: t.isComic ? 2 : 1,
      borderColor: t.isComic ? t.border : `${accent}40`,
      borderStyle: t.isComic ? 'solid' : 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    iconGlyph: { fontSize: 28, fontFamily: interFamily('400') },
    title: { fontSize: 18, fontWeight: '800', fontFamily: interFamily('800'), color: t.textPrimary, marginBottom: 10, textAlign: 'center' },
    subtitle: { fontSize: 14, color: t.textSecondary, lineHeight: 22, marginBottom: 28, textAlign: 'center', fontFamily: interFamily('400') },
    primaryBtn: {
      width: '100%',
      paddingVertical: 14,
      borderRadius: r,
      backgroundColor: t.isComic ? t.surface : accent,
      borderWidth: t.isComic ? 1.5 : 0,
      borderColor: t.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    primaryBtnText: { color: t.isComic ? t.border : '#000', fontWeight: t.isComic ? '800' : '700', fontFamily: interFamily(t.isComic ? '800' : '700'), fontSize: 15, textTransform: t.isComic ? 'uppercase' : 'none', letterSpacing: t.isComic ? 0.6 : 0 },
    scheduleBtn: {
      width: '100%',
      paddingVertical: 14,
      borderRadius: r,
      backgroundColor: t.surface,
      borderWidth: t.isComic ? 1.5 : 1,
      borderColor: t.isComic ? `${t.borderDim}50` : t.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scheduleBtnText: { color: t.isComic ? t.textSecondary : t.textPrimary, fontWeight: '600', fontFamily: interFamily('600'), fontSize: 15 },
    footer: {
      padding: 16,
      borderTopWidth: t.isComic ? 2 : 1,
      borderTopColor: divider,
      backgroundColor: t.surface,
    },
    footerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    footerText: { fontSize: 12, color: t.textSecondary, fontFamily: interFamily('400') },
  });
}
