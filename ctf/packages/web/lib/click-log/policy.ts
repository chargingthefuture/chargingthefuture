export function canCreateIncident(userId: string | null): boolean {
  return !!userId;
}

export function canViewIncidents(userId: string | null, targetUserId: string, isAdmin: boolean): boolean {
  if (!userId) return false;
  return isAdmin || userId === targetUserId;
}

export function canDeleteIncident(userId: string | null, incidentOwnerId: string, isAdmin: boolean): boolean {
  if (!userId) return false;
  return isAdmin || userId === incidentOwnerId;
}

// Only the member who logged an incident may change whether it is shared with the owner.
// Deliberately no admin override: consent belongs to the member alone.
export function canToggleIncidentShare(userId: string | null, incidentOwnerId: string): boolean {
  if (!userId) return false;
  return userId === incidentOwnerId;
}

// Only the member who logged an incident may edit its note and tags. Deliberately no admin
// override: the note is the member's private content. The date and location are immutable —
// editing covers note and tags only (owner decision, 2026-08-13).
export function canEditIncident(userId: string | null, incidentOwnerId: string): boolean {
  if (!userId) return false;
  return userId === incidentOwnerId;
}

// The aggregate trends view is owner/admin-only.
export function canViewSharedTrends(isAdmin: boolean): boolean {
  return isAdmin;
}
