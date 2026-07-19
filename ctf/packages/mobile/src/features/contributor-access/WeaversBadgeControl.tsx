// The tappable "Weavers of the Commons" badge shown next to a member's name on the Directory
// profile detail, plus its tap-through dialog. Mirrors the web
// components/contributor-access/weavers-badge-control.tsx: the dialog copy is verbatim, and a
// condensed "How it's earned" explainer replaces the web link to
// /apps/directory/weavers-of-the-commons (the mobile app has no equivalent page). Honest copy
// only — the badge records real contribution; the platform vouches for no one.
//
// Positive-only: the CALLER renders this component only when the member holds the badge; there is
// no absence state to render.

import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, type ThemeTokens } from '../../theme';
import { WeaversBadge } from './WeaversBadge';

export function WeaversBadgeControl({ size = 20 }: { size?: number }) {
  const { tokens } = useTheme();
  const s = useMemo(() => makeStyles(tokens), [tokens]);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Weavers of the Commons"
        style={s.badgeButton}
      >
        <WeaversBadge size={size} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={s.backdropWrap}>
          {/* Backdrop is pressable so a tap outside the card closes the dialog. */}
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel="Close" />
          <View style={s.card}>
            <View style={s.cardHeader}>
              <WeaversBadge size={32} />
              <Text style={s.cardTitle}>Weavers of the Commons</Text>
            </View>
            <Text style={s.cardBody}>
              This member is a consistent, broad contributor to the community — real help, delivered
              over time. Anyone can earn this.
            </Text>
            <Text style={s.cardHowTitle}>How it&rsquo;s earned</Text>
            <Text style={s.cardBody}>
              By steadily delivering real help to other members across the platform. It is granted
              automatically — there is no application and no way to buy it — and once earned it is
              permanent. No score, points, or rank is shown anywhere; a member either holds the
              badge or simply does not yet.
            </Text>
            <Pressable
              style={s.closeBtn}
              onPress={() => setOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Text style={s.closeBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    badgeButton: { flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
    backdropWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      backgroundColor: 'rgba(0,0,0,0.6)',
    },
    card: {
      width: '100%',
      maxWidth: 380,
      borderRadius: 16,
      backgroundColor: t.surfaceAlt,
      borderWidth: 1,
      borderColor: t.border,
      paddingHorizontal: 22,
      paddingTop: 22,
      paddingBottom: 18,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    cardTitle: { fontSize: 16, fontWeight: '800', color: t.textPrimary, flexShrink: 1 },
    cardBody: { fontSize: 13, color: t.textSecondary, lineHeight: 21, marginBottom: 14 },
    cardHowTitle: { fontSize: 12, fontWeight: '700', color: t.textPrimary, marginBottom: 6 },
    closeBtn: {
      alignSelf: 'flex-end',
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: t.border,
    },
    closeBtnText: { fontSize: 12, fontWeight: '600', color: t.textSecondary },
  });
}
