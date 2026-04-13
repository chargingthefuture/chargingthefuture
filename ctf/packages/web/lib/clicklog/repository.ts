export async function getIncidentById(id: string): Promise<ClicklogIncident | null> {
  const result = await queryDb<ClicklogIncident>(
    `SELECT * FROM clicklog_incidents WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

import { queryDb } from 'lib/db/postgres';
import { ClicklogIncident, CreateIncidentInput, IncidentMetadata } from './types';

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

export async function deleteIncident(id: string, userId: string): Promise<boolean> {
  const result = await queryDb(
    `DELETE FROM clicklog_incidents WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return (result.rowCount ?? 0) > 0;
}
