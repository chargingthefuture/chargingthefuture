import { StyleSheet } from 'react-native';

export const COLOR = '#F59E0B';

export const colors = {
  bg: '#0F1117',
  surface: '#161B27',
  card: '#090B0F',
  border: 'rgba(255,255,255,0.06)',
  text: '#F9FAFB',
  textMuted: '#E8EAF0',
  textSubtle: '#9CA3AF',
  textDim: '#6B7280',
  green: '#22C55E',
  red: '#EF4444',
  purple: '#A855F7',
  accent: COLOR,
};

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  // Header
  header: {
    padding: 14,
    paddingHorizontal: 20,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: `${COLOR}30`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  headerSubtitle: { fontSize: 11, color: COLOR },
  balancePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: `${COLOR}08`,
    borderWidth: 1,
    borderColor: `${COLOR}20`,
    alignItems: 'center',
  },
  balancePillValue: { fontSize: 14, fontWeight: '800', color: COLOR },
  balancePillLabel: { fontSize: 9, color: colors.textDim },

  // Bottom nav
  bottomNav: {
    height: 72,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
  navBtnIconActive: { backgroundColor: `${COLOR}20` },
  navBtnLabel: { fontSize: 10, fontWeight: '400', color: colors.textDim },
  navBtnLabelActive: { fontWeight: '600', color: COLOR },

  // Content area
  content: { flex: 1, padding: 16 },
});
