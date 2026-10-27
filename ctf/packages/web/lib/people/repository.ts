import type { SePeoplePage, SePerson } from '@ctf/shared';
import { queryDb } from 'lib/db/postgres';

// People in 3.1: a page of Directory profiles with what each one lists and, for a claimed profile,
// the skills its owner offers through Foundation. Live profiles only (`deleted_at IS NULL`), the
// same liveness test as the Directory. "Offering now" keeps only the profiles whose owner offers at
// least one skill; those come first in every view.

type PersonRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  headline: string | null;
  job_title: string | null;
  claimed: boolean;
  listed: string[] | null;
  offering: string[] | null;
  total: string;
};

const OFFERS = `EXISTS (SELECT 1 FROM foundation_provider_skills f WHERE p.claimed_by_user_id IS NOT NULL AND f.user_id = p.claimed_by_user_id)`;

const PEOPLE_SQL = `
  SELECT
    p.id::text AS id,
    p.first_name,
    p.last_name,
    p.headline,
    jt.name AS job_title,
    p.claimed_by_user_id IS NOT NULL AS claimed,
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
  WHERE p.deleted_at IS NULL
    AND ($1::boolean = FALSE OR ${OFFERS})
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
    offering: row.offering ?? [],
    listed: row.listed ?? [],
  };
}

export async function listPeople(input: { page: number; pageSize: number; offeringOnly: boolean; query: string | null }): Promise<SePeoplePage> {
  const term = input.query ? `%${input.query.toLowerCase().replace(/[%_\\]/g, '')}%` : null;
  const result = await queryDb<PersonRow>(PEOPLE_SQL, [input.offeringOnly, term, input.pageSize, (input.page - 1) * input.pageSize]);
  return {
    items: result.rows.map(toPerson),
    page: input.page,
    pageSize: input.pageSize,
    total: Number(result.rows[0]?.total ?? 0),
  };
}
