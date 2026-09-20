import { describe, expect, it } from 'vitest';
import { ImageResponse } from 'next/og';
import { buildMissionPosterView } from './mission-poster-view';
import {
  MISSION_POSTER_WIDTH,
  buildMissionPosterElement,
  estimateMissionPosterHeight,
} from './mission-poster-image';
import type { SkillsHuntMission, SkillsHuntRound } from './types';

// The picture is drawn by satori, which takes only a subset of CSS and fails loudly on the rest.
// Nothing else in this repo renders that way, so this test actually produces the PNG rather than
// inspecting the element tree: a style the renderer cannot take goes red here instead of returning
// a broken download to an admin.

const round: SkillsHuntRound = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Autumn round',
  description: null,
  status: 'active',
  startsAtIso: '2026-09-01T00:00:00.000Z',
  endsAtIso: '2026-09-30T23:59:59.000Z',
  scoringConfig: {},
  rewardCreditsPerAccept: 0,
  rewardPerUserRoundCap: null,
  createdByUserId: 'user_admin',
  updatedByUserId: 'user_admin',
  createdAtIso: '2026-08-31T00:00:00.000Z',
  updatedAtIso: '2026-08-31T00:00:00.000Z',
};

function mission(overrides: Partial<SkillsHuntMission>): SkillsHuntMission {
  return {
    id: 'm1',
    roundId: round.id,
    title: 'Scout the Health sector',
    description:
      'Workforce shows the community is short about 695,041 people in Health. Nominate people with Health skills.',
    goalType: 'count_skills_in_sector',
    goalTarget: 3,
    goalMetadata: { sectorId: 'health', sectorName: 'Health' },
    bonusPoints: 3,
    colorHex: '#FBBF24',
    status: 'active',
    displayOrder: 0,
    autoCreated: true,
    sourceSector: 'Health',
    sourceGapAtCreation: 695041,
    createdByUserId: 'user_admin',
    updatedByUserId: 'user_admin',
    createdAtIso: '2026-09-01T00:00:00.000Z',
    updatedAtIso: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildMissionPosterView', () => {
  it('names the sector or skill a mission counts, in plain words', () => {
    const view = buildMissionPosterView(round, [
      mission({}),
      mission({ id: 'm2', goalType: 'count_skill_matches', goalTarget: 1, goalMetadata: { skillName: 'Welding' } }),
      mission({ id: 'm3', goalType: 'count_rare_skill_finds', goalTarget: 2, goalMetadata: {} }),
      mission({ id: 'm4', goalType: 'count_total_accepted', goalTarget: 1, goalMetadata: {} }),
    ]);

    expect(view.missions.map((row) => row.targetLine)).toEqual([
      '3 accepted nominations with a Health skill',
      '1 accepted nomination of someone with Welding',
      '2 accepted nominations of a rare skill',
      '1 accepted nomination',
    ]);
  });

  it('carries the round name and its dates', () => {
    const view = buildMissionPosterView(round, [mission({})]);
    expect(view.roundLine).toBe('Autumn round · 2026-09-01 to 2026-09-30');
  });

  it('leaves out archived and locked missions, so every mission shown is one a reader can join', () => {
    const view = buildMissionPosterView(round, [
      mission({ id: 'm1', status: 'archived' }),
      mission({ id: 'm2', status: 'locked' }),
      mission({ id: 'm3', title: 'Open one', status: 'active' }),
    ]);
    expect(view.missions.map((row) => row.title)).toEqual(['Open one']);
    expect(view.emptyLine).toBeNull();
  });

  it('says so when the round has nothing open', () => {
    const view = buildMissionPosterView(round, [mission({ status: 'archived' })]);
    expect(view.missions).toHaveLength(0);
    expect(view.emptyLine).toBe('This round has no open missions right now.');
  });

  it('omits the bonus line when a mission pays no points', () => {
    const view = buildMissionPosterView(round, [mission({ bonusPoints: 0 })]);
    expect(view.missions[0].bonusLine).toBeNull();
  });
});

describe('estimateMissionPosterHeight', () => {
  it('grows with the number of missions', () => {
    const one = buildMissionPosterView(round, [mission({})]);
    const three = buildMissionPosterView(round, [mission({ id: 'a' }), mission({ id: 'b' }), mission({ id: 'c' })]);
    expect(estimateMissionPosterHeight(three)).toBeGreaterThan(estimateMissionPosterHeight(one));
  });

  it('leaves room for a long title and a long description', () => {
    const short = buildMissionPosterView(round, [mission({ description: null, title: 'Short' })]);
    const long = buildMissionPosterView(round, [
      mission({ title: 'A mission title long enough to wrap onto more than one line in the picture', description: 'x'.repeat(400) }),
    ]);
    expect(estimateMissionPosterHeight(long)).toBeGreaterThan(estimateMissionPosterHeight(short));
  });
});

describe('buildMissionPosterElement', () => {
  it('renders to a PNG satori accepts', async () => {
    const view = buildMissionPosterView(round, [
      mission({}),
      mission({ id: 'm2', title: 'Find a mechanic', goalType: 'count_skill_matches', goalMetadata: { skillName: 'Mechanic' }, bonusPoints: 0, colorHex: null }),
    ]);

    const response = new ImageResponse(buildMissionPosterElement(view, '2026-09-20'), {
      width: MISSION_POSTER_WIDTH,
      height: estimateMissionPosterHeight(view),
    });

    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(bytes.length).toBeGreaterThan(1000);
    // PNG magic number — proves a real image came back, not an error page.
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  }, 30000);
});
