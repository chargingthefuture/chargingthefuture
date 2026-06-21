import { queryDb } from 'lib/db/postgres';

// A single cross-plugin presence entry: where a member is active, with a deep link into that plugin.
export interface MemberPresenceEntry {
  pluginSlug: string;
  refType: string;
  refId: string;
  label: string;
  deepLink: string;
}

interface MemberPresenceRow {
  plugin_slug: string;
  ref_type: string;
  ref_id: string;
  label: string;
  deep_link: string;
}

// Read the active presence rows for one member, ordered by plugin then label so the
// "Also active in" list is stable. Degrades safely: if the table is absent at runtime
// (fresh deploy before migration), returns an empty list rather than throwing.
export async function getMemberPresence(userId: string): Promise<MemberPresenceEntry[]> {
  const trimmed = userId.trim();
  if (trimmed.length === 0) {
    return [];
  }

  try {
    const result = await queryDb<MemberPresenceRow>(
      `
        SELECT plugin_slug, ref_type, ref_id, label, deep_link
        FROM member_plugin_presence
        WHERE user_id = $1 AND is_active = TRUE
        ORDER BY plugin_slug ASC, label ASC
      `,
      [trimmed],
    );

    return result.rows.map((row) => ({
      pluginSlug: row.plugin_slug,
      refType: row.ref_type,
      refId: row.ref_id,
      label: row.label,
      deepLink: row.deep_link,
    }));
  } catch {
    // Missing table or transient persistence failure: presence is additive, never load-bearing,
    // so an empty list keeps the profile rendering.
    return [];
  }
}

export interface UpsertMemberPresenceInput {
  userId: string;
  pluginSlug: string;
  refType: string;
  refId: string;
  label: string;
  deepLink: string;
}

// Idempotent write used by the backfill now and by future per-plugin write hooks. Re-running with
// the same (userId, pluginSlug, refType, refId) updates the label/deep link and re-activates the row.
export async function upsertMemberPresence(input: UpsertMemberPresenceInput): Promise<void> {
  await queryDb(
    `
      INSERT INTO member_plugin_presence
        (user_id, plugin_slug, ref_type, ref_id, label, deep_link, is_active, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW())
      ON CONFLICT (user_id, plugin_slug, ref_type, ref_id)
      DO UPDATE SET
        label = EXCLUDED.label,
        deep_link = EXCLUDED.deep_link,
        is_active = TRUE,
        updated_at = NOW()
    `,
    [input.userId, input.pluginSlug, input.refType, input.refId, input.label, input.deepLink],
  );
}

export interface DeactivateMemberPresenceInput {
  userId: string;
  pluginSlug: string;
  refType: string;
  refId: string;
}

// Mark one presence row inactive (e.g. a listing was removed). Idempotent: a no-op if the row is
// absent or already inactive.
export async function deactivateMemberPresence(input: DeactivateMemberPresenceInput): Promise<void> {
  await queryDb(
    `
      UPDATE member_plugin_presence
      SET is_active = FALSE, updated_at = NOW()
      WHERE user_id = $1 AND plugin_slug = $2 AND ref_type = $3 AND ref_id = $4
    `,
    [input.userId, input.pluginSlug, input.refType, input.refId],
  );
}
