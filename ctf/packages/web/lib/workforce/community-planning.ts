import { fetchSectorDetailsForSectors, strongerReason, sortMembers } from './detail';
import type { WorkforceMatchedMember } from './types';

// ---------------------------------------------------------------------------
// Community planning team rosters
//
// A read-only overlay on the Workforce sector map that answers one real-world question from the
// living planning document in GitHub issue #1465 ("Survivor-built gated community — planning
// document"): given the teams that document defines, which Directory members would each team be
// drawn from?
//
// Each team is just a named union of Workforce sectors. The roster for a team is the de-duplicated
// set of members that already match any of the team's sectors under the existing Workforce 3-way
// rule (same sector, same job title, or a skill registered under an occupation in the sector). The
// gap number is the sum of the team's sectors' demand gaps.
//
// Nothing here is stored. Because it reads the live Workforce model, the rosters recompute on every
// load — as the Directory is updated and Workforce recalculates, the teams update with it, with no
// extra scheduled job. Member names are shown for the same reason the Workforce drilldowns show them
// (a sign-in-only, member-facing view of the Directory); this never leaves the app, so it never
// exposes members publicly the way a GitHub comment on this open-source repo would.
// ---------------------------------------------------------------------------

export const COMMUNITY_PLANNING_SOURCE_ISSUE =
  'https://github.com/chargingthefuture/chargingthefuture/issues/1465';

export type CommunityPlanningTeamDefinition = {
  key: string;
  name: string;
  // The Workforce sector names this team draws from. Matched case-insensitively against the live
  // Skills Taxonomy sector names; a name not present in the taxonomy is reported as a coverage gap
  // rather than silently dropped, so a taxonomy rename is visible instead of quietly emptying a team.
  sectors: string[];
  responsibleFor: string;
};

// The ten teams and their sector mapping, transcribed from the "Team model — who helps with what"
// table in issue #1465. "Trades" in that table is the Construction/Trades sector.
export const COMMUNITY_PLANNING_TEAMS: CommunityPlanningTeamDefinition[] = [
  {
    key: 'legal-governance',
    name: 'Legal & Governance',
    sectors: ['Professional & Business Services'],
    responsibleFor:
      'Entity formation, membership and gating criteria, resident agreements, liability, dispute process',
  },
  {
    key: 'finance',
    name: 'Finance',
    sectors: ['Microfinance & SME Support', 'Professional & Business Services'],
    responsibleFor:
      'Funding model, budget, land purchase financing, ongoing cost model, reserves',
  },
  {
    key: 'land-site',
    name: 'Land & Site',
    sectors: ['Construction/Trades', 'Environmental & Waste Management'],
    responsibleFor:
      'Site criteria, land search, zoning, water/soil/environmental checks, utilities feasibility',
  },
  {
    key: 'build-infrastructure',
    name: 'Build & Infrastructure',
    sectors: ['Construction/Trades', 'Energy'],
    responsibleFor:
      'Site plan, housing design, build order, roads, power, water, waste, connectivity',
  },
  {
    key: 'food-agriculture',
    name: 'Food & Agriculture',
    sectors: ['Food & Agriculture'],
    responsibleFor: 'Growing capacity, food storage, kitchen/commons planning',
  },
  {
    key: 'health-wellbeing',
    name: 'Health & Wellbeing',
    sectors: ['Health'],
    responsibleFor:
      'Care model, first aid capacity, mental-health support, quiet/recovery spaces',
  },
  {
    key: 'safety-security',
    name: 'Safety & Security',
    sectors: ['Emergency & Reserve Roles'],
    responsibleFor:
      'Gate and perimeter model, emergency plans, drills, incident process that respects member privacy',
  },
  {
    key: 'technology',
    name: 'Technology',
    sectors: ['R&D & High-Tech'],
    responsibleFor: 'Connectivity, community use of this platform on site, records, backups',
  },
  {
    key: 'communications-documentation',
    name: 'Communications & Documentation',
    sectors: ['Creative & Media'],
    responsibleFor:
      'The runbook itself: editing every team’s section into one coherent, reusable document',
  },
  {
    key: 'operations-maintenance',
    name: 'Operations & Maintenance',
    sectors: ['Retail & Services', 'Construction/Trades'],
    responsibleFor:
      'Move-in logistics, shared-resource scheduling, maintenance rosters, supply purchasing',
  },
];

