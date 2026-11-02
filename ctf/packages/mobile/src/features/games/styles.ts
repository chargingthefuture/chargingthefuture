// The puzzle of the day's styles, from the member's 3.1 theme, matching the web's games.module.css.

import { StyleSheet } from 'react-native';
import type { SeThemeTokens } from '@ctf/shared';
import { SE_FONT } from '../se-frame/fonts';

export type GameStyles = ReturnType<typeof makeGameStyles>;

export function makeGameStyles(t: SeThemeTokens) {
  const pill = { minHeight: 44, paddingHorizontal: 18, justifyContent: 'center' as const, borderRadius: 999 };
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { gap: 18, paddingTop: 20, paddingHorizontal: 16, paddingBottom: 48 },
    eyebrow: { fontSize: 13, color: t.soft, fontFamily: SE_FONT.sans },
    title: { fontSize: 30, lineHeight: 33, color: t.ink, fontFamily: SE_FONT.serif },
    play: { gap: 12 },
    list: { gap: 8 },
    row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
    ask: { fontSize: 15, lineHeight: 21, color: t.soft, fontFamily: SE_FONT.sans },
    text: { fontSize: 15, lineHeight: 21, color: t.soft, fontFamily: SE_FONT.sans },
    quote: { paddingHorizontal: 16, paddingVertical: 14, borderLeftWidth: 3, borderLeftColor: t.kind.game, borderRadius: 12, backgroundColor: t.sunk, fontSize: 18, lineHeight: 26, color: t.ink, fontFamily: SE_FONT.serif },
    choice: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 12, justifyContent: 'center', borderRadius: 16, borderWidth: 1.5, borderColor: t.hair, backgroundColor: t.card },
    choiceText: { fontSize: 15, lineHeight: 21, color: t.ink, fontFamily: SE_FONT.sans },
    wrong: { borderColor: t.soft, opacity: 0.7 },
    bigWord: { fontSize: 32, lineHeight: 38, color: t.ink, fontFamily: SE_FONT.serif },
    strip: { width: '100%', aspectRatio: 5, borderRadius: 6, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
    stripPicked: { borderColor: t.pick, transform: [{ scale: 0.98 }] },
    fullPicture: { width: '100%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden' },
    ladder: { alignItems: 'center', gap: 6 },
    rung: { minWidth: 140, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5, borderColor: t.hair, backgroundColor: t.card, fontSize: 22, letterSpacing: 6, textAlign: 'center', color: t.ink, fontFamily: SE_FONT.sansBold },
    rungEnd: { borderStyle: 'dashed', color: t.kind.game },
    form: { flexDirection: 'row', gap: 8 },
    input: { flex: 1, minHeight: 44, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5, borderColor: t.hair, backgroundColor: t.card, color: t.ink, fontSize: 18, letterSpacing: 4, fontFamily: SE_FONT.sans },
    result: { gap: 8, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card },
    resultTitle: { fontSize: 15, color: t.ink, fontFamily: SE_FONT.sansBold },
    shareLine: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: t.sunk, fontSize: 14, color: t.ink, fontFamily: SE_FONT.sans },
    primary: { ...pill, backgroundColor: t.btn },
    primaryText: { fontSize: 15, color: t.onBtn, fontFamily: SE_FONT.sansSemi },
    secondary: { ...pill, borderWidth: 1.5, borderColor: t.line },
    secondaryText: { fontSize: 15, color: t.ink, fontFamily: SE_FONT.sansSemi },
    linkButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
    link: { fontSize: 14, color: t.ink, textDecorationLine: 'underline', fontFamily: SE_FONT.sans },
    dim: { opacity: 0.4 },
  });
}
