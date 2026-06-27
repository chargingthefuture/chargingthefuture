import { queryDb } from 'lib/db/postgres';
import { ClicklogIncident, CreateIncidentInput } from './types';

export async function getIncidentById(id: string): Promise<ClicklogIncident | null> {
  const result = await queryDb<ClicklogIncident>(
    `SELECT * FROM clicklog_incidents WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

export async function createIncident(input: CreateIncidentInput): Promise<ClicklogIncident> {
  const { userId, metadata } = input;
  const result = await queryDb<ClicklogIncident>(
    `INSERT INTO clicklog_incidents (id, user_id, metadata, created_at)
     VALUES (gen_random_uuid(), $1, $2, NOW())
     RETURNING *`,
    [userId, metadata]
  );
  return result.rows[0];
}

export async function getIncidentsByUser(userId: string, limit = 50): Promise<ClicklogIncident[]> {
  const result = await queryDb<ClicklogIncident>(
    `SELECT * FROM clicklog_incidents WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

export async function getIncidentCount(userId: string): Promise<number> {
  const result = await queryDb<{ count: string }>(
    `SELECT COUNT(*) FROM clicklog_incidents WHERE user_id = $1`,
    [userId]
  );
  return parseInt(result.rows[0]?.count ?? '0', 10);
}

// Deletes an incident. Members may delete only their own (the user_id condition
// scopes the DELETE); admins may delete any incident, so for them the ownership
// condition is dropped. The route performs the authorization check (canDeleteIncident)
// before calling this.
export async function deleteIncident(id: string, userId: string, isAdmin = false): Promise<boolean> {
  const result = isAdmin
    ? await queryDb(`DELETE FROM clicklog_incidents WHERE id = $1`, [id])
    : await queryDb(`DELETE FROM clicklog_incidents WHERE id = $1 AND user_id = $2`, [id, userId]);
  return (result.rowCount ?? 0) > 0;
}
