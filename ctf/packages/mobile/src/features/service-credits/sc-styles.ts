import { StyleSheet } from 'react-native';
import type { ThemeTokens } from '../../theme';

// Shared chrome for the ServiceCredits screen (header + bottom nav), themed through the flat token
// palette. Call from a component with `makeStyles(tokens, accent)` where `accent` comes from
// getAppAccent('service-credits', theme). The money/ledger direction swatches (+credit green,
// −debit red) are left raw per the token-pass status-palette rule; the tabs reference LEDGER for
// those.

// Money/ledger direction palette — semantic status swatches, left raw (not the danger/success chrome role).
export const LEDGER = {
  green: '#22C55E',
  red: '#EF4444',
} as const;

export function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg },

    // Header
    header: {
      padding: 14,
      paddingHorizontal: 20,
      backgroundColor: t.surfaceAlt,
      borderBottomWidth: 1,
      borderBottomColor: t.borderFaint,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: `${accent}30`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: { fontSize: 16, fontWeight: '800', color: t.textPrimary },
    headerSubtitle: { fontSize: 11, color: accent },
    balancePill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: `${accent}08`,
      borderWidth: 1,
      borderColor: `${accent}20`,
      alignItems: 'center',
    },
    balancePillValue: { fontSize: 14, fontWeight: '800', color: accent },
    balancePillLabel: { fontSize: 9, color: t.textSecondary },

    // Bottom nav
    bottomNav: {
      height: 72,
      backgroundColor: t.surfaceAlt,
      borderTopWidth: 1,
      borderTopColor: t.borderFaint,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingHorizontal: 8,
    },
    navBtn: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    navBtnIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navBtnIconActive: { backgroundColor: `${accent}20` },
    navBtnLabel: { fontSize: 10, fontWeight: '400', color: t.textSecondary },
    navBtnLabelActive: { fontWeight: '600', color: accent },

    // Content area
    content: { flex: 1, padding: 16 },
  });
}
