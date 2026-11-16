// A card's conversation drawn in the 3.0 look, the Android copy of the web's
// card-conversation-classic.module.css: the same names as the conversation part of
// cardSheetStyles.ts, painted with the 3.0 plugin's own shell tokens (classicLook.ts), so a 3.0
// screen never shows the 3.1 look.

import { StyleSheet } from 'react-native';
import { interFamily } from '../../../components/ui';
import type { ClassicLook } from '../classicLook';
import type { CardTalkInk, CardTalkStyles } from './cardSheetStyles';

// Hex accent plus a two-digit alpha, the way the plugin screens tint it (`${ACCENT}26`).
const tint = (accent: string, alpha: string) => `${accent}${alpha}`;

function answerStyles(l: ClassicLook) {
  const talk = { minHeight: 36, paddingHorizontal: 12, borderRadius: l.r(10), borderWidth: 1, justifyContent: 'center' } as const;
  return {
    answers: { borderWidth: 1, borderColor: l.BORDER_STRONG, borderRadius: l.r(10), padding: 12, gap: 10 },
    answersTitle: { fontSize: 12, color: l.SUBTLE, fontFamily: interFamily('700') },
    answer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    yoursRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    answerText: { flex: 1, fontSize: 14, color: l.TEXT, fontFamily: interFamily('400') },
    answerName: { fontFamily: interFamily('700') },
    answerConfirmed: { fontSize: 12, color: l.SUBTLE, fontFamily: interFamily('600') },
    talkButton: { ...talk, borderColor: l.BORDER_HI, backgroundColor: 'transparent' },
    talkPrimary: { ...talk, borderColor: l.ACCENT, backgroundColor: l.ACCENT },
    talkLabel: { fontSize: 13, color: l.SUBTLE, fontFamily: interFamily('600') },
    talkPrimaryLabel: { fontSize: 13, color: '#FFFFFF', fontFamily: interFamily('700') },
  } as const;
}

function switchStyles(l: ClassicLook) {
  const chip = { minHeight: 32, paddingHorizontal: 10, borderRadius: l.r(8), borderWidth: 1, justifyContent: 'center' } as const;
  return {
    talk: { gap: 10 },
    talkHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    talkTitle: { fontSize: 14, color: l.TEXT, fontFamily: interFamily('600') },
    switch: { flexDirection: 'row', flexWrap: 'wrap', alignSelf: 'flex-start', gap: 6 },
    switchOn: { ...chip, borderColor: tint(l.ACCENT, '4D'), backgroundColor: tint(l.ACCENT, '26') },
    switchOff: { ...chip, borderColor: l.BORDER_HI, backgroundColor: l.INPUT_BG },
    switchOnLabel: { fontSize: 12, color: l.ACCENT, fontFamily: interFamily('600') },
    switchOffLabel: { fontSize: 12, color: l.SUBTLE, fontFamily: interFamily('600') },
  } as const;
}

function messageStyles(l: ClassicLook) {
  return {
    messages: { gap: 8 },
    bubbleRow: { alignSelf: 'flex-start', maxWidth: '80%', gap: 2 },
    bubbleRowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
    bubble: { backgroundColor: l.INPUT_BG, borderWidth: 1, borderColor: l.BORDER_HI, borderRadius: l.r(10), paddingVertical: 8, paddingHorizontal: 12 },
    bubbleMine: { backgroundColor: tint(l.ACCENT, '26'), borderColor: tint(l.ACCENT, '4D') },
    bubbleText: { fontSize: 14, lineHeight: 21, color: l.TEXT, fontFamily: interFamily('400') },
    bubbleTextMine: { color: l.TEXT },
    meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
    metaText: { fontSize: 11, color: l.SUBTLE, fontFamily: interFamily('400') },
    linkButton: { minHeight: 24, justifyContent: 'center' },
    bubbleRowEditing: { width: '80%' },
    editBox: { alignSelf: 'stretch', minHeight: 88, borderWidth: 1, borderColor: l.BORDER_HI, backgroundColor: l.INPUT_BG, borderRadius: l.r(10), paddingVertical: 10, paddingHorizontal: 12, fontSize: 14, lineHeight: 21, color: l.TEXT, fontFamily: interFamily('400'), textAlignVertical: 'top' },
    linkLabel: { fontSize: 11, color: l.ACCENT, fontFamily: interFamily('600') },
    pill: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 10, borderRadius: l.r(8), borderWidth: 1, borderColor: l.BORDER_HI, backgroundColor: l.INPUT_BG },
    pillText: { fontSize: 12, color: l.SUBTLE, fontFamily: interFamily('600') },
    pillAgree: { fontSize: 12, color: l.ACCENT, fontFamily: interFamily('600') },
    quiet: { fontSize: 13, color: l.SUBTLE, fontFamily: interFamily('400') },
  } as const;
}

function composerStyles(l: ClassicLook) {
  return {
    composer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    input: { flex: 1, minHeight: 42, borderRadius: l.r(10), borderWidth: 1, borderColor: l.BORDER_HI, backgroundColor: l.INPUT_BG, paddingHorizontal: 14, fontSize: 14, color: l.TEXT, fontFamily: interFamily('400') },
    send: { width: 42, height: 42, borderRadius: l.r(10), backgroundColor: l.ACCENT, alignItems: 'center', justifyContent: 'center' },
    dim: { opacity: 0.5 },
    hint: { fontSize: 11, color: l.SUBTLE, fontFamily: interFamily('400') },
  } as const;
}

export function makeCardTalkClassicStyles(l: ClassicLook): CardTalkStyles {
  return StyleSheet.create({ ...answerStyles(l), ...switchStyles(l), ...messageStyles(l), ...composerStyles(l) });
}

export function cardTalkClassicInk(l: ClassicLook): CardTalkInk {
  return { soft: l.SUBTLE, onBtn: '#FFFFFF' };
}

// The panel around it and the toggle that opens it, on the web .panel and .panelToggle.
export function makeCardTalkClassicFrame(l: ClassicLook) {
  return StyleSheet.create({
    panel: { gap: 12, marginTop: 10, paddingVertical: 14, paddingHorizontal: 16, borderRadius: l.r(14), borderWidth: 1, borderColor: l.BORDER_HI, backgroundColor: l.SURFACE },
  });
}
