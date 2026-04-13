export type IncidentMetadata = {
  latitude?: number;
  longitude?: number;
  notes?: string;
};

export type ClicklogIncident = {
  id: string;
  user_id: string | null;
  metadata: IncidentMetadata;
  created_at: string;
};

export type CreateIncidentInput = {
  userId: string;
  metadata: IncidentMetadata;
};
