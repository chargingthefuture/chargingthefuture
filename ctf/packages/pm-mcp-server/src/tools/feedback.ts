import { query } from '../db.js';
import { FeedbackItem, ApprovalQueueRow } from '../types.js';

export async function listFeedback(
  status?: string,
  type?: string,
  category?: string,
  priority?: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{ items: FeedbackItem[]; totalCount: number }> {
  let sql = 'SELECT * FROM feedback_items WHERE 1=1';
  const params: unknown[] = [];
  let paramIndex = 1;

  if (status) {
    sql += ` AND status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  if (type) {
    sql += ` AND type = $${paramIndex}`;
    params.push(type);
    paramIndex++;
  }

  if (category) {
    sql += ` AND category = $${paramIndex}`;
    params.push(category);
    paramIndex++;
  }

  if (priority) {
    sql += ` AND priority = $${paramIndex}`;
    params.push(priority);
    paramIndex++;
  }

  sql += ' ORDER BY created_at DESC';

  const offset = (page - 1) * pageSize;
  sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(pageSize, offset);

  const result = await query(sql, params);

  // Get total count
  let countSql = 'SELECT COUNT(*) as count FROM feedback_items WHERE 1=1';
  const countParams: any[] = [];
  let countParamIndex = 1;

  if (status) {
    countSql += ` AND status = $${countParamIndex}`;
    countParams.push(status);
    countParamIndex++;
  }

  if (type) {
    countSql += ` AND type = $${countParamIndex}`;
    countParams.push(type);
    countParamIndex++;
  }

  if (category) {
    countSql += ` AND category = $${countParamIndex}`;
    countParams.push(category);
    countParamIndex++;
  }

  if (priority) {
    countSql += ` AND priority = $${countParamIndex}`;
    countParams.push(priority);
    countParamIndex++;
  }

  const countResult = await query(countSql, countParams);
  const totalCount = parseInt(countResult.rows[0].count, 10);

  return {
    items: result.rows,
    totalCount,
  };
}

export async function triageFeedback(
  feedbackId: string,
  priority?: string,
  category?: string,
  status?: string
): Promise<FeedbackItem> {
  let sql = 'UPDATE feedback_items SET updated_at = NOW()';
  const params: unknown[] = [];
  let paramIndex = 1;

  if (priority) {
    sql += `, priority = $${paramIndex}`;
    params.push(priority);
    paramIndex++;
  }

  if (category) {
    sql += `, category = $${paramIndex}`;
    params.push(category);
    paramIndex++;
  }

  if (status) {
    sql += `, status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  sql += ` WHERE id = $${paramIndex} RETURNING *`;
  params.push(feedbackId);

  const result = await query(sql, params);
  return result.rows[0];
}

export async function createInventoryMatch(
  feedbackId: string,
  inventoryFilePath: string,
  matchConfidence: number,
  suggestedUpdates: Record<string, any>,
  matcherReasoning?: string
): Promise<{ matchId: string; feedbackId: string }> {
  const sql = `
    INSERT INTO feedback_inventory_matches 
      (feedback_id, inventory_file_path, match_confidence, suggested_updates, matcher_reasoning)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id as match_id, feedback_id
  `;

  const result = await query(sql, [
    feedbackId,
    inventoryFilePath,
    matchConfidence,
    JSON.stringify(suggestedUpdates),
    matcherReasoning,
  ]);

  // Update feedback status to matched_to_inventory
  await query(
    `UPDATE feedback_items SET status = 'matched_to_inventory', updated_at = NOW() WHERE id = $1`,
    [feedbackId]
  );

  // Create approval queue entry
  const matchId = result.rows[0].match_id;
  await query(
    `INSERT INTO approval_queue (feedback_id, matcher_id, status) VALUES ($1, $2, 'pending')`,
    [feedbackId, matchId]
  );

  return result.rows[0];
}

export async function getApprovalQueue(
  status?: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{ items: ApprovalQueueRow[]; totalCount: number }> {
  let sql = `
    SELECT 
      aq.id, aq.feedback_id, aq.matcher_id, aq.status,
      fi.title, fi.type, fi.category, fi.priority,
      fim.inventory_file_path, fim.match_confidence, fim.suggested_updates, fim.matcher_reasoning
    FROM approval_queue aq
    JOIN feedback_items fi ON aq.feedback_id = fi.id
    JOIN feedback_inventory_matches fim ON aq.matcher_id = fim.id
    WHERE 1=1
  `;
  const params: unknown[] = [];
  let paramIndex = 1;

  if (status) {
    sql += ` AND aq.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  sql += ' ORDER BY aq.created_at DESC';

  const offset = (page - 1) * pageSize;
  sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(pageSize, offset);

  const result = await query<ApprovalQueueRow>(sql, params);

  // Get total count
  let countSql = 'SELECT COUNT(*) as count FROM approval_queue WHERE 1=1';
  const countParams: unknown[] = [];
  let countParamIndex = 1;

  if (status) {
    countSql += ` AND status = $${countParamIndex}`;
    countParams.push(status);
    countParamIndex++;
  }

  const countResult = await query(countSql, countParams);
  const totalCount = parseInt(countResult.rows[0].count, 10);

  return {
    items: result.rows,
    totalCount,
  };
}

export async function approveMatch(
  approvalId: string,
  approverId: string,
  approverFeedback?: string,
  approvedArtifactChanges?: Record<string, any>
): Promise<{ approvalId: string; status: string; approvedAt: string }> {
  // Update approval queue
  const sql = `
    UPDATE approval_queue 
    SET status = 'approved', approver_id = $2, approver_feedback = $3, 
        approved_artifact_changes = $4, approved_at = NOW()
    WHERE id = $1
    RETURNING id as approval_id, status, approved_at
  `;

  const result = await query(sql, [
    approvalId,
    approverId,
    approverFeedback,
    approvedArtifactChanges ? JSON.stringify(approvedArtifactChanges) : null,
  ]);

  const approval = result.rows[0];

  // Get feedback_id and create implementation queue entry
  const feedbackResult = await query(
    'SELECT feedback_id FROM approval_queue WHERE id = $1',
    [approvalId]
  );
  const feedbackId = feedbackResult.rows[0].feedback_id;

  // Get inventory file path
  const matchResult = await query(
    `SELECT inventory_file_path FROM feedback_inventory_matches 
     WHERE id = (SELECT matcher_id FROM approval_queue WHERE id = $1)`,
    [approvalId]
  );
  const inventoryFilePath = matchResult.rows[0].inventory_file_path;

  // Create implementation queue entry
  await query(
    `INSERT INTO implementation_queue 
      (approval_id, feedback_id, inventory_file_path, artifact_changes, implementation_status)
     VALUES ($1, $2, $3, $4, 'pending')`,
    [
      approvalId,
      feedbackId,
      inventoryFilePath,
      approvedArtifactChanges ? JSON.stringify(approvedArtifactChanges) : '{}',
    ]
  );

  // Update feedback status
  await query(
    `UPDATE feedback_items SET status = 'approval_pending', updated_at = NOW() WHERE id = $1`,
    [feedbackId]
  );

  return approval;
}

export async function rejectMatch(
  approvalId: string,
  approverId: string,
  rejectionReason: string
): Promise<{ approvalId: string; status: string }> {
  const sql = `
    UPDATE approval_queue 
    SET status = 'rejected', approver_id = $2, approver_feedback = $3
    WHERE id = $1
    RETURNING id as approval_id, status
  `;

  const result = await query(sql, [approvalId, approverId, rejectionReason]);

  // Mark feedback as dismissed
  const feedbackResult = await query(
    'SELECT feedback_id FROM approval_queue WHERE id = $1',
    [approvalId]
  );
  const feedbackId = feedbackResult.rows[0].feedback_id;

  await query(
    `UPDATE feedback_items SET status = 'dismissed', updated_at = NOW() WHERE id = $1`,
    [feedbackId]
  );

  return result.rows[0];
}
