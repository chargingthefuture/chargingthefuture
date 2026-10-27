// Shared constants, types, and helpers for the Contributions web shell.
// Palette derives from the design/.../survivor-hub/Contributions* mockups.

import { getAppAccent, type ThemeName } from '@/lib/theme/theme-tokens';
import { getPluginShellTokens, type PluginShellTokens } from '@/components/shared/plugin-shell-theme';
import type { ContributionKind, ContributionStatus, ContributionSubmission } from '@/lib/contributions/types';

// The Contributions mockups paint a solid surface (#161B27) and a solid border (#1E2A3A) for
// cards. We carry both as extra tokens on top of the shared plugin-shell chrome so the default
// theme renders faithful to the mockup, and the comic theme uses the comic surface tokens.
export type ContributionsTokens = PluginShellTokens & { SURFACE: string; BORDER_SOLID: string };

// The shell accent is coral #FB7185 — distinct from ClickLog's pink and Beacon's deep red.
export const ACCENT_DEFAULT = '#FB7185';

export function getContributionsTokens(theme: ThemeName): ContributionsTokens {
  if (theme === 'comic') {
    const accent = getAppAccent('contributions', 'comic');
    return { ...getPluginShellTokens(accent, theme), SURFACE: '#141414', BORDER_SOLID: '#D4C49A1A' };
  }
  return { ...getPluginShellTokens(ACCENT_DEFAULT, theme), SURFACE: '#161B27', BORDER_SOLID: '#1E2A3A' };
}

export const FONT_FAMILY = "'Inter', system-ui, sans-serif";

export const STATUS_OK = '#22C55E';
export const STATUS_PENDING = '#F59E0B';

// --- API response shapes -----------------------------------------------------------------------

export type SubmissionsResponse = {
  ok: boolean;
  submissions: ContributionSubmission[];
  // Whether gift cards are being taken (the encryption key is set), the amount range, and the
  // thank-you rate, so the form copy always matches the settings.
  open: boolean;
  minUsd: number;
  maxUsd: number;
  creditsPerUsd: number;
};

export type SubmissionCreateResponse = {
  ok: boolean;
  submission?: ContributionSubmission;
  code?: string;
  message?: string;
};

// --- display helpers ---------------------------------------------------------------------------

export function statusColor(status: ContributionStatus, tokens: ContributionsTokens): string {
  if (status === 'confirmed') {
    return STATUS_OK;
  }
  if (status === 'pending') {
    return STATUS_PENDING;
  }
  return tokens.MUTED;
}

export function statusLabel(status: ContributionStatus): string {
  if (status === 'confirmed') {
    return 'Confirmed';
  }
  if (status === 'pending') {
    return 'Waiting for review';
  }
  return 'Not matched';
}

const KIND_BASE_LABEL: Record<ContributionKind, string> = {
  gift_card: 'Gift card',
  quora_comment: 'Quora comment',
  github_star: 'GitHub star',
};

const METHOD_LABEL: Record<string, string> = {
  amazon: 'Amazon',
  apple: 'Apple',
  dennys: "Denny's",
};

// Member-facing label for a submission, e.g. "Gift card (Amazon $25)".
export function submissionLabel(submission: ContributionSubmission): string {
  if (submission.kind === 'gift_card') {
    const method = submission.method ? METHOD_LABEL[submission.method] ?? submission.method : null;
    const amount = submission.claimedAmountUsd != null ? `$${submission.claimedAmountUsd.toLocaleString()}` : null;
    const detail = [method, amount].filter(Boolean).join(' ');
    return detail ? `Gift card (${detail})` : 'Gift card';
  }
  return KIND_BASE_LABEL[submission.kind];
}

// Short "May 12" style date for the history list.
export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
