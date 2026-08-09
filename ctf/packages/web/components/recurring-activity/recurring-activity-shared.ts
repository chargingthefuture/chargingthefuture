// Shared constants, types, and helpers for the Recurring Activity web shell.
//
// A recurring activity is a member's self-declared, counterparty-confirmed ongoing tie with one
// other member (rent, an ongoing service, a standing favor). It is deliberately NOT a ledger and
// NOT a bill: no obligation language, no amounts for fiat, and only ServiceCredits carries a
// declared value. The UI stays calm and low-tax on purpose.

import { getAppAccent, type ThemeName } from '@/lib/theme/theme-tokens';
import { getPluginShellTokens, type PluginShellTokens } from '@/components/shared/plugin-shell-theme';
import type {
  RecurringActivityCadence,
  RecurringActivitySector,
  RecurringActivityStatus,
  RecurringActivityVisibility,
} from '@/lib/recurring-activity/types';

export type {
  RecurringActivityCadence,
  RecurringActivitySector,
  RecurringActivityStatus,
  RecurringActivityVisibility,
};

// Like the Contributions shell, we paint a solid surface + border on top of the shared plugin chrome
// so cards read faithfully in the default theme, and fall back to the comic surfaces in comic theme.
export type RecurringActivityTokens = PluginShellTokens & { SURFACE: string; BORDER_SOLID: string };

export function getRecurringActivityTokens(theme: ThemeName): RecurringActivityTokens {
  const accent = getAppAccent('recurring-activity', theme);
  if (theme === 'comic') {
    return { ...getPluginShellTokens(accent, theme), SURFACE: '#141414', BORDER_SOLID: '#D4C49A1A' };
  }
  return { ...getPluginShellTokens(accent, theme), SURFACE: '#161B27', BORDER_SOLID: '#1E2A3A' };
}

export const FONT_FAMILY = "'Inter', system-ui, sans-serif";

// Every mutation carries the same-origin CSRF confirmation header the server expects.
export const CSRF_HEADERS = { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' } as const;

// --- API + client shapes -----------------------------------------------------------------------

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
  // The app this was declared from, when the member used that app's inline control instead of the
  // form here. Null for a line created on this screen.
  originPlugin?: string | null;
}

export interface ActivitiesResponse {
  ok: boolean;
  activities?: Activity[];
  message?: string;
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

export interface CurrenciesResponse {
  ok: boolean;
  currencies?: Currency[];
}

// One member the caller can pick as the other party. Only claimed profiles (with a real user id)
// are offered, because a counterparty must resolve to an actual member.
export interface MemberOption {
  userId: string;
  name: string;
}

interface DirectoryListItem {
  id: string;
  firstName: string;
  lastName: string | null;
  claimedByUserId: string | null;
}

interface DirectoryListResponse {
  items?: DirectoryListItem[];
}

export function mapDirectoryToMembers(payload: DirectoryListResponse): MemberOption[] {
  return (payload.items ?? [])
    .filter((item): item is DirectoryListItem & { claimedByUserId: string } => Boolean(item.claimedByUserId))
    .map((item) => ({
      userId: item.claimedByUserId,
      name: [item.firstName, item.lastName].filter(Boolean).join(' ').trim() || 'A member',
    }));
}

// --- display labels ----------------------------------------------------------------------------

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

// Status wording stays calm and free of obligation. Never "overdue", never a warning.
export const STATUS_LABEL: Record<RecurringActivityStatus, string> = {
  pending: 'Waiting for confirmation',
  active: 'Ongoing',
  ended: 'Ended',
  declined: 'Declined',
};

// Status color: the accent for an ongoing tie, muted tones for everything else. No red, ever.
export function statusColor(status: RecurringActivityStatus, tokens: RecurringActivityTokens): string {
  if (status === 'active') {
    return tokens.ACCENT;
  }
  if (status === 'pending') {
    return '#93C5FD';
  }
  return tokens.MUTED;
}

// The one calm line shown after a member records an activity. Ties to the Community Value Index
// without any number, ranking, or gamified framing.
export const COMMUNITY_LINE = 'This is part of what the community builds together.';

// Display the currency by its label (never the bare code). ServiceCredits always reads as its label.
export function currencyLabel(code: string, currencies: Currency[]): string {
  const match = currencies.find((c) => c.code === code);
  return match ? match.label : code;
}

// For a ServiceCredits line, show "N ServiceCredits" from the declared value. Fiat lines carry no
// amount by design, so this returns null for them.
export function scValueLabel(activity: Activity, currencies: Currency[]): string | null {
  if (activity.scValue === null) {
    return null;
  }
  const match = currencies.find((c) => c.code === activity.currencyCode);
  if (!match?.isServiceCredits) {
    return null;
  }
  return `${activity.scValue.toLocaleString('en-US')} ${match.label}`;
}
