export type WorkforcePagination = {
  page: number;
  pageSize: number;
  total: number;
};

export type WorkforceDashboard = {
  workforceTotal: number;
  recruitedTotal: number;
  occupationsTotal: number;
  generatedAtIso: string;
};

export type WorkforceProfile = {
  userId: string;
  occupationId: string | null;
  occupationName: string | null;
  skillLevel: string;
  region: string | null;
  recruitedState: boolean;
  recruitedResolvedAtIso: string | null;
  availabilityPreferences: Record<string, unknown>;
  workPreferences: Record<string, unknown>;
  serviceDeletedAtIso: string | null;
  updatedAtIso: string;
};

export type WorkforceProfileInput = {
  occupationId: string | null;
  skillLevel: string;
  region: string | null;
  availabilityPreferences?: Record<string, unknown>;
  workPreferences?: Record<string, unknown>;
};

export type WorkforceOccupation = {
  id: string;
  name: string;
  sector: string | null;
  isActive: boolean;
  createdByUserId: string;
  updatedByUserId: string;
  createdAtIso: string;
  updatedAtIso: string;
};

export type WorkforceOccupationInput = {
  name: string;
  sector: string | null;
  isActive?: boolean;
};

export type WorkforceConfig = {
  exportsEnabled: boolean;
  reportWeekTimezone: string;
  reportWeekStartDow: number;
  updatedByUserId: string;
  updatedAtIso: string;
};

export type WorkforceConfigInput = {
  exportsEnabled: boolean;
  reportWeekTimezone: string;
  reportWeekStartDow: number;
};

export type WorkforceSummaryReport = {
  workforceTotal: number;
  recruitedTotal: number;
  generatedAtIso: string;
};

export type WorkforceGroupedReportItem = {
  bucket: string;
  workforceTotal: number;
  recruitedTotal: number;
};

export type WorkforceExportJob = {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'deferred';
  exportType: string;
  createdByUserId: string;
  createdAtIso: string;
  completedAtIso: string | null;
};
