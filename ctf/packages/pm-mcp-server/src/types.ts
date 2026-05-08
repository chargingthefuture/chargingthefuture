import type { JSONSchema7 } from './json-schema.js';
// Centralized CountRow type for query results
export interface CountRow {
  count: string;
}

// ApprovalQueueRow: all approval_queue columns plus joined fields
export interface ApprovalQueueRow {
  id: string;
  feedback_id: string;
  matcher_id: string;
  status: string;
  title: string;
  type: string;
  category: string;
  priority: string;
  inventory_file_path: string;
  match_confidence: number;
  suggested_updates: Record<string, unknown>;
  matcher_reasoning?: string | null;
}

// ImplementationQueueRow: all implementation_queue columns plus joined fields
export interface ImplementationQueueRow {
  id: string;
  approval_id: string;
  feedback_id: string;
  inventory_file_path: string;
  artifact_changes: Record<string, unknown>;
  implementation_status: string;
  implementation_agent_id?: string;
  implementation_log?: string;
  created_at: string;
  completed_at?: string;
  // joined fields
  title: string;
  type: string;
  category: string;
  priority: string;
  body?: string;
  approver_id?: string;
}
export interface FeedbackItem {
  id: string;
  user_id: string;
  type: 'bug_report' | 'feature_request' | 'general' | 'satisfaction';
  title: string;
  body?: string;
  category?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  status: 'new' | 'triaged' | 'matched_to_inventory' | 'approval_pending' | 'approved' | 'linked_to_task' | 'resolved' | 'dismissed';
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  vote_count?: number;
}

export interface InventoryMatch {
  id: string;
  feedback_id: string;
  inventory_file_path: string;
  match_confidence: number;
  suggested_updates: Record<string, unknown>;
  matcher_reasoning?: string;
  created_at: string;
}

export interface ApprovalQueueItem {
  id: string;
  feedback_id: string;
  matcher_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'modified';
  approver_id?: string;
  approver_feedback?: string;
  approved_artifact_changes?: Record<string, unknown>;
  created_at: string;
  approved_at?: string;
}

export interface ImplementationQueueItem {
  id: string;
  approval_id: string;
  feedback_id: string;
  inventory_file_path: string;
  artifact_changes: Record<string, unknown>;
  implementation_status: 'pending' | 'in_progress' | 'completed' | 'failed';
  implementation_agent_id?: string;
  implementation_log?: string;
  created_at: string;
  completed_at?: string;
}

export interface InventoryFile {
  path: string;
  name: string;
  content: string;
  parsed_features: Record<string, unknown>;
  artifact_schemas?: Record<string, unknown>;
  artifact_apis?: Record<string, unknown>;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: JSONSchema7;
}