export type CommunityPlanningTeamRoster = {
  key: string;
  name: string;
  responsibleFor: string;
  // Sectors requested by the team definition, and which of them actually resolved to a taxonomy
  // bucket. missingSectors is the difference — a sector the team wants that the taxonomy does not
  // currently carry (e.g. after a rename), surfaced so it can be recruited for or the mapping fixed.
  sectors: string[];
  matchedSectors: string[];
  missingSectors: string[];
  // Demand overlay, summed across the team's resolved sectors (the sectors within a team are
  // distinct, so there is no double counting inside a team).
  target: number;
  recruited: number;
  gap: number;
  memberCount: number;
  members: WorkforceMatchedMember[];
};

export type CommunityPlanningReport = {
  generatedAtIso: string;
  sourceIssue: string;
  teams: CommunityPlanningTeamRoster[];
};

// Merge the matched-member lists of a team's sectors into one de-duplicated roster keyed by
// profileId. A member matched through more than one of the team's sectors keeps the strongest match
// reason and the union of their matching occupations, skills, sectors, and job titles — so the roster
// shows the fullest picture of why they fit the team.
function mergeTeamMembers(memberLists: WorkforceMatchedMember[][]): WorkforceMatchedMember[] {
  const byProfile = new Map<string, WorkforceMatchedMember>();
  for (const list of memberLists) {
    for (const member of list) {
      const existing = byProfile.get(member.profileId);
      if (!existing) {
        byProfile.set(member.profileId, {
          ...member,
          skills: [...member.skills],
          sectors: [...member.sectors],
          jobTitles: [...member.jobTitles],
          matchingOccupations: [...member.matchingOccupations],
        });
        continue;
      }
      const seenOccupations = new Set(existing.matchingOccupations.map((o) => o.id));
      for (const occupation of member.matchingOccupations) {
        if (!seenOccupations.has(occupation.id)) {
          existing.matchingOccupations.push(occupation);
          seenOccupations.add(occupation.id);
        }
      }
      existing.matchReason = strongerReason(existing.matchReason, member.matchReason);
      existing.skills = Array.from(new Set([...existing.skills, ...member.skills]));
      existing.sectors = Array.from(new Set([...existing.sectors, ...member.sectors]));
      existing.jobTitles = Array.from(new Set([...existing.jobTitles, ...member.jobTitles]));
    }
  }
  return sortMembers(Array.from(byProfile.values()));
}

export async function fetchCommunityPlanningReport(): Promise<CommunityPlanningReport> {
  // Every sector referenced by any team, resolved in a single pass so the model and the Directory
  // profile set are loaded once for the whole report rather than once per sector per team.
  const allSectors = Array.from(
    new Set(COMMUNITY_PLANNING_TEAMS.flatMap((team) => team.sectors)),
  );
  const detailsBySector = await fetchSectorDetailsForSectors(allSectors);

  const teams: CommunityPlanningTeamRoster[] = COMMUNITY_PLANNING_TEAMS.map((team) => {
    const matchedSectors: string[] = [];
    const missingSectors: string[] = [];
    const memberLists: WorkforceMatchedMember[][] = [];
    let target = 0;
    let recruited = 0;
    let gap = 0;

    for (const sector of team.sectors) {
      const detail = detailsBySector.get(sector.toLowerCase());
      if (!detail) {
        missingSectors.push(sector);
        continue;
      }
      matchedSectors.push(sector);
      target += detail.target;
      recruited += detail.recruited;
      gap += detail.gap;
      memberLists.push(detail.matchedMembers);
    }

    const members = mergeTeamMembers(memberLists);
    return {
      key: team.key,
      name: team.name,
      responsibleFor: team.responsibleFor,
      sectors: team.sectors,
      matchedSectors,
      missingSectors,
      target,
      recruited,
      gap,
      memberCount: members.length,
      members,
    };
  });

  return {
    generatedAtIso: new Date().toISOString(),
    sourceIssue: COMMUNITY_PLANNING_SOURCE_ISSUE,
    teams,
  };
}
