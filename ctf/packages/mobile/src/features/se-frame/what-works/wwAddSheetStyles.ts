// Styles for What Works, add a problem, the Android copy of the web's ww-add-sheet.module.css (the
// approved 3.1 board "What works: add a problem"), drawn from the theme tokens so it follows every
// color and dark mode.

import { StyleSheet } from 'react-native';
import type { SeThemeTokens } from '@ctf/shared';
import { SE_FONT } from '../fonts';

const bigButton = { minHeight: 50, borderRadius: 999, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' } as const;

function frameStyles(t: SeThemeTokens) {
  return {
    backdrop: { flex: 1, backgroundColor: t.soft, justifyContent: 'flex-end' },
    sheet: { flex: 1, backgroundColor: t.card, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderTopWidth: 1.5, borderColor: t.line },
    content: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20, gap: 14 },
    top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    close: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: t.hair, alignItems: 'center', justifyContent: 'center' },
    eyebrow: { fontSize: 12, color: t.kind.story, fontFamily: SE_FONT.sansBold },
    title: { fontSize: 24, color: t.ink, fontFamily: SE_FONT.serif },
    rule: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: t.bg, fontSize: 13, lineHeight: 19, color: t.ink, fontFamily: SE_FONT.sans },
    spacer: { flex: 1 },
  } as const;
}

function formStyles(t: SeThemeTokens) {
  return {
    field: { gap: 6 },
    label: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansBold },
    textarea: { minHeight: 96, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 22, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card, color: t.ink, fontSize: 15, fontFamily: SE_FONT.sans, textAlignVertical: 'top' },
    input: { minHeight: 48, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card, color: t.ink, fontSize: 15, fontFamily: SE_FONT.sans },
    matches: { gap: 8 },
    match: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5, borderColor: t.hair, backgroundColor: t.card },
    matchText: { flex: 1 },
    matchTitle: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sansBold },
    matchCount: { fontSize: 12, color: t.soft, fontFamily: SE_FONT.sans },
    note: { fontSize: 13, color: t.soft, fontFamily: SE_FONT.sans },
    use: { fontSize: 13, color: t.kind.story, fontFamily: SE_FONT.sansBold },
    error: { fontSize: 13, color: t.liveBadge, fontFamily: SE_FONT.sans },
    add: { ...bigButton, borderColor: t.line, backgroundColor: t.card, boxShadow: `0px 3px 0px ${t.line}` },
    addLabel: { fontSize: 15, color: t.ink, fontFamily: SE_FONT.sansBold },
    primary: { ...bigButton, borderColor: t.line, backgroundColor: t.btn, boxShadow: `0px 3px 0px ${t.line}` },
    primaryLabel: { fontSize: 15, color: t.onBtn, fontFamily: SE_FONT.sansBold },
    dim: { opacity: 0.6 },
  } as const;
}

export function makeWwAddSheetStyles(t: SeThemeTokens) {
  return StyleSheet.create({ ...frameStyles(t), ...formStyles(t) });
}

export type WwAddSheetStyles = ReturnType<typeof makeWwAddSheetStyles>;
