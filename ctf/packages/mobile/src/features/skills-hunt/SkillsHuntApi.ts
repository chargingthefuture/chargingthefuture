// SkillsHunt mobile API client.
//
// Targets the same /api/skills-hunt/* endpoints as the web shell. All calls go
// through authedFetch so the Clerk bearer token is attached and the base URL
// comes from runtime config (APP_URL) — same pattern as socket-relay/currency.

import { authedFetchJson } from '../../auth/authedFetch';

// The canonical skills taxonomy lives under a different API base than the rest of
// SkillsHunt, so its read is called with an absolute path rather than getJson.
const TAXONOMY_FLATTENED_PATH = '/api/skills-taxonomy/flattened';

const API_BASE = '/api/skills-hunt';

export type Round = {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'active' | 'closed' | 'archived';
  startsAtIso: string;
  endsAtIso: string;
  // Whole ServiceCredits paid to the scout when a nomination is accepted (0 = no reward). Optional
  // because scout-facing round payloads may omit it; default to 0 when reading.
  rewardCreditsPerAccept?: number;
  // Optional ceiling on total reward credits one scout can earn in this round (null = no cap).
  rewardPerUserRoundCap?: number | null;
};

export type LeaderboardItem = {
  rank: number;
  score: number;
  acceptedCount: number;
  firstMatchCount: number;
  pendingPoints: number;
  rareSkillBonus: number;
  userId: string | null;
  usernameSnapshot: string | null;
  teamKey: string | null;
  lastSubmissionAtIso: string | null;
};

export type Submission = {
  id: string;
  roundId: string;
  fullName: string;
  bio: string;
  quoraProfileUrl: string;
  skills: string[];
  proposedSkills: string[];
  status: 'pending' | 'accepted' | 'rejected' | 'flagged';
  pointsAwarded: number;
  urlValidationResult: 'valid' | 'invalid' | 'dead' | null;
  createdAtIso: string;
  // Reward payout for this accepted nomination (admin view): whether the scout was paid, how many
  // ServiceCredits, and when. Optional because the scout-facing list omits them.
  creditGranted?: boolean;
  creditAmount?: number;
  creditGrantedAtIso?: string | null;
};

export type Achievement = {
  id: string;
  code: string;
  title: string;
  description: string;
};

export type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAtIso: string;
};

// One row from GET /api/skills-taxonomy/flattened. The scout picker only needs the
// sector and skill names to group skills by sector.
export type TaxonomyFlattenedItem = {
  sectorName: string;
  skillName: string;
};

export type MissionWithProgress = {
  id: string;
  roundId: string;
  title: string;
  description: string | null;
  goalType: string;
  goalTarget: number;
  bonusPoints: number;
  colorHex: string | null;
  status: 'draft' | 'active' | 'locked' | 'archived';
  progress: { progressCount: number; completedAtIso: string | null } | null;
};

async function getJson<T>(path: string): Promise<T> {
  return authedFetchJson<T>(`${API_BASE}${path}`);
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  return authedFetchJson<T>(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
    body: JSON.stringify(body),
  });
}

export const SkillsHuntApi = {
  listActiveRounds: () => getJson<{ rounds: Round[] }>(`/rounds?status=active`),
  listLeaderboard: (roundId: string, mode: 'individual' | 'team' = 'individual') =>
    getJson<{ items: LeaderboardItem[]; currentUserEntry: LeaderboardItem | null }>(
      `/rounds/${roundId}/leaderboard?mode=${mode}`,
    ),
  listAchievements: () => getJson<{ achievements: Achievement[] }>(`/achievements`),
  listMyFinds: (roundId: string) =>
    getJson<{ items: Submission[] }>(`/rounds/${roundId}/submissions`),
  listMissions: (roundId: string) =>
    getJson<{ items: MissionWithProgress[] }>(`/rounds/${roundId}/missions`),
  listNotifications: () => getJson<{ notifications: Notification[] }>(`/notifications`),
  listTaxonomyFlattened: () =>
    authedFetchJson<{ items: TaxonomyFlattenedItem[]; generatedAt: string }>(TAXONOMY_FLATTENED_PATH),
  markNotificationRead: (notificationId: string) =>
    postJson<{ ok: true }>(`/notifications/${notificationId}/read`, {}),
  submitNomination: (
    roundId: string,
    body: {
      fullName: string;
      bio: string;
      quoraProfileUrl: string;
      skills: string[];
      proposedSkills: string[];
      claimedProfessions: string[];
    },
  ) => postJson<{ ok: true; submission: Submission }>(`/rounds/${roundId}/submissions`, body),
};
