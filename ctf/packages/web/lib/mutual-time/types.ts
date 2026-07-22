import type { MutualTimeMeetingPlugin } from './constants';

export type MutualTimeStatus = 'open' | 'closed';

// The effective, time-aware state a viewer sees. Distinct from the stored `status`: an event whose
// opens_at is in the future is 'scheduled' (not yet votable) even though it is stored as 'open'.
export type MutualTimeEffectiveState = 'scheduled' | 'open' | 'closed';

// Full event as the admin dashboard sees it (their own events).
export type MutualTimeEvent = {
  id: string;
  slug: string;
  title: string | null;
  description: string | null;
  meetingPlugin: MutualTimeMeetingPlugin;
  windowStartDate: string; // YYYY-MM-DD (UTC)
  windowDays: number;
  opensAtIso: string | null;
  closesAtIso: string | null;
  status: MutualTimeStatus;
  effectiveState: MutualTimeEffectiveState;
  voterCount: number;
  resultSlotStartIso: string | null;
  resultCanMakeIt: number | null;
  createdAtIso: string;
  closedAtIso: string | null;
};

// Public read of an event (title/description/status/result). Never exposes who voted or their picks.
export type MutualTimePublicEvent = {
  slug: string;
  title: string | null;
  description: string | null;
  meetingPlugin: MutualTimeMeetingPlugin;
  meetingPluginName: string;
  meetingPluginRoute: string;
  windowStartDate: string;
  windowDays: number;
  opensAtIso: string | null;
  closesAtIso: string | null;
  effectiveState: MutualTimeEffectiveState;
  candidateSlots: string[]; // ISO UTC starts, for the vote grid
  voterCount: number;
  resultSlotStartIso: string | null;
  resultCanMakeIt: number | null;
};

// What one member's vote-state adds on top of the public event when they load the page.
export type MutualTimeViewerState = {
  canVote: boolean; // signed in AND unlock-approved
  picks: string[]; // this viewer's current picks (ISO UTC starts)
};

export type MutualTimeAuditEvent = {
  pluginId: 'mutual-time';
  command:
    | 'mutual-time.event.create'
    | 'mutual-time.event.close'
    | 'mutual-time.vote.save';
  actorId: string;
  status: 'allow' | 'deny';
  reason: string;
  // The policy evidence string from the access-policy/audit contract (e.g. 'role=admin',
  // 'role=admin;owner=true', 'unlockTier=approved_full'). Included in the emitted policyDecision.
  evidence?: string;
  target: Record<string, string | null | undefined>;
  result: 'success' | 'failure';
  errorCategory: string | null;
};
