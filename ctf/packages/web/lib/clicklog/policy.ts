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
