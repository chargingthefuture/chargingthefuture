// The puzzles screen's styles, from the member's 3.1 theme, matching the web's games.module.css.

import { StyleSheet } from 'react-native';
import type { SeThemeTokens } from '@ctf/shared';
import { SE_FONT } from '../se-frame/fonts';

export type GameStyles = ReturnType<typeof makeGameStyles>;

const RIGHT = '#2f8a4f';

export function makeGameStyles(t: SeThemeTokens) {
  const pill = { minHeight: 44, paddingHorizontal: 18, justifyContent: 'center' as const, borderRadius: 999 };
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { gap: 18, padding: 16, paddingBottom: 48 },
    title: { fontSize: 30, lineHeight: 33, color: t.ink, fontFamily: SE_FONT.serif },
    eyebrow: { fontSize: 13, color: t.soft, fontFamily: SE_FONT.sans },
    group: { gap: 8 },
    groupTitle: { fontSize: 12, color: t.soft, fontFamily: SE_FONT.sansBold },
    list: { gap: 8 },
    play: { gap: 12 },
    row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
    card: { minHeight: 44, gap: 4, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, borderWidth: 1.5, borderColor: t.hair, backgroundColor: t.card },
    rowTitle: { fontSize: 15, lineHeight: 21, color: t.ink, fontFamily: SE_FONT.sansSemi },
    rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    meta: { fontSize: 13, color: t.soft, fontFamily: SE_FONT.sans },
    solved: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden', backgroundColor: t.kind.game, color: t.onBtn, fontSize: 11, fontFamily: SE_FONT.sansBold },
    kind: { fontSize: 12, letterSpacing: 0.5, color: t.kind.game, fontFamily: SE_FONT.sansBold },
    ask: { fontSize: 15, lineHeight: 21, color: t.soft, fontFamily: SE_FONT.sans },
    quote: { paddingHorizontal: 16, paddingVertical: 14, borderLeftWidth: 3, borderLeftColor: t.kind.game, borderRadius: 12, backgroundColor: t.sunk, fontSize: 18, lineHeight: 26, color: t.ink, fontFamily: SE_FONT.serif },
    gap: { color: t.kind.game, fontFamily: SE_FONT.sansBold },
    choice: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 12, justifyContent: 'center', borderRadius: 16, borderWidth: 1.5, borderColor: t.hair, backgroundColor: t.card },
    choiceText: { fontSize: 15, lineHeight: 21, color: t.ink, fontFamily: SE_FONT.sans },
    right: { borderColor: RIGHT, borderWidth: 3 },
    wrong: { borderColor: t.soft, opacity: 0.7 },
    line: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    lineText: { flex: 1 },
    lineNumber: { width: 24, height: 24, borderRadius: 12, overflow: 'hidden', backgroundColor: t.sunk, color: t.ink, fontSize: 13, lineHeight: 24, textAlign: 'center', fontFamily: SE_FONT.sansBold },
    result: { gap: 8, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card },
    resultTitle: { fontSize: 15, color: t.ink, fontFamily: SE_FONT.sansBold },
    primary: { ...pill, backgroundColor: t.btn },
    primaryText: { fontSize: 15, color: t.onBtn, fontFamily: SE_FONT.sansSemi },
    secondary: { ...pill, borderWidth: 1.5, borderColor: t.line },
    secondaryText: { fontSize: 15, color: t.ink, fontFamily: SE_FONT.sansSemi },
    linkButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
    link: { fontSize: 14, color: t.ink, textDecorationLine: 'underline', fontFamily: SE_FONT.sans },
    pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  });
}
