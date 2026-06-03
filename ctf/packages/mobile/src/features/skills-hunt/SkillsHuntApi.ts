// Skills Hunt mobile API client.
//
// Targets the same /api/skills-hunt/* endpoints as the web shell. Auth is
// handled by the platform wrapper (cookies on web, session token on native).

import { Platform } from 'react-native';

// Native builds resolve the API origin from a runtime config key
// (process.env.EXPO_PUBLIC_API_ORIGIN — exposed via Expo's public-env
// convention; falls back to localhost for dev). Document the key in the
// mobile build configs alongside other EXPO_PUBLIC_* values.
function getApiOrigin(): string {
  const fromEnv = typeof process !== 'undefined' && process.env
    ? (process.env.EXPO_PUBLIC_API_ORIGIN ?? process.env.API_ORIGIN)
    : undefined;
  return fromEnv && fromEnv.length > 0 ? fromEnv.replace(/\/$/, '') : 'http://localhost:3000';
}

const API_BASE = Platform.OS === 'web' ? '/api/skills-hunt' : `${getApiOrigin()}/api/skills-hunt`;

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
  fullName: string;
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

export type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAtIso: string;
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
  listNotifications: () => getJson<{ notifications: Notification[] }>(`/notifications`),
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
