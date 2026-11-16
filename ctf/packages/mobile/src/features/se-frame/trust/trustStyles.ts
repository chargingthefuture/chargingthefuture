// Styles for the trust lines on Android, the copy of the web's trust.module.css.

import { StyleSheet } from 'react-native';
import type { SeThemeTokens } from '@ctf/shared';
import { SE_FONT } from '../fonts';

export type TrustStyles = ReturnType<typeof makeTrustStyles>;

export function makeTrustStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    section: { gap: 8 },
    label: { fontSize: 11, letterSpacing: 0.66, textTransform: 'uppercase', color: t.soft, fontFamily: SE_FONT.sansBold },
    soft: { fontSize: 13, lineHeight: 19, color: t.soft, fontFamily: SE_FONT.sans },
    note: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: t.sunk, fontSize: 12, lineHeight: 17, color: t.soft, fontFamily: SE_FONT.sans },
    lines: { gap: 8 },
    line: { gap: 3, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.hair },
    lineHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    lineText: { flex: 1, minWidth: 0, fontSize: 14, color: t.ink, fontFamily: SE_FONT.sansSemi },
    date: { fontSize: 12, color: t.soft, fontFamily: SE_FONT.sans },
    details: { paddingLeft: 22, fontSize: 12, lineHeight: 17, color: t.soft, fontFamily: SE_FONT.sans },
    empty: { gap: 8, padding: 14, borderRadius: 18, backgroundColor: t.card, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.line },
    emptyTitle: { fontSize: 15, color: t.ink, fontFamily: SE_FONT.sansBold },
    step: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: t.sunk },
    ring: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: t.line },
    stepText: { fontSize: 13, color: t.soft, fontFamily: SE_FONT.sans },
    retry: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sansBold, textDecorationLine: 'underline' },
  });
}
