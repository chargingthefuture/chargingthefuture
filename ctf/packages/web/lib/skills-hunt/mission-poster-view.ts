// The words on the shareable missions picture, worked out once and away from React.
//
// The picture exists because the Missions tab is taller than a phone screen. Getting a clean
// picture of it by hand means scrolling, taking several screenshots, and stitching them together —
// which loses cards at the seams and puts the app's own top bar, battery and clock in the middle of
// something meant to be posted in public. This builds the same list the tab shows, as plain rows,
// so the drawing step has nothing left to decide.
//
// Pure: no database, no request, no React. The numbers and the wording a reader sees are unit
// tested here rather than only by looking at a downloaded picture.

import type { SkillsHuntMission, SkillsHuntRound } from './types';

export type MissionPosterRow = {
  title: string;
  description: string | null;
  /** What the mission counts, in plain words — the sector or skill where it has one. */
  subject: string | null;
  /** "3 accepted nominations", already pluralized. */
  targetLine: string;
  /** "+3 pts" when the mission pays a bonus, null when it pays none. */
  bonusLine: string | null;
  accent: string;
};

export type MissionPosterView = {
  title: string;
  subtitle: string;
  roundLine: string;
  missions: MissionPosterRow[];
  /** Shown in place of the list when the round has no mission anyone can join. */
  emptyLine: string | null;
  joinLine: string;
};

const DEFAULT_MISSION_COLOR = '#FBBF24';

// The tab's own subtitle, word for word. The picture is an advertisement for the screen it was
// taken from, so it should not describe the missions differently than the screen does.
const SUBTITLE = 'Complete missions to earn bonus points and unlock badges';

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function goalSubject(mission: SkillsHuntMission): string | null {
  const metadata = mission.goalMetadata;
  const skill = metadata.skillName;
  if (mission.goalType === 'count_skill_matches' && typeof skill === 'string' && skill.trim()) {
    return skill.trim();
  }
  const sector = metadata.sectorName;
  if (mission.goalType === 'count_skills_in_sector' && typeof sector === 'string' && sector.trim()) {
    return sector.trim();
  }
  return null;
}

// What the mission asks for, said the way a reader who has never opened the app would read it.
// The goal type's own name ("count_rare_skill_finds") is an internal label and never appears.
function targetLine(mission: SkillsHuntMission): string {
  const target = mission.goalTarget;
  switch (mission.goalType) {
    case 'count_skills_in_sector': {
      const sector = goalSubject(mission);
      return sector
        ? `${plural(target, 'accepted nomination', 'accepted nominations')} with a ${sector} skill`
        : plural(target, 'accepted nomination', 'accepted nominations');
    }
    case 'count_skill_matches': {
      const skill = goalSubject(mission);
      return skill
        ? `${plural(target, 'accepted nomination', 'accepted nominations')} of someone with ${skill}`
        : plural(target, 'accepted nomination', 'accepted nominations');
    }
    case 'count_rare_skill_finds':
      return `${plural(target, 'accepted nomination', 'accepted nominations')} of a rare skill`;
    default:
      return plural(target, 'accepted nomination', 'accepted nominations');
  }
}

function dayOf(iso: string): string {
  const day = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : iso;
}

function roundLine(round: SkillsHuntRound): string {
  return `${round.name} · ${dayOf(round.startsAtIso)} to ${dayOf(round.endsAtIso)}`;
}

// No progress anywhere in the picture (deliberate). The Missions tab draws one member's own bar,
// and this picture is made to be posted in public: one person's counts are not an advertisement,
// and nobody outside the app can read a bar that belongs to a stranger. What travels is the
// mission itself — what it asks for and what it pays.
//
// Archived missions are left out, and so are locked ones: a reader who acts on this picture should
// find every mission in it waiting for them when they arrive.
export function buildMissionPosterView(
  round: SkillsHuntRound,
  missions: SkillsHuntMission[],
): MissionPosterView {
  const rows = missions
    .filter((mission) => mission.status === 'active')
    .map((mission) => ({
      title: mission.title,
      description: mission.description,
      subject: goalSubject(mission),
      targetLine: targetLine(mission),
      bonusLine: mission.bonusPoints > 0 ? `+${mission.bonusPoints} pts` : null,
      accent: mission.colorHex ?? DEFAULT_MISSION_COLOR,
    }));

  return {
    title: 'Active Missions',
    subtitle: SUBTITLE,
    roundLine: roundLine(round),
    missions: rows,
    emptyLine: rows.length === 0 ? 'This round has no open missions right now.' : null,
    joinLine: 'Join SkillsHunt at chargingthefuture.com — nominate people with the skills a sector is short of.',
  };
}
