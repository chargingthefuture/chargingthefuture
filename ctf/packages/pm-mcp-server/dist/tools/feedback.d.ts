import { FeedbackItem, ApprovalQueueRow } from '../types.js';
export declare function listFeedback(status?: string, type?: string, category?: string, priority?: string, page?: number, pageSize?: number): Promise<{
    items: FeedbackItem[];
    totalCount: number;
}>;
export declare function triageFeedback(feedbackId: string, priority?: string, category?: string, status?: string): Promise<FeedbackItem>;
export declare function createInventoryMatch(feedbackId: string, inventoryFilePath: string, matchConfidence: number, suggestedUpdates: Record<string, any>, matcherReasoning?: string): Promise<{
    matchId: string;
    feedbackId: string;
}>;
export declare function getApprovalQueue(status?: string, page?: number, pageSize?: number): Promise<{
    items: ApprovalQueueRow[];
    totalCount: number;
}>;
export declare function approveMatch(approvalId: string, approverId: string, approverFeedback?: string, approvedArtifactChanges?: Record<string, any>): Promise<{
    approvalId: string;
    status: string;
    approvedAt: string;
}>;
/**
 * Rejects an approval match in the approval queue.
 *
 * Updates the approval_queue status to 'rejected', records the approver and reason,
 * and marks the associated feedback item as 'dismissed'.
 *
 * @param approvalId - The approval queue entry ID to reject
 * @param approverId - The ID of the user/agent performing the rejection
 * @param rejectionReason - The reason for rejection (stored as approver_feedback)
 * @returns An object containing the approvalId and new status
 * @sideeffect Updates both approval_queue and feedback_items tables
 */
export declare function rejectMatch(approvalId: string, approverId: string, rejectionReason: string): Promise<{
    approvalId: string;
    status: string;
}>;
//# sourceMappingURL=feedback.d.ts.map