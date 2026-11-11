// People's styles on Android, the copy of the web stylesheet (components/se-frame/people/
// people.module.css), from the 3.1 theme tokens.

import { StyleSheet } from 'react-native';
import type { SeThemeTokens } from '@ctf/shared';
import { SE_FONT } from '../fonts';

export type PeopleStyles = ReturnType<typeof makePeopleStyles>;

export function makePeopleStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    screen: { gap: 14 },
    lockedScreen: { gap: 18 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
    title: { fontSize: 30, lineHeight: 33, color: t.ink, fontFamily: SE_FONT.serif },
    count: { fontSize: 13, color: t.soft, fontFamily: SE_FONT.sans },
    search: { minHeight: 48, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card, color: t.ink, fontSize: 15, fontFamily: SE_FONT.sans },
    chips: { gap: 8, paddingRight: 16 },
    chipRow: { marginRight: -16 },
    chip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5, borderColor: t.hair },
    chipOn: { borderColor: t.ink, backgroundColor: t.ink },
    chipLabel: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansSemi },
    chipLabelOn: { color: t.bg },
    card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 18, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.hair },
    face: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden' },
    body: { flex: 1, minWidth: 0, gap: 4 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    name: { fontSize: 15, color: t.ink, fontFamily: SE_FONT.sansBold },
    tag: { fontSize: 11, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999, overflow: 'hidden', backgroundColor: t.sunk, color: t.soft, fontFamily: SE_FONT.sansBold },
    line: { fontSize: 13, color: t.soft, fontFamily: SE_FONT.sans },
    skills: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
    skillsLabel: { fontSize: 11, color: t.soft, fontFamily: SE_FONT.sansBold },
    offeringLabel: { color: t.kind.offer },
    skill: { fontSize: 12, paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999, overflow: 'hidden' },
    offering: { backgroundColor: t.kind.offer, color: t.card, fontFamily: SE_FONT.sansSemi },
    listed: { borderWidth: 1, borderColor: t.hair, color: t.ink, fontFamily: SE_FONT.sans },
    quote: { alignSelf: 'flex-start', marginTop: 4, minHeight: 38, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card, shadowColor: t.line, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 0, elevation: 2 },
    quoteLabel: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansSemi },
    meta: { fontSize: 14, color: t.soft, fontFamily: SE_FONT.sans },
    pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card },
    disabled: { opacity: 0.5 },
    buttonLabel: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sansBold },
    link: { color: t.ink, textDecorationLine: 'underline', fontFamily: SE_FONT.sansBold },
    faces: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10, paddingVertical: 8 },
    faceCell: { width: '20%', alignItems: 'center' },
    lockedFace: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden', opacity: 0.55 },
    lockedCard: { gap: 10, padding: 18, borderRadius: 20, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.line, shadowColor: t.line, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3 },
    lockedNumber: { fontSize: 40, lineHeight: 40, color: t.ink, fontFamily: SE_FONT.serif },
    lockedLabel: { fontSize: 15, color: t.ink, fontFamily: SE_FONT.sansBold },
    lockedText: { fontSize: 14, lineHeight: 21, color: t.soft, fontFamily: SE_FONT.sans },
    finish: { alignSelf: 'flex-start', minHeight: 46, justifyContent: 'center', paddingHorizontal: 20, borderRadius: 999, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.btn, shadowColor: t.line, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3 },
    finishLabel: { fontSize: 15, color: t.onBtn, fontFamily: SE_FONT.sansBold },
    openNow: { gap: 6, padding: 14, borderRadius: 18, backgroundColor: t.sunk },
    openTitle: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sansBold },
    backLink: { alignSelf: 'flex-start', fontSize: 14, color: t.ink, textDecorationLine: 'underline', fontFamily: SE_FONT.sansBold },
  });
}
