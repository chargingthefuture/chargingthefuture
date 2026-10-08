// The pieces the PeerProgramming admin screen is built from, copied from the web admin
// (web components/peer-programming/pp-admin-shell.tsx, pp-admin-topic-form.tsx,
// pp-admin-assignments.tsx): the section card, its heading and lead line, the green / red / amber
// banners, the labeled text box, the tick box and the solid accent button.
import React, { type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, type TextInputProps } from 'react-native';
import { Check } from 'lucide-react-native';
import { interFamily } from '../../components/ui';
import { usePPTheme } from './usePPTheme';

export function AdminSection({ children }: { children: ReactNode }) {
  const t = usePPTheme();
  return (
    <View style={[styles.section, { borderRadius: t.r(12), backgroundColor: t.SURFACE, borderColor: t.BORDER_SOLID }]}>{children}</View>
  );
}

export function SectionTitle({ text, marginBottom = 4 }: { text: string; marginBottom?: number }) {
  const t = usePPTheme();
  return <Text style={[styles.title, { color: t.TITLE, marginBottom }]}>{text}</Text>;
}

export function SectionLead({ children, marginBottom = 12 }: { children: ReactNode; marginBottom?: number }) {
  const t = usePPTheme();
  return <Text style={[styles.lead, { color: t.MUTED, marginBottom }]}>{children}</Text>;
}

export function EmptyLine({ text }: { text: string }) {
  const t = usePPTheme();
  return <Text style={[styles.empty, { color: t.MUTED }]}>{text}</Text>;
}

const BANNERS = {
  error: { background: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', color: '#EF4444' },
  notice: { background: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', color: '#22C55E' },
  warning: { background: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', color: '#F59E0B' },
};

export function Banner({ tone, children, spaced = false }: { tone: keyof typeof BANNERS; children: ReactNode; spaced?: boolean }) {
  const t = usePPTheme();
  const look = BANNERS[tone];
  return (
    <View style={[styles.banner, spaced ? styles.bannerSpaced : null, { borderRadius: t.r(10), backgroundColor: look.background, borderColor: look.border }]}>
      <Text accessibilityRole={tone === 'error' ? 'alert' : undefined} style={[styles.bannerText, { color: look.color }]}>{children}</Text>
    </View>
  );
}

export function FieldLabel({ text }: { text: string }) {
  const t = usePPTheme();
  return <Text style={[styles.label, { color: t.TITLE }]}>{text}</Text>;
}

export function AdminInput({ minHeight, mono, ...props }: TextInputProps & { minHeight?: number; mono?: boolean }) {
  const t = usePPTheme();
  return (
    <TextInput
      placeholderTextColor={t.MUTED}
      {...props}
      style={[
        styles.input,
        { backgroundColor: t.BG, borderColor: t.BORDER_SOLID, color: t.TITLE, borderRadius: t.r(8) },
        minHeight ? { minHeight, textAlignVertical: 'top' } : null,
        mono ? styles.mono : null,
      ]}
    />
  );
}

// The web's native tick box, drawn: a 16px square that fills with the accent and shows a tick.
export function TickBox({ checked, label, onChange }: { checked: boolean; label: string; onChange: (_checked: boolean) => void }) {
  const t = usePPTheme();
  return (
    <TouchableOpacity
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={styles.tickRow}
    >
      <View style={[styles.tick, { borderRadius: t.r(3), borderColor: checked ? t.ACCENT : t.MUTED, backgroundColor: checked ? t.ACCENT : 'transparent' }]}>
        {checked ? <Check size={12} color="#fff" strokeWidth={3} /> : null}
      </View>
      <Text style={[styles.tickLabel, { color: t.TITLE }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function SolidButton({ label, disabled, dim, onPress }: { label: string; disabled: boolean; dim: boolean; onPress: () => void }) {
  const t = usePPTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={[styles.solid, { borderRadius: t.r(8), backgroundColor: t.ACCENT, borderColor: t.ACCENT, opacity: dim ? 0.5 : 1 }]}
    >
      <Text style={styles.solidText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 16, padding: 16, borderWidth: 1 },
  title: { fontSize: 15, fontFamily: interFamily('800') },
  lead: { fontSize: 12, lineHeight: 18, fontFamily: interFamily('400') },
  empty: { fontSize: 13, fontFamily: interFamily('400') },
  banner: { paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1 },
  bannerSpaced: { marginBottom: 12 },
  bannerText: { fontSize: 13, lineHeight: 19.5, fontFamily: interFamily('400') },
  label: { fontSize: 13, fontFamily: interFamily('600'), marginBottom: 6 },
  input: { borderWidth: 1, paddingVertical: 8, paddingHorizontal: 10, fontSize: 13, fontFamily: interFamily('400') },
  mono: { fontFamily: 'monospace' },
  tickRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tick: { width: 16, height: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tickLabel: { flex: 1, fontSize: 13, fontFamily: interFamily('400') },
  solid: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1 },
  solidText: { color: '#0F1117', fontSize: 13, fontFamily: interFamily('700') },
});
