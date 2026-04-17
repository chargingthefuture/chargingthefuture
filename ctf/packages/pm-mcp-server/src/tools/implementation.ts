
import { query } from '../db.js';
import { ImplementationQueueRow } from '../types.js';

interface CountRow {
  count: string;
}

export async function getImplementationQueue(
  status?: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{ items: ImplementationQueueRow[]; totalCount: number }> {
  let sql = `
    SELECT 
      iq.id, iq.approval_id, iq.feedback_id, iq.inventory_file_path,
      iq.artifact_changes, iq.implementation_status, iq.implementation_agent_id,
      iq.implementation_log, iq.created_at, iq.completed_at,
      fi.title, fi.type, fi.category, fi.priority, fi.body,
      aq.approver_id
    FROM implementation_queue iq
    JOIN feedback_items fi ON iq.feedback_id = fi.id
    JOIN approval_queue aq ON iq.approval_id = aq.id
    WHERE 1=1
  `;
  const params: unknown[] = [];
  let paramIndex = 1;

  if (status) {
    sql += ` AND iq.implementation_status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  sql += ' ORDER BY iq.created_at DESC';

  const offset = (page - 1) * pageSize;
  sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(pageSize, offset);

  const result = await query<ImplementationQueueRow>(sql, params);

  // Get total count
  let countSql = 'SELECT COUNT(*) as count FROM implementation_queue WHERE 1=1';
  const countParams: unknown[] = [];
  let countParamIndex = 1;

  if (status) {
    countSql += ` AND implementation_status = $${countParamIndex}`;
    countParams.push(status);
    countParamIndex++;
  }

  const countResult = await query<CountRow>(countSql, countParams);
  const totalCount = parseInt(countResult.rows[0].count, 10);

  return {
    items: result.rows,
    totalCount,
  };
}

export async function setImplementationStatus(
  implementationId: string,
  newStatus: 'in_progress' | 'completed' | 'failed',
  implementationAgentId?: string,
  implementationLog?: string
): Promise<{
  implementationId: string;
  status: string;
  feedbackStatus: string;
  completedAt?: string;
}> {
  let sql = `
    UPDATE implementation_queue 
    SET implementation_status = $2, updated_at = NOW()
  `;
  const params: unknown[] = [implementationId, newStatus];
  let paramIndex = 3;

  if (implementationAgentId) {
    sql += `, implementation_agent_id = $${paramIndex}`;
    params.push(implementationAgentId);
    paramIndex++;
  }

  if (implementationLog) {
    sql += `, implementation_log = $${paramIndex}`;
    params.push(implementationLog);
    paramIndex++;
  }

  if (newStatus === 'completed') {
    sql += `, completed_at = NOW()`;
  }

  sql += ` WHERE id = $1 RETURNING id as implementation_id, implementation_status as status, completed_at`;

  const result = await query(sql, params);
  const implementation = result.rows[0];

  // Get feedback_id
  const feedbackResult = await query(
    'SELECT feedback_id FROM implementation_queue WHERE id = $1',
    [implementationId]
  );
  const feedbackId = feedbackResult.rows[0].feedback_id;

  // Update feedback status based on implementation status
  let newFeedbackStatus = 'linked_to_task';
  if (newStatus === 'completed') {
    newFeedbackStatus = 'resolved';
  } else if (newStatus === 'in_progress') {
    newFeedbackStatus = 'linked_to_task';
  }

  await query(
    `UPDATE feedback_items SET status = $2, updated_at = NOW() WHERE id = $1`,
    [feedbackId, newFeedbackStatus]
  );

  return {
    implementationId: implementation.implementation_id,
    status: implementation.status,
    feedbackStatus: newFeedbackStatus,
    completedAt: implementation.completed_at,
  };
}
