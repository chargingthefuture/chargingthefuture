import { SE_PEOPLE_CATEGORY_SECTORS, type SePeopleCategory, type SePeoplePage, type SePerson } from '@ctf/shared';
import { queryDb } from 'lib/db/postgres';
import { countryCode, regionName } from './place';

// People in 3.1: a page of Directory profiles with what each one lists and, for a claimed profile,
// the skills its owner offers through Foundation. Every row is live: a Directory listing that goes
// away is deleted outright (post/0033 dropped the old tombstone columns). "Offering now" keeps only
// the profiles whose owner offers at least one skill; those come first in every view. A category
// (Trades, Care, Paperwork, Tech) keeps the profiles whose job title, profile sector or any listed
// skill sits in one of that category's Skills Taxonomy sectors (SE_PEOPLE_CATEGORY_SECTORS). The
// place is the state and the country only; the city column is never read.

type PersonRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  headline: string | null;
  job_title: string | null;
  claimed: boolean;
  region: string | null;
  country: string | null;
  listed: string[] | null;
  offering: string[] | null;
  total: string;
};

const OFFERS = `EXISTS (SELECT 1 FROM foundation_provider_skills f WHERE p.claimed_by_user_id IS NOT NULL AND f.user_id = p.claimed_by_user_id)`;

// The sector names of a profile: its own sector, its job title's, and those of the skills it lists.
const IN_CATEGORY = `(
  $5::text[] IS NULL
  OR EXISTS (SELECT 1 FROM skills_taxonomy_sectors s_p WHERE s_p.id IN (p.sector_id, jt.sector_id) AND s_p.name = ANY($5::text[]))
  OR EXISTS (
    SELECT 1 FROM directory_profile_skills dps_c
    JOIN skills_taxonomy_skills sk_c ON sk_c.id = dps_c.skill_id
    JOIN skills_taxonomy_job_titles jt_c ON jt_c.id = sk_c.job_title_id
    JOIN skills_taxonomy_sectors s_c ON s_c.id = jt_c.sector_id
    WHERE dps_c.profile_id::text = p.id::text AND s_c.name = ANY($5::text[])
  )
)`;

const PEOPLE_SQL = `
  SELECT
    p.id::text AS id,
    p.first_name,
    p.last_name,
    p.headline,
    jt.name AS job_title,
    p.claimed_by_user_id IS NOT NULL AS claimed,
    p.state AS region,
    p.country,
    ARRAY(
      SELECT DISTINCT sk.name FROM directory_profile_skills dps
      JOIN skills_taxonomy_skills sk ON sk.id = dps.skill_id
      WHERE dps.profile_id::text = p.id::text ORDER BY sk.name
    ) AS listed,
    ARRAY(
      SELECT DISTINCT sk.name FROM foundation_provider_skills f
      JOIN skills_taxonomy_skills sk ON sk.id = f.skill_id
      WHERE p.claimed_by_user_id IS NOT NULL AND f.user_id = p.claimed_by_user_id ORDER BY sk.name
    ) AS offering,
    COUNT(*) OVER ()::text AS total
  FROM directory_profiles p
  LEFT JOIN skills_taxonomy_job_titles jt ON jt.id = p.job_title_id
  WHERE ($1::boolean = FALSE OR ${OFFERS})
    AND ${IN_CATEGORY}
    AND (
      $2::text IS NULL
      OR lower(concat_ws(' ', p.first_name, p.last_name, p.headline, jt.name)) LIKE $2::text
      OR EXISTS (
        SELECT 1 FROM directory_profile_skills dps_q
        JOIN skills_taxonomy_skills sk_q ON sk_q.id = dps_q.skill_id
        WHERE dps_q.profile_id::text = p.id::text AND lower(sk_q.name) LIKE $2::text
      )
    )
  ORDER BY ${OFFERS} DESC, p.updated_at DESC, p.id
  LIMIT $3 OFFSET $4
`;

function personName(row: PersonRow): string {
  return [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || 'Unnamed';
}

function toPerson(row: PersonRow): SePerson {
  return {
    id: row.id,
    name: personName(row),
    headline: row.headline,
    jobTitle: row.job_title,
    claimed: row.claimed,
    region: regionName(row.region),
    country: countryCode(row.country),
    offering: row.offering ?? [],
    listed: row.listed ?? [],
  };
}

export type PeopleQuery = { page: number; pageSize: number; offeringOnly: boolean; query: string | null; category: SePeopleCategory | null };

export async function listPeople(input: PeopleQuery): Promise<SePeoplePage> {
  const term = input.query ? `%${input.query.toLowerCase().replace(/[%_\\]/g, '')}%` : null;
  const sectors = input.category ? [...SE_PEOPLE_CATEGORY_SECTORS[input.category]] : null;
  const result = await queryDb<PersonRow>(PEOPLE_SQL, [input.offeringOnly, term, input.pageSize, (input.page - 1) * input.pageSize, sectors]);
  return {
    items: result.rows.map(toPerson),
    page: input.page,
    pageSize: input.pageSize,
    total: Number(result.rows[0]?.total ?? 0),
  };
}

// How many people the Directory lists, and nothing else: the count on People's header and on the
// screen a member not yet approved sees. No name, id or place leaves this.
export async function countPeople(): Promise<number> {
  const result = await queryDb<{ total: string }>('SELECT COUNT(*)::text AS total FROM directory_profiles');
  return Number(result.rows[0]?.total ?? 0);
}
