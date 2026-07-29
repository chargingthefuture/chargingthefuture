import { queryDb, withDbTransaction } from 'lib/db/postgres';
import type { ContributedEntry } from './quora-export-intake';

// Storage for member-contributed Quora writing. Nothing written here is visible to the assistant:
// entries sit in comic_contribution_entries until a human accepts them, at which point they are
// copied into comic_knowledge_entries. The gap between the two tables IS the human review step.

export type ContributionSummary = {
  id: string;
  kind: 'links' | 'export';
  status: 'pending_review' | 'accepted' | 'declined' | 'withdrawn';
  entryCount: number;
  discardedSections: string[];
  declineReason: string;
  createdAtIso: string;
};

type ContributionRow = {
  id: string;
  kind: 'links' | 'export';
  status: ContributionSummary['status'];
  entry_count: number;
  discarded_sections: unknown;
  decline_reason: string;
  created_at: Date;
};

function mapRow(row: ContributionRow): ContributionSummary {
  return {
    id: row.id,
    kind: row.kind,
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
  kind: 'links' | 'export';
  consentVersion: string;
  thirdPartyNote: string;
  discardedSections: string[];
  entries: ContributedEntry[];
}): Promise<ContributionSummary> {
  return withDbTransaction(async (client) => {
    const inserted = await client.query<ContributionRow>(
      `INSERT INTO comic_contributions
         (user_id, kind, status, consent_version, third_party_note, entry_count, discarded_sections)
       VALUES ($1, $2, 'pending_review', $3, $4, $5, $6::jsonb)
       RETURNING id, kind, status, entry_count, discarded_sections, decline_reason, created_at`,
      [
        input.userId,
        input.kind,
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
           (contribution_id, entry_type, question, content, source_url, authored_at)
         VALUES ($1::uuid, $2, $3, $4, $5, $6)`,
        [
          contribution.id,
          entry.entryType,
          entry.question,
          entry.content,
          entry.sourceUrl ?? null,
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
    `SELECT id, kind, status, entry_count, discarded_sections, decline_reason, created_at
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

// ── Admin review ──────────────────────────────────────────────────────────────────────────────
//
// Reviewing is where a contribution stops being inert. Until an entry is promoted into
// comic_knowledge_entries it cannot reach a member, so everything below is the human step the
// contributor was promised on the knowledge page.

export type ContributionEntryForReview = {
  id: string;
  entryType: string;
  question: string | null;
  content: string;
  sourceUrl: string | null;
  excluded: boolean;
  promoted: boolean;
};

export type ContributionForReview = ContributionSummary & {
  userId: string;
  consentVersion: string;
  thirdPartyNote: string;
  entries: ContributionEntryForReview[];
};

export async function listContributionsForReview(status: string): Promise<ContributionForReview[]> {
  const contributions = await queryDb<ContributionRow & {
    user_id: string;
    consent_version: string;
    third_party_note: string;
  }>(
    `SELECT id, user_id, kind, status, consent_version, third_party_note, entry_count,
            discarded_sections, decline_reason, created_at
     FROM comic_contributions
     WHERE ($1 = 'all' OR status = $1)
     ORDER BY created_at ASC
     LIMIT 50`,
    [status],
  );
  if (contributions.rowCount === 0) return [];

  const ids = contributions.rows.map((row) => row.id);
  const entries = await queryDb<{
    id: string;
    contribution_id: string;
    entry_type: string;
    question: string | null;
    content: string;
    source_url: string | null;
    excluded: boolean;
    knowledge_entry_id: string | null;
  }>(
    `SELECT id, contribution_id, entry_type, question, content, source_url, excluded, knowledge_entry_id
     FROM comic_contribution_entries
     WHERE contribution_id = ANY($1::uuid[])
     ORDER BY created_at ASC`,
    [ids],
  );

  const byContribution = new Map<string, ContributionEntryForReview[]>();
  for (const row of entries.rows) {
    const list = byContribution.get(row.contribution_id) ?? [];
    list.push({
      id: row.id,
      entryType: row.entry_type,
      question: row.question,
      content: row.content,
      sourceUrl: row.source_url,
      excluded: row.excluded,
      promoted: row.knowledge_entry_id !== null,
    });
    byContribution.set(row.contribution_id, list);
  }

  return contributions.rows.map((row) => ({
    ...mapRow(row),
    userId: row.user_id,
    consentVersion: row.consent_version,
    thirdPartyNote: row.third_party_note,
    entries: byContribution.get(row.id) ?? [],
  }));
}

export type AcceptResult = {
  status: 'accepted';
  promoted: number;
  alreadyPresent: number;
  contributorUserId: string;
};

// Accept a contribution: promote the chosen entries into the knowledge base, in one transaction with
// the status flip so a half-promoted contribution cannot exist.
//
// Two things are load-bearing here:
//   * `contribution_id` is stamped on every promoted row. That is what makes withdrawal and account
//     deletion able to find these rows later — without it the member's words would be unreachable.
//   * `content_hash` uses the SAME formula as importComicKnowledge.mjs, and the insert is
//     ON CONFLICT DO NOTHING. Two members who quote the same widely-shared passage do not create a
//     duplicate; the second simply finds the row already there.
export async function acceptContribution(input: {
  contributionId: string;
  reviewerId: string;
  excludedEntryIds: string[];
  hashOf: (entryType: string, question: string | null, content: string) => string;
}): Promise<AcceptResult | null> {
  return withDbTransaction(async (client) => {
    const found = await client.query<{ id: string; user_id: string; status: string }>(
      `SELECT id, user_id, status FROM comic_contributions
       WHERE id = $1::uuid AND status = 'pending_review'
       FOR UPDATE`,
      [input.contributionId],
    );
    if (found.rowCount === 0) return null;
    const contributorUserId = found.rows[0].user_id;

    const excluded = new Set(input.excludedEntryIds);
    const entries = await client.query<{
      id: string;
      entry_type: string;
      question: string | null;
      content: string;
      authored_at: Date | null;
    }>(
      `SELECT id, entry_type, question, content, authored_at
       FROM comic_contribution_entries
       WHERE contribution_id = $1::uuid AND knowledge_entry_id IS NULL`,
      [input.contributionId],
    );

    let promoted = 0;
    let alreadyPresent = 0;

    for (const entry of entries.rows) {
      if (excluded.has(entry.id)) {
        await client.query(
          `UPDATE comic_contribution_entries SET excluded = TRUE WHERE id = $1::uuid`,
          [entry.id],
        );
        continue;
      }

      const hash = input.hashOf(entry.entry_type, entry.question, entry.content);
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO comic_knowledge_entries
           (source, entry_type, question, content, content_hash, authored_at, contribution_id)
         VALUES ('quora_export', $1, $2, $3, $4, $5, $6::uuid)
         ON CONFLICT (content_hash) DO NOTHING
         RETURNING id`,
        [entry.entry_type, entry.question, entry.content, hash, entry.authored_at, input.contributionId],
      );

      if (inserted.rowCount === 1) {
        promoted++;
        await client.query(
          `UPDATE comic_contribution_entries SET knowledge_entry_id = $2::uuid WHERE id = $1::uuid`,
          [entry.id, inserted.rows[0].id],
        );
      } else {
        alreadyPresent++;
        // Point at the row that already carries this text, so a later withdrawal still reaches it.
        await client.query(
          `UPDATE comic_contribution_entries
           SET knowledge_entry_id = (SELECT id FROM comic_knowledge_entries WHERE content_hash = $2)
           WHERE id = $1::uuid`,
          [entry.id, hash],
        );
      }
    }

    await client.query(
      `UPDATE comic_contributions
       SET status = 'accepted', reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $1::uuid`,
      [input.contributionId, input.reviewerId],
    );

    return { status: 'accepted' as const, promoted, alreadyPresent, contributorUserId };
  });
}

// Decline a contribution. Nothing is promoted; the entries stay for the record, and the reason is
// shown to the contributor on their own page so a decline is never silent.
export async function declineContribution(input: {
  contributionId: string;
  reviewerId: string;
  reason: string;
}): Promise<boolean> {
  const result = await queryDb(
    `UPDATE comic_contributions
     SET status = 'declined', reviewed_by = $2, reviewed_at = NOW(),
         decline_reason = $3, updated_at = NOW()
     WHERE id = $1::uuid AND status = 'pending_review'`,
    [input.contributionId, input.reviewerId, input.reason.slice(0, 500)],
  );
  return (result.rowCount ?? 0) > 0;
}

// Stamp the recognition grant so a re-review can never mint a second one. Returns false when it was
// already stamped, which the caller treats as "already granted" rather than an error.
export async function markContributionGranted(contributionId: string): Promise<boolean> {
  const result = await queryDb(
    `UPDATE comic_contributions SET granted_at = NOW(), updated_at = NOW()
     WHERE id = $1::uuid AND granted_at IS NULL`,
    [contributionId],
  );
  return (result.rowCount ?? 0) > 0;
}
