// The 3.1 Unlock screen's styles on Android, the copy of the web's unlock-screen.module.css.

import { StyleSheet } from 'react-native';
import type { SeThemeTokens } from '@ctf/shared';
import { SE_FONT } from '../fonts';

const card = { gap: 10, padding: 16, borderRadius: 20, borderWidth: 1.5 } as const;
const shadow = (color: string) => ({ shadowColor: color, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3 });
const pill = { minHeight: 46, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' } as const;

export function makeUnlockStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    stack: { gap: 16 },
    top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    back: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: t.hair, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 28, lineHeight: 31, color: t.ink, fontFamily: SE_FONT.serif },
    lead: { fontSize: 15, lineHeight: 22, color: t.soft, fontFamily: SE_FONT.sans },
    card: { ...card, backgroundColor: t.card, borderColor: t.line, ...shadow(t.line) },
    pickCard: { ...card, backgroundColor: t.pick, borderColor: t.onPick, ...shadow(t.onPick) },
    sunk: { gap: 10, padding: 14, borderRadius: 18, backgroundColor: t.sunk },
    dayRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    day: { fontSize: 12, letterSpacing: 1, color: t.onPick, fontFamily: SE_FONT.sansBold },
    track: { flex: 1, height: 8, borderRadius: 999, backgroundColor: t.pickField, borderWidth: 1.5, borderColor: t.onPick, overflow: 'hidden' },
    fill: { height: '100%', backgroundColor: t.onPick },
    cardTitle: { fontSize: 21, lineHeight: 25, color: t.ink, fontFamily: SE_FONT.serif },
    sectionTitle: { fontSize: 15, color: t.ink, fontFamily: SE_FONT.sansBold },
    text: { fontSize: 14, lineHeight: 21, color: t.ink, fontFamily: SE_FONT.sans },
    note: { fontSize: 13, lineHeight: 19, color: t.soft, fontFamily: SE_FONT.sans },
    small: { fontSize: 12, lineHeight: 17, color: t.ink, fontFamily: SE_FONT.sans },
    onPick: { color: t.onPick },
    label: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansBold },
    row: { flexDirection: 'row', gap: 8 },
    input: { flex: 1, minHeight: 46, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.bg, color: t.ink, fontSize: 14, fontFamily: SE_FONT.sans },
    pickInput: { borderColor: t.onPick, backgroundColor: t.pickField, color: t.onPick },
    field: { minHeight: 46, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.bg, color: t.ink, fontSize: 14, fontFamily: SE_FONT.sans },
    add: { ...pill, borderColor: t.line, backgroundColor: t.btn },
    pickAdd: { borderColor: t.onPick, backgroundColor: t.hero },
    addLabel: { fontSize: 14, color: t.onBtn, fontFamily: SE_FONT.sansBold },
    pickAddLabel: { color: t.onHero },
    primary: { ...pill, alignSelf: 'flex-start', borderColor: t.line, backgroundColor: t.btn },
    secondary: { minHeight: 40, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card, justifyContent: 'center', alignSelf: 'flex-start', ...shadow(t.line), shadowOffset: { width: 0, height: 2 } },
    secondaryLabel: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansSemi },
    busy: { opacity: 0.6 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    link: { color: t.ink, fontFamily: SE_FONT.sansBold, textDecorationLine: 'underline' },
    toggle: { minHeight: 32, justifyContent: 'center', alignSelf: 'flex-start' },
    toggleLabel: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansBold, textDecorationLine: 'underline' },
    banToggle: { minHeight: 32, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    banLabel: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sansBold },
    picture: { width: '100%', aspectRatio: 640 / 400, borderRadius: 12, borderWidth: 1.5, borderColor: t.hair, overflow: 'hidden' },
    stepHeading: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansBold },
    item: { flexDirection: 'row', gap: 6 },
    whyItem: { gap: 2 },
    whyTitle: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sansBold },
    error: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansBold },
  });
}

export type UnlockStyles = ReturnType<typeof makeUnlockStyles>;
