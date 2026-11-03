// Styles for a Today card opened in place, the Android copy of the web's card-sheet.module.css
// (the approved 3.1 board "a card opened in place"), drawn from the theme tokens so it follows
// every color and dark mode.

import { StyleSheet } from 'react-native';
import type { SeThemeTokens } from '@ctf/shared';
import { SE_FONT } from '../fonts';

const roundBase = { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' } as const;
const pillButton = { minHeight: 32, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5, justifyContent: 'center' } as const;

function sheetStyles(t: SeThemeTokens) {
  return {
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: { flex: 1, backgroundColor: t.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderTopWidth: 1.5, borderColor: t.line },
    content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16, gap: 14 },
    grip: { alignSelf: 'center', width: 44, height: 5, borderRadius: 999, backgroundColor: t.hair },
    head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    who: { flexShrink: 1 },
    handle: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sansSemi },
    when: { fontSize: 12, fontFamily: SE_FONT.sansBold },
    spacer: { flex: 1 },
    round: { ...roundBase, borderColor: t.hair, backgroundColor: t.card },
    menu: { alignSelf: 'flex-end', padding: 6, borderRadius: 14, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.line, boxShadow: `0px 3px 0px ${t.line}` },
    menuItem: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
    menuLabel: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sans },
    text: { gap: 8 },
    title: { fontSize: 26, lineHeight: 31, color: t.ink, fontFamily: SE_FONT.serif },
    body: { fontSize: 15, lineHeight: 22, color: t.soft, fontFamily: SE_FONT.sans },
    openIn: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
    openInLabel: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansSemi, textDecorationLine: 'underline' },
  } as const;
}

function answerStyles(t: SeThemeTokens) {
  const talk = { minHeight: 38, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5, borderColor: t.line, justifyContent: 'center', boxShadow: `0px 2px 0px ${t.line}` } as const;
  return {
    answers: { backgroundColor: t.card, borderWidth: 1.5, borderColor: t.hair, borderRadius: 18, padding: 12, gap: 10 },
    answersTitle: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansBold },
    answer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    answerText: { flex: 1, fontSize: 14, color: t.ink, fontFamily: SE_FONT.sans },
    answerName: { fontFamily: SE_FONT.sansBold },
    talkButton: { ...talk, backgroundColor: t.card },
    talkPrimary: { ...talk, backgroundColor: t.btn },
    talkLabel: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansSemi },
    talkPrimaryLabel: { fontSize: 13, color: t.onBtn, fontFamily: SE_FONT.sansBold },
  } as const;
}

function talkStyles(t: SeThemeTokens) {
  return {
    talk: { gap: 10 },
    talkHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    talkTitle: { fontSize: 15, color: t.ink, fontFamily: SE_FONT.sansBold },
    switch: { flexDirection: 'row', flexWrap: 'wrap', alignSelf: 'flex-start', backgroundColor: t.sunk, borderRadius: 999, padding: 3 },
    switchOn: { ...pillButton, borderColor: t.line, backgroundColor: t.card },
    switchOff: { ...pillButton, borderColor: 'transparent' },
    switchOnLabel: { fontSize: 12, color: t.ink, fontFamily: SE_FONT.sansBold },
    switchOffLabel: { fontSize: 12, color: t.soft, fontFamily: SE_FONT.sansSemi },
    messages: { gap: 8 },
    bubbleRow: { alignSelf: 'flex-start', maxWidth: '78%', gap: 2 },
    bubbleRowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
    bubble: { backgroundColor: t.card, borderWidth: 1.5, borderColor: t.hair, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomRightRadius: 18, borderBottomLeftRadius: 6, paddingVertical: 10, paddingHorizontal: 12 },
    bubbleMine: { backgroundColor: t.btn, borderColor: t.btn, borderBottomLeftRadius: 18, borderBottomRightRadius: 6 },
    bubbleText: { fontSize: 14, lineHeight: 20, color: t.ink, fontFamily: SE_FONT.sans },
    bubbleTextMine: { color: t.onBtn },
    meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
    metaText: { fontSize: 11, color: t.soft, fontFamily: SE_FONT.sans },
    linkButton: { minHeight: 24, justifyContent: 'center' },
    bubbleRowEditing: { width: '78%' },
    editBox: { alignSelf: 'stretch', minHeight: 88, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomRightRadius: 6, borderBottomLeftRadius: 18, paddingVertical: 10, paddingHorizontal: 12, fontSize: 14, lineHeight: 20, color: t.ink, fontFamily: SE_FONT.sans, textAlignVertical: 'top' },
    linkLabel: { fontSize: 11, color: t.ink, fontFamily: SE_FONT.sansSemi, textDecorationLine: 'underline' },
    pill: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: t.sunk },
    pillText: { fontSize: 12, color: t.ink, fontFamily: SE_FONT.sansSemi },
    pillAgree: { fontSize: 12, color: t.ink, fontFamily: SE_FONT.sansSemi, textDecorationLine: 'underline' },
    quiet: { fontSize: 13, color: t.soft, fontFamily: SE_FONT.sans },
    composer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    input: { flex: 1, minHeight: 46, borderRadius: 999, borderWidth: 1.5, borderColor: t.hair, backgroundColor: t.card, paddingHorizontal: 16, fontSize: 14, color: t.ink, fontFamily: SE_FONT.sans },
    send: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.btn, alignItems: 'center', justifyContent: 'center', boxShadow: `0px 2px 0px ${t.line}` },
    dim: { opacity: 0.6 },
    hint: { fontSize: 11, color: t.soft, fontFamily: SE_FONT.sans, textAlign: 'center' },
  } as const;
}

export function makeCardSheetStyles(t: SeThemeTokens) {
  return StyleSheet.create({ ...sheetStyles(t), ...answerStyles(t), ...talkStyles(t) });
}

export type CardSheetStyles = ReturnType<typeof makeCardSheetStyles>;
