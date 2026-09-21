import { queryDb } from 'lib/db/postgres';

// How much of the skills catalog the Directory actually covers, sector by sector.
//
// The blog's invite posts argue from these figures — the catalog is the set of things a working
// economy of about five million people needs somebody to be able to do, and the interesting number
// is how many of them nobody on the list can do yet. Those figures were being copied forward from
// an older reading, because the person writing the posts works from a phone and the only way to
// refresh them was a query at a command line, which is not available to them.
//
// So they ride along with the invite queue: one screen, one copy control, and the figures are as
// current as the list of people is.
//
// Read-only. Counts only, no member data.

export type DirectorySectorCoverage = {
  sector: string;
  skillsInCatalog: number;
  skillsHeld: number;
  skillsWithNobody: number;
};

export type DirectorySkillCoverage = {
  readAt: string;
  listedPeople: number;
  skillsInCatalog: number;
  skillsHeld: number;
  skillsWithNobody: number;
  sectors: DirectorySectorCoverage[];
};

type CoverageDbRow = {
  sector: string | null;
  skills_in_catalog: string;
  skills_held: string;
};

type PeopleDbRow = { listed_people: string };

function count(value: string | null | undefined): number {
  const parsed = Number.parseInt(value ?? '0', 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getDirectorySkillCoverage(): Promise<DirectorySkillCoverage> {
  // Every id comparison is cast to text. On the cloned production database
  // directory_profile_skills.profile_id and skill_id are varchar columns while the taxonomy and
  // profile ids are uuids, and an untyped comparison fails with "operator does not exist:
  // uuid = character varying". Every other query in this folder casts for the same reason.
  const coverage = await queryDb<CoverageDbRow>(
    `
      WITH catalog AS (
        SELECT s.id::text AS skill_id, sec.name AS sector
        FROM skills_taxonomy_skills s
        JOIN skills_taxonomy_job_titles jt ON jt.id::text = s.job_title_id::text
        JOIN skills_taxonomy_sectors sec ON sec.id::text = jt.sector_id::text
        WHERE s.is_active AND jt.is_active AND sec.is_active
      ),
      held AS (
        SELECT DISTINCT ps.skill_id::text AS skill_id
        FROM directory_profile_skills ps
        JOIN directory_profiles p ON p.id::text = ps.profile_id::text
      )
      SELECT
        c.sector,
        count(*)::text AS skills_in_catalog,
        count(*) FILTER (WHERE h.skill_id IS NOT NULL)::text AS skills_held
      FROM catalog c
      LEFT JOIN held h ON h.skill_id = c.skill_id
      GROUP BY c.sector
      ORDER BY c.sector
    `,
  );

  const people = await queryDb<PeopleDbRow>(
    `
      SELECT count(*)::text AS listed_people
      FROM directory_profiles p
    `,
  );

  const sectors: DirectorySectorCoverage[] = coverage.rows.map((row) => {
    const inCatalog = count(row.skills_in_catalog);
    const held = count(row.skills_held);
    return {
      sector: row.sector ?? '(no sector)',
      skillsInCatalog: inCatalog,
      skillsHeld: held,
      skillsWithNobody: inCatalog - held,
    };
  });

  const skillsInCatalog = sectors.reduce((sum, row) => sum + row.skillsInCatalog, 0);
  const skillsHeld = sectors.reduce((sum, row) => sum + row.skillsHeld, 0);

  return {
    readAt: new Date().toISOString(),
    listedPeople: count(people.rows[0]?.listed_people),
    skillsInCatalog,
    skillsHeld,
    skillsWithNobody: skillsInCatalog - skillsHeld,
    sectors,
  };
}
