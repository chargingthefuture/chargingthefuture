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

// The teams and their sector mapping. The first ten are transcribed from the "Team model — who
// helps with what" table in issue #1465, using the LIVE taxonomy sector names: the table's "Trades"
// is the "Housing & Construction" sector and its "Energy" is "Energy & Utilities" (the shorthand
// names rendered as "not mapped" until corrected — owner-confirmed live names, 2026-07-17).
//
// PLAN FOR THE HARDEST CASE (owner direction, 2026-08-29). The original ten teams describe a gated
// community that still buys most of what it needs from outside: municipal water, the grid, schools,
// courts, shops, factories. That is the easy case. A community that has to run without any of that
// needs more capacity inside it, and a plan built for the harder case already covers the easier one
// — so the teams are scoped to a settlement that can stand on its own, and a simply gated community
// is then a subset, not a separate plan.
//
// Concretely, the first ten teams left NINE of the twenty live taxonomy sectors with no team at
// all: Water & Sanitation, Transport & Logistics, Telecommunications & IT, Education, Public Safety
// & Justice, Finance & Public Administration, Manufacturing & Industry, Mining / Extractive, and
// Tourism & Hospitality. Members whose only skills sit in those sectors were invisible to every
// roster, and the demand gaps for them were never counted. Two of the gaps contradicted the teams'
// own descriptions: Build & Infrastructure said it was responsible for "water" and "connectivity"
// while drawing from neither Water & Sanitation nor Telecommunications & IT, and Food & Agriculture
// claimed "kitchen/commons planning" while every Chef / Cook lives in Tourism & Hospitality.
//
// Three teams are added for capacities with no home at all (Water & Sanitation, Education &
// Childcare, Making & Repair) and six existing teams are widened. Every one of the twenty sectors is
// now drawn from by at least one team. Sectors deliberately appear in more than one team — the same
// way Housing & Construction always has, across Land & Site, Build & Infrastructure and Operations —
// because building a thing and running it afterwards are different jobs staffed from the same trade.
// Rosters de-duplicate members, so an overlap costs nothing.
export const COMMUNITY_PLANNING_TEAMS: CommunityPlanningTeamDefinition[] = [
  {
    key: 'legal-governance',
    name: 'Legal & Governance',
    sectors: ['Professional & Business Services', 'Public Safety & Justice'],
    responsibleFor:
      'Entity formation, membership and gating criteria, resident agreements, liability, and a dispute process the community can run itself rather than taking to an outside court',
  },
  {
    key: 'finance',
    name: 'Finance',
    sectors: [
      'Microfinance & SME Support',
      'Professional & Business Services',
      'Finance & Public Administration',
    ],
    responsibleFor:
      'Funding model, budget, land purchase financing, ongoing cost model, reserves, and the bookkeeping and buying that keep it running',
  },
  {
    key: 'land-site',
    name: 'Land & Site',
    sectors: ['Housing & Construction', 'Environmental & Waste Management', 'Mining / Extractive'],
    responsibleFor:
      'Site criteria, land search, zoning, water/soil/environmental checks, utilities feasibility, and what the ground itself can supply — water, stone, clay, aggregate',
  },
  {
    key: 'build-infrastructure',
    name: 'Build & Infrastructure',
    sectors: [
      'Housing & Construction',
      'Energy & Utilities',
      'Water & Sanitation',
      'Telecommunications & IT',
    ],
    responsibleFor:
      'Site plan, housing design, build order, roads, power, water, waste, connectivity',
  },
  {
    key: 'food-agriculture',
    name: 'Food & Agriculture',
    sectors: ['Food & Agriculture', 'Tourism & Hospitality'],
    responsibleFor:
      'Growing capacity, food storage, and the commons kitchen — cooking for numbers, not for one household',
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
    sectors: ['Emergency & Reserve Roles', 'Public Safety & Justice'],
    responsibleFor:
      'Gate and perimeter model, emergency plans, drills, incident process that respects member privacy',
  },
  {
    key: 'technology',
    name: 'Technology',
    sectors: ['R&D & High-Tech', 'Telecommunications & IT'],
    responsibleFor:
      'Connectivity that does not depend on one outside provider, community use of this platform on site, records, backups',
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
    sectors: ['Retail & Services', 'Housing & Construction', 'Transport & Logistics'],
    responsibleFor:
      'Move-in logistics, shared-resource scheduling, maintenance rosters, supply purchasing, and moving people and goods in and out',
  },
  // The three teams below are not in the issue #1465 table. They exist because a community that
  // cannot buy these from outside has to staff them itself, and nothing in the original ten drew
  // from their sectors at all.
  {
    key: 'water-sanitation',
    name: 'Water & Sanitation',
    sectors: ['Water & Sanitation'],
    responsibleFor:
      'Drinking water and wastewater once the taps exist: sources and wells, treatment, testing, distribution, repairs. Build & Infrastructure installs it; this team keeps it safe to drink',
  },
  {
    key: 'education-childcare',
    name: 'Education & Childcare',
    sectors: ['Education'],
    responsibleFor:
      'Teaching and childcare on site — school-age lessons, tutoring, childcare and after-school cover, and training adults into the skills the other teams are short of',
  },
  {
    key: 'making-repair',
    name: 'Making & Repair',
    sectors: ['Manufacturing & Industry', 'Mining / Extractive'],
    responsibleFor:
      'Making and mending what cannot be ordered in: fabrication, machining, spare parts, materials processing, and keeping equipment running past the point where a supplier would replace it',
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
