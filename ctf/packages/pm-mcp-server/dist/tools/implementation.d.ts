import { ImplementationQueueRow } from '../types.js';
export declare function getImplementationQueue(status?: string, page?: number, pageSize?: number): Promise<{
    items: ImplementationQueueRow[];
    totalCount: number;
}>;
export declare function setImplementationStatus(implementationId: string, newStatus: 'in_progress' | 'completed' | 'failed', implementationAgentId?: string, implementationLog?: string): Promise<{
    implementationId: string;
    status: string;
    feedbackStatus: string;
    completedAt?: string;
}>;
//# sourceMappingURL=implementation.d.ts.map