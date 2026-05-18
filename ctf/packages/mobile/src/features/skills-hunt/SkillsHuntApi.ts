// Skills Hunt mobile API client.
//
// Targets the same /api/skills-hunt/* endpoints as the web shell. Auth is
// handled by the platform wrapper (cookies on web, session token on native).

import { Platform } from 'react-native';

const API_BASE = Platform.OS === 'web' ? '/api/skills-hunt' : 'https://your-api-domain/api/skills-hunt';

export type Round = {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'active' | 'closed' | 'archived';
  startsAtIso: string;
  endsAtIso: string;
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
  displayName: string;
  bio: string;
  quoraProfileUrl: string;
  skills: string[];
  proposedSkills: string[];
  status: 'pending' | 'accepted' | 'rejected' | 'flagged';
  pointsAwarded: number;
  urlValidationResult: 'valid' | 'invalid' | 'dead' | null;
  createdAtIso: string;
};

export type Achievement = {
  id: string;
  code: string;
  title: string;
  description: string;
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
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'request failed' })) as { message?: string };
    throw new Error(err.message ?? `POST ${path} failed`);
  }
  return res.json() as Promise<T>;
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
  submitNomination: (
    roundId: string,
    body: {
      displayName: string;
      bio: string;
      quoraProfileUrl: string;
      skills: string[];
      proposedSkills: string[];
      claimedProfessions: string[];
    },
  ) => postJson<{ ok: true; submission: Submission }>(`/rounds/${roundId}/submissions`, body),
};
