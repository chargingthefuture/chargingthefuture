import { query } from '../db.js';
export async function listFeedback(status, type, category, priority, page = 1, pageSize = 20) {
    let sql = 'SELECT * FROM feedback_items WHERE 1=1';
    const params = [];
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
    const countParams = [];
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
export async function triageFeedback(feedbackId, priority, category, status) {
    let sql = 'UPDATE feedback_items SET updated_at = NOW()';
    const params = [];
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
export async function createInventoryMatch(feedbackId, inventoryFilePath, matchConfidence, suggestedUpdates, matcherReasoning) {
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
    await query(`UPDATE feedback_items SET status = 'matched_to_inventory', updated_at = NOW() WHERE id = $1`, [feedbackId]);
    // Create approval queue entry
    const matchId = result.rows[0].match_id;
    await query(`INSERT INTO approval_queue (feedback_id, matcher_id, status) VALUES ($1, $2, 'pending')`, [feedbackId, matchId]);
    return { matchId: result.rows[0].match_id, feedbackId: result.rows[0].feedback_id };
}
export async function getApprovalQueue(status, page = 1, pageSize = 20) {
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
    const params = [];
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
    const result = await query(sql, params);
    // Get total count
    let countSql = 'SELECT COUNT(*) as count FROM approval_queue WHERE 1=1';
    const countParams = [];
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
export async function approveMatch(approvalId, approverId, approverFeedback, approvedArtifactChanges) {
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
    const feedbackResult = await query('SELECT feedback_id FROM approval_queue WHERE id = $1', [approvalId]);
    const feedbackId = feedbackResult.rows[0].feedback_id;
    // Get inventory file path
    const matchResult = await query(`SELECT inventory_file_path FROM feedback_inventory_matches 
     WHERE id = (SELECT matcher_id FROM approval_queue WHERE id = $1)`, [approvalId]);
    const inventoryFilePath = matchResult.rows[0].inventory_file_path;
    // Create implementation queue entry
    await query(`INSERT INTO implementation_queue 
      (approval_id, feedback_id, inventory_file_path, artifact_changes, implementation_status)
     VALUES ($1, $2, $3, $4, 'pending')`, [
        approvalId,
        feedbackId,
        inventoryFilePath,
        approvedArtifactChanges ? JSON.stringify(approvedArtifactChanges) : '{}',
    ]);
    // Update feedback status
    // Update feedback status
    await query(`UPDATE feedback_items SET status = 'approved', updated_at = NOW() WHERE id = $1`, [feedbackId]);
    return {
        approvalId: approval.approval_id,
        status: approval.status,
        approvedAt: approval.approved_at,
    };
}
// Restore rejectMatch function declaration
export async function rejectMatch(approvalId, approverId, rejectionReason) {
    const sql = `
    UPDATE approval_queue 
    SET status = 'rejected', approver_id = $2, approver_feedback = $3
    WHERE id = $1
    RETURNING id as approval_id, status
  `;
    const result = await query(sql, [approvalId, approverId, rejectionReason]);
    // Mark feedback as dismissed
    const feedbackResult = await query('SELECT feedback_id FROM approval_queue WHERE id = $1', [approvalId]);
    const feedbackId = feedbackResult.rows[0].feedback_id;
    await query(`UPDATE feedback_items SET status = 'dismissed', updated_at = NOW() WHERE id = $1`, [feedbackId]);
    return {
        approvalId: result.rows[0].approval_id,
        status: result.rows[0].status,
    };
}
//# sourceMappingURL=feedback.js.map