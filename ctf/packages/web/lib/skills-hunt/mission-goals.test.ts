import { describe, expect, it } from 'vitest';
import {
  computeProgressForMission,
  validateMissionCreateInput,
  validateMissionUpdateInput,
  type AcceptedSubmissionForMission,
  type MissionCreateInput,
} from './missions';
import type { SkillsHuntMission, SkillsHuntMissionGoalType } from './types';

function mission(
  goalType: SkillsHuntMissionGoalType,
  goalMetadata: Record<string, unknown> = {},
  goalTarget = 1,
): SkillsHuntMission {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    roundId: '22222222-2222-4222-8222-222222222222',
    title: 'Find a mechanic',
    description: null,
    goalType,
    goalTarget,
    goalMetadata,
    bonusPoints: 5,
    colorHex: null,
    status: 'active',
    displayOrder: 0,
    autoCreated: false,
    sourceSector: null,
    sourceGapAtCreation: null,
    createdByUserId: 'admin',
    updatedByUserId: 'admin',
    createdAtIso: '2026-09-17T00:00:00.000Z',
    updatedAtIso: '2026-09-17T00:00:00.000Z',
  };
}

function accepted(skills: string[], rareSkillBonus = 0): AcceptedSubmissionForMission {
  return { skills, rareSkillBonus, matchedSectors: new Set<string>() };
}

// The scout in the owner's report had 82 accepted nominations and no mechanic among them.
const EIGHTY_TWO_NOMINATIONS: AcceptedSubmissionForMission[] = [
  accepted(['Plumbing']),
  accepted(['Cleaning techniques and schedules']),
  ...Array.from({ length: 80 }, () => accepted(['Data entry'])),
];

describe('computeProgressForMission — count_skill_matches', () => {
  // The bug this goal type exists for: a mission named for one trade was stored as
  // count_total_accepted, so it counted every accepted nomination the scout had and read
  // "82/1 complete" for someone who had nominated no mechanic at all.
  it('counts nothing when no nomination carries the named skill', () => {
    const found = computeProgressForMission(
      mission('count_skill_matches', { skillName: 'Automotive repair' }),
      EIGHTY_TWO_NOMINATIONS,
    );
    expect(found).toBe(0);
  });

  it('counts only the nominations carrying the named skill', () => {
    const found = computeProgressForMission(
      mission('count_skill_matches', { skillName: 'Automotive repair' }),
      [...EIGHTY_TWO_NOMINATIONS, accepted(['Automotive repair']), accepted(['Automotive repair', 'Welding'])],
    );
    expect(found).toBe(2);
  });

  it('ignores case and surrounding spaces on both sides of the comparison', () => {
    const found = computeProgressForMission(
      mission('count_skill_matches', { skillName: '  automotive REPAIR ' }),
      [accepted(['Automotive Repair'])],
    );
    expect(found).toBe(1);
  });

  // A goal with no skill named can never be met, so it must not quietly read as progress.
  it('counts nothing when the mission names no skill', () => {
    expect(computeProgressForMission(mission('count_skill_matches', {}), EIGHTY_TWO_NOMINATIONS)).toBe(0);
  });
});

describe('computeProgressForMission — the other goals are unchanged', () => {
  it('count_total_accepted still counts every accepted nomination', () => {
    expect(computeProgressForMission(mission('count_total_accepted'), EIGHTY_TWO_NOMINATIONS)).toBe(82);
  });

  it('count_rare_skill_finds still counts only the rare-bonus nominations', () => {
    const found = computeProgressForMission(
      mission('count_rare_skill_finds'),
      [accepted(['Welding'], 10), accepted(['Data entry'], 0)],
    );
    expect(found).toBe(1);
  });
});

const CREATE_BASE: MissionCreateInput = {
  roundId: '22222222-2222-4222-8222-222222222222',
  title: 'Find a mechanic',
  goalType: 'count_skill_matches',
  goalTarget: 1,
  goalMetadata: { skillName: 'Automotive repair' },
};

describe('validateMissionCreateInput', () => {
  it('accepts a skill mission that names its skill', () => {
    expect(validateMissionCreateInput(CREATE_BASE)).toBeNull();
  });

  it('refuses a skill mission with no skill named', () => {
    expect(validateMissionCreateInput({ ...CREATE_BASE, goalMetadata: {} })).toContain('skillName required');
  });

  it('refuses a skill mission whose skill is only spaces', () => {
    expect(validateMissionCreateInput({ ...CREATE_BASE, goalMetadata: { skillName: '   ' } })).toContain('skillName required');
  });
});

describe('validateMissionUpdateInput', () => {
  const stored = mission('count_total_accepted');

  // The edit control's whole job: re-pointing a wrongly-typed mission. Sending the new goal type
  // without the skill would store a goal that counts nothing, which is the quiet version of the
  // same bug.
  it('refuses a switch to the named-skill goal that does not name the skill', () => {
    expect(validateMissionUpdateInput(stored, { goalType: 'count_skill_matches' })).toContain('skillName required');
  });

  it('accepts a switch that names the skill', () => {
    const problem = validateMissionUpdateInput(stored, {
      goalType: 'count_skill_matches',
      goalMetadata: { skillName: 'Automotive repair' },
    });
    expect(problem).toBeNull();
  });

  // Fields left out mean "leave alone", so a mission that already names its skill stays valid when
  // only the title is edited.
  it('accepts an edit that touches neither the goal type nor its metadata', () => {
    const skillMission = mission('count_skill_matches', { skillName: 'Automotive repair' });
    expect(validateMissionUpdateInput(skillMission, { title: 'Find an auto mechanic' })).toBeNull();
  });
});
