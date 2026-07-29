import { queryDb, withDbTransaction } from 'lib/db/postgres';
import type { ContributedEntry } from './quora-export-intake';

// Storage for member-contributed Quora writing. Nothing written here is visible to the assistant:
// entries sit in comic_contribution_entries until a human accepts them, at which point they are
// copied into comic_knowledge_entries. The gap between the two tables IS the human review step.

export type ContributionSummary = {
  id: string;
  status: 'pending_review' | 'accepted' | 'declined' | 'withdrawn';
  entryCount: number;
  discardedSections: string[];
  declineReason: string;
  createdAtIso: string;
};

type ContributionRow = {
  id: string;
  status: ContributionSummary['status'];
  entry_count: number;
  discarded_sections: unknown;
  decline_reason: string;
  created_at: Date;
};

function mapRow(row: ContributionRow): ContributionSummary {
  return {
    id: row.id,
    status: row.status,
    entryCount: row.entry_count,
    discardedSections: Array.isArray(row.discarded_sections)
      ? row.discarded_sections.filter((value): value is string => typeof value === 'string')
      : [],
    declineReason: row.decline_reason,
    createdAtIso: new Date(row.created_at).toISOString(),
  };
}

// Quora's export timestamps are free-form strings. An unparseable one becomes null rather than a bad
// date — the authored date is nice to have and never worth failing an upload over.
function parseAuthoredAt(raw: string | null): string | null {
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

// Record one contribution and its surviving entries in a single transaction, so a submission can
// never end up stored without its consent row, or counted with entries that failed to write.
export async function createContribution(input: {
  userId: string;
  consentVersion: string;
  thirdPartyNote: string;
  discardedSections: string[];
  entries: ContributedEntry[];
}): Promise<ContributionSummary> {
  return withDbTransaction(async (client) => {
    const inserted = await client.query<ContributionRow>(
      `INSERT INTO comic_contributions
         (user_id, status, consent_version, third_party_note, entry_count, discarded_sections)
       VALUES ($1, 'pending_review', $2, $3, $4, $5::jsonb)
       RETURNING id, status, entry_count, discarded_sections, decline_reason, created_at`,
      [
        input.userId,
        input.consentVersion,
        input.thirdPartyNote.slice(0, 4000),
        input.entries.length,
        JSON.stringify(input.discardedSections),
      ],
    );
    const contribution = inserted.rows[0];

    for (const entry of input.entries) {
      await client.query(
        `INSERT INTO comic_contribution_entries
           (contribution_id, entry_type, question, content, authored_at)
         VALUES ($1::uuid, $2, $3, $4, $5)`,
        [
          contribution.id,
          entry.entryType,
          entry.question,
          entry.content,
          parseAuthoredAt(entry.createdRaw),
        ],
      );
    }

    return mapRow(contribution);
  });
}

// A member's own contribution history, for the page's "what you have sent" list.
export async function listContributionsForUser(userId: string): Promise<ContributionSummary[]> {
  const result = await queryDb<ContributionRow>(
    `SELECT id, status, entry_count, discarded_sections, decline_reason, created_at
     FROM comic_contributions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId],
  );
  return result.rows.map(mapRow);
}

// How many contributions this member has sent recently. The upload route uses this as its own rate
// limit — parsing an archive is expensive, and a signed-in account should not be able to spend the
// server's memory in a loop.
export async function countRecentContributions(userId: string, withinHours: number): Promise<number> {
  const result = await queryDb<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM comic_contributions
     WHERE user_id = $1 AND created_at > NOW() - ($2 || ' hours')::interval`,
    [userId, String(withinHours)],
  );
  return Number(result.rows[0]?.count ?? '0');
}

// Withdraw a contribution at the member's request: mark it withdrawn AND deactivate every knowledge
// row it produced, in one transaction. Deactivating (not deleting) matches how curation works in
// comic_knowledge_entries everywhere else — but the effect the member was promised is the one that
// matters: the assistant stops quoting them.
export async function withdrawContribution(userId: string, contributionId: string): Promise<boolean> {
  return withDbTransaction(async (client) => {
    const owned = await client.query<{ id: string }>(
      `SELECT id FROM comic_contributions
       WHERE id = $1::uuid AND user_id = $2 AND status <> 'withdrawn'
       FOR UPDATE`,
      [contributionId, userId],
    );
    if (owned.rowCount === 0) return false;

    await client.query(
      `UPDATE comic_knowledge_entries SET active = FALSE
       WHERE id IN (
         SELECT knowledge_entry_id FROM comic_contribution_entries
         WHERE contribution_id = $1::uuid AND knowledge_entry_id IS NOT NULL
       )`,
      [contributionId],
    );

    await client.query(
      `UPDATE comic_contributions
       SET status = 'withdrawn', withdrawn_at = NOW(), updated_at = NOW()
       WHERE id = $1::uuid`,
      [contributionId],
    );
    return true;
  });
}
