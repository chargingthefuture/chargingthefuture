import type { PoolClient } from 'pg';

// Only one Skills Hunt round is open at a time (owner decision, 2026-10-01). The round is the
// season; themed asks such as "Find Doctors" are missions inside it. With two rounds open, every
// nomination had to say which round it was for and every member tab needed a round switch, which
// is what this rule removes. Enforced here, inside the create/update transaction, under a
// transaction-scoped lock so two admins opening rounds at once cannot both succeed.
export class SkillsHuntAnotherRoundOpenError extends Error {
  constructor(readonly openRoundName: string) {
    super('skills_hunt_another_round_open');
  }
}

export async function assertNoOtherOpenRound(client: PoolClient, roundId: string | null): Promise<void> {
  await client.query(`SELECT pg_advisory_xact_lock(hashtext('skills-hunt-open-round'))`);
  const open = await client.query<{ name: string }>(
    `
      SELECT name
      FROM skills_hunt_rounds
      WHERE status = 'active'
        AND ($1::uuid IS NULL OR id <> $1::uuid)
      ORDER BY starts_at ASC
      LIMIT 1
    `,
    [roundId],
  );
  const other = open.rows[0];
  if (other) {
    throw new SkillsHuntAnotherRoundOpenError(other.name);
  }
}
