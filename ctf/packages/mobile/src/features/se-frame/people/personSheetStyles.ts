// People's profile and quote sheets on Android, the copy of the web's person-sheet.module.css, from
// the 3.1 theme tokens.

import { StyleSheet } from 'react-native';
import type { SeThemeTokens } from '@ctf/shared';
import { SE_FONT } from '../fonts';

export type PersonSheetStyles = ReturnType<typeof makePersonSheetStyles>;

const pill = { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5 } as const;
const chip = { fontSize: 12, paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999, overflow: 'hidden' } as const;
const box = { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16 } as const;

export function makePersonSheetStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: { flex: 1, backgroundColor: t.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderTopWidth: 1.5, borderColor: t.line },
    content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24, gap: 14 },
    grip: { alignSelf: 'center', width: 44, height: 5, borderRadius: 999, backgroundColor: t.hair },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    kicker: { fontSize: 13, color: t.soft, fontFamily: SE_FONT.sansBold },
    round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: t.hair, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' },
    identity: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
    face: { width: 64, height: 64, borderRadius: 32, overflow: 'hidden' },
    who: { flex: 1, minWidth: 0, gap: 4 },
    nameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
    name: { fontSize: 24, lineHeight: 28, color: t.ink, fontFamily: SE_FONT.serif },
    tag: { fontSize: 11, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999, overflow: 'hidden', backgroundColor: t.sunk, color: t.soft, fontFamily: SE_FONT.sansBold },
    headline: { fontSize: 15, lineHeight: 21, color: t.ink, fontFamily: SE_FONT.sans },
    origin: { fontSize: 13, color: t.kind.offer, fontFamily: SE_FONT.sansBold },
    soft: { fontSize: 13, lineHeight: 19, color: t.soft, fontFamily: SE_FONT.sans },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
    primary: { ...pill, alignSelf: 'flex-start', borderColor: t.line, backgroundColor: t.btn, shadowColor: t.line, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 0, elevation: 2 },
    primaryLabel: { fontSize: 13, color: t.onBtn, fontFamily: SE_FONT.sansSemi },
    disabled: { opacity: 0.5 },
    pill: { ...pill, borderColor: t.line, backgroundColor: t.card, shadowColor: t.line, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 0, elevation: 2 },
    pillLabel: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansSemi },
    section: { gap: 8 },
    label: { fontSize: 11, letterSpacing: 0.66, textTransform: 'uppercase', color: t.soft, fontFamily: SE_FONT.sansBold },
    bio: { fontSize: 14, lineHeight: 22, color: t.ink, fontFamily: SE_FONT.sans },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: { ...chip, borderWidth: 1, borderColor: t.hair, color: t.ink, fontFamily: SE_FONT.sans },
    offer: { ...chip, backgroundColor: t.kind.offer, color: t.card, fontFamily: SE_FONT.sansSemi },
    pending: { ...chip, borderWidth: 1, borderStyle: 'dashed', borderColor: t.hair, color: t.soft, fontFamily: SE_FONT.sans },
    note: { ...box, backgroundColor: t.sunk },
    noteText: { fontSize: 13, lineHeight: 19, color: t.soft, fontFamily: SE_FONT.sans },
    strong: { color: t.ink, fontFamily: SE_FONT.sansBold },
    done: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sansSemi },
    link: { color: t.ink, textDecorationLine: 'underline', fontFamily: SE_FONT.sansBold },
  });
}
