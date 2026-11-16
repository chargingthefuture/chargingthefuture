// Styles for Me → Tools → "Log what happened", the Android copy of the web's
// click-log-sheet.module.css, drawn from the theme tokens so it follows every color and dark mode.

import { StyleSheet } from 'react-native';
import type { SeThemeTokens } from '@ctf/shared';
import { SE_FONT } from '../fonts';

const bigButton = { flex: 1, minHeight: 50, borderRadius: 999, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' } as const;

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
    note: { fontSize: 13, lineHeight: 19, color: t.soft, fontFamily: SE_FONT.sans },
    error: { fontSize: 13, lineHeight: 19, color: t.liveBadge, fontFamily: SE_FONT.sans },
    spacer: { flex: 1 },
    actions: { flexDirection: 'row', gap: 10 },
    secondary: { ...bigButton, borderColor: t.line, backgroundColor: t.card, boxShadow: `0px 3px 0px ${t.line}` },
    secondaryLabel: { fontSize: 15, color: t.ink, fontFamily: SE_FONT.sansBold },
    primary: { ...bigButton, borderColor: t.line, backgroundColor: t.btn, boxShadow: `0px 3px 0px ${t.line}` },
    primaryLabel: { fontSize: 15, color: t.onBtn, fontFamily: SE_FONT.sansBold },
    dim: { opacity: 0.6 },
    historyLink: { fontSize: 15, color: t.kind.story, fontFamily: SE_FONT.sansBold, textDecorationLine: 'underline' },
  } as const;
}

function fieldStyles(t: SeThemeTokens) {
  return {
    field: { gap: 6 },
    label: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansBold },
    textarea: { minHeight: 96, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 22, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card, color: t.ink, fontSize: 15, fontFamily: SE_FONT.sans, textAlignVertical: 'top' },
    input: { minHeight: 48, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card, color: t.ink, fontSize: 15, fontFamily: SE_FONT.sans },
    suggestion: { gap: 10, padding: 12, borderRadius: 16, backgroundColor: t.bg },
    check: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    box: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: t.line, alignItems: 'center', justifyContent: 'center' },
    boxOn: { backgroundColor: t.btn },
    boxMark: { fontSize: 13, color: t.onBtn, fontFamily: SE_FONT.sansBold },
    checkLabel: { flex: 1, fontSize: 13, lineHeight: 19, color: t.ink, fontFamily: SE_FONT.sans },
    location: { alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card, justifyContent: 'center' },
    locationOn: { backgroundColor: t.btn },
    locationLabel: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sansBold },
    locationLabelOn: { color: t.onBtn },
  } as const;
}

function tagStyles(t: SeThemeTokens) {
  return {
    group: { gap: 8 },
    groupHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
    groupLabel: { flex: 1, fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansBold },
    picked: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    pickedTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 12, paddingRight: 4, paddingVertical: 4, borderRadius: 999, backgroundColor: t.btn },
    pickedLabel: { fontSize: 13, color: t.onBtn, fontFamily: SE_FONT.sansBold },
    remove: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
    removeLabel: { fontSize: 18, color: t.onBtn, fontFamily: SE_FONT.sans },
    searchRow: { justifyContent: 'center' },
    searchInput: { paddingRight: 48 },
    clear: { position: 'absolute', right: 8, minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
    clearLabel: { fontSize: 18, color: t.soft, fontFamily: SE_FONT.sans },
    chips: { maxHeight: 180, borderRadius: 16, borderWidth: 1.5, borderColor: t.hair },
    chipsContent: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingVertical: 10, paddingHorizontal: 12 },
    chip: { minHeight: 36, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5, borderColor: t.hair, backgroundColor: t.bg, justifyContent: 'center' },
    chipOn: { borderColor: t.line, backgroundColor: t.btn },
    chipLabel: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sans },
    chipLabelOn: { color: t.onBtn, fontFamily: SE_FONT.sansBold },
  } as const;
}

export function makeClickLogSheetStyles(t: SeThemeTokens) {
  return StyleSheet.create({ ...frameStyles(t), ...fieldStyles(t), ...tagStyles(t) });
}

export type ClickLogSheetStyles = ReturnType<typeof makeClickLogSheetStyles>;
