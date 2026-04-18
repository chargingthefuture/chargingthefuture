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
export declare function rejectMatch(approvalId: string, approverId: string, rejectionReason: string): Promise<{
    approvalId: string;
    status: string;
}>;
//# sourceMappingURL=feedback.d.ts.map