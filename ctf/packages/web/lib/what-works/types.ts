export type WhatWorksProductStatus = 'pending' | 'approved' | 'rejected';

// Raw storage rows
export type WhatWorksProblem = {
  id: string;
  slug: string;
  emoji: string;
  title: string;
  context: string;
  sort_order: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type WhatWorksProduct = {
  id: string;
  problem_id: string;
  emoji: string;
  name: string;
  kind: string;
  note: string;
  purchase_url: string;
  status: WhatWorksProductStatus;
  suggested_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

// Reader projection — never exposes submitter identity (anonymity promise).
export type WhatWorksPublicProduct = {
  id: string;
  emoji: string;
  name: string;
  kind: string;
  note: string;
  purchaseUrl: string;
  verifiedCount: number;
  viewerHasEndorsed: boolean;
};

export type WhatWorksPublicProblem = {
  id: string;
  slug: string;
  emoji: string;
  title: string;
  context: string;
  products: WhatWorksPublicProduct[];
};

export type WhatWorksListStats = {
  problems: number;
  verifiedTools: number;
  survivorsHelped: number;
};

export type WhatWorksList = {
  problems: WhatWorksPublicProblem[];
  stats: WhatWorksListStats;
};

// Admin projections
export type WhatWorksAdminProblem = WhatWorksProblem & {
  productCount: number;
  approvedCount: number;
  pendingCount: number;
};

export type WhatWorksAdminProduct = {
  id: string;
  problemId: string;
  problemTitle: string;
  emoji: string;
  name: string;
  kind: string;
  note: string;
  purchaseUrl: string;
  status: WhatWorksProductStatus;
  verifiedCount: number;
  createdAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
};

// Inputs
export type SuggestProductInput = {
  problemId: string;
  name: string;
  purchaseUrl: string;
  emoji?: string;
  kind?: string;
  note?: string;
  suggestedBy: string;
};

export type CreateProblemInput = {
  emoji?: string;
  title: string;
  context?: string;
  sortOrder?: number;
  createdBy: string;
};

export type UpdateProblemInput = {
  emoji?: string;
  title?: string;
  context?: string;
  sortOrder?: number;
  isActive?: boolean;
};

export type ReviewProductInput = {
  action: 'approve' | 'reject';
  reviewerId: string;
  rejectionReason?: string;
};

// Admin correction of a suggested tool's own details (name, link, note, etc.). Never touches
// status, endorsements, or the identity columns — those are governed by review/delete.
export type UpdateProductInput = {
  emoji?: string;
  name?: string;
  kind?: string;
  note?: string;
  purchaseUrl?: string;
};
