// What a signed-out visitor sees, copied from the web MobileFoundationPublic
// (foundation-public-shell.tsx): the description, "Open to members worldwide", the join button and the
// sign-in card. The web's own back link and title row is the app's screen header above this. Both
// buttons start the app's sign-in, which is where the web links go.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Globe, Lock } from 'lucide-react-native';
import { useAuth } from '../../auth/auth-context';
import { alpha, font, useFDTheme } from './useFDTheme';

export function FoundationPublic() {
  const { t, r } = useFDTheme();
  const { signIn } = useAuth();
  const start = () => void signIn();
  return (
    <View style={[styles.screen, { backgroundColor: t.BG }]}>
      <View style={styles.top}>
        {/* The web ends this line "Pay with ServiceCredits."; credits are not money (CLAUDE.md), so that sentence is left out. */}
        <Text style={[font(14), styles.lh21, { color: t.SUBTLE }]}>Electricians, plumbers, carpenters, and more — fellow community members.</Text>
        <View style={styles.worldwide}>
          <Globe size={13} color={t.MUTED} />
          <Text style={[font(12), { color: t.MUTED }]}>Open to members worldwide</Text>
        </View>
        <Pressable onPress={start} accessibilityRole="button" style={[styles.join, { borderRadius: r(12), backgroundColor: t.ACCENT }]}>
          <Text style={[font(15, '700'), styles.white]}>Join Skills Economy — Free</Text>
        </Pressable>
      </View>
      <View style={styles.gateWrap}>
        <View style={[styles.gate, { borderRadius: r(14) }]}>
          <View style={[styles.lock, { borderRadius: r(24), borderColor: alpha(t.ACCENT, '50'), backgroundColor: alpha(t.ACCENT, '10') }]}>
            <Lock size={20} color={t.ACCENT} />
          </View>
          <Text style={[font(15, '700'), styles.center, { color: t.TITLE }]}>Sign in to book tradespeople</Text>
          <Pressable onPress={start} accessibilityRole="button" style={[styles.signIn, { borderRadius: r(9), backgroundColor: t.ACCENT }]}>
            <Text style={[font(13, '700'), styles.white]}>Sign in</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { paddingTop: 24, paddingHorizontal: 20, paddingBottom: 16, gap: 12 },
  lh21: { lineHeight: 21 },
  worldwide: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  join: { padding: 14, alignItems: 'center' },
  white: { color: '#fff', textAlign: 'center' },
  center: { textAlign: 'center' },
  gateWrap: { flex: 1, paddingHorizontal: 20, paddingBottom: 20 },
  gate: { flex: 1, minHeight: 240, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', backgroundColor: 'rgba(255,255,255,0.02)', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 32, paddingHorizontal: 20 },
  lock: { width: 48, height: 48, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  signIn: { paddingVertical: 10, paddingHorizontal: 24 },
});
