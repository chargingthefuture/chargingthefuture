// What the web /apps/recurring-activity page shows a signed-in member who has not finished Unlock
// (recurring-activity-public-shell.tsx with its "Finish verifying" button). The Android app only
// opens this screen for a signed-in member, so the signed-out variant (Sign In / Join Free) is not
// needed. The web blurs the faded "Acknowledge" mark by 2px; React Native cannot blur a view
// without an extra native module, so here it is faded only.

import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { ChevronLeft, EyeOff, Globe, HeartHandshake, Lock, Repeat, Users, type LucideIcon } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { interFamily } from '../../components/ui';
import { COMMUNITY_LINE, getRecurringActivityTokens, rr } from './shared';

const INTRO =
  'Acknowledge an ongoing activity you share with another member — one tap to recognize an everyday tie. No money changes hands: it is a note to each other, never a bill.';

const FEATURES: Array<{ Icon: LucideIcon; label: string; desc: string }> = [
  { Icon: Repeat, label: 'One tap', desc: 'Mark an ongoing tie — no charge, nothing owed.' },
  { Icon: EyeOff, label: 'No bill', desc: 'No money moves — it is recognition, not a charge.' },
  { Icon: Users, label: 'Between members', desc: 'Both sides confirm; you decide who can see it.' },
];

export function VerifyView({ onBack, onVerify }: { onBack: () => void; onVerify: () => void }) {
  const { tokens } = useTheme();
  const t = getRecurringActivityTokens(tokens);
  const size = 140;
  const lock = Math.round(size * 0.33);
  return (
    <View style={{ flex: 1, backgroundColor: t.BG }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: `${t.ACCENT}10`, borderBottomWidth: 1, borderBottomColor: `${t.ACCENT}25` }}>
        <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel="Back to apps" style={{ width: 32, height: 32, borderRadius: rr(tokens, 8), backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', marginRight: 2 }}>
          <ChevronLeft size={18} color="#D5D9E2" />
        </TouchableOpacity>
        <HeartHandshake size={18} color={t.ACCENT} />
        <Text style={{ fontSize: 16, fontFamily: interFamily('700'), color: t.TITLE }}>Recurring Activity</Text>
        <TouchableOpacity onPress={onVerify} accessibilityRole="link" style={{ marginLeft: 'auto', paddingVertical: 7, paddingHorizontal: 16, borderRadius: rr(tokens, 8), backgroundColor: t.ACCENT }}>
          <Text style={{ fontSize: 13, fontFamily: interFamily('700'), color: '#04211D' }}>Finish verifying</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 28, paddingHorizontal: 24, gap: 22 }}>
        <View>
          <View style={{ width: size, height: size, borderRadius: rr(tokens, size / 2), backgroundColor: `${t.ACCENT}1A`, borderWidth: 4, borderColor: `${t.ACCENT}4D`, alignItems: 'center', justifyContent: 'center', gap: 6, opacity: 0.5 }}>
            <HeartHandshake size={Math.round(size * 0.25)} color={t.ACCENT} />
            <Text style={{ fontSize: 13, fontFamily: interFamily('800'), color: t.ACCENT }}>Acknowledge</Text>
          </View>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: lock, height: lock, borderRadius: rr(tokens, lock / 2), backgroundColor: `${t.ACCENT}26`, borderWidth: 2, borderColor: `${t.ACCENT}50`, alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={Math.round(lock * 0.42)} color={t.ACCENT} />
            </View>
          </View>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 22, fontFamily: interFamily('800'), color: t.TITLE, marginBottom: 8, textAlign: 'center' }}>Recognize the ties you keep</Text>
          <Text style={{ fontSize: 13, lineHeight: 20.8, fontFamily: interFamily('400'), color: t.MUTED, maxWidth: 300, textAlign: 'center' }}>{INTRO}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
          <Globe size={13} color={t.MUTED} />
          <Text style={{ fontSize: 12, fontFamily: interFamily('400'), color: t.MUTED }}>Open to members worldwide</Text>
        </View>
        <TouchableOpacity onPress={onVerify} accessibilityRole="link" style={{ width: '100%', padding: 14, borderRadius: rr(tokens, 12), backgroundColor: t.ACCENT, alignItems: 'center' }}>
          <Text style={{ fontSize: 14, fontFamily: interFamily('700'), color: '#04211D' }}>Finish verifying</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
          {FEATURES.map(({ Icon, label, desc }) => (
            <View key={label} style={{ flex: 1, padding: 14, borderRadius: rr(tokens, 12), backgroundColor: t.SURFACE, borderWidth: 1, borderColor: t.BORDER_SOLID, alignItems: 'center' }}>
              <Icon size={20} color={t.ACCENT} style={{ marginBottom: 8, opacity: 0.8 }} />
              <Text style={{ fontSize: 12, fontFamily: interFamily('700'), color: t.TITLE, marginBottom: 4, textAlign: 'center' }}>{label}</Text>
              <Text style={{ fontSize: 11, lineHeight: 16.5, fontFamily: interFamily('400'), color: t.MUTED, textAlign: 'center' }}>{desc}</Text>
            </View>
          ))}
        </View>
        <Text style={{ fontSize: 11, fontFamily: interFamily('400'), color: t.MUTED }}>{COMMUNITY_LINE}</Text>
      </ScrollView>
    </View>
  );
}
