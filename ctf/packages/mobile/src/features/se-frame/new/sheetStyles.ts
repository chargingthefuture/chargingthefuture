// + New as a sheet on Android, the copy of the web's sheet.module.css: the approved boards "New
// post", "Schedule a talk" and "Schedule a talk, not yet verified", in the member's theme.

import { StyleSheet } from 'react-native';
import type { SeThemeTokens } from '@ctf/shared';
import { SE_FONT } from '../fonts';

function sheetFrame(t: SeThemeTokens) {
  return {
    sheet: {
      gap: 14,
      marginTop: 8,
      marginHorizontal: -16,
      marginBottom: -180,
      paddingTop: 12,
      paddingHorizontal: 16,
      paddingBottom: 200,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      borderTopWidth: 1.5,
      borderColor: t.line,
      backgroundColor: t.card,
    },
    top: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
    close: { width: 40, height: 40, borderRadius: 999, borderWidth: 1.5, borderColor: t.hair, alignItems: 'center' as const, justifyContent: 'center' as const },
    topLink: { paddingVertical: 10, fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansSemi, textDecorationLine: 'underline' as const },
    rule: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, backgroundColor: t.sunk, fontSize: 14, lineHeight: 20, color: t.ink, fontFamily: SE_FONT.sans },
    head: { alignItems: 'center' as const, gap: 6, paddingTop: 4 },
    headLeft: { gap: 2 },
    title: { fontSize: 26, lineHeight: 31, color: t.ink, fontFamily: SE_FONT.serif, textAlign: 'center' as const },
    titleSmall: { fontSize: 24, lineHeight: 29, color: t.ink, fontFamily: SE_FONT.serif },
    sub: { fontSize: 13, lineHeight: 19, color: t.soft, fontFamily: SE_FONT.sans },
    headSub: { fontSize: 14, textAlign: 'center' as const },
    kinds: { flexDirection: 'row' as const, gap: 2, padding: 4, borderRadius: 999, backgroundColor: t.sunk },
    kind: { flex: 1, minHeight: 40, borderRadius: 999, alignItems: 'center' as const, justifyContent: 'center' as const },
    kindOn: { borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card },
    kindLabel: { fontSize: 14, color: t.soft, fontFamily: SE_FONT.sansSemi },
    kindLabelOn: { color: t.ink, fontFamily: SE_FONT.sansBold },
    architect: { alignSelf: 'center' as const, paddingVertical: 8, fontSize: 13, color: t.soft, fontFamily: SE_FONT.sans, textDecorationLine: 'underline' as const },
  };
}

function sheetFields(t: SeThemeTokens) {
  return {
    pill: { minHeight: 48, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.bg, color: t.ink, fontSize: 15, fontFamily: SE_FONT.sans },
    area: { minHeight: 72, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 20, borderWidth: 1.5, borderColor: t.hair, backgroundColor: t.bg, color: t.ink, fontSize: 14, fontFamily: SE_FONT.sans, textAlignVertical: 'top' as const },
    areaOff: { opacity: 0.55 },
    optional: { fontFamily: SE_FONT.sans, color: t.soft },
    suggestList: { padding: 4, borderRadius: 16, backgroundColor: t.sunk },
    suggestItem: { minHeight: 44, justifyContent: 'center' as const, paddingHorizontal: 14, borderRadius: 12 },
    suggestText: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sans },
    bold: { fontFamily: SE_FONT.sansBold },
    dashed: { alignSelf: 'flex-start' as const, minHeight: 40, justifyContent: 'center' as const, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5, borderStyle: 'dashed' as const, borderColor: t.soft },
    dashedLabel: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansSemi },
    tasks: { gap: 8 },
    taskRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
    taskInput: { flex: 1 },
    link: { paddingVertical: 10, fontSize: 14, color: t.ink, fontFamily: SE_FONT.sansBold, textDecorationLine: 'underline' as const },
  };
}

function sheetTalk(t: SeThemeTokens) {
  return {
    days: { flexDirection: 'row' as const, gap: 4 },
    day: { flex: 1, minHeight: 52, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 1, borderRadius: 14, borderWidth: 1.5, borderColor: t.hair, backgroundColor: t.sunk },
    dayOn: { borderColor: t.line, backgroundColor: t.btn },
    dayLetter: { fontSize: 11, color: t.ink, fontFamily: SE_FONT.sans },
    dayDate: { fontSize: 15, color: t.ink, fontFamily: SE_FONT.sansBold },
    dayOnLabel: { color: t.onBtn },
    slots: { gap: 6 },
    slot: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, minHeight: 48, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1.5 },
    open: { borderStyle: 'dashed' as const, borderColor: t.soft, backgroundColor: t.card },
    booked: { borderColor: t.hair, backgroundColor: t.sunk },
    picked: { borderColor: t.line, backgroundColor: t.pick },
    slotTime: { width: 74, fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansBold },
    slotText: { flex: 1, minWidth: 0 },
    slotTitle: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansSemi },
    slotSub: { fontSize: 12, color: t.soft, fontFamily: SE_FONT.sans },
    onPick: { color: t.onPick },
    lockCard: { gap: 10, padding: 16, borderRadius: 20, borderWidth: 1.5, borderColor: t.hair, backgroundColor: t.sunk },
    lockTitle: { fontSize: 21, lineHeight: 25, color: t.ink, fontFamily: SE_FONT.serif },
    lockText: { fontSize: 14, lineHeight: 21, color: t.soft, fontFamily: SE_FONT.sans },
    lockButton: { alignSelf: 'flex-start' as const, minHeight: 46, justifyContent: 'center' as const, paddingHorizontal: 20, borderRadius: 999, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.btn, boxShadow: `0px 3px 0px ${t.line}` },
    lockButtonLabel: { fontSize: 15, color: t.onBtn, fontFamily: SE_FONT.sansBold },
    nextCard: { gap: 6, padding: 14, borderRadius: 18, borderWidth: 1.5, borderColor: t.hair, backgroundColor: t.card },
    nextLabel: { fontSize: 12, color: t.soft, fontFamily: SE_FONT.sansBold },
    nextTitle: { fontSize: 15, color: t.ink, fontFamily: SE_FONT.sansBold },
  };
}

export function makeSheetStyles(t: SeThemeTokens) {
  return StyleSheet.create({ ...sheetFrame(t), ...sheetFields(t), ...sheetTalk(t) });
}

export type SheetStyles = ReturnType<typeof makeSheetStyles>;
