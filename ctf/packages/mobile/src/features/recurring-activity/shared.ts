// Types, labels and colors for Recurring Activity, copied from the web's
// components/recurring-activity/recurring-activity-shared.ts and lib/recurring-activity/types.ts.
//
// A recurring activity is a member's self-declared, counterparty-confirmed ongoing tie with one
// other member. It is recognition, never a bill: only ServiceCredits carries a declared value.

import { getAppAccent, type ThemeTokens } from '../../theme';

export type RecurringActivitySector = 'housing' | 'service' | 'favor' | 'general';
export type RecurringActivityCadence = 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
export type RecurringActivityStatus = 'pending' | 'active' | 'ended' | 'declined';
export type RecurringActivityVisibility = 'private' | 'restricted' | 'public';

export type RecurringActivityTokens = {
  ACCENT: string;
  BG: string;
  TEXT: string;
  TITLE: string;
  SUBTLE: string;
  MUTED: string;
  BORDER: string;
  BORDER_STRONG: string;
  INPUT_BG: string;
  SURFACE: string;
  BORDER_SOLID: string;
};

// The web's plugin shell tokens with the Recurring Activity accent and solid card surface.
export function getRecurringActivityTokens(t: ThemeTokens): RecurringActivityTokens {
  if (t.isComic) {
    return {
      ACCENT: getAppAccent('recurring-activity', 'comic'),
      BG: '#0D0D0D',
      TEXT: '#EDE3CB',
      TITLE: '#EDE3CB',
      SUBTLE: '#7A6A50',
      MUTED: '#7A6A50',
      BORDER: '#D4C49A1A',
      BORDER_STRONG: '#D4C49A2E',
      INPUT_BG: '#141414',
      SURFACE: '#141414',
      BORDER_SOLID: '#D4C49A1A',
    };
  }
  return {
    ACCENT: getAppAccent('recurring-activity', 'default'),
    BG: '#0F1117',
    TEXT: '#D5D9E2',
    TITLE: '#D5D9E2',
    SUBTLE: '#9CA3AF',
    MUTED: '#6B7280',
    BORDER: 'rgba(255,255,255,0.06)',
    BORDER_STRONG: 'rgba(255,255,255,0.08)',
    INPUT_BG: 'rgba(255,255,255,0.04)',
    SURFACE: '#161B27',
    BORDER_SOLID: '#1E2A3A',
  };
}

// The web comic theme squares every corner.
export function rr(t: ThemeTokens, value: number): number {
  return t.isComic ? 0 : value;
}

export interface Activity {
  id: string;
  ownerUserId: string;
  counterpartyUserId: string;
  sector: RecurringActivitySector;
  currencyCode: string;
  cadence: RecurringActivityCadence;
  scValue: number | null;
  status: RecurringActivityStatus;
  visibility: RecurringActivityVisibility;
  confirmedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  role: 'owner' | 'counterparty';
  counterpartyName: string | null;
  originPlugin?: string | null;
}

export interface Currency {
  code: string;
  label: string;
  kind: string;
  isServiceCredits: boolean;
  symbol: string | null;
  decimalPlaces: number;
  requiresAmount: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface MemberOption {
  userId: string;
  name: string;
}

export type ActionKind = 'confirm' | 'decline' | 'end' | 'visibility';

export const SECTOR_LABEL: Record<RecurringActivitySector, string> = {
  housing: 'Housing',
  service: 'Service',
  favor: 'Favor',
  general: 'General',
};

export const CADENCE_LABEL: Record<RecurringActivityCadence, string> = {
  weekly: 'Weekly',
  biweekly: 'Every two weeks',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
};

export const VISIBILITY_LABEL: Record<RecurringActivityVisibility, string> = {
  private: 'Private',
  restricted: 'Members only',
  public: 'Public',
};

export const STATUS_LABEL: Record<RecurringActivityStatus, string> = {
  pending: 'Waiting for confirmation',
  active: 'Ongoing',
  ended: 'Ended',
  declined: 'Declined',
};

export function statusColor(status: RecurringActivityStatus, tokens: RecurringActivityTokens): string {
  if (status === 'active') return tokens.ACCENT;
  if (status === 'pending') return '#93C5FD';
  return tokens.MUTED;
}

export const COMMUNITY_LINE = 'This is part of what the community builds together.';

export function currencyLabel(code: string, currencies: Currency[]): string {
  const match = currencies.find((c) => c.code === code);
  return match ? match.label : code;
}

export function scValueLabel(activity: Activity, currencies: Currency[]): string | null {
  if (activity.scValue === null) return null;
  const match = currencies.find((c) => c.code === activity.currencyCode);
  if (!match?.isServiceCredits) return null;
  return `${activity.scValue.toLocaleString('en-US')} ${match.label}`;
}
