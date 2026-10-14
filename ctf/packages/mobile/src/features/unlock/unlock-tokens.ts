// Colors, status labels and benefit lines for the Unlock screen, copied from the web's
// components/unlock/unlock-shared.ts and the plugin shell tokens it builds on
// (components/shared/plugin-shell-theme.ts).

import { CheckCircle, Clock, XCircle, type LucideIcon } from 'lucide-react-native';
import { getAppAccent, type ThemeTokens } from '../../theme';

export const UNLOCK_BRAND = '#D946EF';

export type UnlockTokens = {
  ACCENT: string;
  BG: string;
  HEADER: string;
  TITLE: string;
  SUBTLE: string;
  MUTED: string;
  FAINT: string;
  BORDER: string;
  INPUT_BG: string;
  SURFACE: string;
  BORDER_SOLID: string;
  SURFACE_CARD: string;
};

export function getUnlockTokens(t: ThemeTokens): UnlockTokens {
  if (t.isComic) {
    return {
      ACCENT: getAppAccent('unlock', 'comic'),
      BG: '#0D0D0D',
      HEADER: '#080808',
      TITLE: '#EDE3CB',
      SUBTLE: '#7A6A50',
      MUTED: '#7A6A50',
      FAINT: '#4A3A2A',
      BORDER: '#D4C49A1A',
      INPUT_BG: '#141414',
      SURFACE: '#141414',
      BORDER_SOLID: '#D4C49A1A',
      SURFACE_CARD: '#141414',
    };
  }
  return {
    ACCENT: UNLOCK_BRAND,
    BG: '#0F1117',
    HEADER: '#0D0F14',
    TITLE: '#D5D9E2',
    SUBTLE: '#9CA3AF',
    MUTED: '#6B7280',
    FAINT: '#4B5563',
    BORDER: 'rgba(255,255,255,0.06)',
    INPUT_BG: 'rgba(255,255,255,0.04)',
    SURFACE: '#161B27',
    BORDER_SOLID: '#1E2A3A',
    SURFACE_CARD: '#161B27',
  };
}

export type DisplayStatus = 'pending' | 'approved' | 'rejected';

export const STATUS_CONFIG: Record<DisplayStatus, { icon: LucideIcon; color: string; bg: string; label: string }> = {
  pending: { icon: Clock, color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', label: 'Pending Review' },
  approved: { icon: CheckCircle, color: UNLOCK_BRAND, bg: 'rgba(16,185,129,0.08)', label: 'Approved' },
  rejected: { icon: XCircle, color: '#EF4444', bg: 'rgba(239,68,68,0.08)', label: 'Rejected' },
};

// `spam` and `duplicate` show the same way as `rejected`, as on the web. Typed as a string because
// the server can send `duplicate`, which the app's review-status type does not list.
export function toDisplayStatus(reviewStatus: string | null): DisplayStatus {
  if (reviewStatus === 'approved') return 'approved';
  if (reviewStatus === 'rejected' || reviewStatus === 'spam' || reviewStatus === 'duplicate') return 'rejected';
  return 'pending';
}

export const UNLOCK_BENEFITS = [
  'A real community of survivors — and growing',
  'Find safe housing',
  'Get help with rides and transportation',
  'Find work and ways to earn',
  'Build skills with people who get it',
  'Ask for anything you need, anytime',
];
